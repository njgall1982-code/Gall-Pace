import Foundation
import WatchConnectivity
import HealthKit

final class WatchSessionManager: NSObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    private let healthStore = HKHealthStore()
    private var isSessionActivated = false
    private var lastSentPayload: [String: Any]?

    override init() {
        super.init()
    }

    func start() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
        requestHealthKitPermissions()
    }

    func requestHealthKitPermissions() {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType()
        ]

        var typesToRead: Set<HKObjectType> = [
            HKObjectType.workoutType()
        ]
        if let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate) {
            typesToRead.insert(heartRate)
        }
        if let activeEnergy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            typesToRead.insert(activeEnergy)
        }
        if let distance = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) {
            typesToRead.insert(distance)
        }

        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { success, error in
            if let error = error {
                print("[WatchSessionManager] HealthKit authorization error: \(error.localizedDescription)")
            } else {
                print("[WatchSessionManager] HealthKit authorization granted: \(success)")
            }
        }
    }

    func launchWatchApp() {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        let config = HKWorkoutConfiguration()
        config.activityType = .running
        config.locationType = .outdoor

        healthStore.startWatchApp(with: config) { success, error in
            if success {
                print("[WatchSessionManager] Successfully signaled watch app to launch")
            } else {
                print("[WatchSessionManager] Failed to launch watch app: \(error?.localizedDescription ?? "unknown error")")
            }
        }
    }

    func sendWorkoutState(
        phase: String,
        secondsLeft: Int,
        currentBlockTotal: Int,
        totalRemaining: Int,
        isRunning: Bool,
        isPaused: Bool,
        isCompleted: Bool,
        currentIdx: Int,
        totalIntervals: Int,
        workoutTitle: String
    ) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        let payload: [String: Any] = [
            "action": "stateUpdate",
            "phase": phase,
            "secondsLeft": secondsLeft,
            "currentBlockTotal": currentBlockTotal,
            "totalRemaining": totalRemaining,
            "isRunning": isRunning,
            "isPaused": isPaused,
            "isCompleted": isCompleted,
            "currentIdx": currentIdx,
            "totalIntervals": totalIntervals,
            "workoutTitle": workoutTitle,
            "timestamp": Date().timeIntervalSince1970
        ]

        lastSentPayload = payload

        // 1. Fast direct transmission if the watch is actively running in foreground
        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil) { error in
                print("[WatchSessionManager] SendMessage error: \(error.localizedDescription)")
            }
        }

        // 2. Guaranteed delivery on wake via application context
        do {
            try session.updateApplicationContext(payload)
        } catch {
            print("[WatchSessionManager] updateApplicationContext error: \(error.localizedDescription)")
        }
    }

    func sendWorkoutEnded() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        let payload: [String: Any] = [
            "action": "workoutEnded",
            "isRunning": false,
            "isPaused": false,
            "isCompleted": false,
            "timestamp": Date().timeIntervalSince1970
        ]

        lastSentPayload = payload

        if session.isReachable {
            session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
        }
        try? session.updateApplicationContext(payload)
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        isSessionActivated = (activationState == .activated)
        if isSessionActivated, let payload = lastSentPayload {
            try? session.updateApplicationContext(payload)
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        // Required for switching watches or re-pairing
        WCSession.default.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        handleIncomingWatchCommand(message)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        handleIncomingWatchCommand(message)
        replyHandler(["status": "acknowledged"])
    }

    private func handleIncomingWatchCommand(_ message: [String: Any]) {
        guard let command = message["command"] as? String else { return }

        DispatchQueue.main.async {
            switch command {
            case "pause":
                NativeAudioCoach.shared.handlePauseWorkout()
            case "resume":
                NativeAudioCoach.shared.handleResumeWorkout()
            case "skipNext":
                NativeAudioCoach.shared.handleSkipNextWorkout()
            case "skipPrev":
                NativeAudioCoach.shared.handleSkipPrevWorkout()
            case "stop":
                NativeAudioCoach.shared.handleStopWorkout()
            case "addSeconds":
                let sec = (message["seconds"] as? Int) ?? 30
                NativeAudioCoach.shared.handleAddSecondsWorkout(sec)
            case "requestState":
                NativeAudioCoach.shared.notifyWorkoutState()
            default:
                break
            }
        }
    }
}

