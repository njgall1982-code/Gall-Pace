//
//  GallRunWatchApp.swift
//  GallRunWatch Watch App
//
//  Created by Nick Gall on 11/15/26.
//

import SwiftUI
import WatchKit
import HealthKit

final class WatchExtensionDelegate: NSObject, WKExtensionDelegate {
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        WatchWorkoutManager.shared.startHealthKitWorkoutSession(with: workoutConfiguration)
    }
}

@main
struct GallRunWatch_Watch_AppApp: App {
    @WKExtensionDelegateAdaptor(WatchExtensionDelegate.self) private var extensionDelegate
    @StateObject private var workoutManager = WatchWorkoutManager.shared

    var body: some Scene {
        WindowGroup {
            NavigationView {
                ContentView()
                    .environmentObject(workoutManager)
            }
        }
    }
}
