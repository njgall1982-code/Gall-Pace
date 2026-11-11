import UIKit
import WebKit
import AVFoundation
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CoachBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        NativeAudioCoach.shared.handleAppForeground()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        NativeAudioCoach.shared.handleAppForeground()
    }
}

class CoachBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        registerHandler()
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        registerHandler()
    }

    private func registerHandler() {
        guard let webView = self.webView else { return }
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nativeAudioCoach")
        webView.configuration.userContentController.add(self, name: "nativeAudioCoach")
        NativeAudioCoach.shared.webView = webView
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeAudioCoach",
              let body = message.body as? [String: Any] else { return }
        NativeAudioCoach.shared.handleMessage(body)
    }
}

final class NativeAudioCoach: NSObject, AVAudioPlayerDelegate {
    static let shared = NativeAudioCoach()

    weak var webView: WKWebView?

    private let audioQueue = DispatchQueue(label: "com.intervalcoach.nativeaudio", qos: .userInitiated)
    private var currentPlayer: AVAudioPlayer?
    private var keepAlivePlayer: AVAudioPlayer?
    private var isWorkoutActive: Bool = false
    private var currentDuckMode: Bool = true
    private var playbackQueue: [PlaybackItem] = []
    private var currentRequestId: Int?

    private lazy var preCueChimeWav: Data = makePreCueChimeWav()
    private lazy var normalBeepWav: Data = makeCountdownBeepWav(isFinal: false)
    private lazy var finalBeepWav: Data = makeCountdownBeepWav(isFinal: true)
    private lazy var completionChimeWav: Data = makeCompletionChimeWav()
    private lazy var shortGapWav: Data = makeToneWav(notes: [], totalDuration: 0.12)
    private lazy var silentWav: Data = makeSilentWav()

    struct WorkoutInterval {
        let phase: String
        let duration: Int
        let startClips: [String]
        let warningClip: String?
    }

    struct WorkoutConfig {
        let title: String
        let voiceId: String
        let rate: Float
        let volume: Float
        let duck: Bool
        let chimeEnabled: Bool
        let tenSecondWarningEnabled: Bool
        let countdownEnabled: Bool
        let workoutHalfwayEnabled: Bool
        let silentStart: Bool
    }

    private var workoutConfig: WorkoutConfig?
    private var workoutIntervals: [WorkoutInterval] = []
    private var currentIdx: Int = 0
    private var currentBlockTotal: Int = 60
    private var secondsLeft: Int = 60
    private var blockEndTime: Date?
    private var isWorkoutRunning: Bool = false
    private var isWorkoutPaused: Bool = false
    private var isWorkoutCompleted: Bool = false
    private var isMuted: Bool = false
    private var announcedTenSec: Bool = false
    private var beepsCounted: Set<Int> = []
    private var workoutHalfwayTarget: Int = 0
    private var workoutHalfwayAnnounced: Bool = false
    private var wasInterruptedByPause: Bool = false
    private var totalTime: Int = 0
    private var runTime: Int = 0
    private var walkTime: Int = 0
    private var completedIntervals: Int = 0
    private var workoutTimer: DispatchSourceTimer?

