import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw, X, Volume2, VolumeX,
  Sun, Moon, ShieldAlert, CheckCircle2, Music, Sparkles, ChevronRight, Zap, Footprints, Wind, Flame
} from 'lucide-react';
import { PHASE_CONFIG, formatTime, formatTimeHuman } from '../data/defaultWorkouts';
import { audioManager } from '../services/audioManager';
import { wakeLockService } from '../services/wakeLock';
import { storageService } from '../services/storage';

export function RunningScreen({ workout, onEndWorkout, onFinishWorkout }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(workout.intervals[0]?.duration || 60);
  const [isRunning, setIsRunning] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [audioVerified, setAudioVerified] = useState(false);

  // Performance tracking for completion modal
  const statsRef = useRef({
    totalTime: 0,
    runTime: 0,
    walkTime: 0,
    completedIntervals: 0
  });

  // Track cue states for the current interval to prevent duplicate triggers
  const cueStateRef = useRef({
    announcedStart: false,
    announcedHalfway: false,
    announcedTenSec: false,
    beepsCounted: new Set(),
  });

  const currentInterval = workout.intervals[currentIdx] || workout.intervals[0];
  const nextInterval = workout.intervals[currentIdx + 1] || null;
  const currentPhaseConfig = PHASE_CONFIG[currentInterval.phase] || PHASE_CONFIG.run;

  // Total workout remaining time calculation
  const totalWorkoutSeconds = workout.intervals.reduce((acc, curr) => acc + curr.duration, 0);
  const elapsedWorkoutSeconds = workout.intervals.slice(0, currentIdx).reduce((acc, curr) => acc + curr.duration, 0) + (currentInterval.duration - secondsLeft);
  const remainingWorkoutSeconds = Math.max(0, totalWorkoutSeconds - elapsedWorkoutSeconds);

  // WakeLock: Request upon mount, release upon unmount
  useEffect(() => {
    wakeLockService.request();
    audioManager.unlockAudio();
    audioManager.preloadWorkoutClips(workout);

    return () => {
      wakeLockService.release();
      audioManager.stopAll();
    };
  }, []);

  // Sync wakeLock with pause/resume
  useEffect(() => {
    if (isRunning) {
      wakeLockService.request();
    }
  }, [isRunning]);

  // Interval Change initialization
  useEffect(() => {
    if (!currentInterval) return;

    // Reset interval countdown and flags
    setSecondsLeft(currentInterval.duration);
    cueStateRef.current = {
      announcedStart: false,
      announcedHalfway: false,
      announcedTenSec: false,
      beepsCounted: new Set(),
    };

    // Haptic pulse on new interval
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const settings = storageService.getSettings();
      if (settings.hapticVibration !== false) {
        navigator.vibrate([200, 100, 200]);
      }
    }

    // Play initial Studio Neural clip (unless silentStart is enabled on block 0)
    if (!isMuted) {
      const isFirstBlock = currentIdx === 0;
      if (isFirstBlock && audioManager.silentStart) {
        cueStateRef.current.announcedStart = true;
      } else {
        audioManager.speakInterval(currentInterval);
        cueStateRef.current.announcedStart = true;
      }
    }
  }, [currentIdx, workout]);

  // Main 1-Second Timer Tick
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        // Track stats
        statsRef.current.totalTime += 1;
        if (currentInterval.phase === 'run' || currentInterval.phase === 'sprint') {
          statsRef.current.runTime += 1;
        } else {
          statsRef.current.walkTime += 1;
        }

        const remaining = prev - 1;

        // Halfway cue check (only for intervals >= 90s)
        const halfwayPoint = Math.floor(currentInterval.duration / 2);
        if (
          !isMuted &&
          audioManager.halfwayCueEnabled &&
          currentInterval.duration >= 90 &&
          remaining === halfwayPoint &&
          !cueStateRef.current.announcedHalfway
        ) {
          cueStateRef.current.announcedHalfway = true;
          audioManager.speakHalfway();
        }

        // 10-Second Warning Cue
        if (
          !isMuted &&
          audioManager.tenSecondWarningEnabled &&
          remaining === 10 &&
          !cueStateRef.current.announcedTenSec &&
          nextInterval
        ) {
          cueStateRef.current.announcedTenSec = true;
          audioManager.speakWarning(nextInterval);
        }

        // 3, 2, 1 Countdown Beeps
        if (
          audioManager.countdownEnabled &&
          (remaining === 3 || remaining === 2 || remaining === 1) &&
          !cueStateRef.current.beepsCounted.has(remaining)
        ) {
          cueStateRef.current.beepsCounted.add(remaining);
          audioManager.playCountdownBeep(false);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(60);
          }
        }

        // Interval finished!
        if (remaining <= 0) {
          statsRef.current.completedIntervals += 1;
          audioManager.playCountdownBeep(true); // Final high beep

          // Check if workout is finished
          if (currentIdx >= workout.intervals.length - 1) {
            // Completed whole workout!
            setIsRunning(false);
            audioManager.playCompletionChime();
            setTimeout(() => {
              audioManager.speakComplete();
            }, 600);

            storageService.logCompletedWorkout({
              title: workout.title,
              totalTime: statsRef.current.totalTime,
              runTime: statsRef.current.runTime,
              walkTime: statsRef.current.walkTime,
              completedIntervals: statsRef.current.completedIntervals
            });

            onFinishWorkout({
              ...statsRef.current,
              workoutTitle: workout.title
            });
            return 0;
          } else {
            // Advance to next interval
            setCurrentIdx((idx) => idx + 1);
            return 0;
          }
        }

        return remaining;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, currentIdx, currentInterval, nextInterval, workout, isMuted]);

  // Controls Handlers
  const handleTogglePlay = () => {
    setIsRunning(!isRunning);
    audioManager.unlockAudio();
  };

  const handleSkipNext = () => {
    if (currentIdx < workout.intervals.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setShowExitConfirm(true);
    }
  };

  const handleSkipPrev = () => {
    if (secondsLeft < currentInterval.duration - 3) {
      // If elapsed more than 3s, restart current interval
      setSecondsLeft(currentInterval.duration);
    } else if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleRestartInterval = () => {
    setSecondsLeft(currentInterval.duration);
    cueStateRef.current = {
      announcedStart: false,
      announcedHalfway: false,
      announcedTenSec: false,
      beepsCounted: new Set(),
    };
    if (!isMuted) {
      audioManager.speakInterval(currentInterval);
    }
  };

  const handleAudioCheck = () => {
    setAudioVerified(true);
    audioManager.testAudio(() => {
      setTimeout(() => setAudioVerified(false), 3000);
    });
  };

  // Percentage of current interval completed (0 to 100)
  const intervalProgressPct = Math.min(100, Math.max(0, ((currentInterval.duration - secondsLeft) / currentInterval.duration) * 100));

  // Determine dynamic styling based on phase
  const isHighContrast = highContrastMode;
  let themeBg = 'bg-slate-950';
  let badgeClass = currentPhaseConfig.bgClass;
  let timerTextColor = 'text-white';
  let accentBorder = currentPhaseConfig.cardBorder;

  if (isHighContrast) {
    themeBg = 'bg-black text-white';
    timerTextColor = 'text-white';
  } else if (currentInterval.phase === 'run') {
    timerTextColor = 'text-emerald-300';
  } else if (currentInterval.phase === 'sprint') {
    timerTextColor = 'text-rose-400';
  } else if (currentInterval.phase === 'walk') {
    timerTextColor = 'text-cyan-300';
  } else if (currentInterval.phase === 'warmup') {
    timerTextColor = 'text-amber-300';
  }

  return (
    <div className={`min-h-screen flex flex-col justify-between select-none ${themeBg} transition-colors duration-300`}>
      {/* Top Status Bar & Quick Glance Bar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          {/* Workout Title & Interval Indicator */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {workout.title}
            </div>
            <div className="text-xs font-black text-white flex items-center gap-1.5 mt-0.5">
              <span>Block {currentIdx + 1} of {workout.intervals.length}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono">{formatTime(remainingWorkoutSeconds)} left</span>
            </div>
          </div>

          {/* Quick Utility Toggles: Outdoor Mode, Audio Check, Mute, Exit */}
          <div className="flex items-center gap-1.5">
            {/* Audio Test Pill */}
            <button
              onClick={handleAudioCheck}
              className={`p-2 rounded-full border transition-all active:scale-95 ${
                audioVerified
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Test Speech & Chime"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Mute toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-full border transition-all active:scale-95 ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title={isMuted ? 'Unmute Coach Voice' : 'Mute Coach Voice'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
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
              title="End Workout"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Overall Workout Progress Track */}
        <div className="max-w-md mx-auto mt-3">
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden flex gap-0.5">
            {workout.intervals.map((int, i) => {
              const isPast = i < currentIdx;
              const isCurrent = i === currentIdx;
              let bg = 'bg-slate-800';
              if (isPast) bg = 'bg-slate-600';
              if (isCurrent) {
                if (int.phase === 'run') bg = 'bg-emerald-400';
                else if (int.phase === 'sprint') bg = 'bg-rose-500';
                else if (int.phase === 'walk') bg = 'bg-cyan-400';
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

      {/* Main Focus Area: Massive Countdown & Visual State Indicator */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-md mx-auto w-full text-center">
        {/* Dynamic Glowing Phase Badge */}
        <div className="mb-4">
          <div
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-2xl border text-sm sm:text-base font-black uppercase tracking-wider shadow-lg transition-all ${currentPhaseConfig.bgClass} ${currentPhaseConfig.glowClass}`}
          >
            {currentInterval.phase === 'run' && <Zap className="w-5 h-5 fill-current animate-pulse" />}
            {currentInterval.phase === 'sprint' && <Flame className="w-5 h-5 fill-current animate-bounce" />}
            {currentInterval.phase === 'walk' && <Footprints className="w-5 h-5" />}
            {currentInterval.phase === 'warmup' && <Flame className="w-5 h-5" />}
            {currentInterval.phase === 'cooldown' && <Wind className="w-5 h-5" />}

            <span>{currentInterval.name || currentPhaseConfig.label}</span>

            {/* Target Effort Badge */}
            {currentInterval.effort && (
              <span className="ml-1.5 px-2 py-0.5 rounded-lg bg-black/40 text-xs sm:text-sm font-black border border-white/20">
                {currentInterval.effort}% EFFORT
              </span>
            )}
          </div>
        </div>

        {/* Massive Digital Countdown Timer Display */}
        <div className="relative my-2 w-full py-4">
          <div
            className={`font-mono font-black tracking-tighter text-7xl sm:text-8xl md:text-9xl ${timerTextColor} drop-shadow-2xl transition-colors`}
          >
            {formatTime(secondsLeft)}
          </div>

          <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">
            Interval Countdown
          </div>
        </div>

        {/* Current Interval Progress Bar */}
        <div className="w-full max-w-xs mx-auto mb-6">
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                currentInterval.phase === 'run' ? 'bg-emerald-400' :
                currentInterval.phase === 'sprint' ? 'bg-rose-500' :
                currentInterval.phase === 'walk' ? 'bg-cyan-400' : 'bg-amber-400'
              }`}
              style={{ width: `${intervalProgressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1.5">
            <span>{formatTime(currentInterval.duration - secondsLeft)} elapsed</span>
            <span>{formatTimeHuman(currentInterval.duration)} total</span>
          </div>
        </div>

        {/* Upcoming Interval Preview Banner */}
        <div className="w-full max-w-sm bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Up Next
            </div>
            <div className="text-xs sm:text-sm font-black text-slate-200 mt-0.5 flex items-center gap-1.5">
              {nextInterval ? (
                <>
                  <span className={`w-2 h-2 rounded-full ${
                    nextInterval.phase === 'run' ? 'bg-emerald-400' :
                    nextInterval.phase === 'sprint' ? 'bg-rose-500' :
                    nextInterval.phase === 'walk' ? 'bg-cyan-400' : 'bg-amber-400'
                  }`} />
                  <span>{nextInterval.name || nextInterval.phase.toUpperCase()}</span>
                  <span className="text-slate-500">•</span>
                  <span className="font-mono text-slate-400">{formatTimeHuman(nextInterval.duration)}</span>
                  {nextInterval.effort && (
                    <span className="text-[11px] text-amber-400 font-bold">({nextInterval.effort}%)</span>
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
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                in {formatTime(secondsLeft)}
              </span>
            </div>
          )}
        </div>

        {/* Active Ducking Audio Indicator & Tip */}
        <div className="mt-4 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-2">
          <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Pandora Ducking Active • Resume in Control Center if needed</span>
        </div>
      </main>

      {/* Bottom Sticky Control Deck */}
      <footer className="p-4 sm:p-6 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-md">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Skip Previous / Restart */}
          <button
            onClick={handleSkipPrev}
            className="w-14 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-800 flex items-center justify-center active:scale-95 transition-all shadow-md"
            aria-label="Previous Interval or Restart"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          {/* Central Oversized Play / Pause Button */}
          <button
            onClick={handleTogglePlay}
            className={`flex-1 h-18 rounded-3xl font-black text-slate-950 flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl ${
              isRunning
                ? 'bg-amber-400 hover:bg-amber-300 shadow-amber-400/25'
                : 'bg-emerald-400 hover:bg-emerald-300 shadow-emerald-400/30 ring-4 ring-emerald-500/20'
            }`}
            aria-label={isRunning ? 'Pause Workout' : 'Resume Workout'}
          >
            {isRunning ? (
              <>
                <Pause className="w-7 h-7 fill-current" />
                <span className="text-base uppercase tracking-wider font-black">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-7 h-7 fill-current ml-1" />
                <span className="text-base uppercase tracking-wider font-black">Resume</span>
              </>
            )}
          </button>

          {/* Skip Next */}
          <button
            onClick={handleSkipNext}
            className="w-14 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-800 flex items-center justify-center active:scale-95 transition-all shadow-md"
            aria-label="Skip to Next Interval"
          >
            <SkipForward className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-white">End Workout Early?</h3>
            <p className="text-xs text-slate-400">
              You're doing great! Are you sure you want to stop this run session now?
            </p>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
              >
                Keep Running
              </button>
              <button
                onClick={() => {
                  setShowExitConfirm(false);
                  audioManager.stopAll();
                  onEndWorkout();
                }}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
              >
                Yes, End Run
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default RunningScreen;

