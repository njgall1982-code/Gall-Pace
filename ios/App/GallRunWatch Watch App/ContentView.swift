//
//  ContentView.swift
//  GallRunWatch Watch App
//
//  Created by Nick Gall on 11/15/26.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var workoutManager: WatchWorkoutManager

    var body: some View {
        Group {
            if workoutManager.isRunning || workoutManager.isPaused {
                WorkoutActiveView()
            } else if workoutManager.isCompleted {
                WorkoutSummaryView()
            } else {
                ReadyView()
            }
        }
    }
}
