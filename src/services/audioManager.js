/**
 * AudioManager for IntervalCoach
 * 
 * Optimized for seamless background music compatibility (Pandora, Spotify, Amazon Music):
 * - Does NOT keep continuous audio oscillators running, preventing iOS/Android from pausing music.
 * - Prioritizes native SpeechSynthesis with automatic ducking provided by the OS.
 * - Intelligent voice selection prioritizing Natural, Siri, Enhanced, and Neural human voices.
 * - Human-like pacing, prosody punctuation, and conversational athletic coaching cues.
 */

class AudioManager {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.selectedVoiceURI = null;
    this.speechRate = 0.98; // Natural conversational human pace
    this.speechPitch = 1.0;
    this.speechVolume = 1.0;
    
    // Cues settings
    this.chimeEnabled = false; // Default to pure speech so external music apps (Pandora) are 100% uninterrupted
    this.tenSecondWarningEnabled = true;
    this.countdownEnabled = true;
    this.halfwayCueEnabled = true;

    this.audioCtx = null;
    this.isUnlocked = false;

    this.initVoices();
  }

  initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      const allVoices = this.synth.getVoices() || [];
      if (allVoices.length === 0) return;

      // Filter and sort English voices by quality
      this.voices = this.sortVoicesByQuality(allVoices);

      // Auto-pick best natural voice if none selected or if current is default robotic
      if (!this.selectedVoiceURI && this.voices.length > 0) {
        const bestVoice = this.findBestVoice(this.voices);
        if (bestVoice) {
          this.selectedVoiceURI = bestVoice.voiceURI;
        }
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Sort voices giving top priority to Natural, Enhanced, Siri, and Neural voices
   */
  sortVoicesByQuality(voiceList) {
    const isQuality = (v) => {
      const name = (v.name || '').toLowerCase();
      return (
        name.includes('natural') ||
        name.includes('enhanced') ||
        name.includes('premium') ||
        name.includes('siri') ||
        name.includes('neural') ||
        name.includes('online') ||
        name.includes('google')
      );
    };

    const isEnglish = (v) => (v.lang || '').toLowerCase().startsWith('en');

    return [...voiceList].sort((a, b) => {
      const aEng = isEnglish(a);
      const bEng = isEnglish(b);
      if (aEng && !bEng) return -1;
      if (!aEng && bEng) return 1;

      const aQual = isQuality(a);
      const bQual = isQuality(b);
      if (aQual && !bQual) return -1;
      if (!aQual && bQual) return 1;

      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Finds the highest quality, most natural sounding English voice
   */
  findBestVoice(voiceList) {
    const english = voiceList.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
    if (english.length === 0) return voiceList[0];

    // Priority 1: Apple Siri or Enhanced voices (iOS/macOS)
    const siriOrEnhanced = english.find(v => {
      const n = v.name.toLowerCase();
      return (n.includes('siri') || n.includes('enhanced') || n.includes('premium')) && !n.includes('compact');
    });
    if (siriOrEnhanced) return siriOrEnhanced;

    // Priority 2: Google Neural / Natural voices (Chrome / Android)
    const googleNatural = english.find(v => {
      const n = v.name.toLowerCase();
      return (n.includes('natural') || n.includes('google')) && (v.lang === 'en-US' || v.lang === 'en-GB');
    });
    if (googleNatural) return googleNatural;

    // Priority 3: Well-known natural sounding character voices
    const naturalNames = ['daniel', 'samantha', 'karen', 'oliver', 'serena', 'ava', 'guy', 'jenny', 'aria'];
    const matched = english.find(v => {
      const n = v.name.toLowerCase();
      return naturalNames.some(name => n.includes(name)) && !n.includes('compact');
    });
    if (matched) return matched;

    // Fallback to first English
    return english[0];
  }

  /**
   * Must be triggered from a user tap/click to grant audio permissions.
   * Does NOT start any background oscillator, keeping Pandora/Amazon Music playing.
   */
  unlockAudio() {
    if (this.isUnlocked) return true;

    try {
      if (this.synth) {
        // Unlock speech synthesis with a silent space
        const utterance = new SpeechSynthesisUtterance(' ');
        utterance.volume = 0.01;
        this.synth.speak(utterance);
      }
      this.isUnlocked = true;
      return true;
    } catch (e) {
      console.warn('Audio unlock warning:', e);
      return false;
    }
  }

  /**
   * Transient Web Audio chime (only created on-demand, immediately released)
   */
  playPreCueChime() {
    if (!this.chimeEnabled) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;

      const ctx = new AudioCtxClass();
      const now = ctx.currentTime;

      // Note 1: 587.33 Hz (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.31);

      // Note 2: 880 Hz (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      gain2.gain.setValueAtTime(0.2, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.46);

      // Close context after chime finishes so audio hardware is freed for Pandora
      setTimeout(() => {
        try { ctx.close(); } catch (e) {}
      }, 600);
    } catch (e) {
      console.warn('Chime failed', e);
    }
  }

  /**
   * Short countdown tone
   */
  playCountdownBeep(isFinal = false) {
    if (!this.countdownEnabled || !this.chimeEnabled) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;

      const ctx = new AudioCtxClass();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isFinal ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isFinal ? 1200 : 880, now);
      gain.gain.setValueAtTime(isFinal ? 0.25 : 0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.25 : 0.12));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + (isFinal ? 0.26 : 0.13));

      setTimeout(() => {
        try { ctx.close(); } catch (e) {}
      }, 400);
    } catch (e) {
      console.warn('Countdown beep failed', e);
    }
  }

  /**
   * Speak athletic coaching cues naturally.
   * Cancels any lagging utterance to keep pacing snappy.
   */
  speak(text, { priority = false, delayChime = false } = {}) {
    if (!this.synth) return;

    if (delayChime && this.chimeEnabled) {
      this.playPreCueChime();
    }

    try {
      if (this.synth.speaking) {
        this.synth.cancel();
      }

      // Add conversational polish to robotic-prone strings
      const polishedText = this.humanizePacing(text);

      const utterance = new SpeechSynthesisUtterance(polishedText);
      utterance.rate = this.speechRate;
      utterance.pitch = this.speechPitch;
      utterance.volume = this.speechVolume;

      // Assign selected voice
      if (this.selectedVoiceURI && this.voices.length > 0) {
        const found = this.voices.find(v => v.voiceURI === this.selectedVoiceURI);
        if (found) {
          utterance.voice = found;
          utterance.lang = found.lang;
        }
      }

      const delayMs = (delayChime && this.chimeEnabled) ? 250 : 0;
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
   * Formats text with natural punctuation, commas, and contractions so the
   * speech synthesizer reads with natural human rhythm instead of monotone robotic syllables.
   */
  humanizePacing(text) {
    if (!text) return '';
    let t = text.trim();

    // Expand percentages naturally
    t = t.replace(/(\d+)%/g, '$1 percent');

    // Add breathing pause after "10 seconds"
    t = t.replace(/in 10 seconds,?/gi, 'In 10 seconds,');

    // Add breathing pause before "ready to"
    t = t.replace(/get ready to/gi, 'get ready to');

    // Replace abrupt commands with natural athletic phrasing
    if (/^run at/i.test(t)) {
      t = 'Alright, ' + t;
    } else if (/^walk and/i.test(t)) {
      t = 'Nice job, now ' + t;
    }

    return t;
  }

  /**
   * Audition / Sample a specific voice
   */
  auditionVoice(voiceURI, callback) {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance("Interval Coach ready. Let's start with a warm up walk.");
      utterance.rate = this.speechRate;
      utterance.pitch = this.speechPitch;
      utterance.volume = this.speechVolume;

      const voice = this.voices.find(v => v.voiceURI === voiceURI);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.onend = () => {
        if (callback) callback();
      };
      utterance.onerror = () => {
        if (callback) callback();
      };

      this.synth.speak(utterance);
    } catch (e) {
      if (callback) callback();
    }
  }

  /**
   * One-tap audio test
   */
  testAudio(callback) {
    this.unlockAudio();
    if (this.chimeEnabled) {
      this.playPreCueChime();
    }
    setTimeout(() => {
      this.speak("Interval Coach audio ready! Pick up your pace to 60 percent effort.", {
        priority: true,
        delayChime: false,
      });
      if (callback) callback();
    }, this.chimeEnabled ? 280 : 50);
  }

  stopAll() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {}
    }
  }
}

export const audioManager = new AudioManager();
export default audioManager;
