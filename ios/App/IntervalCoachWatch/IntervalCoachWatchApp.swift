import SwiftUI

@main
struct IntervalCoachWatchApp: App {
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

