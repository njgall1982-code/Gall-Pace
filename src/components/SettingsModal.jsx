import React, { useState, useEffect } from 'react';
import { X, Volume2, Bell, Radio, Smartphone, Sliders, CheckCircle2, Music, RefreshCw } from 'lucide-react';
import { audioManager } from '../services/audioManager';
import { storageService } from '../services/storage';

export function SettingsModal({ isOpen, onClose, onSettingsChanged }) {
  if (!isOpen) return null;

  const [settings, setSettings] = useState(() => storageService.getSettings());
  const [voices, setVoices] = useState([]);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    // Populate voices
    const updateVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const v = window.speechSynthesis.getVoices();
        setVoices(v);
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

    // Apply to audioManager directly
    if (key === 'chimeEnabled') audioManager.chimeEnabled = value;
    if (key === 'tenSecondWarning') audioManager.tenSecondWarningEnabled = value;
    if (key === 'countdownBeeps') audioManager.countdownEnabled = value;
    if (key === 'halfwayCues') audioManager.halfwayCueEnabled = value;
    if (key === 'audioDuckingKeepAlive') audioManager.duckingKeepAliveEnabled = value;
    if (key === 'speechRate') audioManager.speechRate = value;
    if (key === 'speechPitch') audioManager.speechPitch = value;
    if (key === 'speechVolume') audioManager.speechVolume = value;
    if (key === 'selectedVoiceURI') audioManager.selectedVoiceURI = value;

    if (onSettingsChanged) onSettingsChanged(updated);
  };

  const handleTestAudio = () => {
    setTesting(true);
    audioManager.testAudio(() => {
      setTesting(false);
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg max-h-[90vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Audio & Coaching Settings</h2>
              <p className="text-xs text-slate-400">Tune voice ducking, chimes, and pacing</p>
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
          {/* External Music Ducking & Keep-Alive Box */}
          <div className="bg-gradient-to-br from-emerald-950/30 to-teal-950/20 border border-emerald-500/30 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-white">Background Music Ducking & Session Keep-Alive</span>
                </div>
                <p className="text-xs text-slate-300">
                  Maintains an active mobile audio pipeline so speech cues cleanly punch through Pandora, Amazon Music, or Spotify and prevents your phone OS from sleeping workout timers.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.audioDuckingKeepAlive ?? true}
                onChange={(e) => handleChange('audioDuckingKeepAlive', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 mt-1 cursor-pointer"
              />
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Coaching Voice (Browser SpeechSynthesis)
            </label>
            <select
              value={settings.selectedVoiceURI || audioManager.selectedVoiceURI || ''}
              onChange={(e) => handleChange('selectedVoiceURI', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {voices.length === 0 ? (
                <option value="">Default System Voice</option>
              ) : (
                voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Voice Pacing & Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">Speaking Pace</span>
              <span className="text-emerald-400 font-mono">{settings.speechRate || 1.05}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={settings.speechRate || 1.05}
              onChange={(e) => handleChange('speechRate', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Relaxed (0.8x)</span>
              <span>Brisk Coach (1.05x)</span>
              <span>Fast (1.3x)</span>
            </div>
          </div>

          {/* Chime & Cues Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Audio Cues & Chimes</h3>

            {/* Pre-cue Harmonic Chime */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Pre-Cue Harmonic Bell Chime</span>
                <span className="text-[11px] text-slate-400 block">
                  Plays a subtle dual-tone chime before speech to notify your ears over background music.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.chimeEnabled ?? true}
                onChange={(e) => handleChange('chimeEnabled', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>

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

            {/* 3-2-1 Countdown Beeps */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">3-2-1 Audio Countdown Beeps</span>
                <span className="text-[11px] text-slate-400 block">
                  Acoustic ticks at 3, 2, 1 and high pitch whistle on interval switch.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.countdownBeeps ?? true}
                onChange={(e) => handleChange('countdownBeeps', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>

            {/* Halfway cues */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Halfway Milestone Cue</span>
                <span className="text-[11px] text-slate-400 block">
                  "Halfway there" spoken during longer run blocks (over 90s).
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
                  Vibrates device in pocket on interval switch.
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
                <span>Audio Verified!</span>
              </>
            ) : (
              <>
                <Volume2 className={`w-4 h-4 ${testing ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
                <span>{testing ? 'Playing Test...' : 'Test Coaching Audio'}</span>
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

