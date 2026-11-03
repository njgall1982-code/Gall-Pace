/**
 * AudioManager for IntervalCoach
 * 
 * Provides:
 * 1. Web Audio API synthesizer for harmonic chimes and countdown beeps (100% offline, zero latency).
 * 2. SpeechSynthesis API wrapper with mobile Safari/Chrome unlock and voice caching.
 * 3. Mobile Audio Focus / Ducking / Keep-Alive: Generates a silent/sub-audible audio session
 *    via WebAudio/HTML5 Audio to keep the audio session open alongside background music apps
 *    (Pandora, Spotify, Amazon Music) and prevent mobile OS timer throttling.
 */

class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.selectedVoiceURI = null;
    this.speechRate = 1.05; // Slightly brisk for athletic coaching
    this.speechPitch = 1.0;
    this.speechVolume = 1.0;
    this.chimeEnabled = true;
    this.tenSecondWarningEnabled = true;
    this.countdownEnabled = true;
    this.halfwayCueEnabled = true;
    this.duckingKeepAliveEnabled = true;

    // Mobile keep-alive audio oscillator or buffer
    this.silentSource = null;
    this.isUnlocked = false;

    this.initVoices();
  }

  initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      this.voices = this.synth.getVoices();
      // Prefer high-quality English voice if not already selected
      if (!this.selectedVoiceURI && this.voices.length > 0) {
        // Look for natural English voices like Samantha, Daniel, Google US English, or default
        const preferred = this.voices.find(v => 
          (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Siri') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')))
        ) || this.voices.find(v => v.lang.startsWith('en')) || this.voices[0];
        
        if (preferred) {
          this.selectedVoiceURI = preferred.voiceURI;
        }
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  // Ensure AudioContext is resumed upon user touch/click
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Must be called from a user gesture (Start button or Audio Test button)
  unlockAudio() {
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }

      // Play a short silent buffer to unlock mobile audio output
      if (ctx) {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }

      // Unlock speech synthesis on iOS/Android
      if (this.synth) {
        const unlockUtterance = new SpeechSynthesisUtterance(' ');
        unlockUtterance.volume = 0.01;
        this.synth.speak(unlockUtterance);
      }

      if (this.duckingKeepAliveEnabled) {
        this.startKeepAlive();
      }

      this.isUnlocked = true;
      return true;
    } catch (e) {
      console.warn('Audio unlock warning:', e);
      return false;
    }
  }

  /**
   * Start a sub-audible continuous WebAudio tone (or tiny periodic tick)
   * to keep the mobile browser audio session active in background
   * alongside Pandora / Amazon Music.
   */
  startKeepAlive() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx || this.silentSource) return;

      // Create an oscillator at inaudible gain (0.0001) that keeps the audio pipeline open
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.00001, ctx.currentTime); // virtually silent
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this.silentSource = osc;
    } catch (err) {
      console.warn('Keep-alive could not start:', err);
    }
  }

  stopKeepAlive() {
    if (this.silentSource) {
      try {
        this.silentSource.stop();
        this.silentSource.disconnect();
      } catch (e) {}
      this.silentSource = null;
    }
  }

  /**
   * Synthesize a gentle pre-cue chime (harmonious D5 to A5 dual bell)
   * Cuts through background music smoothly without jarring the runner.
   */
  playPreCueChime() {
    if (!this.chimeEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Note 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.36);

      // Note 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.28, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.56);
    } catch (e) {
      console.warn('Pre-cue chime failed', e);
    }
  }

  /**
   * Short countdown beep (e.g. for 3, 2, 1)
   */
  playCountdownBeep(isFinal = false) {
    if (!this.countdownEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isFinal ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isFinal ? 1200 : 880, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(isFinal ? 0.35 : 0.25, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.3 : 0.15));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + (isFinal ? 0.31 : 0.16));
    } catch (e) {
      console.warn('Countdown beep failed', e);
    }
  }

  /**
   * Triumphant finish chime for workout completion
   */
  playCompletionChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = ctx.currentTime;

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + index * 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.3, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteStart);
        osc.stop(noteStart + 0.65);
      });
    } catch (e) {
      console.warn('Completion chime failed', e);
    }
  }

  /**
   * Speak a concise, natural running prompt.
   * Cancels any pending utterance to avoid lag or delayed cues.
   */
  speak(text, { priority = false, delayChime = false } = {}) {
    if (!this.synth) return;

    // Optional subtle pre-chime
    if (delayChime) {
      this.playPreCueChime();
    }

    try {
      // Cancel previous cue if priority or lagging
      if (this.synth.speaking) {
        this.synth.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.speechRate;
      utterance.pitch = this.speechPitch;
      utterance.volume = this.speechVolume;

      if (this.selectedVoiceURI && this.voices.length > 0) {
        const found = this.voices.find(v => v.voiceURI === this.selectedVoiceURI);
        if (found) utterance.voice = found;
      }

      // Delay speech slightly if pre-chime was played so audio chime resonates first
      const delayMs = delayChime ? 280 : 0;
      setTimeout(() => {
        try {
          this.synth.speak(utterance);
        } catch (err) {
          console.warn('SpeechSynthesis error:', err);
        }
      }, delayMs);
    } catch (e) {
      console.warn('Speak error:', e);
    }
  }

  /**
   * Audio Check / Permission Test
   * Speaks a clear sample phrase and plays the pre-cue chime.
   */
  testAudio(callback) {
    this.unlockAudio();
    this.playPreCueChime();
    setTimeout(() => {
      this.speak("Interval Coach audio ready. Run at 60 percent effort.", {
        priority: true,
        delayChime: false,
      });
      if (callback) callback();
    }, 320);
  }

  stopAll() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }
    this.stopKeepAlive();
  }
}

export const audioManager = new AudioManager();
export default audioManager;