    override init() {
        super.init()
        let center = NotificationCenter.default
        center.addObserver(
            self,
            selector: #selector(handleAudioInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
        center.addObserver(
            self,
            selector: #selector(handleAudioRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleAudioInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeRaw = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeRaw) else { return }

        if type == .ended {
            audioQueue.async { [weak self] in
                guard let self = self else { return }
                if self.currentPlayer != nil && self.currentPlayer?.isPlaying == false {
                    self.currentPlayer = nil
                    self.playbackQueue.removeAll()
                    self.finishSessionAfterPlayback()
                } else if self.isWorkoutActive {
                    self.activateKeepAliveSession()
                }
            }
        }
    }

    @objc private func handleAudioRouteChange(_ notification: Notification) {
        audioQueue.async { [weak self] in
            guard let self = self else { return }
            if self.isWorkoutActive && self.currentPlayer == nil && self.keepAlivePlayer?.isPlaying == false {
                self.activateKeepAliveSession()
            }
        }
    }

    func handleAppForeground() {
        audioQueue.async { [weak self] in
            guard let self = self else { return }
            if self.isWorkoutActive && self.currentPlayer == nil {
                self.activateKeepAliveSession()
            }
            if self.workoutConfig != nil || self.isWorkoutCompleted {
                self.notifyWorkoutState()
            }
        }
    }

    enum PlaybackItem {
        case wavData(Data, volume: Float)
        case fileURL(URL, rate: Float, volume: Float)
    }

    struct ToneNote {
        let freq: Double
        let start: Double
        let duration: Double
        let amp: Double
    }

    func handleMessage(_ body: [String: Any]) {
        guard let action = body["action"] as? String else { return }

        audioQueue.async { [weak self] in
            guard let self = self else { return }

            switch action {
            case "playClips":
                let voiceId = (body["voiceId"] as? String) ?? "us-andrew"
                let clips = (body["clips"] as? [String]) ?? []
                let withChime = (body["withChime"] as? Bool) ?? false
                let rate = Float((body["rate"] as? Double) ?? 1.0)
                let volume = Float((body["volume"] as? Double) ?? 1.0)
                let sessionMode = (body["sessionMode"] as? String) ?? "transient"
                let requestId = body["requestId"] as? Int
                let shouldDuck = (sessionMode == "transient" || sessionMode == "duck")

                var items: [PlaybackItem] = []
                if withChime {
                    items.append(.wavData(self.preCueChimeWav, volume: 0.45))
                }
                for clipKey in clips {
                    if let url = self.findVoiceClipURL(voiceId: voiceId, clipKey: clipKey) {
                        items.append(.fileURL(url, rate: rate, volume: min(1.0, volume)))
                    }
                }
                self.startQueue(items: items, duck: shouldDuck, requestId: requestId)

            case "playChime":
                self.startQueue(items: [.wavData(self.preCueChimeWav, volume: 0.45)], duck: false, requestId: nil)

            case "playBeep":
                let isFinal = (body["isFinal"] as? Bool) ?? false
                let wav = isFinal ? self.finalBeepWav : self.normalBeepWav
                let vol: Float = isFinal ? 0.55 : 0.40
                self.startQueue(items: [.wavData(wav, volume: vol)], duck: false, requestId: nil)

            case "playCompletionChime":
                self.startQueue(items: [.wavData(self.completionChimeWav, volume: 0.55)], duck: false, requestId: nil)

            case "startWorkoutKeepAlive":
                self.isWorkoutActive = true
                if self.currentPlayer == nil {
                    self.activateKeepAliveSession()
                }

            case "stopWorkoutKeepAlive":
                self.isWorkoutActive = false
                self.keepAlivePlayer?.stop()
                self.keepAlivePlayer = nil
                if self.currentPlayer == nil {
                    try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
                }

            case "stopAll":
                self.currentPlayer?.stop()
                self.currentPlayer = nil
                self.playbackQueue.removeAll()
                self.finishSessionAfterPlayback()

            case "startWorkout":
                self.handleStartWorkout(body)

            case "pauseWorkout":
                self.handlePauseWorkout()

            case "resumeWorkout":
                self.handleResumeWorkout()

            case "skipNextWorkout":
                self.handleSkipNextWorkout()

            case "skipPrevWorkout":
                self.handleSkipPrevWorkout()

            case "addSecondsWorkout":
                let delta = (body["seconds"] as? Int) ?? 30
                self.handleAddSecondsWorkout(delta)

            case "setMutedWorkout":
                let muted = (body["isMuted"] as? Bool) ?? false
                self.handleSetMutedWorkout(muted)

            case "stopWorkout":
                self.handleStopWorkout()

            case "getWorkoutState":
                if self.workoutConfig != nil || self.isWorkoutCompleted {
                    self.notifyWorkoutState()
                }

            default:
                break
            }
        }
    }

    private func handleStartWorkout(_ body: [String: Any]) {
        guard let rawIntervals = body["intervals"] as? [[String: Any]], !rawIntervals.isEmpty else { return }

        let parsedIntervals: [WorkoutInterval] = rawIntervals.map { item in
            let phase = (item["phase"] as? String) ?? "run"
            let duration = max(1, (item["duration"] as? Int) ?? 60)
            let startClips = (item["startClips"] as? [String]) ?? ["run_60_1m"]
            let warningClip = item["warningClip"] as? String
            return WorkoutInterval(phase: phase, duration: duration, startClips: startClips, warningClip: warningClip)
        }

        let voiceId = (body["voiceId"] as? String) ?? "us-andrew"
        let rate = Float((body["rate"] as? Double) ?? 1.0)
        let volume = Float((body["volume"] as? Double) ?? 1.0)
        let sessionMode = (body["sessionMode"] as? String) ?? "transient"
        let duck = (sessionMode == "transient" || sessionMode == "duck")

        let config = WorkoutConfig(
            title: (body["workoutTitle"] as? String) ?? "Workout",
            voiceId: voiceId,
            rate: rate,
            volume: volume,
            duck: duck,
            chimeEnabled: (body["chimeEnabled"] as? Bool) ?? true,
            tenSecondWarningEnabled: (body["tenSecondWarningEnabled"] as? Bool) ?? true,
            countdownEnabled: (body["countdownEnabled"] as? Bool) ?? true,
            workoutHalfwayEnabled: (body["workoutHalfwayEnabled"] as? Bool) ?? true,
            silentStart: (body["silentStart"] as? Bool) ?? false
        )

        stopWorkoutTimer()
        currentPlayer?.stop()
        currentPlayer = nil
        playbackQueue.removeAll()

        workoutConfig = config
        workoutIntervals = parsedIntervals
        currentIdx = 0
        currentBlockTotal = parsedIntervals[0].duration
        secondsLeft = currentBlockTotal
        blockEndTime = Date().addingTimeInterval(TimeInterval(currentBlockTotal))
        isWorkoutRunning = true
        isWorkoutPaused = false
        isWorkoutCompleted = false
        isWorkoutActive = true
        isMuted = (body["isMuted"] as? Bool) ?? false
        announcedTenSec = false
        beepsCounted.removeAll()
        wasInterruptedByPause = false
        totalTime = 0
        runTime = 0
        walkTime = 0
        completedIntervals = 0

        let totalWorkoutSec = parsedIntervals.reduce(0) { $0 + $1.duration }
        workoutHalfwayTarget = totalWorkoutSec / 2
        workoutHalfwayAnnounced = false

        activateKeepAliveSession()
        startWorkoutTimer()

        if !isMuted && !config.silentStart {
            playWorkoutCue(clips: parsedIntervals[0].startClips, withChime: config.chimeEnabled, config: config)
        }

        notifyWorkoutState()
    }

    private func handlePauseWorkout() {
        guard isWorkoutRunning, !isWorkoutPaused else { return }
        if let endTime = blockEndTime {
            let remaining = max(0, Int(ceil(endTime.timeIntervalSinceNow)))
            if remaining < secondsLeft && currentIdx < workoutIntervals.count {
                let delta = secondsLeft - remaining
                let phase = workoutIntervals[currentIdx].phase
                totalTime += delta
                if phase == "run" || phase == "sprint" {
                    runTime += delta
                } else {
                    walkTime += delta
                }
                secondsLeft = remaining
            }
        }
        isWorkoutPaused = true
        stopWorkoutTimer()
        wasInterruptedByPause = (currentPlayer != nil)
        currentPlayer?.stop()
        currentPlayer = nil
        playbackQueue.removeAll()
        finishSessionAfterPlayback()
        notifyWorkoutState()
    }

    private func handleResumeWorkout() {
        guard isWorkoutRunning, isWorkoutPaused, let config = workoutConfig else { return }
        isWorkoutPaused = false
        blockEndTime = Date().addingTimeInterval(TimeInterval(secondsLeft))
        activateKeepAliveSession()
        startWorkoutTimer()

        if wasInterruptedByPause && !isMuted && currentIdx < workoutIntervals.count {
            wasInterruptedByPause = false
            playWorkoutCue(clips: workoutIntervals[currentIdx].startClips, withChime: config.chimeEnabled, config: config)
        } else {
            wasInterruptedByPause = false
        }
        notifyWorkoutState()
    }

    private func handleSkipNextWorkout() {
        guard isWorkoutRunning, let config = workoutConfig, currentIdx < workoutIntervals.count - 1 else { return }
        currentIdx += 1
        let nextInt = workoutIntervals[currentIdx]
        currentBlockTotal = nextInt.duration
        secondsLeft = currentBlockTotal
        blockEndTime = isWorkoutPaused ? nil : Date().addingTimeInterval(TimeInterval(currentBlockTotal))
        announcedTenSec = false
        beepsCounted.removeAll()
        wasInterruptedByPause = false

        if !isMuted {
            playWorkoutCue(clips: nextInt.startClips, withChime: config.chimeEnabled, config: config)
        }
        notifyWorkoutState()
    }

    private func handleSkipPrevWorkout() {
        guard isWorkoutRunning, let config = workoutConfig else { return }
        if secondsLeft < currentBlockTotal - 3 {
            secondsLeft = currentBlockTotal
            blockEndTime = isWorkoutPaused ? nil : Date().addingTimeInterval(TimeInterval(currentBlockTotal))
            announcedTenSec = false
            beepsCounted.removeAll()
            wasInterruptedByPause = false
            if !isMuted && currentIdx < workoutIntervals.count {
                playWorkoutCue(clips: workoutIntervals[currentIdx].startClips, withChime: config.chimeEnabled, config: config)
            }
            notifyWorkoutState()
        } else if currentIdx > 0 {
            currentIdx -= 1
            let prevInt = workoutIntervals[currentIdx]
            currentBlockTotal = prevInt.duration
            secondsLeft = currentBlockTotal
            blockEndTime = isWorkoutPaused ? nil : Date().addingTimeInterval(TimeInterval(currentBlockTotal))
            announcedTenSec = false
            beepsCounted.removeAll()
            wasInterruptedByPause = false
            if !isMuted {
                playWorkoutCue(clips: prevInt.startClips, withChime: config.chimeEnabled, config: config)
            }
            notifyWorkoutState()
        }
    }

    private func handleAddSecondsWorkout(_ delta: Int) {
        guard isWorkoutRunning, delta > 0 else { return }
        secondsLeft += delta
        currentBlockTotal += delta
        if !isWorkoutPaused {
            blockEndTime = Date().addingTimeInterval(TimeInterval(secondsLeft))
        }
        notifyWorkoutState()
    }

    private func handleSetMutedWorkout(_ muted: Bool) {
        isMuted = muted
        if muted {
            currentPlayer?.stop()
            currentPlayer = nil
            playbackQueue.removeAll()
            finishSessionAfterPlayback()
        } else if isWorkoutRunning, !isWorkoutPaused, let config = workoutConfig, currentIdx < workoutIntervals.count {
            playWorkoutCue(clips: workoutIntervals[currentIdx].startClips, withChime: config.chimeEnabled, config: config)
        }
        notifyWorkoutState()
    }

    private func handleStopWorkout() {
        stopWorkoutTimer()
        isWorkoutRunning = false
        isWorkoutPaused = false
        isWorkoutCompleted = false
        isWorkoutActive = false
        workoutConfig = nil
        workoutIntervals = []
        blockEndTime = nil
        currentPlayer?.stop()
        currentPlayer = nil
        playbackQueue.removeAll()
        keepAlivePlayer?.stop()
        keepAlivePlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private func startWorkoutTimer() {
        stopWorkoutTimer()
        let timer = DispatchSource.makeTimerSource(queue: audioQueue)
        timer.schedule(deadline: .now() + 0.25, repeating: 0.25, leeway: .milliseconds(40))
        timer.setEventHandler { [weak self] in
            self?.tickWorkout()
        }
        workoutTimer = timer
        timer.resume()
    }

    private func stopWorkoutTimer() {
        workoutTimer?.cancel()
        workoutTimer = nil
    }

    private func tickWorkout() {
        guard isWorkoutRunning,
              !isWorkoutPaused,
              !isWorkoutCompleted,
              let config = workoutConfig,
              let endTime = blockEndTime,
              currentIdx < workoutIntervals.count else { return }

        let now = Date()
        let computedRemaining = max(0, Int(ceil(endTime.timeIntervalSince(now))))
        if computedRemaining == secondsLeft {
            return
        }

        let delta = max(0, secondsLeft - computedRemaining)
        if delta > 0 {
            let phase = workoutIntervals[currentIdx].phase
            totalTime += delta
            if phase == "run" || phase == "sprint" {
                runTime += delta
            } else {
                walkTime += delta
            }
        }
        secondsLeft = computedRemaining

        if computedRemaining <= 0 {
            completedIntervals += 1
            if currentIdx >= workoutIntervals.count - 1 {
                isWorkoutRunning = false
                isWorkoutPaused = false
                isWorkoutCompleted = true
                stopWorkoutTimer()
                isWorkoutActive = false

                if !isMuted {
                    var items: [PlaybackItem] = []
                    if config.countdownEnabled {
                        items.append(.wavData(finalBeepWav, volume: 0.55))
                        items.append(.wavData(shortGapWav, volume: 0.01))
                    }
                    items.append(.wavData(completionChimeWav, volume: 0.55))
                    items.append(.wavData(shortGapWav, volume: 0.01))
                    if let completeURL = findVoiceClipURL(voiceId: config.voiceId, clipKey: "complete") {
                        items.append(.fileURL(completeURL, rate: config.rate, volume: min(1.0, config.volume)))
                    }
                    startQueue(items: items, duck: config.duck, requestId: nil)
                } else {
                    keepAlivePlayer?.stop()
                    keepAlivePlayer = nil
                    try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
                }
                notifyWorkoutState()
                return
            } else {
                currentIdx += 1
                let nextInt = workoutIntervals[currentIdx]
                currentBlockTotal = nextInt.duration
                secondsLeft = currentBlockTotal
                blockEndTime = now.addingTimeInterval(TimeInterval(currentBlockTotal))
                announcedTenSec = false
                beepsCounted.removeAll()
                wasInterruptedByPause = false

                if !isMuted {
                    var items: [PlaybackItem] = []
                    if config.countdownEnabled {
                        items.append(.wavData(finalBeepWav, volume: 0.55))
                        items.append(.wavData(shortGapWav, volume: 0.01))
                    }
                    if config.chimeEnabled {
                        items.append(.wavData(preCueChimeWav, volume: 0.45))
                    }
                    for clipKey in nextInt.startClips {
                        if let url = findVoiceClipURL(voiceId: config.voiceId, clipKey: clipKey) {
                            items.append(.fileURL(url, rate: config.rate, volume: min(1.0, config.volume)))
                        }
                    }
                    startQueue(items: items, duck: config.duck, requestId: nil)
                }
                notifyWorkoutState()
                return
            }
        }

        if !isMuted,
           config.workoutHalfwayEnabled,
           !workoutHalfwayAnnounced,
           totalTime >= workoutHalfwayTarget,
           currentPlayer == nil,
           computedRemaining > 12,
           computedRemaining < currentBlockTotal - 4 {
            workoutHalfwayAnnounced = true
            playWorkoutCue(clips: ["workout_halfway"], withChime: config.chimeEnabled, config: config)
        }

        if !isMuted,
           config.tenSecondWarningEnabled,
           computedRemaining <= 10,
           computedRemaining >= 8,
           !announcedTenSec,
           currentIdx < workoutIntervals.count - 1,
           let warnClip = workoutIntervals[currentIdx].warningClip {
            announcedTenSec = true
            playWorkoutCue(clips: [warnClip], withChime: config.chimeEnabled, config: config)
        }

        if !isMuted,
           config.countdownEnabled,
           (computedRemaining == 3 || computedRemaining == 2 || computedRemaining == 1),
           !beepsCounted.contains(computedRemaining) {
            beepsCounted.insert(computedRemaining)
            startQueue(items: [.wavData(normalBeepWav, volume: 0.40)], duck: false, requestId: nil)
        }

        notifyWorkoutState()
    }

    private func playWorkoutCue(clips: [String], withChime: Bool, config: WorkoutConfig) {
        var items: [PlaybackItem] = []
        if withChime {
            items.append(.wavData(preCueChimeWav, volume: 0.45))
        }
        for clipKey in clips {
            if let url = findVoiceClipURL(voiceId: config.voiceId, clipKey: clipKey) {
                items.append(.fileURL(url, rate: config.rate, volume: min(1.0, config.volume)))
            }
        }
        startQueue(items: items, duck: config.duck, requestId: nil)
    }

    private func notifyWorkoutState() {
        let payload: [String: Any] = [
            "currentIdx": currentIdx,
            "secondsLeft": secondsLeft,
            "currentBlockTotal": currentBlockTotal,
            "isRunning": isWorkoutRunning && !isWorkoutPaused,
            "isPaused": isWorkoutPaused,
            "isCompleted": isWorkoutCompleted,
            "isMuted": isMuted,
            "totalTime": totalTime,
            "runTime": runTime,
            "walkTime": walkTime,
            "completedIntervals": completedIntervals
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let jsonString = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(
                "window.__onNativeWorkoutState && window.__onNativeWorkoutState(\(jsonString));",
                completionHandler: nil
            )
        }
    }

    private func startQueue(items: [PlaybackItem], duck: Bool, requestId: Int?) {
        currentPlayer?.stop()
        currentPlayer = nil
        playbackQueue = items
        currentDuckMode = duck
        currentRequestId = requestId

        guard !playbackQueue.isEmpty else {
            notifyJavaScriptEnded(requestId: requestId)
            return
        }

        if duck {
            keepAlivePlayer?.pause()
        }

        let session = AVAudioSession.sharedInstance()
        let options: AVAudioSession.CategoryOptions = duck
            ? [.mixWithOthers, .duckOthers]
            : [.mixWithOthers]
        do {
            try session.setCategory(.playback, mode: .default, options: options)
            try session.setActive(true)
        } catch {
            print("NativeAudioCoach session error: \(error)")
        }

        playNextInQueue()
    }

    private func playNextInQueue() {
        guard !playbackQueue.isEmpty else {
            currentPlayer = nil
            let finishedReqId = currentRequestId
            currentRequestId = nil
            finishSessionAfterPlayback()
            notifyJavaScriptEnded(requestId: finishedReqId)
            return
        }

        let nextItem = playbackQueue.removeFirst()
        do {
            let player: AVAudioPlayer
            switch nextItem {
            case .wavData(let data, let volume):
                player = try AVAudioPlayer(data: data)
                player.volume = volume
            case .fileURL(let url, let rate, let volume):
                player = try AVAudioPlayer(contentsOf: url)
                player.enableRate = true
                player.rate = max(0.5, min(2.0, rate))
                player.volume = volume
            }
            player.delegate = self
            player.prepareToPlay()
            currentPlayer = player
            if !player.play() {
                currentPlayer = nil
                playNextInQueue()
            }
        } catch {
            print("NativeAudioCoach player error: \(error)")
            playNextInQueue()
        }
    }

    private func finishSessionAfterPlayback() {
        let session = AVAudioSession.sharedInstance()
        if currentDuckMode {
            if isWorkoutActive {
                DispatchQueue.main.async { [weak self] in
                    var bgTaskId: UIBackgroundTaskIdentifier = .invalid
                    let endBgTask = {
                        DispatchQueue.main.async {
                            if bgTaskId != .invalid {
                                UIApplication.shared.endBackgroundTask(bgTaskId)
                                bgTaskId = .invalid
                            }
                        }
                    }
                    bgTaskId = UIApplication.shared.beginBackgroundTask(withName: "UnduckAudioSession") {
                        endBgTask()
                    }
                    self?.audioQueue.async { [weak self] in
                        guard let self = self else {
                            endBgTask()
                            return
                        }
                        if self.currentPlayer == nil {
                            self.keepAlivePlayer?.pause()
                            try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
                        }
                        self.audioQueue.asyncAfter(deadline: .now() + 0.08) { [weak self] in
                            if let self = self, self.currentPlayer == nil, self.isWorkoutActive {
                                self.activateKeepAliveSession()
                            }
                            endBgTask()
                        }
                    }
                }
            } else {
                keepAlivePlayer?.stop()
                keepAlivePlayer = nil
                try? session.setActive(false, options: [.notifyOthersOnDeactivation])
            }
        } else {
            if isWorkoutActive {
                activateKeepAliveSession()
            } else {
                keepAlivePlayer?.stop()
                keepAlivePlayer = nil
                try? session.setActive(false, options: [.notifyOthersOnDeactivation])
            }
        }
    }

    private func activateKeepAliveSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            if keepAlivePlayer == nil {
                let player = try AVAudioPlayer(data: silentWav)
                player.numberOfLoops = -1
                player.volume = 0.01
                player.prepareToPlay()
                keepAlivePlayer = player
            }
            if keepAlivePlayer?.isPlaying == false {
                keepAlivePlayer?.play()
            }
        } catch {
            print("KeepAlive error: \(error)")
        }
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        audioQueue.async { [weak self] in
            guard let self = self else { return }
            if player === self.currentPlayer {
                self.playNextInQueue()
            }
        }
    }

    private func notifyJavaScriptEnded(requestId: Int?) {
        guard let reqId = requestId else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript("window.__onNativeAudioEnded && window.__onNativeAudioEnded(\(reqId));", completionHandler: nil)
        }
    }

