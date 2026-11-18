import Foundation
import SwiftUI
import Combine
import WatchKit
import WatchConnectivity
import HealthKit

final class WatchWorkoutManager: NSObject, ObservableObject, WCSessionDelegate, HKWorkoutSessionDelegate, HKLiveWorkoutBuilderDelegate {
    static let shared = WatchWorkoutManager()

    // Published workout state from iPhone
    @Published var phase: String = "ready"
    @Published var secondsLeft: Int = 0
    @Published var currentBlockTotal: Int = 60
    @Published var totalRemaining: Int = 0
    @Published var isRunning: Bool = false
    @Published var isPaused: Bool = false
    @Published var isCompleted: Bool = false
    @Published var currentIdx: Int = 0
    @Published var totalIntervals: Int = 0
    @Published var workoutTitle: String = "Interval Run"
    @Published var isPhoneReachable: Bool = false

    // Live HealthKit metrics
    @Published var heartRate: Double = 0.0
    @Published var activeCalories: Double = 0.0

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var workoutBuilder: HKLiveWorkoutBuilder?

    private var previousPhase: String = "ready"
    private var lastHapticCountdownSec: Int = -1

    override init() {
        super.init()
        setupWatchConnectivity()
        requestHealthKitAuthorization()
    }

    // MARK: - Watch Connectivity Setup

    private func setupWatchConnectivity() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    // MARK: - HealthKit Workout Setup (watchOS 8.0+)

