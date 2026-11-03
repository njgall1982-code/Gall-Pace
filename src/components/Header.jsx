import React, { useState } from 'react';
import { Settings, Volume2, CheckCircle2 } from 'lucide-react';
import { audioManager } from '../services/audioManager';

export function Header({ onOpenSettings }) {
  const [testingAudio, setTestingAudio] = useState(false);
  const [testedSuccess, setTestedSuccess] = useState(false);

  const handleTestAudio = () => {
    setTestingAudio(true);
    audioManager.testAudio(() => {
      setTestingAudio(false);
      setTestedSuccess(true);
      setTimeout(() => setTestedSuccess(false), 2500);
    });
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center shadow-md shadow-emerald-500/20">
            <span className="text-base font-black text-slate-950 tracking-tighter">IC</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase leading-tight">
              IntervalCoach
            </h1>
            <p className="text-[11px] text-slate-400 leading-tight">Run & Walk Audio Timer</p>
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
            title="Test Coach Voice"
          >
            {testedSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Voice Ready</span>
              </>
            ) : (
              <>
                <Volume2 className={`w-3.5 h-3.5 ${testingAudio ? 'animate-pulse text-emerald-400' : 'text-slate-400'}`} />
                <span>{testingAudio ? 'Playing...' : 'Test Voice'}</span>
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
    </header>
  );
}
export default Header;
