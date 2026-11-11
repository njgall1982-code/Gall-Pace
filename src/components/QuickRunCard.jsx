import React, { useMemo, useState } from 'react';
import { Play, Shuffle, Save, Minus, Plus, ChevronDown, ChevronUp, Zap, Check } from 'lucide-react';
import { generateRun, DEFAULT_PARAMS, INTENSITY_LEVELS, formatClock } from '../services/runGenerator';

const STORAGE_KEY = 'intervalcoach_quickrun';
const PARAMS_VERSION = 2;
const LENGTH_CHIPS = [15, 20, 30, 45, 60];
const INTENSITY_ORDER = ['gentle', 'normal', 'hard'];
const RUN_PCT_CHIPS = [25, 50, 75];
const MAX_RUN_CHIPS = [60, 90, 120, 180, 240, 300];
const MAX_WALK_CHIPS = [45, 60, 90, 120, 150];
const MIN_RUN_CHIPS = [15, 30, 45, 60];
const MIN_WALK_CHIPS = [15, 30, 45];

const PHASE_BAR = {
  warmup: 'bg-amber-500',
  run: 'bg-emerald-500',
  sprint: 'bg-rose-500',
  walk: 'bg-cyan-500',
  cooldown: 'bg-indigo-500',
};

const secLabel = (s) => (s % 60 === 0 ? `${s / 60}m` : s === 90 ? '1.5m' : s === 150 ? '2.5m' : `${s}s`);

function loadParams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PARAMS };
    const parsed = JSON.parse(raw);
    if (parsed?.v !== PARAMS_VERSION) return { ...DEFAULT_PARAMS };
    const { v: _v, ...rest } = parsed;
    return { ...DEFAULT_PARAMS, ...rest };
  } catch {
    return { ...DEFAULT_PARAMS };
  }
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
        active
          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function Label({ children, value }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{children}</span>
      {value && <span className="text-sm font-black text-white">{value}</span>}
    </div>
  );
}

