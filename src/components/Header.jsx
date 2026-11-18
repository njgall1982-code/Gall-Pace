import React from 'react';
import { Settings } from 'lucide-react';

export function Header({ onOpenSettings, activityMode = 'run' }) {
  return (
    <header
      className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 pb-2.5"
      style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
    >
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
            <p className="text-[11px] text-slate-400 leading-tight">
              {activityMode === 'bike' ? 'Cycling & Cadence Audio Coach' : 'Run & Walk Audio Timer'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-colors active:scale-95 shadow-sm"
            aria-label="Audio and Coach Settings"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
