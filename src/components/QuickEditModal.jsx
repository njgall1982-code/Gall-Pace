import React, { useState } from 'react';
import { X, Plus, Trash2, Play, Save, Clock, Zap, ArrowUp, ArrowDown, ChevronRight, Copy } from 'lucide-react';
import { PHASE_CONFIG, formatTime, formatTimeHuman } from '../data/defaultWorkouts';

export function QuickEditModal({ workout, isOpen, onClose, onStartWithWorkout, onSaveCustom }) {
  if (!isOpen || !workout) return null;

  const [title, setTitle] = useState(workout.title || 'Custom Workout');
  const [description, setDescription] = useState(workout.description || '');
  const [intervals, setIntervals] = useState(
    JSON.parse(JSON.stringify(workout.intervals || []))
  );

  // Compute total duration dynamically
  const totalSeconds = intervals.reduce((acc, curr) => acc + (curr.duration || 0), 0);

  const handleDurationChange = (index, newDuration) => {
    const updated = [...intervals];
    updated[index].duration = Math.max(15, Math.min(1800, Number(newDuration)));
    setIntervals(updated);
  };

  const handleAdjustDuration = (index, deltaSeconds) => {
    const updated = [...intervals];
    const current = updated[index].duration || 60;
    updated[index].duration = Math.max(15, Math.min(1800, current + deltaSeconds));
    setIntervals(updated);
  };

  const handleEffortChange = (index, newEffort) => {
    const updated = [...intervals];
    updated[index].effort = Number(newEffort);
    setIntervals(updated);
  };

  const handlePhaseChange = (index, phase) => {
    const updated = [...intervals];
    updated[index].phase = phase;
    if (phase === 'walk' || phase === 'warmup' || phase === 'cooldown') {
      updated[index].effort = null;
    } else if (updated[index].effort === null) {
      updated[index].effort = PHASE_CONFIG[phase]?.defaultEffort || 60;
    }
    // Update default name if generic
    updated[index].name = `${PHASE_CONFIG[phase]?.label || 'Phase'}`;
    setIntervals(updated);
  };

  const handleDeleteInterval = (index) => {
    if (intervals.length <= 1) return;
    const updated = intervals.filter((_, idx) => idx !== index);
    setIntervals(updated);
  };

  const handleDuplicateInterval = (index) => {
    const item = { ...intervals[index], id: 'int-' + Date.now() + Math.random().toString(36).substr(2, 4) };
    const updated = [...intervals];
    updated.splice(index + 1, 0, item);
    setIntervals(updated);
  };

  const handleMoveInterval = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= intervals.length) return;
    const updated = [...intervals];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setIntervals(updated);
  };

  const handleAddInterval = (phase = 'run') => {
    const newInterval = {
      id: 'int-' + Date.now(),
      phase: phase,
      name: phase === 'run' ? 'Interval Run' : 'Recovery Walk',
      duration: phase === 'run' ? 120 : 60,
      effort: phase === 'run' ? 65 : null,
      cue: phase === 'run' ? 'Run at 65 percent effort' : 'Walk and recover'
    };
    setIntervals([...intervals, newInterval]);
  };

  const getEditedWorkoutObject = () => {
    return {
      ...workout,
      id: workout.id.startsWith('custom-') ? workout.id : `custom-${Date.now()}`,
      title,
      description,
      isCustom: true,
      intervals
    };
  };

  const handleStartNow = () => {
    const customWorkout = getEditedWorkoutObject();
    onStartWithWorkout(customWorkout);
    onClose();
  };

  const handleSave = () => {
    const customWorkout = getEditedWorkoutObject();
    onSaveCustom(customWorkout);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[92vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/90 flex items-center justify-between gap-3 bg-slate-950/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Quick-Edit Sliders
              </span>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                Total: <strong className="text-white">{formatTimeHuman(totalSeconds)}</strong>
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg sm:text-xl font-black text-white bg-transparent border-b border-dashed border-slate-700 hover:border-slate-500 focus:border-emerald-400 focus:outline-none mt-1 w-full"
              placeholder="Workout Name"
            />
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Intervals List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          <p className="text-xs text-slate-400 font-medium">
            Fine-tune durations and target effort percentages using the sliders below.
          </p>

          {intervals.map((interval, index) => {
            const config = PHASE_CONFIG[interval.phase] || PHASE_CONFIG.run;
            const isEffortApplicable = interval.phase === 'run' || interval.phase === 'sprint';

            return (
              <div
                key={interval.id || index}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 transition-all"
              >
                {/* Interval Top Bar */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-5">
                      #{index + 1}
                    </span>

                    {/* Phase Selector Chips */}
                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                      {['warmup', 'run', 'walk', 'sprint', 'cooldown'].map((p) => {
                        const active = interval.phase === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handlePhaseChange(index, p)}
                            className={`text-[10px] font-bold px-2 py-1 rounded transition-all uppercase ${
                              active
                                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {p === 'warmup' ? 'Warm' : p === 'cooldown' ? 'Cool' : p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions: Move & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveInterval(index, -1)}
                      className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === intervals.length - 1}
                      onClick={() => handleMoveInterval(index, 1)}
                      className="p-1 rounded text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateInterval(index)}
                      className="p-1 rounded text-slate-500 hover:text-cyan-400"
                      title="Duplicate Interval"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={intervals.length <= 1}
                      onClick={() => handleDeleteInterval(index)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 disabled:opacity-30"
                      title="Delete Interval"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Duration Slider + Steppers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Duration:</span>
                    <span className="font-mono font-extrabold text-sm text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {formatTime(interval.duration)} ({formatTimeHuman(interval.duration)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="15"
                      max="600"
                      step="15"
                      value={interval.duration}
                      onChange={(e) => handleDurationChange(index, e.target.value)}
                      className="flex-1 accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Quick Stepper Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAdjustDuration(index, -15)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                    >
                      -15s
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustDuration(index, 15)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                    >
                      +15s
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustDuration(index, 30)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                    >
                      +30s
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjustDuration(index, 60)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
                    >
                      +1m
                    </button>
                  </div>
                </div>

                {/* Target Effort Slider (if Run or Sprint) */}
                {isEffortApplicable && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Target Effort:
                      </span>
                      <span className="font-extrabold text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {interval.effort || 60}% Effort
                      </span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="100"
                      step="5"
                      value={interval.effort || 60}
                      onChange={(e) => handleEffortChange(index, e.target.value)}
                      className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Interval Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => handleAddInterval('run')}
              className="p-3 rounded-xl border border-dashed border-emerald-500/40 hover:border-emerald-500/70 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Run Block</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddInterval('walk')}
              className="p-3 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-500/70 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Walk Block</span>
            </button>
          </div>
        </div>

        {/* Modal Bottom Sticky Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800/90 bg-slate-950/80 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-700 transition-all active:scale-[0.98]"
          >
            <Save className="w-4 h-4 text-purple-400" />
            <span>Save as Custom</span>
          </button>

          <button
            type="button"
            onClick={handleStartNow}
            className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98]"
          >
            <Play className="w-4.5 h-4.5 fill-current" />
            <span>Start Run Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
export default QuickEditModal;

