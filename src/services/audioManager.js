/**
 * Native iOS AudioManager for IntervalCoach
 *
 * Dedicated for Native iOS (Capacitor + WKWebView + NativeAudioCoach Swift bridge).
 * All workout timing, background audio, AVAudioSession mixing/ducking, lock-screen controls,
 * and high-priority coaching cues run directly in SceneDelegate.swift (NativeAudioCoach).
 */

export const STUDIO_VOICES = [
  {
    id: 'us-andrew',
    name: 'Coach Andrew (Studio Neural)',
    region: 'US',
    flag: '🇺🇸',
    accent: 'American Male — Warm & Motivating',
    lang: 'en-US',
  },
  {
    id: 'us-ava',
    name: 'Coach Ava (Studio Neural)',
    region: 'US',
    flag: '🇺🇸',
    accent: 'American Female — Energetic & Natural',
    lang: 'en-US',
  },
  {
    id: 'uk-ryan',
    name: 'Coach Ryan (Studio Neural)',
    region: 'UK',
    flag: '🇬🇧',
    accent: 'British Male — Crisp Track Coach',
    lang: 'en-GB',
  },
  {
    id: 'au-natasha',
    name: 'Coach Natasha (Studio Neural)',
    region: 'AU',
    flag: '🇦🇺',
    accent: 'Australian Female — Upbeat & Bright',
    lang: 'en-AU',
  },
];

export const DURATION_TAGS = {
  15: '15s',
  30: '30s',
  45: '45s',
  60: '1m',
  75: '75s',
  90: '90s',
  105: '105s',
  120: '2m',
  150: '2m30s',
  180: '3m',
  240: '4m',
  300: '5m',
};

export const DEDICATED_CLIPS = new Set([
  'test', 'workout_halfway', 'interval_halfway', 'halfway', 'complete',
  'last_run', 'cue_pick_up_pace', 'cue_push_harder', 'cue_not_grandmas_pace',
  'warmup_1m', 'warmup_2m', 'warmup_3m', 'warmup_5m', 'warmup',
  'cooldown_1m', 'cooldown_2m', 'cooldown_3m', 'cooldown_5m', 'cooldown',
  'walk_30s', 'walk_45s', 'walk_1m', 'walk_90s', 'walk_2m', 'walk_3m', 'walk',
  'run_30_1m', 'run_30_2m',
  'run_40_1m', 'run_40_2m',
  'run_45_1m', 'run_45_90s',
  'run_50_1m', 'run_50_2m',
  'run_55_1m', 'run_55_2m',
  'run_60_30s', 'run_60_1m', 'run_60_2m', 'run_60_3m', 'run_60_4m',
  'run_65_1m', 'run_65_2m',
  'run_70_1m', 'run_70_2m',
  'run_75_30s', 'run_75_1m', 'run_75_2m',
  'run_80_1m', 'run_80_2m', 'run_80_3m',
  'run_85_30s', 'run_85_1m', 'run_85_2m',
  'run_90_30s', 'run_90_1m',
  'run_30', 'run_35', 'run_40', 'run_45', 'run_50', 'run_55', 'run_60',
  'run_65', 'run_70', 'run_75', 'run_80', 'run_85', 'run_90', 'run_95', 'run_100',
  'sprint_75_30s',
  'sprint_80_30s',
  'sprint_85_30s',
  'sprint_90_30s', 'sprint_90_45s',
  'sprint_95_30s', 'sprint_95_45s', 'sprint_95_1m',
  'sprint_100_30s', 'sprint_100_1m',
  'act_warmup', 'act_cooldown', 'act_walk',
  'act_run_30', 'act_run_35', 'act_run_40', 'act_run_45', 'act_run_50',
  'act_run_55', 'act_run_60', 'act_run_65', 'act_run_70', 'act_run_75',
  'act_run_80', 'act_run_85', 'act_run_90', 'act_sprint_95', 'act_sprint_100',
  'for_15s', 'for_30s', 'for_45s', 'for_1m', 'for_75s', 'for_90s', 'for_105s',
  'for_2m', 'for_2m30s', 'for_3m', 'for_4m', 'for_5m',
  'warn_run_30s', 'warn_run_1m', 'warn_run_2m', 'warn_run_3m', 'warn_run',
  'warn_sprint_30s', 'warn_sprint_45s', 'warn_sprint_1m', 'warn_sprint',
  'warn_walk_30s', 'warn_walk_1m', 'warn_walk_90s', 'warn_walk_2m', 'warn_walk',
  'warn_cooldown',
  // Cycling clips
  'pos_in_saddle', 'pos_out_saddle', 'pos_spin_out', 'pos_surge', 'pos_climb',
  'res_25', 'res_30', 'res_35', 'res_40', 'res_45', 'res_50', 'res_55', 'res_add', 'res_drop',
  'cad_60_70', 'cad_70_80', 'cad_80_90', 'cad_90_100', 'cad_fast',
  'ride_warmup', 'ride_cooldown', 'warn_bike', 'warn_climb', 'warn_surge', 'warn_recovery',
]);

