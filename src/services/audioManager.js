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

class AudioManager {
  constructor() {
    this.voices = STUDIO_VOICES;
    this.selectedVoiceURI = 'us-andrew';
    this.speechRate = 1.0;
    this.speechVolume = 1.0;

    // Audio session mode: 'ambient' mixes over Pandora without pausing; 'transient' ducks
    this.audioSessionMode = 'ambient';

    // Coaching cue toggles
    this.chimeEnabled = true;
    this.tenSecondWarningEnabled = true;
    this.countdownEnabled = true;
    this.halfwayCueEnabled = true;
    this.silentStart = false;

    this.audioCtx = null;
    this.activeSource = null;
    this.bufferCache = new Map(); // key: `${voiceId}/${clipKey}` -> AudioBuffer
    this.rawMp3Cache = new Map(); // key: `${voiceId}/${clipKey}` -> ArrayBuffer (survives AudioContext recreation)
    this.isUnlocked = false;

    this.configureAudioSession();
    this.setupLifecycleRecovery();
  }

  /**
   * Automatically recover Web Audio context when the user turns their screen back on,
   * switches back from Pandora, or touches anywhere on the page.
   */
  setupLifecycleRecovery() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const recoverAudio = () => {
      if (!this.audioCtx) return;
      // On iOS WebKit, locking the screen puts audioCtx into 'interrupted' or 'suspended'
      if (this.audioCtx.state !== 'running') {
        this.configureAudioSession();
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
   * Sets iOS 16.4+ navigator.audioSession.type
   * 'ambient' maps to AVAudioSessionCategoryAmbient (mixes with Pandora/Spotify without pausing!)
   */
  configureAudioSession() {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        navigator.audioSession.type = this.audioSessionMode || 'ambient';
      } catch (e) {
        try {
          navigator.audioSession.type = 'ambient';
        } catch (err) {}
      }
    }
  }

  getAudioContext() {
    this.configureAudioSession();
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioCtxClass();
      this. attachStateChangeListener(this.audioCtx);
    }

    // Check !== 'running' to catch both 'suspended' AND iOS WebKit's 'interrupted' state!
    if (this.audioCtx.state !== 'running') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  attachStateChangeListener(ctx) {
    if (!ctx) return;
    ctx.onstatechange = () => {
      // If iOS interrupts the context and the page is visible, attempt immediate resume
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
   * Ensure the AudioContext is running; if iOS permanently wedged it after screen lock,
   * recreate a fresh AudioContext cleanly.
   */
  async ensureRunningContext() {
    let ctx = this.getAudioContext();
    if (!ctx) return null;

    if (ctx.state !== 'running') {
      try {
        await Promise.race([
          ctx.resume(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('resume timeout')), 400))
        ]);
      } catch (e) {
        // Recreate context if iOS wedged the interrupted context
        try {
          await ctx.close();
        } catch (err) {}
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
        this.attachStateChangeListener(this.audioCtx);
        this.bufferCache.clear(); // Re-decode from rawMp3Cache as needed
        ctx = this.audioCtx;
        try {
          await ctx.resume();
        } catch (err) {}
      }
    }
    return ctx;
  }

