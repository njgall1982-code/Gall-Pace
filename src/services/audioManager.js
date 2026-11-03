/**
 * AudioManager for IntervalCoach
 * 
 * Configured specifically for background music mixing on iOS (Pandora, Spotify, Amazon Music):
 * - Uses navigator.audioSession type = 'transient' / 'ambient' on iOS 16.4+ to prevent pausing background music.
 * - Filters voices strictly to English (American, British, Australian).
 * - Human-like pacing and prosody.
 */

class AudioManager {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.selectedVoiceURI = null;
    this.speechRate = 0.98;
    this.speechPitch = 1.0;
    this.speechVolume = 1.0;
    
    // Cues settings
    this.chimeEnabled = false; // Default off so music is never interrupted
    this.tenSecondWarningEnabled = true;
    this.countdownEnabled = true;
    this.halfwayCueEnabled = true;
    this.silentStart = false; // If true, don't speak immediately on hitting start

    this.isUnlocked = false;

    // Set iOS AudioSession to transient / ambient so background music isn't paused
    this.configureAudioSession();
    this.initVoices();
  }

  configureAudioSession() {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator) {
      try {
        // 'transient' is specifically designed for speech/alerts over background music
        navigator.audioSession.type = 'transient';
      } catch (e) {
        try {
          navigator.audioSession.type = 'ambient';
        } catch (err) {}
      }
    }
  }

  initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      const allVoices = this.synth.getVoices() || [];
      if (allVoices.length === 0) return;

      // Filter STRICTLY to English (US, UK, AU, CA, IE, NZ)
      this.voices = this.filterEnglishVoices(allVoices);

      // Auto-select best natural voice if none currently selected
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
   * Filter strictly to English (US, British, Australian, Canadian, Irish, Kiwi)
   * Discards all other languages completely.
   */
  filterEnglishVoices(rawList) {
    const allowedPrefixes = ['en-us', 'en-gb', 'en-au', 'en-ca', 'en-ie', 'en-nz', 'en_us', 'en_gb', 'en_au'];
    
    const filtered = rawList.filter((v) => {
      const lang = (v.lang || '').toLowerCase().replace(/_/g, '-');
      // Must start with en and match our regional targets
      if (!lang.startsWith('en')) return false;
      return allowedPrefixes.some(p => lang.startsWith(p)) || lang === 'en';
    });

    // Sort quality first (Siri, Enhanced, Natural, Neural)
    return filtered.sort((a, b) => {
      const isQuality = (v) => {
        const n = (v.name || '').toLowerCase();
        return n.includes('natural') || n.includes('enhanced') || n.includes('siri') || n.includes('neural') || n.includes('premium');
      };
      const aQ = isQuality(a);
      const bQ = isQuality(b);
      if (aQ && !bQ) return -1;
      if (!aQ && bQ) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Helper to return clean formatted label for UI dropdown
   */
  getVoiceLabel(v) {
    const lang = (v.lang || '').toLowerCase();
    let flag = '🇺🇸';
    let region = 'US';

    if (lang.includes('gb') || lang.includes('uk')) {
      flag = '🇬🇧';
      region = 'UK';
    } else if (lang.includes('au')) {
      flag = '🇦🇺';
      region = 'AU';
    } else if (lang.includes('ca')) {
      flag = '🇨🇦';
      region = 'CA';
    } else if (lang.includes('ie')) {
      flag = '🇮🇪';
      region = 'IE';
    }

    const isHighQuality = /natural|enhanced|siri|neural|premium/i.test(v.name);
    const star = isHighQuality ? '⭐ ' : '';
    
    // Clean up redundant voice name artifacts
    let cleanName = v.name
      .replace(/\(en-[a-z]+\)/gi, '')
      .replace(/English \([A-Za-z ]+\)/gi, '')
      .trim();

    return `${star}${flag} [${region}] ${cleanName}`;
  }

  findBestVoice(voiceList) {
    // 1. Siri / Enhanced
    const siri = voiceList.find(v => {
      const n = v.name.toLowerCase();
      return (n.includes('siri') || n.includes('enhanced') || n.includes('premium')) && !n.includes('compact');
    });
    if (siri) return siri;

    // 2. Google / Neural
    const neural = voiceList.find(v => {
      const n = v.name.toLowerCase();
      return n.includes('natural') || n.includes('google');
    });
    if (neural) return neural;

    // 3. Known athletic names
    const names = ['daniel', 'samantha', 'karen', 'oliver', 'serena', 'ava', 'guy', 'jenny'];
    const matched = voiceList.find(v => {
      const n = v.name.toLowerCase();
      return names.some(name => n.includes(name)) && !n.includes('compact');
    });
    if (matched) return matched;

    return voiceList[0] || null;
  }

  unlockAudio() {
    this.configureAudioSession();
    if (this.isUnlocked) return true;

    try {
      if (this.synth) {
        const utterance = new SpeechSynthesisUtterance(' ');
        utterance.volume = 0.01;
        this.synth.speak(utterance);
      }
      this.isUnlocked = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  refreshVoices() {
    if (!this.synth) return [];
    const raw = this.synth.getVoices() || [];
    this.voices = this.filterEnglishVoices(raw);
    return this.voices;
  }

  speak(text, { priority = false } = {}) {
    if (!this.synth) return;

    this.configureAudioSession();

    try {
      if (this.synth.speaking) {
        this.synth.cancel();
      }

      const polishedText = this.humanizePacing(text);
      const utterance = new SpeechSynthesisUtterance(polishedText);
      utterance.rate = this.speechRate;
      utterance.pitch = this.speechPitch;
      utterance.volume = this.speechVolume;

      if (this.selectedVoiceURI && this.voices.length > 0) {
        const found = this.voices.find(v => v.voiceURI === this.selectedVoiceURI);
        if (found) {
          utterance.voice = found;
          utterance.lang = found.lang;
        }
      }

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('Speak error:', e);
    }
  }

  humanizePacing(text) {
    if (!text) return '';
    let t = text.trim();
    t = t.replace(/(\d+)%/g, '$1 percent');
    t = t.replace(/in 10 seconds,?/gi, 'In 10 seconds,');
    if (/^run at/i.test(t)) {
      t = 'Alright, ' + t;
    } else if (/^walk and/i.test(t)) {
      t = 'Nice job, now ' + t;
    }
    return t;
  }

  auditionVoice(voiceURI, callback) {
    if (!this.synth) return;
    this.configureAudioSession();

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

      utterance.onend = () => { if (callback) callback(); };
      utterance.onerror = () => { if (callback) callback(); };

      this.synth.speak(utterance);
    } catch (e) {
      if (callback) callback();
    }
  }

  testAudio(callback) {
    this.unlockAudio();
    this.speak("Interval Coach audio ready! Pick up your pace to 60 percent effort.", {
      priority: true
    });
    if (callback) callback();
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
