# IntervalCoach 🏃‍♂️🎧

A mobile-first Progressive Web App (PWA) designed for runners who listen to external background music (**Pandora, Amazon Music, Spotify, Apple Music**) while receiving structured, dynamic run/walk audio coaching over top.

---

## ⚡ Core Highlights

1. **External Music Agnostic**:
   - Zero streaming friction. Keep your Pandora or Amazon Music running in the background.
   - IntervalCoach mixes clear voice prompts and chimes over your background music without interrupting playback.

2. **Acoustic Ducking & Speech Synthesis**:
   - Built with the native browser `window.speechSynthesis` API for natural voice prompts.
   - **Harmonic Pre-Cue Chimes**: Dual-tone bell synthesized directly via the Web Audio API (D5 -> A5) signals an imminent prompt through music beats.
   - **10-Second Warnings & 3-2-1 Beeps**: Clear spoken countdown and high-frequency acoustic ticks before interval changes.
   - **Mobile Keep-Alive Session**: Keeps the audio pipeline active so iOS Safari and Android Chrome don't throttle timers or speech when the screen dims.
   - **Audio Test Button**: Test your voice and chime permissions with one tap before heading outside.

3. **Zero-Setup Selection**:
   - High-contrast, glanceable card grid of prebuilt interval programs.
   - **The Base Builder**: Warm-up walk -> 1 min walk / 2 min run @ 40% -> 30s @ 75% -> 1 min walk / 3 min run @ 60% -> Cool down.
   - **The Pyramid Mix**: Ascending & descending efforts (40% -> 60% -> 80% peak -> step down).
   - **Quick Burn**: Snappy 20-minute interval session (8 rounds of 1m @ 85% / 1m walk).
   - **Beginner Couch-to-Run**: Low-impact gentle jog/walk sets.
   - **Tabata Sprint Surges**: 30s explosive power bursts.

4. **Custom Tailor Quick-Edit Sliders**:
   - Tap "Quick-Edit" on any workout or create your own custom workout.
   - Intuitive duration sliders (15s to 10m) with `+15s`, `+30s`, `+1m` steppers.
   - Target effort sliders (30% to 100%).
   - Reorder, duplicate, add, or delete blocks.
   - Persistent `localStorage` saving.

5. **Live Running Screen UI**:
   - **Massive Digital Countdown**: Enormous readable font visible from an arm's length while jogging.
   - **Dynamic Phase Glow Badges**: Green for **RUN**, Cyan for **WALK**, Rose for **SPRINT**, Amber for **WARMUP**, Indigo for **COOLDOWN**.
   - **Screen WakeLock API**: Keeps the display on while running.
   - **Outdoor High-Contrast Mode**: Enhanced sunlight visibility toggle.
   - **Up Next Preview**: Instant preview of upcoming interval and effort level.
   - **Thumb-Friendly Controls**: Large Play/Pause, Skip Next, Restart, and safe confirmation exit.
   - **Haptic Feedback**: Mobile vibration pulses on interval transitions.

---

## 📱 How to Run With Your Music

1. Open **Pandora**, **Amazon Music**, or **Spotify** on your phone and press Play.
2. Open **IntervalCoach** in Safari (iOS) or Chrome (Android).
3. Tap **Test Audio** to verify voice permissions.
4. Tap **Start Run** on your workout. Slip your phone into your pocket or armband!

---

## 📲 Install to Phone Home Screen (PWA)

### iPhone / iPad (Safari):
1. Open IntervalCoach in Safari.
2. Tap the **Share** button (box with upward arrow).
3. Tap **Add to Home Screen**.

### Android (Chrome):
1. Open IntervalCoach in Chrome.
2. Tap the in-app **Install PWA** prompt (or browser menu `⋮` -> **Install app**).

---

## 🛠️ Development & Deployment

### Local Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
```
The static output is in the `dist/` directory.

### Deploying to Vercel
```bash
npm i -g vercel
vercel
```
Or connect your GitHub repository directly to Vercel — it automatically detects Vite.

### Deploying to GitHub Pages
1. In `vite.config.js`, set `base: './'`.
2. Push `dist/` or use the official GitHub Actions Vite workflow.