class AudioManager {
  constructor() {
    this.voices = STUDIO_VOICES;
    this.selectedVoiceURI = 'us-andrew';
    this.speechRate = 1.0;
    this.speechVolume = 1.0;
    this.audioSessionMode = 'transient';

    // Coaching cue toggles
    this.chimeEnabled = true;
    this.tenSecondWarningEnabled = true;
    this.countdownEnabled = true;
    this.workoutHalfwayEnabled = true;
    this.intervalHalfwayEnabled = true;
    this.silentStart = false;

    // Native iOS bridge tracking
    this._nativeReqId = 1;
    this._nativeCallbacks = new Map();
    this._nativeBusy = false;
    this._nativeWorkoutStateListener = null;
    this._nativeWorkoutStopListener = null;

    // Dev browser simulation timer
    this._devTimer = null;
    this._devWorkout = null;
    this._devState = null;

    // Attach global window handlers called by Swift SceneDelegate
    if (typeof window !== 'undefined') {
      window.__onNativeClipEnd = (reqId) => {
        this._nativeBusy = false;
        const cb = this._nativeCallbacks.get(reqId);
        if (cb) {
          this._nativeCallbacks.delete(reqId);
          try { cb(); } catch (e) { console.error('Clip callback error:', e); }
        }
      };

      window.__onNativeWorkoutState = (state) => {
        if (this._nativeWorkoutStateListener) {
          this._nativeWorkoutStateListener(state);
        }
      };

      window.__onNativeWorkoutStop = () => {
        if (this._nativeWorkoutStopListener) {
          this._nativeWorkoutStopListener();
        }
      };
    }
  }

  /**
   * Returns true when running inside native iOS app with NativeAudioCoach bridge
   */
  isNativeIOS() {
    return Boolean(
      typeof window !== 'undefined' &&
      window.webkit?.messageHandlers?.nativeAudioCoach
    );
  }

  sendNativeMessage(payload) {
    if (!this.isNativeIOS()) return false;
    try {
      window.webkit.messageHandlers.nativeAudioCoach.postMessage(payload);
      return true;
    } catch (e) {
      console.warn('Native audio bridge error:', e);
      return false;
    }
  }

  unlockAudio() {
    // No-op on native iOS; AVAudioSession is initialized natively
    return true;
  }

  configureAudioSession() {
    // No-op on native iOS; AVAudioSession category is set natively by SceneDelegate
  }

  preloadCommonClips(_voiceId) {
    // No-op; native iOS bundles clips directly in the app bundle
  }

  preloadWorkoutClips(_workout) {
    // No-op; native iOS bundles clips directly in the app bundle
  }

  isAudioBusy() {
    return this._nativeBusy;
  }

  setNativeWorkoutStateListener(listener) {
    this._nativeWorkoutStateListener = listener;
  }

  setNativeWorkoutStopListener(listener) {
    this._nativeWorkoutStopListener = listener;
  }

