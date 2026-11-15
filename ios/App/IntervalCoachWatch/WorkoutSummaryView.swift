import SwiftUI

struct WorkoutSummaryView: View {
    @EnvironmentObject var workoutManager: WatchWorkoutManager

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 38, height: 38)
                    .foregroundColor(.green)

                Text("Run Completed!")
                    .font(.system(size: 16, weight: .bold, design: .rounded))

                VStack(spacing: 4) {
                    if workoutManager.totalIntervals > 0 {
                        HStack {
                            Text("Intervals")
                                .font(.footnote)
                                .foregroundColor(.gray)
                            Spacer()
                            Text("\(workoutManager.totalIntervals)")
                                .font(.footnote.bold())
                        }
                    }

                    if workoutManager.activeCalories > 0 {
                        HStack {
                            Text("Active Cal")
                                .font(.footnote)
                                .foregroundColor(.gray)
                            Spacer()
                            Text("\(Int(workoutManager.activeCalories)) kcal")
                                .font(.footnote.bold())
                                .foregroundColor(.red)
                        }
                    }

                    if workoutManager.heartRate > 0 {
                        HStack {
                            Text("Final HR")
                                .font(.footnote)
                                .foregroundColor(.gray)
                            Spacer()
                            Text("\(Int(workoutManager.heartRate)) BPM")
                                .font(.footnote.bold())
                                .foregroundColor(.pink)
                        }
                    }
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.1))
                .cornerRadius(8)

                Button(action: {
                    workoutManager.resetToReady()
                }) {
                    Text("Done")
                        .fontWeight(.bold)
                }
                .tint(.green)
                .padding(.top, 4)
            }
            .padding(.horizontal, 4)
        }
    }
}

