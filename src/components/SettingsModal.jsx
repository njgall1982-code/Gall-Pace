import React, { useState, useEffect } from 'react';
import { X, Volume2, Bell, Radio, Smartphone, Sliders, CheckCircle2, Music, Sparkles, Play, Info } from 'lucide-react';
import { audioManager } from '../services/audioManager';
import { storageService } from '../services/storage';

export function SettingsModal({ isOpen, onClose, onSettingsChanged }) {
  if (!isOpen) return null;

  const [settings, setSettings] = useState(() => storageService.getSettings());
  const [voices, setVoices] = useState([]);
  const [testing, setTesting] = useState(false);
  const [auditioningURI, setAuditioningURI] = useState(null);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const rawVoices = window.speechSynthesis.getVoices() || [];
        const sorted = audioManager.sortVoicesByQuality(rawVoices);
        setVoices(sorted);
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const handleChange = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    storageService.saveSettings(updated);

    if (key === 'chimeEnabled') audioManager.chimeEnabled = value;
    if (key === 'tenSecondWarning') audioManager.tenSecondWarningEnabled = value;
    if (key === 'countdownBeeps') audioManager.countdownEnabled = value;
    if (key === 'halfwayCues') audioManager.halfwayCueEnabled = value;
    if (key === 'speechRate') audioManager.speechRate = value;
    if (key === 'speechPitch') audioManager.speechPitch = value;
    if (key === 'speechVolume') audioManager.speechVolume = value;
    if (key === 'selectedVoiceURI') audioManager.selectedVoiceURI = value;

    if (onSettingsChanged) onSettingsChanged(updated);
  };

  const handleAuditionVoice = (uri) => {
    setAuditioningURI(uri);
    audioManager.auditionVoice(uri, () => {
      setAuditioningURI(null);
    });
  };

  const handleTestAudio = () => {
    setTesting(true);
    audioManager.testAudio(() => {
      setTesting(false);
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 2500);
    });
  };

  const selectedVoice = settings.selectedVoiceURI || audioManager.selectedVoiceURI;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[92vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Audio & Voice Settings</h2>
              <p className="text-xs text-slate-400">Background music & natural speech tuning</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* External Music Protection Card */}
          <div className="bg-gradient-to-br from-emerald-950/30 to-teal-950/20 border border-emerald-500/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <Music className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-bold text-white block">
                  Pandora & Background Music Ducking
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Uses pure native speech so iOS/Android automatically ducks your Pandora or Spotify volume down, speaks the coach cue, and raises music back up without stopping playback.
                </p>
              </div>
            </div>
          </div>

          {/* Voice Selection with Audition Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Coach Voice
              </label>
              <button
                type="button"
                onClick={() => handleAuditionVoice(selectedVoice)}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 transition-all active:scale-95"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{auditioningURI === selectedVoice ? 'Playing...' : 'Audition Voice'}</span>
              </button>
            </div>

            <select
              value={selectedVoice || ''}
              onChange={(e) => handleChange('selectedVoiceURI', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
            >
              {voices.length === 0 ? (
                <option value="">Default System Voice</option>
              ) : (
                voices.map((v) => {
                  const isNatural = /natural|enhanced|premium|siri|neural|google/i.test(v.name);
                  return (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {isNatural ? '⭐ ' : ''}{v.name} ({v.lang})
                    </option>
                  );
                })
              )}
            </select>

            {/* iPhone Pro Tip for Studio Quality Siri Voices */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">Want studio-quality voices on iPhone?</strong>
                <p className="mt-0.5 text-slate-400">
                  Go to iPhone <strong>Settings $\rightarrow$ Accessibility $\rightarrow$ Spoken Content $\rightarrow$ Voices $\rightarrow$ English</strong> and download <em>"Siri"</em>, <em>"Samantha (Enhanced)"</em>, or <em>"Daniel"</em>. They will sound like real humans!
                </p>
              </div>
            </div>
          </div>

          {/* Voice Pacing & Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">Speaking Pace</span>
              <span className="text-emerald-400 font-mono">{settings.speechRate || 0.98}x</span>
            </div>
            <input
              type="range"
              min="0.85"
              max="1.15"
              step="0.02"
              value={settings.speechRate || 0.98}
              onChange={(e) => handleChange('speechRate', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>Conversational (0.90x)</span>
              <span>Natural Human (0.98x)</span>
              <span>Brisk (1.10x)</span>
            </div>
          </div>

          {/* Cues Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Coaching Prompts</h3>

            {/* 10-Second Imminent Warning */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">10-Second Warning Cue</span>
                <span className="text-[11px] text-slate-400 block">
                  "In 10 seconds, get ready to run at 60% effort."
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.tenSecondWarning ?? true}
                onChange={(e) => handleChange('tenSecondWarning', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>

            {/* 3-2-1 Audio Countdown */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Countdown Beeps & Ticks</span>
                <span className="text-[11px] text-slate-400 block">
                  Subtle audio ticks on 3, 2, 1 transition.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.countdownBeeps ?? true}
                onChange={(e) => handleChange('countdownBeeps', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>

            {/* Pre-cue Bell Chime */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Pre-Cue Bell Chimes</span>
                <span className="text-[11px] text-slate-400 block">
                  Optional harmonic tone before cues (keep off for cleanest music ducking).
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.chimeEnabled ?? false}
                onChange={(e) => handleChange('chimeEnabled', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>

            {/* Halfway cues */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Halfway Milestone Cue</span>
                <span className="text-[11px] text-slate-400 block">
                  Spoken encouragement halfway through long intervals.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.halfwayCues ?? true}
                onChange={(e) => handleChange('halfwayCues', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>

            {/* Haptic vibration */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Phone Vibration / Haptics</span>
                <span className="text-[11px] text-slate-400 block">
                  Pulses device in pocket on interval switch.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.hapticVibration ?? true}
                onChange={(e) => handleChange('hapticVibration', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800/90 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            onClick={handleTestAudio}
            disabled={testing}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-95"
          >
            {testSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Coach Audio Ready!</span>
              </>
            ) : (
              <>
                <Volume2 className={`w-4 h-4 ${testing ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
                <span>{testing ? 'Testing...' : 'Test Coach Audio'}</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
export default SettingsModal;