  /**
   * Starts a workout on native iOS (or dev simulator if running in a browser during development)
   */
  startNativeWorkout(workout, { isMuted = false } = {}) {
    if (this.isNativeIOS()) {
      const validVoice = STUDIO_VOICES.some((v) => v.id === this.selectedVoiceURI)
        ? this.selectedVoiceURI
        : 'us-andrew';

      const intervals = workout.intervals.map((interval, idx) => ({
        phase: interval.phase || 'run',
        duration: Math.max(1, Math.round(interval.duration || 60)),
        startClips: this.getClipKeysForInterval(interval),
        warningClip: interval.warningClip || (idx < workout.intervals.length - 1
          ? this.getWarningClipKey(workout.intervals[idx + 1])
          : null),
      }));

      return this.sendNativeMessage({
        action: 'startWorkout',
        workoutTitle: workout.title || 'Workout',
        voiceId: validVoice,
        rate: Number(this.speechRate || 1.0),
        volume: Number(this.speechVolume || 1.0),
        sessionMode: this.audioSessionMode === 'transient' ? 'transient' : 'mix',
        chimeEnabled: Boolean(this.chimeEnabled),
        tenSecondWarningEnabled: Boolean(this.tenSecondWarningEnabled),
        countdownEnabled: Boolean(this.countdownEnabled),
        workoutHalfwayEnabled: Boolean(this.workoutHalfwayEnabled),
        intervalHalfwayEnabled: Boolean(this.intervalHalfwayEnabled),
        silentStart: Boolean(this.silentStart),
        isMuted: Boolean(isMuted),
        intervals,
      });
    }

    // Dev preview mock simulator for browser development
    this._startDevSimulator(workout, isMuted);
  }

  pauseNativeWorkout() {
    if (this.isNativeIOS()) {
      return this.sendNativeMessage({ action: 'pauseWorkout' });
    }
    if (this._devState) this._devState.isRunning = false;
  }

  resumeNativeWorkout() {
    if (this.isNativeIOS()) {
      return this.sendNativeMessage({ action: 'resumeWorkout' });
    }
    if (this._devState) this._devState.isRunning = true;
  }

  skipNextNativeWorkout() {
    if (this.isNativeIOS()) {
      return this.sendNativeMessage({ action: 'skipNextWorkout' });
    }
    if (this._devState && this._devWorkout) {
      if (this._devState.currentIdx < this._devWorkout.intervals.length - 1) {
        this._devState.currentIdx += 1;
        const nextDur = this._devWorkout.intervals[this._devState.currentIdx].duration || 60;
        this._devState.currentBlockTotal = nextDur;
        this._devState.secondsLeft = nextDur;
      }
    }
  }

  skipPrevNativeWorkout() {
    if (this.isNativeIOS()) {
      return this.sendNativeMessage({ action: 'skipPrevWorkout' });
    }
    if (this._devState && this._devWorkout && this._devState.currentIdx > 0) {
      this._devState.currentIdx -= 1;
      const prevDur = this._devWorkout.intervals[this._devState.currentIdx].duration || 60;
      this._devState.currentBlockTotal = prevDur;
      this._devState.secondsLeft = prevDur;
    }
  }

  addNativeWorkoutSeconds(seconds = 30) {
    if (this.isNativeIOS()) {
      return this.sendNativeMessage({ action: 'addSecondsWorkout', seconds });
    }
    if (this._devState) {
      this._devState.secondsLeft += seconds;
      this._devState.currentBlockTotal += seconds;
    }
  }

  setNativeWorkoutMuted(isMuted) {
    if (this.isNativeIOS()) {
      return this.sendNativeMessage({ action: 'setMutedWorkout', isMuted: Boolean(isMuted) });
    }
    if (this._devState) this._devState.isMuted = Boolean(isMuted);
  }

  stopNativeWorkout() {
    if (this.isNativeIOS()) {
      return this.sendNativeMessage({ action: 'stopWorkout' });
    }
    this._stopDevSimulator();
  }

  requestNativeWorkoutState() {
    if (this.isNativeIOS()) {
      return this.sendNativeMessage({ action: 'getWorkoutState' });
    }
  }

