# 📱 iOS Test App Setup & Workflow Guide

This guide walks you through building, testing, and updating **IntervalCoach** as a native iOS app on your physical iPhone using a Mac.

---

## 🏗️ Architecture Overview

Your app is built with **React + Vite**. We use **Capacitor** (by Ionic) to wrap the React code into a genuine native iOS Xcode project.

* **You do not need to write Swift.**
* You keep coding in React / JavaScript.
* Capacitor packages your built web files (`dist/`) into native iOS views and bridges background audio and device capabilities.

---

## ⚡ What Has Already Been Configured For You

The following are already set up in this repository:
1. **Capacitor Core & iOS Engine** installed in `package.json`.
2. **`capacitor.config.json`** configured with App ID `com.intervalcoach.app`.
3. **`ios/` folder** initialized with a native Xcode workspace (`App.xcworkspace`).
4. **Background Audio & Mixing pre-configured**:
   - `Info.plist` has `UIBackgroundModes: ['audio']` enabled.
   - `AppDelegate.swift` is configured with `AVAudioSession` options `.mixWithOthers` and `.duckOthers` so your voice cues mix over background music (Spotify, Pandora, etc.) and don't stop when the screen sleeps.
5. **Full Safe-Area Viewport** enabled in `index.html` for notch and Dynamic Island support.

---

## 🚀 First-Time Setup: Getting the App onto your iPhone

### Step 1: Transfer Code to your Mac
The cleanest way is using GitHub:
1. Commit and push your code from your PC:
   ```bash
   git add .
   git commit -m "Add iOS Capacitor project and background audio"
   git push
   ```
2. On your Mac, clone or pull the repository:
   ```bash
   git clone <your-repo-url>
   cd "Running App"
   npm install
   ```

*(Alternatively, you can copy the project folder to a flash drive or AirDrop it to your Mac).*

---

### Step 2: Open the Project in Xcode on your Mac
On your Mac terminal inside the project directory, run:
```bash
npm run cap:ios
```
*(Or simply open `ios/App/App.xcworkspace` in Xcode).*

---

### Step 3: Configure Your Free Apple ID in Xcode (One-time only)
1. In Xcode, in the left sidebar, click the top blue project item named **App**.
2. In the center pane, select the **Signing & Capabilities** tab.
3. Make sure **"Automatically manage signing"** is checked.
4. Next to **Team**, click the dropdown:
   - Click **Add an Account...** and sign in with your regular Apple ID (no paid $99/yr developer account is needed).
   - Select your personal team (it will say `Your Name (Personal Team)`).
5. If Xcode shows a bundle identifier error (because `com.intervalcoach.app` might need to be unique), just tweak the **Bundle Identifier** to something unique to you (e.g., `com.yourname.intervalcoach`).

---

### Step 4: Prepare Your iPhone (One-time only)
1. Connect your iPhone to your Mac with a USB cable.
2. Tap **"Trust This Computer"** on your iPhone screen if prompted.
3. **Enable Developer Mode (iOS 16+)**:
   - On your iPhone, open **Settings → Privacy & Security**.
   - Scroll all the way to the bottom and tap **Developer Mode**.
   - Toggle it **ON**.
   - The phone will ask to restart. Tap **Restart**.
   - After restart, unlock your phone and tap **Turn On** when prompted.

---

### Step 5: Push to Your iPhone!
1. At the top toolbar of Xcode, find the device selector (next to the "App" scheme).
2. Click it and choose your physical **iPhone** from the device list.
3. Click the **Play button ▶ (Run)** in the top-left corner.
4. Xcode will compile the app and install it onto your iPhone.

#### ⚠️ "Untrusted Developer" Warning on First Launch:
When you tap the app on your phone for the first time, iOS may say the developer is untrusted:
1. On iPhone, go to **Settings → General → VPN & Device Management**.
2. Tap your Apple ID under "Developer App".
3. Tap **"Trust [Your Apple ID]"**.
4. Open **IntervalCoach** — it will now launch!

---

## 🔄 Day-to-Day Workflow: How to Make Updates Easily

You don't need to do the setup again. Whenever you want to test code changes:

### Workflow A: The "Standalone Build" (Push new code to iPhone)
Use this when you want to update the app on your phone so you can take it outside for a run:
1. Make your code changes on your PC / Mac.
2. In your terminal, run:
   ```bash
   npm run cap:sync
   ```
   *(This runs `vite build` and immediately syncs the latest files to the iOS project).*
3. In Xcode, hit the **Play ▶ button** to push the updated app to your iPhone.

---

### Workflow B: "Live Reload" (Instant updates over Wi-Fi while developing)
If you are tweaking the UI or adjusting sounds and don't want to re-push from Xcode every minute:
1. Find your Mac's local Wi-Fi IP address (e.g., `192.168.1.50`).
2. Open `capacitor.config.json` and add a `server` entry:
   ```json
   {
     "appId": "com.intervalcoach.app",
     "appName": "IntervalCoach",
     "webDir": "dist",
     "server": {
       "url": "http://192.168.1.50:5173",
       "cleartext": true
     }
   }
   ```
3. Run `npx cap sync` once.
4. Start your local dev server with network access:
   ```bash
   npm run dev -- --host
   ```
5. When you launch the app on your iPhone (while connected to the same Wi-Fi), **every file save in your code editor will instantly update on your phone screen in real time!**
*(Remember to remove the `server` block and run `npm run cap:sync` before taking the phone outside).*

---

## ⚠️ Important Gotchas to Keep in Mind

| Gotcha | Why it happens | What to do |
| :--- | :--- | :--- |
| **App expires after 7 days** | Free Apple IDs have a 7-day provisioning limit for tethered apps. | Just plug the phone back into your Mac and press **Play ▶ in Xcode** to renew for another 7 days. (A paid Apple Developer account gives 1-year profiles and TestFlight). |
| **Phone sleep / screen off audio** | iOS shuts down web views when locked unless audio mode is set. | We have already configured `UIBackgroundModes: audio` and `AVAudioSession` ducking in `AppDelegate.swift`. |
| **Dynamic Island / Notch spacing** | Native apps stretch edge-to-edge. | We already included `viewport-fit=cover` in `index.html`. If a header touches the top edge, add `pt-safe` or top padding. |

