import React from 'react';
import { Play, Sliders, Trash2, Clock, Activity, Zap, Footprints, Wind, Flame } from 'lucide-react';
import { getWorkoutDuration, formatTimeHuman, PHASE_CONFIG } from '../data/defaultWorkouts';

export function WorkoutCard({ workout, onStart, onEdit, onDelete, isCustom }) {
  const totalSeconds = getWorkoutDuration(workout);
  const totalFormatted = formatTimeHuman(totalSeconds);
  const intervalCount = workout.intervals?.length || 0;

  // Calculate run vs walk proportions
  const runSeconds = workout.intervals?.filter(i => i.phase === 'run' || i.phase === 'sprint').reduce((s, i) => s + i.duration, 0) || 0;
  const walkSeconds = workout.intervals?.filter(i => i.phase === 'walk' || i.phase === 'warmup' || i.phase === 'cooldown').reduce((s, i) => s + i.duration, 0) || 0;

  // Effort range
  const efforts = workout.intervals?.map(i => i.effort).filter(e => typeof e === 'number') || [];
  const minEffort = efforts.length ? Math.min(...efforts) : null;
  const maxEffort = efforts.length ? Math.max(...efforts) : null;

  return (
    <div className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition-all shadow-md hover:shadow-xl hover:shadow-emerald-950/20 flex flex-col justify-between">
      <div>
        {/* Header tags */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {workout.category || 'Interval Run'}
            </span>
            {isCustom && (
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Custom
              </span>
            )}
            <span className="text-[11px] font-medium text-slate-400">
              {workout.level}
            </span>
          </div>

          {isCustom && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(workout.id);
              }}
              className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
              title="Delete custom workout"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Title & Subtitle */}
        <h3 className="text-xl font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">
          {workout.title}
        </h3>
        <p className="text-xs text-slate-400 mt-1 mb-3 line-clamp-2">
          {workout.description || workout.subtitle}
        </p>

        {/* Key Stats Bar */}
        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3.5 text-center">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Duration</div>
            <div className="text-sm font-extrabold text-white flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              {totalFormatted}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Intervals</div>
            <div className="text-sm font-extrabold text-white flex items-center justify-center gap-1 mt-0.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              {intervalCount} blocks
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Effort</div>
            <div className="text-sm font-extrabold text-white flex items-center justify-center gap-1 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {minEffort ? `${minEffort}% - ${maxEffort}%` : 'Moderate'}
            </div>
          </div>
        </div>

        {/* Interval Visual Timeline Preview */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
            <span>Interval Breakdown</span>
            <span>
              <strong className="text-emerald-400">{Math.round(runSeconds / 60)}m run</strong> / <strong className="text-cyan-400">{Math.round(walkSeconds / 60)}m walk</strong>
            </span>
          </div>

          {/* Segmented Timeline */}
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-800">
            {workout.intervals?.map((interval, idx) => {
              const widthPct = Math.max(3, (interval.duration / totalSeconds) * 100);
              let colorClass = 'bg-cyan-500';
              if (interval.phase === 'run') colorClass = 'bg-emerald-500';
              if (interval.phase === 'sprint') colorClass = 'bg-rose-500';
              if (interval.phase === 'warmup') colorClass = 'bg-amber-500';
              if (interval.phase === 'cooldown') colorClass = 'bg-indigo-500';

              return (
                <div
                  key={interval.id || idx}
                  className={`h-full rounded-sm transition-opacity hover:opacity-80 ${colorClass}`}
                  style={{ width: `${widthPct}%` }}
                  title={`${interval.name}: ${interval.duration}s (${interval.effort ? interval.effort + '%' : 'easy'})`}
                />
              );
            })}
          </div>

          {/* Phase legend preview */}
          <div className="flex items-center gap-2.5 mt-2 text-[10px] text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Run
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"></span> Walk
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Sprint
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Warm/Cool
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
        {/* Quick Edit Slider Modal Button */}
        <button
          onClick={() => onEdit(workout)}
          className="flex-1 py-3 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 active:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all active:scale-[0.98]"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>Quick-Edit</span>
        </button>

        {/* Start Workout Primary Button */}
        <button
          onClick={() => onStart(workout)}
          className="flex-[2] py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98]"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Start Run</span>
        </button>
      </div>
    </div>
  );
}
export default WorkoutCard;