    private func findVoiceClipURL(voiceId: String, clipKey: String) -> URL? {
        if let resourceRoot = Bundle.main.resourceURL {
            let directURL = resourceRoot
                .appendingPathComponent("public")
                .appendingPathComponent("voices")
                .appendingPathComponent(voiceId)
                .appendingPathComponent("\(clipKey).mp3")
            if FileManager.default.fileExists(atPath: directURL.path) {
                return directURL
            }
        }
        if let url = Bundle.main.url(forResource: clipKey, withExtension: "mp3", subdirectory: "public/voices/\(voiceId)") {
            return url
        }
        return nil
    }

    private func makePreCueChimeWav() -> Data {
        return makeToneWav(
            notes: [
                ToneNote(freq: 587.33, start: 0.0, duration: 0.24, amp: 0.35),
                ToneNote(freq: 880.0, start: 0.09, duration: 0.32, amp: 0.40)
            ],
            totalDuration: 0.43
        )
    }

    private func makeCountdownBeepWav(isFinal: Bool) -> Data {
        let freq = isFinal ? 1174.66 : 880.0
        let dur = isFinal ? 0.22 : 0.12
        let amp = isFinal ? 0.45 : 0.35
        return makeToneWav(
            notes: [ToneNote(freq: freq, start: 0.0, duration: dur, amp: amp)],
            totalDuration: dur + 0.02
        )
    }