  /**
   * Must be called inside a user click/tap gesture (e.g., Start Run or Test Audio)
   * Unlocks Web Audio API on iOS without interrupting Pandora.
   */
  unlockAudio() {
    this.configureAudioSession();
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        if (ctx.state !== 'running') {
          ctx.resume().catch(() => {});
        }
        // Play a 1-sample silent buffer to unlock iOS Web Audio pipeline
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
      this.isUnlocked = true;
      this.preloadCommonClips(this.selectedVoiceURI);
      return true;
    } catch (e) {
      console.warn('Audio unlock warning:', e);
      return false;
    }
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
      let rawBuffer = this.rawMp3Cache.get(cacheKey);
      if (!rawBuffer) {
        const response = await fetch(`./voices/${validVoice}/${clipKey}.mp3`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        rawBuffer = await response.arrayBuffer();
        this.rawMp3Cache.set(cacheKey, rawBuffer);
      }
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
   * Preload common clips for a voice so playback during a run is 0ms instant and offline-safe
   */
  preloadCommonClips(voiceId = this.selectedVoiceURI) {
    const common = [
      'test', 'warmup_3m', 'warmup_2m', 'warmup',
      'walk_1m', 'walk_90s', 'walk_30s', 'walk',
      'run_40', 'run_45', 'run_50', 'run_60', 'run_75', 'run_80', 'run_85', 'run_90', 'run_95', 'run_100',
      'warn_run', 'warn_walk', 'warn_sprint', 'warn_cooldown',
      'halfway', 'complete', 'cooldown_3m', 'cooldown_2m'
    ];
    common.forEach((clipKey) => {
      this.loadClipBuffer(voiceId, clipKey);
    });
  }

  /**
   * Preload all clips needed for a specific workout
   */
  preloadWorkoutClips(workout) {
    if (!workout || !workout.intervals) return;
    this.preloadCommonClips(this.selectedVoiceURI);
    workout.intervals.forEach((interval) => {
      const key = this.getClipKeyForInterval(interval);
      if (key) this.loadClipBuffer(this.selectedVoiceURI, key);
    });
  }

  /**
   * Maps an interval object to the appropriate studio neural MP3 clip key
   */
  getClipKeyForInterval(interval) {
    if (!interval) return 'run_60';
    const phase = interval.phase || 'run';
    const dur = interval.duration || 60;

    if (phase === 'warmup') {
      if (dur === 180) return 'warmup_3m';
      if (dur === 120) return 'warmup_2m';
      return 'warmup';
    }
    if (phase === 'cooldown') {
      if (dur === 180) return 'cooldown_3m';
      if (dur === 120) return 'cooldown_2m';
      return 'cooldown';
    }
    if (phase === 'walk') {
      if (dur === 60) return 'walk_1m';
      if (dur === 90) return 'walk_90s';
      if (dur === 30) return 'walk_30s';
      return 'walk';
    }

    const rawEffort = interval.effort || (phase === 'sprint' ? 95 : 60);
    const snapped = Math.min(100, Math.max(30, Math.round(rawEffort / 5) * 5));
    return `run_${snapped}`;
  }

  /**
   * Maps an upcoming interval to its 10-second warning clip key
   */
  getWarningClipKey(nextInterval) {
    if (!nextInterval) return null;
    const phase = nextInterval.phase || 'run';
    if (phase === 'walk') return 'warn_walk';
    if (phase === 'sprint') return 'warn_sprint';
    if (phase === 'cooldown') return 'warn_cooldown';
    return 'warn_run';
  }

  /**
   * Play a gentle harmonic pre-cue chime on the same Web Audio context
   */
  playPreCueChime(ctxOverride = null) {
    if (!this.chimeEnabled) return;
    try {
      const ctx = ctxOverride || this.getAudioContext();
      if (!ctx) return;

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
   * Core playback method: plays a Studio Neural clip via Web Audio API BufferSource
   * so Pandora/Spotify continues playing uninterrupted in the background!
   */
  async playClip(clipKey, { voiceId = this.selectedVoiceURI, withChime = false, onEnd = null } = {}) {
    this.configureAudioSession();
    const ctx = await this.ensureRunningContext();
    if (!ctx) {
      if (onEnd) onEnd();
      return;
    }

    try {
      // Stop any currently playing voice clip
      if (this.activeSource) {
        try {
          this.activeSource.stop();
          this.activeSource.disconnect();
        } catch (e) {}
        this.activeSource = null;
      }

      const buffer = await this.loadClipBuffer(voiceId, clipKey);
      if (!buffer) {
        if (onEnd) onEnd();
        return;
      }

      if (withChime && this.chimeEnabled) {
        this.playPreCueChime(ctx);
      }

      const delaySec = (withChime && this.chimeEnabled) ? 0.28 : 0.02;
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = buffer;
      source.playbackRate.value = this.speechRate || 1.0;

      // Boost voice gain slightly (1.4x) so it cuts cleanly over background music
      gainNode.gain.value = Math.min(2.0, (this.speechVolume || 1.0) * 1.4);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      this.activeSource = source;
      source.onended = () => {
        if (this.activeSource === source) {
          this.activeSource = null;
        }
        if (this.audioSessionMode === 'transient' && ctx.state === 'running') {
          setTimeout(() => {
            if (!this.activeSource) {
              ctx.suspend().catch(() => {});
            }
          }, 120);
        }
        if (onEnd) onEnd();
      };

      source.start(ctx.currentTime + delaySec);
    } catch (err) {
      console.warn('Error playing neural clip:', err);
      if (onEnd) onEnd();
    }
  }

  speakInterval(interval) {
    const clipKey = this.getClipKeyForInterval(interval);
    this.playClip(clipKey, { withChime: true });
  }

  speakWarning(nextInterval) {
    const clipKey = this.getWarningClipKey(nextInterval);
    if (clipKey) {
      this.playClip(clipKey, { withChime: true });
    }
  }

  speakHalfway() {
    this.playClip('halfway', { withChime: false });
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
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch (e) {}
      this.activeSource = null;
    }
  }
}

export const audioManager = new AudioManager();
export default audioManager;
