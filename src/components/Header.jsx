import React, { useState } from 'react';
import { Settings, Volume2, Music, CheckCircle2, Sparkles, Smartphone } from 'lucide-react';
import { audioManager } from '../services/audioManager';

export function Header({ onOpenSettings }) {
  const [testingAudio, setTestingAudio] = useState(false);
  const [testedSuccess, setTestedSuccess] = useState(false);

  const handleTestAudio = () => {
    setTestingAudio(true);
    audioManager.testAudio(() => {
      setTestingAudio(false);
      setTestedSuccess(true);
      setTimeout(() => setTestedSuccess(false), 3000);
    });
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-xl font-black text-slate-950 tracking-tighter">IC</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white uppercase">IntervalCoach</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-400">Audio coaching over your music</p>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2">
          {/* Quick Audio Test Button */}
          <button
            onClick={handleTestAudio}
            disabled={testingAudio}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border transition-all active:scale-95 shadow-sm ${
              testedSuccess
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-600'
            }`}
            title="Test Voice & Chimes"
          >
            {testedSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Audio Ready</span>
              </>
            ) : (
              <>
                <Volume2 className={`w-3.5 h-3.5 ${testingAudio ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
                <span className="text-xs font-medium">{testingAudio ? 'Testing...' : 'Test Audio'}</span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors active:scale-95"
            aria-label="Audio and Coach Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* External Music Tip Banner */}
      <div className="max-w-4xl mx-auto mt-2.5">
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-teal-500/10 text-teal-400">
              <Music className="w-3.5 h-3.5" />
            </div>
            <span>
              <strong className="text-teal-400 font-semibold">Music Agnostic:</strong> Play Pandora, Spotify or Amazon Music in background. IntervalCoach ducks audio over top.
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
export default Header;