  playClips(clipKeys, { voiceId = this.selectedVoiceURI, withChime = false, onEnd = null } = {}) {
    const keys = Array.isArray(clipKeys) ? clipKeys.filter(Boolean) : [clipKeys].filter(Boolean);
    if (!keys.length) {
      if (onEnd) onEnd();
      return;
    }

    if (this.isNativeIOS()) {
      const validVoice = STUDIO_VOICES.some((v) => v.id === voiceId) ? voiceId : 'us-andrew';
      const reqId = this._nativeReqId++;
      if (onEnd) {
        this._nativeCallbacks.set(reqId, onEnd);
      }
      this._nativeBusy = true;
      this.sendNativeMessage({
        action: 'playClips',
        voiceId: validVoice,
        clips: keys,
        withChime: Boolean(withChime && this.chimeEnabled),
        rate: Number(this.speechRate || 1.0),
        volume: Number(this.speechVolume || 1.0),
        sessionMode: this.audioSessionMode === 'transient' ? 'transient' : 'mix',
        requestId: reqId,
      });
      return;
    }

    // Dev preview: play with HTML5 audio if clip exists
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(`./voices/${voiceId}/${keys[0]}.mp3`);
        audio.onended = () => { if (onEnd) onEnd(); };
        audio.onerror = () => { if (onEnd) onEnd(); };
        audio.play().catch(() => { if (onEnd) onEnd(); });
        return;
      } catch (e) {}
    }
    if (onEnd) onEnd();
  }

  playClip(clipKeyOrKeys, options = {}) {
    return this.playClips(clipKeyOrKeys, options);
  }

  stopAll() {
    if (this.isNativeIOS()) {
      this._nativeBusy = false;
      this.sendNativeMessage({ action: 'stopAll' });
    }
  }

  speakInterval(interval) {
    const clipKeys = this.getClipKeysForInterval(interval);
    this.playClips(clipKeys, { withChime: true });
  }

  speakWarning(nextInterval, currentInterval = null) {
    const clipKey = currentInterval?.warningClip || this.getWarningClipKey(nextInterval);
    if (clipKey) {
      this.playClip(clipKey, { withChime: true });
    }
  }

  speakWorkoutHalfway() {
    this.playClip('workout_halfway', { withChime: true });
  }

  speakIntervalHalfway() {
    this.playClip('interval_halfway', { withChime: true });
  }

  speakComplete() {
    this.playClip('complete', { withChime: false });
  }

  auditionVoice(voiceId, callback) {
    const targetVoice = STUDIO_VOICES.some((v) => v.id === voiceId) ? voiceId : 'us-andrew';
    this.playClip('test', {
      voiceId: targetVoice,
      withChime: false,
      onEnd: callback,
    });
  }

  testAudio(callback) {
    this.playClip('test', {
      voiceId: this.selectedVoiceURI,
      withChime: true,
      onEnd: callback,
    });
  }

  getVoiceLabel(v) {
    return `⭐ ${v.flag} [${v.region}] ${v.name} — ${v.accent}`;
  }

  refreshVoices() {
    return STUDIO_VOICES;
  }

  /**
   * Maps an interval object to one or more studio neural MP3 clip keys.
   */
  getClipKeysForInterval(interval) {
    if (!interval) return ['run_60_1m'];
    if (Array.isArray(interval.startClips) && interval.startClips.length > 0) {
      return interval.startClips;
    }
    const phase = interval.phase || 'run';
    const dur = interval.duration || 60;
    const durTag = DURATION_TAGS[dur] || null;

    if (phase === 'warmup') {
      if (durTag && DEDICATED_CLIPS.has(`warmup_${durTag}`)) return [`warmup_${durTag}`];
      if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) return ['act_warmup', `for_${durTag}`];
      return ['warmup'];
    }

    if (phase === 'cooldown') {
      if (durTag && DEDICATED_CLIPS.has(`cooldown_${durTag}`)) return [`cooldown_${durTag}`];
      if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) return ['act_cooldown', `for_${durTag}`];
      return ['cooldown'];
    }

    if (phase === 'walk') {
      if (durTag && DEDICATED_CLIPS.has(`walk_${durTag}`)) return [`walk_${durTag}`];
      if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) return ['act_walk', `for_${durTag}`];
      return ['walk'];
    }

    if (phase === 'sprint') {
      const rawEffort = interval.effort || 95;
      const snapped = Math.min(100, Math.max(75, Math.round(rawEffort / 5) * 5));
      if (durTag && DEDICATED_CLIPS.has(`sprint_${snapped}_${durTag}`)) return [`sprint_${snapped}_${durTag}`];
      if (durTag && DEDICATED_CLIPS.has(`run_${snapped}_${durTag}`)) return [`run_${snapped}_${durTag}`];
      const actKey = snapped >= 95 ? `act_sprint_${snapped}` : 'act_sprint_95';
      if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) return [actKey, `for_${durTag}`];
      return ['run_95'];
    }

    // Default: 'run'
    const rawEffort = interval.effort || 60;
    const snapped = Math.min(100, Math.max(30, Math.round(rawEffort / 5) * 5));
    if (durTag && DEDICATED_CLIPS.has(`run_${snapped}_${durTag}`)) return [`run_${snapped}_${durTag}`];
    const actKey = DEDICATED_CLIPS.has(`act_run_${snapped}`) ? `act_run_${snapped}` : 'act_run_60';
    if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) return [actKey, `for_${durTag}`];
    return ['run_60'];
  }

  getClipKeyForInterval(interval) {
    const keys = this.getClipKeysForInterval(interval);
    return keys[0] || 'run_60';
  }

  getWarningClipKey(nextInterval) {
    if (!nextInterval) return null;
    if (nextInterval.warningClip) return nextInterval.warningClip;
    const phase = nextInterval.phase || 'run';
    const dur = nextInterval.duration || 60;
    const durTag = dur === 30 ? '30s' : dur === 45 ? '45s' : dur === 60 ? '1m' : dur === 90 ? '90s' : dur === 120 ? '2m' : dur === 180 ? '3m' : null;

    if (phase === 'warmup') return 'warn_walk';
    if (phase === 'cooldown') return 'warn_cooldown';
    if (phase === 'walk') {
      if (durTag && DEDICATED_CLIPS.has(`warn_walk_${durTag}`)) return `warn_walk_${durTag}`;
      return 'warn_walk';
    }
    if (phase === 'sprint') {
      if (durTag && DEDICATED_CLIPS.has(`warn_sprint_${durTag}`)) return `warn_sprint_${durTag}`;
      return 'warn_sprint';
    }
    if (durTag && DEDICATED_CLIPS.has(`warn_run_${durTag}`)) return `warn_run_${durTag}`;
    return 'warn_run';
  }

  // Lightweight mock simulator for browser development (npm run dev)
  _startDevSimulator(workout, isMuted) {
    this._stopDevSimulator();
    this._devWorkout = workout;
    const initialDur = workout.intervals[0]?.duration || 60;
    this._devState = {
      currentIdx: 0,
      currentBlockTotal: initialDur,
      secondsLeft: initialDur,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
      isMuted: Boolean(isMuted),
      totalTime: 0,
      runTime: 0,
      walkTime: 0,
      completedIntervals: 0,
    };

    this._devTimer = setInterval(() => {
      if (!this._devState || !this._devState.isRunning) return;
      this._devState.totalTime += 1;
      const curr = this._devWorkout.intervals[this._devState.currentIdx];
      const isWork = curr?.phase === 'run' || curr?.phase === 'sprint';
      if (isWork) this._devState.runTime += 1; else this._devState.walkTime += 1;

      this._devState.secondsLeft -= 1;
      if (this._devState.secondsLeft <= 0) {
        this._devState.completedIntervals += 1;
        if (this._devState.currentIdx >= this._devWorkout.intervals.length - 1) {
          this._devState.isCompleted = true;
          this._devState.isRunning = false;
          this._stopDevSimulator();
        } else {
          this._devState.currentIdx += 1;
          const nextDur = this._devWorkout.intervals[this._devState.currentIdx].duration || 60;
          this._devState.currentBlockTotal = nextDur;
          this._devState.secondsLeft = nextDur;
        }
      }

      if (this._nativeWorkoutStateListener) {
        this._nativeWorkoutStateListener({ ...this._devState });
      }
    }, 1000);
  }

  _stopDevSimulator() {
    if (this._devTimer) {
      clearInterval(this._devTimer);
      this._devTimer = null;
    }
    this._devWorkout = null;
    this._devState = null;
  }
}

export const audioManager = new AudioManager();
export default audioManager;