export function QuickRunCard({ onStart, onSave }) {
  const [params, setParams] = useState(loadParams);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [showTweaks, setShowTweaks] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, v: PARAMS_VERSION }));
      } catch {
        // storage unavailable; settings just won't persist
      }
      return next;
    });
    setSaved(false);
  };

  const workout = useMemo(() => generateRun({ ...params, seed }), [params, seed]);
  const totalSec = workout.stats.totalSec;
  const activeLevel = INTENSITY_LEVELS[params.intensity] || INTENSITY_LEVELS.normal;

  const handleShuffle = () => {
    const prevPattern = workout.intervals
      .filter((iv) => iv.phase === 'run' || iv.phase === 'sprint')
      .map((iv) => iv.duration)
      .join(',');
    let nextSeed = Math.floor(Math.random() * 1e9);
    for (let i = 0; i < 8; i++) {
      const candidate = generateRun({ ...params, seed: nextSeed });
      const nextPattern = candidate.intervals
        .filter((iv) => iv.phase === 'run' || iv.phase === 'sprint')
        .map((iv) => iv.duration)
        .join(',');
      if (nextPattern !== prevPattern || candidate.stats.archetype !== workout.stats.archetype) {
        break;
      }
      nextSeed = Math.floor(Math.random() * 1e9);
    }
    setSeed(nextSeed);
    setSaved(false);
  };

  const handleSave = () => {
    onSave({ ...workout, id: `custom-${Date.now()}`, isCustom: true });
    setSaved(true);
  };

  return (
    <section className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-wide">Quick Run</h2>
          <span className="text-xs text-slate-400">Build a run in seconds</span>
        </div>
        {workout.stats.archetypeLabel && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-slate-300">
            {workout.stats.archetypeLabel}
          </span>
        )}
      </div>

      {/* Length */}
      <div>
        <Label value={`${params.totalMin} min`}>Length</Label>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            aria-label="Shorter"
            onClick={() => update({ totalMin: Math.max(10, params.totalMin - 5) })}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 active:scale-95"
          >
            <Minus className="w-4 h-4" />
          </button>
          {LENGTH_CHIPS.map((m) => (
            <Chip key={m} active={params.totalMin === m} onClick={() => update({ totalMin: m })}>
              {m}
            </Chip>
          ))}
          <button
            type="button"
            aria-label="Longer"
            onClick={() => update({ totalMin: Math.min(90, params.totalMin + 5) })}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 active:scale-95"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Intensity Level */}
      <div>
        <Label value={`${activeLevel.effortMin}–${activeLevel.effortMax}% effort`}>Level</Label>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITY_ORDER.map((id) => {
            const cfg = INTENSITY_LEVELS[id];
            const active = params.intensity === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => update({ intensity: id })}
                className={`px-3 py-2 rounded-xl text-left transition-all active:scale-95 border ${
                  active
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <div className="text-xs font-black">{cfg.label}</div>
                <div className={`text-[10px] font-semibold ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                  {cfg.effortMin}–{cfg.effortMax}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Run % */}
      <div>
        <Label value={`${params.runPct}% run / ${100 - params.runPct}% walk`}>Run vs walk</Label>
        <input
          type="range"
          min={10}
          max={90}
          step={5}
          value={params.runPct}
          onChange={(e) => update({ runPct: Number(e.target.value) })}
          className="w-full accent-emerald-500"
        />
        <div className="flex gap-2 mt-1">
          {RUN_PCT_CHIPS.map((p) => (
            <Chip key={p} active={params.runPct === p} onClick={() => update({ runPct: p })}>
              {p}%
            </Chip>
          ))}
        </div>
      </div>

      {/* Tweaks */}
      <div>
        <button
          type="button"
          onClick={() => setShowTweaks((v) => !v)}
          className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
        >
          {showTweaks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Tweak limits
        </button>
        {showTweaks && (
          <div className="mt-3 space-y-3 bg-slate-950/50 border border-slate-800 rounded-xl p-3">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={params.longerRunsInMiddle}
                onChange={(e) => update({ longerRunsInMiddle: e.target.checked })}
                className="w-4 h-4 accent-emerald-500"
              />
              Longer runs in the middle
            </label>
            <div>
              <Label value={secLabel(params.maxRunSec)}>Max run</Label>
              <div className="flex gap-2 flex-wrap">
                {MAX_RUN_CHIPS.filter((s) => s <= 240).map((s) => (
                  <Chip key={s} active={params.maxRunSec === s} onClick={() => update({ maxRunSec: s })}>
                    {secLabel(s)}
                  </Chip>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.allowLongRuns}
                  onChange={(e) => update({ allowLongRuns: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
                Allow runs over the max (up to 5 min)
              </label>
            </div>
            <div>
              <Label value={secLabel(params.maxWalkSec)}>Max walk</Label>
              <div className="flex gap-2 flex-wrap">
                {MAX_WALK_CHIPS.map((s) => (
                  <Chip key={s} active={params.maxWalkSec === s} onClick={() => update({ maxWalkSec: s })}>
                    {secLabel(s)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label value={secLabel(params.minRunSec)}>Shortest run</Label>
              <div className="flex gap-2 flex-wrap">
                {MIN_RUN_CHIPS.map((s) => (
                  <Chip key={s} active={params.minRunSec === s} onClick={() => update({ minRunSec: s })}>
                    {secLabel(s)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label value={secLabel(params.minWalkSec)}>Shortest walk</Label>
              <div className="flex gap-2 flex-wrap">
                {MIN_WALK_CHIPS.map((s) => (
                  <Chip key={s} active={params.minWalkSec === s} onClick={() => update({ minWalkSec: s })}>
                    {secLabel(s)}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Walks scale with</Label>
              <div className="flex gap-2">
                <Chip active={params.walkScaling === 'scaled'} onClick={() => update({ walkScaling: 'scaled' })}>
                  Run before
                </Chip>
                <Chip active={params.walkScaling === 'even'} onClick={() => update({ walkScaling: 'even' })}>
                  Even
                </Chip>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      <div>
        <div className="flex h-8 w-full rounded-lg overflow-hidden gap-px bg-slate-950" aria-label="Run preview">
          {workout.intervals.map((iv) => (
            <div
              key={iv.id}
              style={{ width: `${(iv.duration / totalSec) * 100}%` }}
              className={`${PHASE_BAR[iv.phase] || 'bg-slate-600'} ${iv.phase === 'run' || iv.phase === 'sprint' ? 'opacity-100' : 'opacity-60'}`}
              title={`${iv.name} (${iv.effort ? `${iv.effort}% effort` : 'recovery'}) · ${formatClock(iv.duration)}`}
            />
          ))}
        </div>
        <p className="text-xs text-slate-300 mt-2">
          <span className="font-bold text-white">{formatClock(totalSec)}</span> total ·{' '}
          {workout.stats.runCount} runs · longest {formatClock(workout.stats.longestRun)} ·{' '}
          <span className="font-bold text-emerald-300">{workout.stats.achievedRunPct}% run</span> ·{' '}
          <span className="font-semibold text-slate-200">
            {workout.stats.startEffort}%→{workout.stats.maxEffort}% effort
          </span>
        </p>
        {workout.notes.map((n) => (
          <p key={n} className="text-xs text-amber-300 mt-1">{n}</p>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onStart(workout)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-sm uppercase tracking-wider transition-all"
        >
          <Play className="w-4 h-4" /> Start
        </button>
        <button
          type="button"
          onClick={handleShuffle}
          className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-sm active:scale-95"
        >
          <Shuffle className="w-4 h-4" /> Shuffle
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saved}
          className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-sm active:scale-95 disabled:opacity-70"
        >
          {saved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </section>
  );
}

export default QuickRunCard;

