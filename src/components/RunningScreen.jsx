import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, X, Volume2, VolumeX,
  Sun, ShieldAlert, CheckCircle2, Zap, Footprints, Wind, Flame, Plus, Lock, Bike
} from 'lucide-react';
import { PHASE_CONFIG, formatTime, formatTimeHuman } from '../data/defaultWorkouts';
import { audioManager } from '../services/audioManager';
import { storageService } from '../services/storage';

export function RunningScreen({ workout, onEndWorkout, onFinishWorkout }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(workout.intervals[0]?.duration || 60);
  const [currentBlockTotal, setCurrentBlockTotal] = useState(workout.intervals[0]?.duration || 60);
  const [isRunning, setIsRunning] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [isPocketLocked, setIsPocketLocked] = useState(false);

  const lastTapTimeRef = useRef(0);
  const isMutedRef = useRef(false);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Performance tracking for completion modal
  const statsRef = useRef({
    totalTime: 0,
    runTime: 0,
    walkTime: 0,
    completedIntervals: 0
  });

  const currentInterval = workout.intervals[currentIdx] || workout.intervals[0];
  const nextInterval = workout.intervals[currentIdx + 1] || null;
  const currentPhaseConfig = PHASE_CONFIG[currentInterval.phase] || PHASE_CONFIG.run;
  const isBikeWorkout = workout?.activity === 'bike' || Boolean(currentInterval?.cadence);

  // Total workout remaining time calculation
  const futureIntervalsSeconds = workout.intervals
    .slice(currentIdx + 1)
    .reduce((acc, curr) => acc + curr.duration, 0);
  const remainingWorkoutSeconds = Math.max(0, secondsLeft + futureIntervalsSeconds);

  const finishedHandledRef = useRef(false);

  // Connect directly to NativeAudioCoach (SceneDelegate.swift)
  useEffect(() => {
    audioManager.setNativeWorkoutStateListener((state) => {
      if (!state) return;
      statsRef.current = {
        totalTime: state.totalTime ?? 0,
        runTime: state.runTime ?? 0,
        walkTime: state.walkTime ?? 0,
        completedIntervals: state.completedIntervals ?? 0,
      };
      if (typeof state.currentIdx === 'number') setCurrentIdx(state.currentIdx);
      if (typeof state.secondsLeft === 'number') setSecondsLeft(state.secondsLeft);
      if (typeof state.currentBlockTotal === 'number') setCurrentBlockTotal(state.currentBlockTotal);
      if (typeof state.isRunning === 'boolean') setIsRunning(state.isRunning);

      if (state.isCompleted && !finishedHandledRef.current) {
        finishedHandledRef.current = true;
        setIsPocketLocked(false);
        storageService.logCompletedWorkout({
          title: workout.title,
          totalTime: statsRef.current.totalTime,
          runTime: statsRef.current.runTime,
          walkTime: statsRef.current.walkTime,
          completedIntervals: statsRef.current.completedIntervals,
        });
        onFinishWorkout({
          ...statsRef.current,
          workoutTitle: workout.title,
        });
      }
    });

    audioManager.setNativeWorkoutStopListener(() => {
      onEndWorkout();
    });

    audioManager.startNativeWorkout(workout, { isMuted: isMutedRef.current });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        audioManager.requestNativeWorkoutState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      audioManager.setNativeWorkoutStateListener(null);
      audioManager.setNativeWorkoutStopListener(null);
      audioManager.stopNativeWorkout();
    };
  }, []);

  // Controls Handlers: routed directly to NativeAudioCoach in Swift
  const handleTogglePlay = () => {
    if (isRunning) {
      audioManager.pauseNativeWorkout();
      setIsRunning(false);
    } else {
      audioManager.resumeNativeWorkout();
      setIsRunning(true);
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
    audioManager.setNativeWorkoutMuted(nextMuted);
  };

  const handleAddThirtySeconds = () => {
    audioManager.addNativeWorkoutSeconds(30);
  };

  const handleSkipNext = () => {
    if (currentIdx < workout.intervals.length - 1) {
      audioManager.skipNextNativeWorkout();
    } else {
      setShowExitConfirm(true);
    }
  };

  const handleSkipPrev = () => {
    audioManager.skipPrevNativeWorkout();
  };

  // Double-tap handler to exit Pocket Lock / OLED Blackout mode
  const handlePocketOverlayTap = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 400) {
      setIsPocketLocked(false);
    }
    lastTapTimeRef.current = now;
  };

  // Percentage of current interval completed (0 to 100)
  const intervalProgressPct = Math.min(
    100,
    Math.max(0, ((currentBlockTotal - secondsLeft) / currentBlockTotal) * 100)
  );

  // Dynamic styling based on phase
  const isHighContrast = highContrastMode;
  let themeBg = 'bg-slate-950';
  let timerTextColor = 'text-white';

  if (isHighContrast) {
    themeBg = 'bg-black text-white';
    timerTextColor = 'text-white';
  } else if (currentInterval.phase === 'run' || currentInterval.phase === 'bike_flat') {
    timerTextColor = 'text-emerald-300';
  } else if (currentInterval.phase === 'sprint' || currentInterval.phase === 'bike_surge') {
    timerTextColor = 'text-rose-400';
  } else if (currentInterval.phase === 'walk' || currentInterval.phase === 'bike_recovery') {
    timerTextColor = 'text-cyan-300';
  } else if (currentInterval.phase === 'warmup' || currentInterval.phase === 'bike_climb') {
    timerTextColor = 'text-amber-300';
  } else if (currentInterval.phase === 'cooldown') {
    timerTextColor = 'text-indigo-300';
  }

  return (
    <div
      className={`fixed inset-0 h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between select-none ${themeBg} transition-colors duration-300`}
    >
      {/* Top Status Bar */}
      <div
        className="px-4 pb-2.5 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md shrink-0"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          {/* Workout Title & Interval Indicator */}
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
              {workout.title}
            </div>
            <div className="text-xs font-black text-white flex items-center gap-1.5 mt-0.5">
              <span>Block {currentIdx + 1}/{workout.intervals.length}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono">{formatTime(remainingWorkoutSeconds)} left</span>
            </div>
          </div>

          {/* Utility Controls: Pocket Blackout, Voice Mute Pill, Sunlight Mode, End Run */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pocket Screen Blackout / Lock Button */}
            <button
              onClick={() => {
                audioManager.unlockAudio();
                wakeLockService.request();
                setIsPocketLocked(true);
              }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-full border bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600 text-xs font-bold transition-all active:scale-95"
              title="Pocket Blackout Mode (Turns screen black & locks buttons while keeping voice active)"
            >
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Pocket</span>
            </button>

            {/* Explicit Mute / Unmute Pill Button */}
            <button
              onClick={handleToggleMute}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-full border text-xs font-bold transition-all active:scale-95 ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}
              title={isMuted ? 'Tap to Unmute Coach' : 'Tap to Mute Coach'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Voice</span>
                </>
              )}
            </button>

            {/* High Contrast Outdoor Mode */}
            <button
              onClick={() => setHighContrastMode(!highContrastMode)}
              className={`p-2 rounded-full border transition-all active:scale-95 ${
                highContrastMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
              title="Toggle Outdoor High-Contrast Sunlight Mode"
            >
              <Sun className="w-4 h-4" />
            </button>

            {/* Exit Workout button */}
            <button
              onClick={() => setShowExitConfirm(true)}
              className="p-2 rounded-full bg-slate-900 text-slate-400 hover:text-rose-400 border border-slate-800 transition-all active:scale-95"
              title={isBikeWorkout ? 'End Ride' : 'End Workout'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Overall Workout Segmented Progress Track */}
        <div className="max-w-md mx-auto mt-2.5">
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden flex gap-0.5">
            {workout.intervals.map((int, i) => {
              const isPast = i < currentIdx;
              const isCurrent = i === currentIdx;
              let bg = 'bg-slate-800';
              if (isPast) bg = 'bg-slate-600';
              if (isCurrent) {
                if (int.phase === 'run' || int.phase === 'bike_flat') bg = 'bg-emerald-400';
                else if (int.phase === 'sprint' || int.phase === 'bike_surge') bg = 'bg-rose-500';
                else if (int.phase === 'walk' || int.phase === 'bike_recovery') bg = 'bg-cyan-400';
                else if (int.phase === 'bike_climb') bg = 'bg-amber-400';
                else if (int.phase === 'cooldown') bg = 'bg-indigo-400';
                else bg = 'bg-amber-400';
              }
              return (
                <div
                  key={int.id || i}
                  className={`h-full flex-1 rounded-sm transition-all duration-300 ${bg}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Center Area: Fits dynamically in viewport without scrolling */}
      <main className="flex-1 flex flex-col items-center justify-evenly px-4 py-2 max-w-md mx-auto w-full text-center min-h-0">
        {/* Dynamic Glowing Phase Badge */}
        <div>
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl border text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg transition-all ${currentPhaseConfig.bgClass} ${currentPhaseConfig.glowClass}`}
          >
            {currentInterval.phase === 'run' && <Zap className="w-4 h-4 fill-current animate-pulse" />}
            {currentInterval.phase === 'sprint' && <Flame className="w-4 h-4 fill-current animate-bounce" />}
            {currentInterval.phase === 'walk' && <Footprints className="w-4 h-4" />}
            {currentInterval.phase === 'warmup' && (isBikeWorkout ? <Bike className="w-4 h-4" /> : <Flame className="w-4 h-4" />)}
            {currentInterval.phase === 'cooldown' && (isBikeWorkout ? <Bike className="w-4 h-4" /> : <Wind className="w-4 h-4" />)}
            {currentInterval.phase?.startsWith('bike_') && <Bike className="w-4 h-4" />}

            <span>{currentInterval.name || currentPhaseConfig.label}</span>

            {currentInterval.effort && (
              <span className="ml-1 px-2 py-0.5 rounded-lg bg-black/40 text-xs font-black border border-white/20">
                {currentInterval.effort}% EFFORT
              </span>
            )}
          </div>
        </div>

        {/* Massive Digital Countdown Timer Display */}
        <div className="w-full">
          <div
            className={`font-mono font-black tracking-tighter text-7xl sm:text-8xl leading-none ${timerTextColor} drop-shadow-2xl transition-colors`}
          >
            {formatTime(secondsLeft)}
          </div>
        </div>

        {/* Dedicated High-Visibility Cycling Target HUD (Optimized for 3ft distance) */}
        {isBikeWorkout && (
          <div className="grid grid-cols-3 gap-2 w-full max-w-sm mx-auto py-2.5 px-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="text-center flex flex-col justify-center">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Cadence</span>
              <span className="text-xl sm:text-2xl font-black text-teal-300 font-mono tracking-tight leading-tight mt-0.5">
                {currentInterval.cadence || '80–90'}
              </span>
            </div>
            <div className="text-center border-x border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Resistance</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight leading-tight mt-0.5">
                {currentInterval.resistance || '30'}
              </span>
            </div>
            <div className="text-center flex flex-col justify-center items-center">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">Position</span>
              {currentInterval.position === 'standing' ? (
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/25 border border-amber-500/50 text-amber-300 text-xs font-black shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse">
                  🚴 Stand
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold">
                  🪑 Saddle
                </span>
              )}
            </div>
          </div>
        )}

        {/* Current Interval Progress Bar + Quick +30s Button */}
        <div className="w-full max-w-xs mx-auto">
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                currentInterval.phase === 'run' || currentInterval.phase === 'bike_flat' ? 'bg-emerald-400' :
                currentInterval.phase === 'sprint' || currentInterval.phase === 'bike_surge' ? 'bg-rose-500' :
                currentInterval.phase === 'walk' || currentInterval.phase === 'bike_recovery' ? 'bg-cyan-400' :
                currentInterval.phase === 'cooldown' ? 'bg-indigo-400' : 'bg-amber-400'
              }`}
              style={{ width: `${intervalProgressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1.5">
            <span>{formatTime(currentBlockTotal - secondsLeft)} elapsed</span>
            <button
              onClick={handleAddThirtySeconds}
              className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-sans font-bold text-[10px] flex items-center gap-0.5 active:scale-95 transition-all"
              title="Add 30 seconds to current block"
            >
              <Plus className="w-2.5 h-2.5 text-emerald-400" />
              <span>30s</span>
            </button>
            <span>{formatTimeHuman(currentBlockTotal)} total</span>
          </div>
        </div>

        {/* Upcoming Interval Preview Banner */}
        <div className="w-full max-w-sm bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 text-left">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Up Next
            </div>
            <div className="text-xs sm:text-sm font-black text-slate-200 mt-0.5 flex items-center gap-1.5 truncate">
              {nextInterval ? (
                <>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    nextInterval.phase === 'run' || nextInterval.phase === 'bike_flat' ? 'bg-emerald-400' :
                    nextInterval.phase === 'sprint' || nextInterval.phase === 'bike_surge' ? 'bg-rose-500' :
                    nextInterval.phase === 'walk' || nextInterval.phase === 'bike_recovery' ? 'bg-cyan-400' :
                    nextInterval.phase === 'cooldown' ? 'bg-indigo-400' :
                    'bg-amber-400'
                  }`} />
                  <span className="truncate">{nextInterval.name || nextInterval.phase.toUpperCase()}</span>
                  <span className="text-slate-500">•</span>
                  <span className="font-mono text-slate-400 shrink-0">{formatTimeHuman(nextInterval.duration)}</span>
                  {nextInterval.effort && (
                    <span className="text-[11px] text-amber-400 font-bold shrink-0">({nextInterval.effort}%)</span>
                  )}
                  {nextInterval.resistance && (
                    <span className="text-[11px] text-amber-400 font-bold shrink-0">(Res {nextInterval.resistance} • {nextInterval.cadence})</span>
                  )}
                </>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Finish Line!
                </span>
              )}
            </div>
          </div>

          {nextInterval && (
            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                in {formatTime(secondsLeft)}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Control Deck — Always visible at bottom of viewport */}
      <footer className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-md shrink-0">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Skip Previous / Restart */}
          <button
            onClick={handleSkipPrev}
            className="w-16 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-800 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all shadow-md"
            aria-label="Previous Interval or Restart"
          >
            <SkipBack className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {secondsLeft < currentBlockTotal - 3 ? 'Restart' : 'Prev'}
            </span>
          </button>

          {/* Central Oversized Play / Pause Button */}
          <button
            onClick={handleTogglePlay}
            className={`flex-1 h-14 rounded-2xl font-black text-slate-950 flex items-center justify-center gap-2.5 transition-all active:scale-95 shadow-xl ${
              isRunning
                ? 'bg-amber-400 hover:bg-amber-300 shadow-amber-400/20'
                : 'bg-emerald-400 hover:bg-emerald-300 shadow-emerald-400/30 ring-4 ring-emerald-500/20'
            }`}
            aria-label={isRunning ? 'Pause Workout' : 'Resume Workout'}
          >
            {isRunning ? (
              <>
                <Pause className="w-6 h-6 fill-current" />
                <span className="text-base uppercase tracking-wider font-black">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6 fill-current ml-0.5" />
                <span className="text-base uppercase tracking-wider font-black">Resume</span>
              </>
            )}
          </button>

          {/* Skip Next */}
          <button
            onClick={handleSkipNext}
            className="w-16 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-800 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all shadow-md"
            aria-label="Skip to Next Interval"
          >
            <SkipForward className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Next</span>
          </button>
        </div>
      </footer>

      {/* OLED Pitch-Black Pocket Lock Overlay (Keeps Voice Active & Saves Battery in Pocket) */}
      {isPocketLocked && (
        <div
          onClick={handlePocketOverlayTap}
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer"
        >
          <Lock className="w-8 h-8 text-neutral-700 mb-3" />
          <div className="font-mono text-4xl font-bold text-neutral-700">
            {formatTime(secondsLeft)}
          </div>
          <div className="text-xs font-semibold text-neutral-600 mt-1 uppercase tracking-widest">
            {currentInterval.name || currentPhaseConfig.label}
          </div>
          <div className="mt-10 px-4 py-2 rounded-full border border-neutral-800 text-neutral-600 text-xs font-medium">
            Pocket Mode Active • Double-tap screen to unlock
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-white">
              End {isBikeWorkout ? 'Ride' : 'Workout'} Early?
            </h3>
            <p className="text-xs text-slate-400">
              You're doing great! Are you sure you want to stop this {isBikeWorkout ? 'ride' : 'run'} session now?
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
              >
                {isBikeWorkout ? 'Keep Riding' : 'Keep Running'}
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  audioManager.stopNativeWorkout();
                  onEndWorkout();
                }}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
              >
                {isBikeWorkout ? 'Yes, End Ride' : 'Yes, End Run'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default RunningScreen;
