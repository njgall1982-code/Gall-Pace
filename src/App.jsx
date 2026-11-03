import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { WorkoutCard } from './components/WorkoutCard';
import { RunningScreen } from './components/RunningScreen';
import { QuickEditModal } from './components/QuickEditModal';
import { SettingsModal } from './components/SettingsModal';
import { WorkoutCompleteModal } from './components/WorkoutCompleteModal';
import { DEFAULT_WORKOUTS } from './data/defaultWorkouts';
import { storageService } from './services/storage';
import { audioManager } from './services/audioManager';
import { Plus, Sparkles, Filter, Download, Music2, Volume2, ShieldCheck, Play } from 'lucide-react';

export function App() {
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [completedStats, setCompletedStats] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customWorkouts, setCustomWorkouts] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Load custom workouts and apply settings on mount
  useEffect(() => {
    const saved = storageService.getCustomWorkouts();
    setCustomWorkouts(saved);

    const settings = storageService.getSettings();
    if (settings) {
      if (settings.chimeEnabled !== undefined) audioManager.chimeEnabled = settings.chimeEnabled;
      if (settings.tenSecondWarning !== undefined) audioManager.tenSecondWarningEnabled = settings.tenSecondWarning;
      if (settings.countdownBeeps !== undefined) audioManager.countdownEnabled = settings.countdownBeeps;
      if (settings.halfwayCues !== undefined) audioManager.halfwayCueEnabled = settings.halfwayCues;
      if (settings.audioDuckingKeepAlive !== undefined) audioManager.duckingKeepAliveEnabled = settings.audioDuckingKeepAlive;
      if (settings.speechRate) audioManager.speechRate = settings.speechRate;
      if (settings.speechPitch) audioManager.speechPitch = settings.speechPitch;
      if (settings.speechVolume) audioManager.speechVolume = settings.speechVolume;
      if (settings.selectedVoiceURI) audioManager.selectedVoiceURI = settings.selectedVoiceURI;
    }

    // Capture PWA install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const handleStartWorkout = (workout) => {
    audioManager.unlockAudio();
    setActiveWorkout(workout);
  };

  const handleSaveCustomWorkout = (workout) => {
    const updated = storageService.saveCustomWorkout(workout);
    setCustomWorkouts(updated);
  };

  const handleDeleteCustomWorkout = (id) => {
    const updated = storageService.deleteCustomWorkout(id);
    setCustomWorkouts(updated);
  };

  const handleCreateNewCustom = () => {
    const blankWorkout = {
      id: `custom-${Date.now()}`,
      title: 'My Custom Run',
      subtitle: 'Personalized Interval Workout',
      description: 'Custom intervals configured with sliders.',
      level: 'Custom',
      category: 'Custom',
      isCustom: true,
      intervals: [
        { id: 'c-1', phase: 'warmup', name: 'Warm-up Walk', duration: 180, effort: null, cue: 'Starting with a 3 minute warm up walk.' },
        { id: 'c-2', phase: 'run', name: 'Target Run', duration: 120, effort: 60, cue: 'Run at 60 percent effort for 2 minutes.' },
        { id: 'c-3', phase: 'walk', name: 'Walk Recovery', duration: 60, effort: null, cue: 'Walk for 1 minute to recover.' },
        { id: 'c-4', phase: 'run', name: 'Push Run', duration: 120, effort: 75, cue: 'Pick up the pace! Run at 75 percent effort.' },
        { id: 'c-5', phase: 'cooldown', name: 'Cool Down Walk', duration: 180, effort: null, cue: 'Cool down walk for 3 minutes.' }
      ]
    };
    setEditingWorkout(blankWorkout);
  };

  // Combine default and custom workouts
  const allWorkouts = [...customWorkouts, ...DEFAULT_WORKOUTS];

  // Filtering
  const filteredWorkouts = allWorkouts.filter((w) => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Custom') return w.isCustom;
    if (selectedFilter === 'Endurance') return w.category === 'Endurance' || w.category === 'Varied Intervals';
    if (selectedFilter === 'HIIT') return w.category === 'HIIT / Cardio' || w.category === 'Speed & Power';
    if (selectedFilter === 'Beginner') return w.category === 'Gentle Start' || w.level?.includes('Beginner');
    return true;
  });

  // If in active workout mode, render RunningScreen full-bleed
  if (activeWorkout) {
    return (
      <RunningScreen
        workout={activeWorkout}
        onEndWorkout={() => setActiveWorkout(null)}
        onFinishWorkout={(stats) => {
          setActiveWorkout(null);
          setCompletedStats(stats);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Sticky Header with Brand, Audio Test & Settings */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* PWA Install Banner (Mobile) */}
        {installPrompt && !isInstalled && (
          <div className="bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Install IntervalCoach to Phone</h4>
                <p className="text-xs text-slate-300">Pin to home screen for instant full-screen running.</p>
              </div>
            </div>
            <button
              onClick={handleInstallApp}
              className="py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md shrink-0"
            >
              Install PWA
            </button>
          </div>
        )}

        {/* Hero Step-by-Step Mini Guide */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Zero-Setup Workflow
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Web Audio Ready
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Run to your own music. Never miss an interval.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
            1. Launch Pandora, Amazon Music, or Spotify in the background.<br />
            2. Tap <strong>Start Run</strong> on any workout below. Audio coach seamlessly announces cues over top.
          </p>

          <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-slate-800/80 text-center">
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <div className="text-[10px] font-bold uppercase text-slate-500">Step 1</div>
              <div className="text-xs font-bold text-white mt-0.5">Start Music App</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <div className="text-[10px] font-bold uppercase text-slate-500">Step 2</div>
              <div className="text-xs font-bold text-emerald-400 mt-0.5">Pick Workout</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <div className="text-[10px] font-bold uppercase text-slate-500">Step 3</div>
              <div className="text-xs font-bold text-cyan-400 mt-0.5">Hit Start & Run</div>
            </div>
          </div>
        </div>

        {/* Workout Library Header & Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">
                Workout Library
              </h2>
              <p className="text-xs text-slate-400">
                Tap to start immediately, or customize durations with quick sliders
              </p>
            </div>

            {/* Create Custom Workout Button */}
            <button
              onClick={handleCreateNewCustom}
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>New Workout</span>
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {['All', 'Endurance', 'HIIT', 'Beginner', 'Custom'].map((filter) => {
              const active = selectedFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all shrink-0 ${active
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>
        </div>

        {/* High-Contrast Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredWorkouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              isCustom={workout.isCustom}
              onStart={handleStartWorkout}
              onEdit={(w) => setEditingWorkout(w)}
              onDelete={handleDeleteCustomWorkout}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 px-4 border-t border-slate-900 text-center text-xs text-slate-500">
        <p>IntervalCoach • Mobile-First PWA • External Music Agnostic Running Assistant</p>
      </footer>

      {/* Modals */}
      {editingWorkout && (
        <QuickEditModal
          workout={editingWorkout}
          isOpen={Boolean(editingWorkout)}
          onClose={() => setEditingWorkout(null)}
          onStartWithWorkout={handleStartWorkout}
          onSaveCustom={handleSaveCustomWorkout}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {completedStats && (
        <WorkoutCompleteModal
          isOpen={Boolean(completedStats)}
          workout={{ title: completedStats.workoutTitle, intervals: [] }}
          stats={completedStats}
          onClose={() => setCompletedStats(null)}
        />
      )}
    </div>
  );
}

export default App;
