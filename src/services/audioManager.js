/**
 * Studio Neural AudioManager for IntervalCoach
 *
 * Features:
 * 1. Plays pre-generated Microsoft Azure Neural AI Coach MP3 clips decoded through Web Audio API
 *    (AudioContext + AudioBufferSourceNode) with `navigator.audioSession.type = 'ambient'`.
 * 2. Handles iOS WebKit's non-standard `audioCtx.state === 'interrupted'` state when unlocking
 *    the screen or returning from background apps, automatically resuming or recreating the context.
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

const DURATION_TAGS = {
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

const DEDICATED_CLIPS = new Set([
  'test', 'workout_halfway', 'complete',
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
]);

class AudioManager {
  constructor() {
    this.voices = STUDIO_VOICES;
    this.selectedVoiceURI = 'us-andrew';
    this.speechRate = 1.0;
    this.speechVolume = 1.0;

    // Audio session mode: 'transient' ducks Pandora briefly while talking; 'mix' plays over at 100%
    this.audioSessionMode = 'transient';

    // Coaching cue toggles
    this.chimeEnabled = true;
    this.tenSecondWarningEnabled = true;
    this.countdownEnabled = true;
    this.workoutHalfwayEnabled = true;
    this.silentStart = false;

    this.audioCtx = null;
    this.activeSource = null;
    this.activeSources = [];
    this.activeHtmlAudio = null;
    this.bufferCache = new Map(); // key: `${voiceId}/${clipKey}` -> AudioBuffer
    this.rawMp3Cache = new Map(); // key: `${voiceId}/${clipKey}` -> ArrayBuffer (survives AudioContext recreation)
    this.isUnlocked = false;
    this._appliedSessionMode = null;

    // Native iOS bridge tracking
    this._nativeReqId = 1;
    this._nativeCallbacks = new Map();
    this._nativeBusy = false;

    if (typeof window !== 'undefined') {
      window.__onNativeAudioEnded = (reqId) => {
        this._nativeBusy = false;
        const cb = this._nativeCallbacks.get(reqId);
        if (cb) {
          this._nativeCallbacks.delete(reqId);
          cb();
        }
      };
    }

    this.configureAudioSession();
    this.setupLifecycleRecovery();
  }

  /**
   * Returns true when running inside the native iOS Capacitor app with NativeAudioCoach bridge
   */
  isNativeIOS() {
    return Boolean(
      typeof window !== 'undefined' &&
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.nativeAudioCoach
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

  /**
   * Automatically recover Web Audio context when the user turns their screen back on,
   * switches back from Pandora, or touches anywhere on the page.
   */
  setupLifecycleRecovery() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const recoverAudio = () => {
      if (!this.audioCtx) return;
      if (this.audioCtx.state !== 'running') {
        this.audioCtx.resume().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        recoverAudio();
      }
    });

    window.addEventListener('pageshow', recoverAudio);
    window.addEventListener('focus', recoverAudio);
    window.addEventListener('touchstart', recoverAudio, { passive: true });
    window.addEventListener('click', recoverAudio, { passive: true });
  }

  /**
   * Sets iOS 16.4+ navigator.audioSession.type only in browser mode and only when changed.
   * Inside native Capacitor iOS, AppDelegate.swift configures AVAudioSession natively with .mixWithOthers.
   */
  configureAudioSession() {
    if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return;
    }
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      const targetMode = this.audioSessionMode === 'ambient' ? 'playback' : (this.audioSessionMode || 'playback');
      if (this._appliedSessionMode === targetMode) return;
      try {
        navigator.audioSession.type = targetMode;
        this._appliedSessionMode = targetMode;
      } catch (e) {}
    }
  }

  getAudioContext() {
    if (this.isNativeIOS()) return null;
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioCtxClass();
      this.attachStateChangeListener(this.audioCtx);
    }

    if (this.audioCtx.state !== 'running') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  attachStateChangeListener(ctx) {
    if (!ctx) return;
    ctx.onstatechange = () => {
      if (
        (ctx.state === 'interrupted' || ctx.state === 'suspended') &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        this.audioSessionMode !== 'transient'
      ) {
        ctx.resume().catch(() => {});
      }
    };
  }

  /**
   * Ensure the AudioContext is running without prematurely destroying it.
   */
  async ensureRunningContext() {
    if (this.isNativeIOS()) return null;
    let ctx = this.getAudioContext();
    if (!ctx) return null;

    if (ctx.state !== 'running') {
      try {
        await Promise.race([
          ctx.resume(),
          new Promise((resolve) => setTimeout(resolve, 600))
        ]);
      } catch (e) {}
    }

    if (ctx) {
      this._clockCtx = ctx;
      this._clockWall = Date.now();
      this._clockTime = ctx.currentTime;
    }
    return ctx;
  }

  /**
   * Drastic recovery: only called manually when user explicitly toggles mute/unmute
   */
  hardResetAudio() {
    this.stopAll();
    if (this.isNativeIOS()) return null;
    const old = this.audioCtx;
    this.audioCtx = null;
    if (old) {
      try { old.onstatechange = null; } catch (e) {}
      try { old.close().catch(() => {}); } catch (e) {}
    }
    this.bufferCache.clear();
    this._clockCtx = null;

    const ctx = this.getAudioContext();
    if (!ctx) return null;
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (e) {}
    this.isUnlocked = true;
    this._clockCtx = ctx;
    this._clockWall = Date.now();
    this._clockTime = ctx.currentTime;
    return ctx;
  }

  /**
   * Must be called inside a user click/tap gesture (e.g., Start Run or Test Audio)
   * Unlocks Web Audio API on iOS without flooding the decode queue.
   */
  unlockAudio() {
    if (this.isNativeIOS()) {
      this.isUnlocked = true;
      return true;
    }
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        if (ctx.state !== 'running') {
          ctx.resume().catch(() => {});
        }
        // Play a 1-sample silent buffer to unlock iOS Web Audio pipeline synchronously
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
      this.isUnlocked = true;
      return true;
    } catch (e) {
      console.warn('Audio unlock warning:', e);
      return false;
    }
  }

  /**
   * Fetch raw MP3 bytes into memory cache without blocking AudioContext decode queue
   */
  async fetchClipRaw(voiceId, clipKey) {
    const validVoice = STUDIO_VOICES.some(v => v.id === voiceId) ? voiceId : 'us-andrew';
    const cacheKey = `${validVoice}/${clipKey}`;
    if (this.rawMp3Cache.has(cacheKey)) {
      return this.rawMp3Cache.get(cacheKey);
    }

    const candidateUrls = [
      `./voices/${validVoice}/${clipKey}.mp3`,
      `voices/${validVoice}/${clipKey}.mp3`,
      `/voices/${validVoice}/${clipKey}.mp3`,
    ];
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url);
        if (res && res.ok) {
          const rawBuffer = await res.arrayBuffer();
          this.rawMp3Cache.set(cacheKey, rawBuffer);
          return rawBuffer;
        }
      } catch (e) {}
    }
    throw new Error(`HTTP fetch failed for ${cacheKey}`);
  }

  /**
   * Fetch and decode a studio neural MP3 clip into a Web Audio AudioBuffer
   */
  async loadClipBuffer(voiceId, clipKey) {
    const validVoice = STUDIO_VOICES.some(v => v.id === voiceId) ? voiceId : 'us-andrew';
    const cacheKey = `${validVoice}/${clipKey}`;
    if (this.bufferCache.has(cacheKey)) {
      return this.bufferCache.get(cacheKey);
    }

    const ctx = this.getAudioContext();
    if (!ctx) return null;

    try {
      const rawBuffer = await this.fetchClipRaw(validVoice, clipKey);
      // Clone rawBuffer before decodeAudioData because decodeAudioData detaches the buffer
      const bufferCopy = rawBuffer.slice(0);
      const audioBuffer = await ctx.decodeAudioData(bufferCopy);
      this.bufferCache.set(cacheKey, audioBuffer);
      return audioBuffer;
    } catch (err) {
      console.warn(`Could not load clip ${cacheKey}:`, err);
      return null;
    }
  }

  /**
   * Preload raw MP3 bytes for common clips in the background without choking AudioContext
   */
  preloadCommonClips(voiceId = this.selectedVoiceURI) {
    if (this.isNativeIOS()) return;
    const common = ['test', 'warmup_2m', 'walk_1m', 'run_60_1m', 'cooldown_2m'];
    common.forEach((clipKey) => {
      this.fetchClipRaw(voiceId, clipKey).catch(() => {});
    });
  }

  /**
   * Preload raw MP3 clips needed for a specific workout
   */
  preloadWorkoutClips(workout) {
    if (this.isNativeIOS()) {
      this.sendNativeMessage({ action: 'startWorkoutKeepAlive' });
      return;
    }
    if (!workout || !workout.intervals) return;
    const keysToFetch = new Set(['workout_halfway', 'complete']);
    workout.intervals.forEach((interval, idx) => {
      const keys = this.getClipKeysForInterval(interval);
      keys.forEach((key) => keysToFetch.add(key));
      if (idx < workout.intervals.length - 1) {
        const warnKey = this.getWarningClipKey(workout.intervals[idx + 1]);
        if (warnKey) keysToFetch.add(warnKey);
      }
    });
    keysToFetch.forEach((key) => {
      this.fetchClipRaw(this.selectedVoiceURI, key).catch(() => {});
    });
  }

  stopWorkoutKeepAlive() {
    if (this.isNativeIOS()) {
      this.sendNativeMessage({ action: 'stopWorkoutKeepAlive' });
    }
  }

  /**
   * Maps an interval object to one or more studio neural MP3 clip keys.
   * Returns exact dedicated clips with duration included, or modular sequence [action, duration].
   */
  getClipKeysForInterval(interval) {
    if (!interval) return ['run_60_1m'];
    const phase = interval.phase || 'run';
    const dur = interval.duration || 60;
    const durTag = DURATION_TAGS[dur] || null;

    if (phase === 'warmup') {
      if (durTag && DEDICATED_CLIPS.has(`warmup_${durTag}`)) {
        return [`warmup_${durTag}`];
      }
      if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) {
        return ['act_warmup', `for_${durTag}`];
      }
      return ['warmup'];
    }

    if (phase === 'cooldown') {
      if (durTag && DEDICATED_CLIPS.has(`cooldown_${durTag}`)) {
        return [`cooldown_${durTag}`];
      }
      if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) {
        return ['act_cooldown', `for_${durTag}`];
      }
      return ['cooldown'];
    }

    if (phase === 'walk') {
      if (durTag && DEDICATED_CLIPS.has(`walk_${durTag}`)) {
        return [`walk_${durTag}`];
      }
      if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) {
        return ['act_walk', `for_${durTag}`];
      }
      return ['walk'];
    }

    if (phase === 'sprint') {
      const rawEffort = interval.effort || 95;
      const snapped = Math.min(100, Math.max(75, Math.round(rawEffort / 5) * 5));
      if (durTag && DEDICATED_CLIPS.has(`sprint_${snapped}_${durTag}`)) {
        return [`sprint_${snapped}_${durTag}`];
      }
      if (durTag && DEDICATED_CLIPS.has(`run_${snapped}_${durTag}`)) {
        return [`run_${snapped}_${durTag}`];
      }
      const actKey = snapped >= 95 ? `act_sprint_${snapped}` : (DEDICATED_CLIPS.has(`act_run_${snapped}`) ? `act_run_${snapped}` : 'act_sprint_95');
      if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) {
        return [actKey, `for_${durTag}`];
      }
      return [DEDICATED_CLIPS.has(`run_${snapped}`) ? `run_${snapped}` : 'run_95'];
    }

    // Default: 'run'
    const rawEffort = interval.effort || 60;
    const snapped = Math.min(100, Math.max(30, Math.round(rawEffort / 5) * 5));
    if (durTag && DEDICATED_CLIPS.has(`run_${snapped}_${durTag}`)) {
      return [`run_${snapped}_${durTag}`];
    }
    if (snapped >= 95 && durTag && DEDICATED_CLIPS.has(`sprint_${snapped}_${durTag}`)) {
      return [`sprint_${snapped}_${durTag}`];
    }
    const actKey = DEDICATED_CLIPS.has(`act_run_${snapped}`) ? `act_run_${snapped}` : 'act_run_60';
    if (durTag && DEDICATED_CLIPS.has(`for_${durTag}`)) {
      return [actKey, `for_${durTag}`];
    }
    return [DEDICATED_CLIPS.has(`run_${snapped}`) ? `run_${snapped}` : 'run_60'];
  }

  /**
   * Backward-compatible helper returning single primary clip key
   */
  getClipKeyForInterval(interval) {
    const keys = this.getClipKeysForInterval(interval);
    return keys[0] || 'run_60';
  }

  /**
   * Maps an upcoming interval to its 10-second warning clip key with duration
   */
  getWarningClipKey(nextInterval) {
    if (!nextInterval) return null;
    const phase = nextInterval.phase || 'run';
    const dur = nextInterval.duration || 60;
    const durTag = DURATION_TAGS[dur] || null;

    if (phase === 'walk') {
      if (durTag && ['30s', '1m', '90s', '2m'].includes(durTag) && DEDICATED_CLIPS.has(`warn_walk_${durTag}`)) {
        return `warn_walk_${durTag}`;
      }
      return 'warn_walk';
    }
    if (phase === 'sprint') {
      if (durTag && ['30s', '45s', '1m'].includes(durTag) && DEDICATED_CLIPS.has(`warn_sprint_${durTag}`)) {
        return `warn_sprint_${durTag}`;
      }
      return 'warn_sprint';
    }
    if (phase === 'cooldown') {
      return 'warn_cooldown';
    }
    // run
    if (durTag && ['30s', '1m', '2m', '3m'].includes(durTag) && DEDICATED_CLIPS.has(`warn_run_${durTag}`)) {
      return `warn_run_${durTag}`;
    }
    return 'warn_run';
  }

  /**
   * Play a gentle harmonic pre-cue chime on the same Web Audio context
   */
  playPreCueChime(ctxOverride = null) {
    if (!this.chimeEnabled) return;
    if (this.isNativeIOS()) {
      this.sendNativeMessage({ action: 'playChime' });
      return;
    }
    try {
      const ctx = ctxOverride || this.getAudioContext();
      if (!ctx) return;
      if (ctx.state !== 'running') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.22, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.26);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.09);
      gain2.gain.setValueAtTime(0.001, now + 0.09);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.43);
    } catch (e) {
      console.warn('Chime error:', e);
    }
  }

  /**
   * Short acoustic tick for 3, 2, 1 countdown
   */
  async playCountdownBeep(isFinal = false) {
    if (!this.countdownEnabled) return;
    if (this.isNativeIOS()) {
      this.sendNativeMessage({ action: 'playBeep', isFinal: Boolean(isFinal) });
      return;
    }
    try {
      const ctx = await this.ensureRunningContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isFinal ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isFinal ? 1174.66 : 880, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(isFinal ? 0.3 : 0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.22 : 0.12));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + (isFinal ? 0.23 : 0.13));
    } catch (e) {}
  }

  async playCompletionChime() {
    if (this.isNativeIOS()) {
      this.sendNativeMessage({ action: 'playCompletionChime' });
      return;
    }
    try {
      const ctx = await this.ensureRunningContext();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const now = ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.11;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.52);
      });
    } catch (e) {}
  }

  /**
   * Fallback player using HTML5 Audio elements if Web Audio Context is suspended/unavailable
   */
  async playClipsWithHtmlAudio(keys, { voiceId = this.selectedVoiceURI, onEnd = null } = {}) {
    const validVoice = STUDIO_VOICES.some(v => v.id === voiceId) ? voiceId : 'us-andrew';
    for (let i = 0; i < keys.length; i++) {
      const clipKey = keys[i];
      await new Promise((resolve) => {
        const audio = new Audio(`./voices/${validVoice}/${clipKey}.mp3`);
        audio.playbackRate = this.speechRate || 1.0;
        audio.volume = Math.min(1.0, this.speechVolume || 1.0);
        this.activeHtmlAudio = audio;
        audio.onended = () => {
          this.activeHtmlAudio = null;
          resolve();
        };
        audio.onerror = () => {
          this.activeHtmlAudio = null;
          resolve();
        };
        audio.play().catch(() => {
          this.activeHtmlAudio = null;
          resolve();
        });
      });
    }
    if (onEnd) onEnd();
  }

  /**
   * Core playback method: plays one or more Studio Neural clips sequentially.
   * On native iOS, routes directly through NativeAudioCoach (AVAudioPlayer + AVAudioSession)
   * so Pandora/Spotify never pauses and ducks/unducks smoothly!
   */
  async playClips(clipKeys, { voiceId = this.selectedVoiceURI, withChime = false, onEnd = null } = {}) {
    const keys = Array.isArray(clipKeys) ? clipKeys.filter(Boolean) : [clipKeys].filter(Boolean);
    if (!keys.length) {
      if (onEnd) onEnd();
      return;
    }

    if (this.isNativeIOS()) {
      const validVoice = STUDIO_VOICES.some(v => v.id === voiceId) ? voiceId : 'us-andrew';
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

    this.stopAll();
    const syncCtx = this.getAudioContext();
    let chimePlayed = false;
    if (syncCtx && withChime && this.chimeEnabled) {
      this.playPreCueChime(syncCtx);
      chimePlayed = true;
    }

    const ctx = await this.ensureRunningContext();
    if (!ctx) {
      return this.playClipsWithHtmlAudio(keys, { voiceId, onEnd });
    }

    try {
      const buffers = await Promise.all(keys.map((k) => this.loadClipBuffer(voiceId, k)));
      const validBuffers = buffers.filter(Boolean);
      if (!validBuffers.length || ctx.state !== 'running') {
        return this.playClipsWithHtmlAudio(keys, { voiceId, onEnd });
      }

      if (withChime && this.chimeEnabled && !chimePlayed) {
        this.playPreCueChime(ctx);
      }

      const initialDelay = (withChime && this.chimeEnabled) ? 0.25 : 0.02;
      let scheduledTime = ctx.currentTime + initialDelay;
      this.activeSources = [];

      validBuffers.forEach((buffer, idx) => {
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();

        source.buffer = buffer;
        source.playbackRate.value = this.speechRate || 1.0;

        // Boost voice gain slightly (1.4x) so it cuts cleanly over background music
        gainNode.gain.value = Math.min(2.0, (this.speechVolume || 1.0) * 1.4);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        this.activeSources.push(source);

        const isLast = idx === validBuffers.length - 1;
        if (isLast) {
          source.onended = () => {
            this.activeSources = [];
            this.activeSource = null;
            if (onEnd) onEnd();
          };
        }

        source.start(scheduledTime);
        const effectiveDuration = buffer.duration / (this.speechRate || 1.0);
        scheduledTime += effectiveDuration + 0.05;
      });

      this.activeSource = this.activeSources[0] || null;
    } catch (err) {
      console.warn('Error playing neural clips:', err);
      return this.playClipsWithHtmlAudio(keys, { voiceId, onEnd });
    }
  }

  playClip(clipKeyOrKeys, options = {}) {
    return this.playClips(clipKeyOrKeys, options);
  }

  isAudioBusy() {
    if (this.isNativeIOS()) {
      return this._nativeBusy;
    }
    return (this.activeSource !== null) || (this.activeSources && this.activeSources.length > 0) || (this.activeHtmlAudio !== null);
  }

  speakInterval(interval) {
    const clipKeys = this.getClipKeysForInterval(interval);
    this.playClips(clipKeys, { withChime: true });
  }

  speakWarning(nextInterval) {
    const clipKey = this.getWarningClipKey(nextInterval);
    if (clipKey) {
      this.playClip(clipKey, { withChime: true });
    }
  }

  speakWorkoutHalfway() {
    this.playClip('workout_halfway', { withChime: true });
  }

  speakComplete() {
    this.playClip('complete', { withChime: false });
  }

  getVoiceLabel(v) {
    return `⭐ ${v.flag} [${v.region}] ${v.name} — ${v.accent}`;
  }

  refreshVoices() {
    return STUDIO_VOICES;
  }

  auditionVoice(voiceId, callback) {
    const targetVoice = STUDIO_VOICES.some(v => v.id === voiceId) ? voiceId : 'us-andrew';
    this.unlockAudio();
    this.playClip('test', {
      voiceId: targetVoice,
      withChime: false,
      onEnd: callback,
    });
  }

  testAudio(callback) {
    this.unlockAudio();
    this.playClip('test', {
      voiceId: this.selectedVoiceURI,
      withChime: true,
      onEnd: callback,
    });
  }

  stopAll() {
    if (this.isNativeIOS()) {
      this._nativeBusy = false;
      this.sendNativeMessage({ action: 'stopAll' });
      return;
    }
    if (this.activeSources && this.activeSources.length) {
      this.activeSources.forEach((src) => {
        try {
          src.stop();
          src.disconnect();
        } catch (e) {}
      });
      this.activeSources = [];
    }
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch (e) {}
      this.activeSource = null;
    }
    if (this.activeHtmlAudio) {
      try {
        this.activeHtmlAudio.pause();
      } catch (e) {}
      this.activeHtmlAudio = null;
    }
  }
}

export const audioManager = new AudioManager();
export default audioManager;
