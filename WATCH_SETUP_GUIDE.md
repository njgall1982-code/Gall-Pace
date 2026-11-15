# ⌚ Apple Watch Companion App Setup & Testing Guide

This guide shows you how to add the Apple Watch target in Xcode on your Mac and test the **IntervalCoach Watch App** on your Apple Watch (both **Series 3 on watchOS 8** and **Apple Watch SE on watchOS 10**).

---

## ⚡ What We Have Already Prepared in the Code

All the code has been written and wired up for you:
1. **iPhone Bridge (`WatchSessionManager.swift`)**: 
   - Manages Apple's `WatchConnectivity` (`WCSession`).
   - Hooks into `HealthKit` (`HKHealthStore.startWatchApp`) to automatically launch the watch app onto your wrist when you tap **Start Run** on your phone.
   - Synchronizes countdown seconds, intervals, and titles every tick.
   - Listens for remote controls from your watch (Pause, Resume, Skip, +30s, End Run).
2. **Native iOS Workout Engine (`SceneDelegate.swift`)**:
   - Updated so state updates broadcast directly to your wrist.
   - Responds to watch taps immediately.
3. **watchOS SwiftUI App (`ios/App/IntervalCoachWatch/`)**:
   - `IntervalCoachWatchApp.swift`: SwiftUI App entry point.
   - `WatchWorkoutManager.swift`: Manages HealthKit workout tracking, live heart rate sensor (BPM), and wrist haptic pulses (`.directionUp` for Run, `.directionDown` for Walk, `.click` for 3-2-1 countdown).
   - `WorkoutActiveView.swift`: High-contrast, large-text running screen with interval countdown, phase badge, progress bar, heart rate, and swipeable control buttons.
   - `ReadyView.swift`: Standby screen with "iPhone Connected" indicator and a "Test Buzz" button.
   - `WorkoutSummaryView.swift`: Post-run recap.

---

## 🚀 One-Time Setup in Xcode (Takes ~2 minutes)

When you open `ios/App/App.xcworkspace` in Xcode on your Mac:

### Step 1: Add the Watch Target in Xcode
1. In Xcode's top menu, click **File → New → Target...**
2. In the template sheet, click the **watchOS** tab at the top.
3. Select **App** and click **Next**.
4. Fill in the options:
   - **Product Name:** `IntervalCoachWatch`
   - **Bundle Identifier:** (Xcode will auto-fill e.g. `com.intervalcoach.app.watchkitapp` or match your personal team prefix)
   - **Interface:** `SwiftUI`
   - **Language:** `Swift`
   - **Target Application:** Make sure **App** (your iPhone app) is selected in the dropdown!
5. Click **Finish**. If Xcode prompts *"Activate IntervalCoachWatch scheme?"*, click **Activate**.

---

### Step 2: Set Deployment Target to watchOS 8.0 (Crucial for Series 3!)
1. In the left sidebar, click the top blue project item named **App**.
2. Under **Targets**, click **IntervalCoachWatch**.
3. Under the **General** tab:
   - Find **Minimum Deployments** (or **Deployment Info**).
   - Change **watchOS** to **8.0**. *(This enables it to install on your Series 3 while also running on modern watchOS 10!)*

---

### Step 3: Add HealthKit Capability
1. With **IntervalCoachWatch** still selected under Targets, click the **Signing & Capabilities** tab.
2. Click **+ Capability** in the top-left corner.
3. Search for **HealthKit** and double-click to add it.
4. *(Optional check)*: In your main iPhone **App** target, also make sure **HealthKit** is added under **Signing & Capabilities**.

---

### Step 4: Link the Source Files (If not already linked)
Xcode may have created a placeholder `ContentView.swift` and `IntervalCoachWatchApp.swift` in a new folder. 
1. In the left sidebar navigator, look at the files under `IntervalCoachWatch`.
2. Make sure the files we created are included in the target:
   - `IntervalCoachWatchApp.swift`
   - `WatchWorkoutManager.swift`
   - `ContentView.swift`
   - `WorkoutActiveView.swift`
   - `ReadyView.swift`
   - `WorkoutSummaryView.swift`
3. If any file shows a missing target membership:
   - Click the file in the sidebar.
   - In the right-side inspector pane, under **Target Membership**, check the box for **IntervalCoachWatch**.

---

### Step 5: Configure Signing (Free Apple ID)
1. Select the **IntervalCoachWatch** target.
2. Under **Signing & Capabilities**:
   - Check **"Automatically manage signing"**.
   - Under **Team**, select your free personal team: `Your Name (Personal Team)`.

---

## 🏃 Testing on Your Devices

### 1. Enable Developer Mode on Devices:
* **iPhone (iOS 16+):** Settings → Privacy & Security → Developer Mode → Toggle ON (phone restarts).
* **Apple Watch Series 3 (watchOS 8):** Developer mode was not required on watchOS 8, so nothing extra needed!
* **Apple Watch SE (watchOS 10):** Settings → Privacy & Security → Developer Mode → Toggle ON.

### 2. Run the App!
1. Connect your iPhone to your Mac via USB cable (with your Apple Watch on your wrist and unlocked).
2. In Xcode's top toolbar, click the device selector:
   - Choose your **iPhone + Apple Watch** (Xcode will show them as a paired pair, e.g. *"Your iPhone + Your Apple Watch"*).
   - Select the **App** scheme (or **IntervalCoachWatch** scheme).
3. Click the **Play ▶ button**.
4. Xcode installs the app on your phone and automatically transfers the companion app onto your watch!

---

## 🌟 How It Works When You Go For a Run

1. Open **IntervalCoach** on your iPhone.
2. Select your workout and tap **Start Run**.
3. **Your watch immediately buzzes and opens into your running screen!**
4. As you run:
   - When switching from **WALK** to **RUN**: Your watch gives an upward double tap (`.directionUp`).
   - When switching from **RUN** to **WALK**: Your watch gives a downward tap (`.directionDown`).
   - In the final 3 seconds of any interval: Your watch clicks (`.click`) on 3, 2, 1.
   - Glance at your wrist to see live **Interval Countdown**, **Total Time Left**, and **Heart Rate (BPM)**.
   - Swipe left anytime to Pause, +30 seconds, Skip, or End Run.

