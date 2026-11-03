import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Award, CheckCircle, Clock, Zap, Footprints, Flame, ArrowRight } from 'lucide-react';
import { formatTimeHuman } from '../data/defaultWorkouts';

export function WorkoutCompleteModal({ isOpen, workout, stats, onClose }) {
  if (!isOpen || !workout) return null;

  useEffect(() => {
    // Fire celebratory confetti shower
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 350);
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  }, []);

  const totalTime = stats?.totalTime || 0;
  const runTime = stats?.runTime || 0;
  const walkTime = stats?.walkTime || 0;
  const completedIntervals = stats?.completedIntervals || workout.intervals.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl text-center space-y-5">
        {/* Trophy / Ribbon Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/30">
          <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
            <Award className="w-10 h-10 text-emerald-400 animate-bounce" />
          </div>
        </div>

        {/* Heading */}
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Workout Conquered
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
            Outstanding Effort!
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {workout.title} completed successfully.
          </p>
        </div>

        {/* Athletic Stat Breakdown */}
        <div className="grid grid-cols-2 gap-2.5 text-left">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" /> Total Time
            </div>
            <div className="text-lg font-black text-white mt-0.5">
              {formatTimeHuman(totalTime)}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Flame className="w-3 h-3 text-emerald-400" /> Run Time
            </div>
            <div className="text-lg font-black text-emerald-400 mt-0.5">
              {formatTimeHuman(runTime)}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Footprints className="w-3 h-3 text-cyan-400" /> Walk Time
            </div>
            <div className="text-lg font-black text-cyan-400 mt-0.5">
              {formatTimeHuman(walkTime)}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-amber-400" /> Intervals
            </div>
            <div className="text-lg font-black text-amber-400 mt-0.5">
              {completedIntervals} / {workout.intervals.length}
            </div>
          </div>
        </div>

        {/* Motivational Coaching Message */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-medium">
          🎧 "Your background music kept the rhythm, and you hit every interval. Keep up this consistency!"
        </div>

        {/* Finish / Return Button */}
        <button
          onClick={onClose}
          className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 transition-all active:scale-95"
        >
          <span>Back to Workouts</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
export default WorkoutCompleteModal;

