import React, { useState } from 'react';
import { X, Volume2, Sliders, CheckCircle2, Music, Sparkles, Play, Bell } from 'lucide-react';
import { audioManager, STUDIO_VOICES } from '../services/audioManager';
import { storageService } from '../services/storage';

export function SettingsModal({ isOpen, onClose, onSettingsChanged }) {
  if (!isOpen) return null;

  const [settings, setSettings] = useState(() => storageService.getSettings());
  const [testing, setTesting] = useState(false);
  const [auditioningId, setAuditioningId] = useState(null);
  const [testSuccess, setTestSuccess] = useState(false);

  const selectedVoice = STUDIO_VOICES.some(v => v.id === settings.selectedVoiceURI)
    ? settings.selectedVoiceURI
    : audioManager.selectedVoiceURI;

  const handleChange = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    storageService.saveSettings(updated);

    if (key === 'chimeEnabled') audioManager.chimeEnabled = value;
    if (key === 'tenSecondWarning') audioManager.tenSecondWarningEnabled = value;
    if (key === 'countdownBeeps') audioManager.countdownEnabled = value;
    if (key === 'workoutHalfway') audioManager.workoutHalfwayEnabled = value;
    if (key === 'silentStart') audioManager.silentStart = value;
    if (key === 'speechRate') audioManager.speechRate = value;
    if (key === 'speechVolume') audioManager.speechVolume = value;
    if (key === 'audioSessionMode') {
      audioManager.audioSessionMode = value;
      audioManager.configureAudioSession();
    }
    if (key === 'selectedVoiceURI') {
      audioManager.selectedVoiceURI = value;
      audioManager.preloadCommonClips(value);
    }

    if (onSettingsChanged) onSettingsChanged(updated);
  };

  const handleAuditionVoice = (voiceId) => {
    setAuditioningId(voiceId);
    handleChange('selectedVoiceURI', voiceId);
    audioManager.auditionVoice(voiceId, () => {
      setAuditioningId(null);
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
              <h2 className="text-lg font-black text-white">Studio Coach & Music Settings</h2>
              <p className="text-xs text-slate-400">Built-in Neural AI Coaches • Zero Pandora Interruption</p>
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
          {/* Background Music Mixing Mode */}
          <div className="bg-gradient-to-br from-emerald-950/30 to-teal-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                <Music className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <span className="text-sm font-bold text-white block">
                  Non-Stop Pandora / Music Mixing (Web Audio Ambient)
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Plays studio neural voice buffers directly through Web Audio <code>ambient</code> mode instead of iOS speech synthesis — so <strong>Pandora never stops or pauses</strong>!
                </p>
                <p className="text-[11px] text-amber-300 font-semibold flex items-center gap-1 pt-0.5">
                  <Bell className="w-3.5 h-3.5 shrink-0" />
                  <span>Important on iPhone: Make sure Silent Mode (Bell switch) is OFF so iOS allows ambient audio mixing!</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleChange('audioSessionMode', 'ambient')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  (settings.audioSessionMode || 'ambient') === 'ambient'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="text-xs font-bold">Mix Over Music (Best)</div>
                <div className="text-[10px] opacity-80">Never pauses Pandora (Ringer ON)</div>
              </button>

              <button
                type="button"
                onClick={() => handleChange('audioSessionMode', 'transient')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  settings.audioSessionMode === 'transient'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="text-xs font-bold">Transient Ducking</div>
                <div className="text-[10px] opacity-80">Ducks volume during speech</div>
              </button>
            </div>
          </div>

          {/* Built-in Studio Neural Voice Cards (US, UK, AU) */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Select Studio Neural Coach (US / UK / AU)
            </label>

            <div className="grid grid-cols-1 gap-2">
              {STUDIO_VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                const isAuditioning = auditioningId === v.id;

                return (
                  <div
                    key={v.id}
                    onClick={() => handleChange('selectedVoiceURI', v.id)}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md shadow-emerald-950/30'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{v.flag}</span>
                      <div>
                        <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                          <span>{v.name}</span>
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{v.accent}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAuditionVoice(v.id);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center gap-1.5 border border-slate-700 shrink-0 active:scale-95 transition-all"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isAuditioning ? 'Playing...' : 'Sample'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voice Pacing & Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">Coach Speaking Speed</span>
              <span className="text-emerald-400 font-mono">{settings.speechRate || 1.0}x</span>
            </div>
            <input
              type="range"
              min="0.9"
              max="1.15"
              step="0.05"
              value={settings.speechRate || 1.0}
              onChange={(e) => handleChange('speechRate', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Cues Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Coaching Controls</h3>

            {/* Pre-cue Bell Chime */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Pre-Cue Harmonic Chime</span>
                <span className="text-[11px] text-slate-400 block">
                  Plays a gentle bell tone right before the coach speaks so you hear it clearly over music.
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
                  "In 10 seconds, get ready to run."
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
                <span className="text-xs font-bold text-slate-200 block">3-2-1 Countdown Beeps</span>
                <span className="text-[11px] text-slate-400 block">
                  Acoustic ticks on 3, 2, 1 transition.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.countdownBeeps ?? true}
                onChange={(e) => handleChange('countdownBeeps', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>

            {/* Workout Halfway Milestone */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Workout Halfway Milestone</span>
                <span className="text-[11px] text-slate-400 block">
                  "Halfway point of your workout! Keep it up." (Announced at the total time halfway mark).
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.workoutHalfway ?? true}
                onChange={(e) => handleChange('workoutHalfway', e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </label>

            {/* Show Quick-Start Guide on Home Screen */}
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
              <div className="space-y-0.5 pr-2">
                <span className="text-xs font-bold text-slate-200 block">Show Quick-Start Guide on Home Screen</span>
                <span className="text-[11px] text-slate-400 block">
                  1. Start Pandora/Spotify in background → 2. Pick a workout → 3. Hit Start Run.
                </span>
              </div>
              <input
                type="checkbox"
                checked={!settings.hideIntroGuide}
                onChange={(e) => handleChange('hideIntroGuide', !e.target.checked)}
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
                <span>Studio Coach Verified!</span>
              </>
            ) : (
              <>
                <Volume2 className={`w-4 h-4 ${testing ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
                <span>{testing ? 'Playing Studio Voice...' : 'Test Coach Over Music'}</span>
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