    private func makeCompletionChimeWav() -> Data {
        let freqs = [523.25, 659.25, 783.99, 1046.5]
        let notes = freqs.enumerated().map { idx, f in
            ToneNote(freq: f, start: Double(idx) * 0.11, duration: 0.45, amp: 0.35)
        }
        return makeToneWav(notes: notes, totalDuration: 0.85)
    }

    private func makeSilentWav() -> Data {
        return makeToneWav(notes: [], totalDuration: 1.0)
    }

    private func makeToneWav(notes: [ToneNote], totalDuration: Double) -> Data {
        let sampleRate = 22050
        let numSamples = max(1, Int(Double(sampleRate) * totalDuration))
        let dataSize = numSamples * 2
        let fileSize = 36 + dataSize

        var data = Data(capacity: 44 + dataSize)
        data.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // "RIFF"
        var riffSize = UInt32(fileSize).littleEndian
        withUnsafeBytes(of: &riffSize) { data.append(contentsOf: $0) }
        data.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // "WAVE"
        data.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // "fmt "

        var fmtChunkSize = UInt32(16).littleEndian
        var audioFormat = UInt16(1).littleEndian
        var numChannels = UInt16(1).littleEndian
        var sr = UInt32(sampleRate).littleEndian
        var byteRate = UInt32(sampleRate * 2).littleEndian
        var blockAlign = UInt16(2).littleEndian
        var bitsPerSample = UInt16(16).littleEndian

        withUnsafeBytes(of: &fmtChunkSize) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: &audioFormat) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: &numChannels) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: &sr) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: &byteRate) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: &blockAlign) { data.append(contentsOf: $0) }
        withUnsafeBytes(of: &bitsPerSample) { data.append(contentsOf: $0) }

        data.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // "data"
        var subchunk2Size = UInt32(dataSize).littleEndian
        withUnsafeBytes(of: &subchunk2Size) { data.append(contentsOf: $0) }

        for i in 0..<numSamples {
            let t = Double(i) / Double(sampleRate)
            var sampleVal = 0.0
            for note in notes {
                if t >= note.start && t <= (note.start + note.duration) {
                    let localT = t - note.start
                    let attack = min(1.0, localT / 0.012)
                    let decay = pow(0.001, localT / note.duration)
                    let env = attack * decay
                    sampleVal += sin(2.0 * Double.pi * note.freq * localT) * note.amp * env
                }
            }
            let clamped = max(-1.0, min(1.0, sampleVal))
            var pcm = Int16(clamped * 32767.0).littleEndian
            withUnsafeBytes(of: &pcm) { data.append(contentsOf: $0) }
        }
        return data
    }
}
