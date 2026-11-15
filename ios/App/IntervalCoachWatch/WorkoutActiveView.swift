import SwiftUI

struct WorkoutActiveView: View {
    @EnvironmentObject var workoutManager: WatchWorkoutManager
    @State private var selectedTab = 0
    @State private var showEndConfirm = false

    private var phaseColor: Color {
        let p = workoutManager.phase.lowercased()
        if p == "run" || p == "sprint" {
            return Color.green
        } else if p == "walk" || p == "rest" {
            return Color.cyan
        } else {
            return Color.orange
        }
    }

    private var phaseTitle: String {
        let p = workoutManager.phase.lowercased()
        if p == "run" { return "RUN" }
        if p == "sprint" { return "SPRINT" }
        if p == "walk" { return "WALK" }
        if p == "warmup" { return "WARM UP" }
        if p == "cooldown" { return "COOL DOWN" }
        return workoutManager.phase.uppercased()
    }

    private func formatTime(_ totalSeconds: Int) -> String {
        let sec = max(0, totalSeconds)
        let m = sec / 60
        let s = sec % 60
        return String(format: "%02d:%02d", m, s)
    }

    private var progressRatio: Double {
        guard workoutManager.currentBlockTotal > 0 else { return 0.0 }
        let elapsed = Double(workoutManager.currentBlockTotal - workoutManager.secondsLeft)
        return min(1.0, max(0.0, elapsed / Double(workoutManager.currentBlockTotal)))
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            // PAGE 1: Main Glanceable Running Screen
            VStack(spacing: 4) {
                // Top Header: Interval indicator & Live Heart Rate
                HStack {
                    if workoutManager.totalIntervals > 0 {
                        Text("\(workoutManager.currentIdx + 1)/\(workoutManager.totalIntervals)")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(.gray)
                    }

                    Spacer()

                    if workoutManager.heartRate > 0 {
                        HStack(spacing: 3) {
                            Image(systemName: "heart.fill")
                                .foregroundColor(.red)
                                .font(.system(size: 11))
                            Text("\(Int(workoutManager.heartRate))")
                                .font(.system(size: 14, weight: .semibold, design: .rounded))
                                .foregroundColor(.white)
                        }
                    }
                }
                .padding(.horizontal, 4)

                // Phase Badge (RUN / WALK / etc.)
                Text(phaseTitle)
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundColor(.black)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 3)
                    .background(phaseColor)
                    .cornerRadius(12)

                // Giant Interval Countdown
                Text(formatTime(workoutManager.secondsLeft))
                    .font(.system(size: 44, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(workoutManager.isPaused ? .yellow : .white)
                    .minimumScaleFactor(0.8)

                if workoutManager.isPaused {
                    Text("PAUSED")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.yellow)
                } else {
                    // Interval Progress Bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.gray.opacity(0.35))
                                .frame(height: 5)
                            Capsule()
                                .fill(phaseColor)
                                .frame(width: geo.size.width * CGFloat(progressRatio), height: 5)
                        }
                    }
                    .frame(height: 5)
                    .padding(.horizontal, 10)
                }

                // Bottom Subtitle: Total workout time left
                HStack(spacing: 4) {
                    Text("Total Left:")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.gray)
                    Text(formatTime(workoutManager.totalRemaining))
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundColor(.white)
                }
                .padding(.top, 2)
            }
            .tag(0)

            // PAGE 2: Quick Controls (Swipe right-to-left)
            ScrollView {
                VStack(spacing: 8) {
                    // Pause / Resume Button
                    Button(action: {
                        if workoutManager.isPaused {
                            workoutManager.sendResume()
                        } else {
                            workoutManager.sendPause()
                        }
                    }) {
                        HStack {
                            Image(systemName: workoutManager.isPaused ? "play.fill" : "pause.fill")
                            Text(workoutManager.isPaused ? "Resume" : "Pause")
                                .fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .tint(workoutManager.isPaused ? .green : .yellow)

                    // Skip Interval Button
                    Button(action: {
                        workoutManager.sendSkipNext()
                    }) {
                        HStack {
                            Image(systemName: "forward.fill")
                            Text("Skip Interval")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .tint(.blue)

                    // +30 Seconds Button
                    Button(action: {
                        workoutManager.sendAddSeconds(30)
                    }) {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("+30 Sec")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .tint(.purple)

                    // End Run Button
                    if showEndConfirm {
                        VStack(spacing: 4) {
                            Text("End Workout?")
                                .font(.footnote)
                                .foregroundColor(.red)
                            HStack {
                                Button("Yes") {
                                    showEndConfirm = false
                                    workoutManager.sendStop()
                                }
                                .tint(.red)

                                Button("Cancel") {
                                    showEndConfirm = false
                                }
                                .tint(.gray)
                            }
                        }
                        .padding(.top, 4)
                    } else {
                        Button(action: {
                            showEndConfirm = true
                        }) {
                            HStack {
                                Image(systemName: "xmark.circle.fill")
                                Text("End Run")
                                    .fontWeight(.bold)
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .tint(.red)
                    }
                }
                .padding(.horizontal, 4)
            }
            .tag(1)
        }
        .tabViewStyle(PageTabViewStyle())
    }
}

