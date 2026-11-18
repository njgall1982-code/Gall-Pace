import SwiftUI
import WatchKit

struct ReadyView: View {
    @EnvironmentObject var workoutManager: WatchWorkoutManager

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Image(systemName: "figure.run.circle.fill")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 44, height: 44)
                    .foregroundColor(.green)

                Text("IntervalCoach")
                    .font(.system(size: 16, weight: .bold, design: .rounded))

                Text("Start a workout on your iPhone to begin.")
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 6)

                HStack(spacing: 5) {
                    Circle()
                        .fill(workoutManager.isPhoneReachable ? Color.green : Color.orange)
                        .frame(width: 7, height: 7)
                    Text(workoutManager.isPhoneReachable ? "iPhone Connected" : "iPhone Standby")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                }
                .padding(.top, 4)

                // Quick test haptic button
                Button(action: {
                    WKInterfaceDevice.current().play(.directionUp)
                }) {
                    Text("Test Buzz")
                        .font(.system(size: 11, weight: .medium))
                }
                .frame(height: 28)
                .padding(.top, 6)
            }
            .padding(.horizontal, 4)
        }
    }
}