    private func requestHealthKitAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType()
        ]

        var typesToRead: Set<HKObjectType> = [
            HKObjectType.workoutType()
        ]
        if let heartRateType = HKObjectType.quantityType(forIdentifier: .heartRate) {
            typesToRead.insert(heartRateType)
        }
        if let calorieType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            typesToRead.insert(calorieType)
        }
        if let distanceType = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) {
            typesToRead.insert(distanceType)
        }

        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { _, _ in }
    }

    func startHealthKitWorkoutSession(with existingConfig: HKWorkoutConfiguration? = nil) {
        guard HKHealthStore.isHealthDataAvailable(), workoutSession == nil else { return }

        let config: HKWorkoutConfiguration
        if let existingConfig = existingConfig {
            config = existingConfig
        } else {
            config = HKWorkoutConfiguration()
            config.activityType = .running
            config.locationType = .outdoor
        }

        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            let builder = session.associatedWorkoutBuilder()

            session.delegate = self
            builder.delegate = self
            builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)

            self.workoutSession = session
            self.workoutBuilder = builder

            let startDate = Date()
            session.startActivity(with: startDate)
            builder.beginCollection(withStart: startDate) { _, _ in }
        } catch {
            print("[WatchWorkoutManager] Failed to start workout session: \(error.localizedDescription)")
        }
    }

    func endHealthKitWorkoutSession() {
        guard let session = workoutSession, let builder = workoutBuilder else { return }

        session.end()
        let endDate = Date()
        builder.endCollection(withEnd: endDate) { [weak self] _, _ in
            builder.finishWorkout { _, _ in
                DispatchQueue.main.async {
                    self?.workoutSession = nil
                    self?.workoutBuilder = nil
                }
            }
        }
    }

    // MARK: - State Handling & Haptics

    nonisolated func applyStateDictionary(_ dict: [String: Any]) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            if let action = dict["action"] as? String, action == "workoutEnded" {
                self.resetToReady()
                return
            }

            let newPhase = (dict["phase"] as? String) ?? self.phase
            let newSecLeft = (dict["secondsLeft"] as? Int) ?? self.secondsLeft
            let newBlockTotal = (dict["currentBlockTotal"] as? Int) ?? self.currentBlockTotal
            let newTotalRemaining = (dict["totalRemaining"] as? Int) ?? self.totalRemaining
            let newIsRunning = (dict["isRunning"] as? Bool) ?? self.isRunning
            let newIsPaused = (dict["isPaused"] as? Bool) ?? self.isPaused
            let newIsCompleted = (dict["isCompleted"] as? Bool) ?? false
            let newIdx = (dict["currentIdx"] as? Int) ?? self.currentIdx
            let newTotalCount = (dict["totalIntervals"] as? Int) ?? self.totalIntervals
            let newTitle = (dict["workoutTitle"] as? String) ?? self.workoutTitle

            // Haptic on phase change (Run vs Walk)
            if newIsRunning && !newIsPaused && newPhase != self.previousPhase && self.previousPhase != "ready" {
                if newPhase == "run" || newPhase == "sprint" {
                    WKInterfaceDevice.current().play(.directionUp)
                } else if newPhase == "walk" || newPhase == "rest" {
                    WKInterfaceDevice.current().play(.directionDown)
                }
            }

            // Haptic countdown clicks on 3, 2, 1 seconds
            if newIsRunning && !newIsPaused && (newSecLeft == 3 || newSecLeft == 2 || newSecLeft == 1) && newSecLeft != self.lastHapticCountdownSec {
                self.lastHapticCountdownSec = newSecLeft
                WKInterfaceDevice.current().play(.click)
            } else if newSecLeft > 3 {
                self.lastHapticCountdownSec = -1
            }

            // Haptic on completion
            if newIsCompleted && !self.isCompleted {
                WKInterfaceDevice.current().play(.success)
                self.endHealthKitWorkoutSession()
            }

            // Auto-start HealthKit workout tracking if workout is active
            if newIsRunning && self.workoutSession == nil && !newIsCompleted {
                self.startHealthKitWorkoutSession()
            }

            self.phase = newPhase
            self.secondsLeft = newSecLeft
            self.currentBlockTotal = newBlockTotal
            self.totalRemaining = newTotalRemaining
            self.isRunning = newIsRunning
            self.isPaused = newIsPaused
            self.isCompleted = newIsCompleted
            self.currentIdx = newIdx
            self.totalIntervals = newTotalCount
            self.workoutTitle = newTitle
            self.previousPhase = newPhase
        }
    }

    func resetToReady() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.endHealthKitWorkoutSession()
            self.phase = "ready"
            self.secondsLeft = 0
            self.currentBlockTotal = 60
            self.totalRemaining = 0
            self.isRunning = false
            self.isPaused = false
            self.isCompleted = false
            self.previousPhase = "ready"
            self.lastHapticCountdownSec = -1
        }
    }

    // MARK: - Outgoing Remote Controls to iPhone

    func sendPause() {
        sendCommand("pause")
        self.isPaused = true
    }

    func sendResume() {
        sendCommand("resume")
        self.isPaused = false
    }

    func sendSkipNext() {
        sendCommand("skipNext")
        WKInterfaceDevice.current().play(.click)
    }

    func sendAddSeconds(_ seconds: Int = 30) {
        sendCommand("addSeconds", extra: ["seconds": seconds])
        WKInterfaceDevice.current().play(.click)
    }

    func sendStop() {
        sendCommand("stop")
        resetToReady()
    }

    private func sendCommand(_ command: String, extra: [String: Any] = [:]) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        var message: [String: Any] = ["command": command]
        for (k, v) in extra {
            message[k] = v
        }

        if session.isReachable {
            session.sendMessage(message, replyHandler: nil, errorHandler: nil)
        } else {
            // Background fallback transfer
            session.transferUserInfo(message)
        }
    }

    // MARK: - WCSessionDelegate

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        let reachable = session.isReachable
        DispatchQueue.main.async {
            self.isPhoneReachable = reachable
            if activationState == .activated && reachable {
                self.sendCommand("requestState")
            }
        }
        if let context = session.receivedApplicationContext as [String: Any]?, !context.isEmpty {
            applyStateDictionary(context)
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        DispatchQueue.main.async {
            self.isPhoneReachable = reachable
            if reachable {
                self.sendCommand("requestState")
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        applyStateDictionary(message)
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        applyStateDictionary(applicationContext)
    }

    // MARK: - HKWorkoutSessionDelegate

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {}
    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {}

    // MARK: - HKLiveWorkoutBuilderDelegate

    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType else { continue }

            if quantityType == HKQuantityType.quantityType(forIdentifier: .heartRate) {
                let stats = workoutBuilder.statistics(for: quantityType)
                if let quantity = stats?.mostRecentQuantity() {
                    let heartRateUnit = HKUnit.count().unitDivided(by: HKUnit.minute())
                    let bpm = quantity.doubleValue(for: heartRateUnit)
                    DispatchQueue.main.async {
                        self.heartRate = bpm
                    }
                }
            } else if quantityType == HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
                let stats = workoutBuilder.statistics(for: quantityType)
                if let quantity = stats?.sumQuantity() {
                    let calorieUnit = HKUnit.kilocalorie()
                    let calories = quantity.doubleValue(for: calorieUnit)
                    DispatchQueue.main.async {
                        self.activeCalories = calories
                    }
                }
            }
        }
    }

    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}

