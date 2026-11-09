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
    private lazy var silentWav: Data = makeSilentWav()

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

            default:
                break
            }
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
            player.play()
        } catch {
            print("NativeAudioCoach player error: \(error)")
            playNextInQueue()
        }
    }

    private func finishSessionAfterPlayback() {
        let session = AVAudioSession.sharedInstance()
        if currentDuckMode {
            keepAlivePlayer?.pause()
            try? session.setActive(false, options: [.notifyOthersOnDeactivation])
            if isWorkoutActive {
                audioQueue.asyncAfter(deadline: .now() + 0.08) { [weak self] in
                    guard let self = self, self.currentPlayer == nil, self.isWorkoutActive else { return }
                    self.activateKeepAliveSession()
                }
            }
        } else {
            if isWorkoutActive {
                activateKeepAliveSession()
            } else {
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
                player.volume = 0.0
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
