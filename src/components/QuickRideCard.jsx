import React, { useMemo, useState } from 'react';
import { Play, Shuffle, Save, Bike, Mountain, Zap, RotateCw, Check } from 'lucide-react';
import {
  generateBikeWorkout,
  BIKE_PRESETS,
  BIKE_EFFORTS,
  BIKE_STYLES,
} from '../services/bikeGenerator';

const STORAGE_KEY = 'intervalcoach_quickride';
const PARAMS_VERSION = 1;
const LENGTH_CHIPS = [15, 20, 30, 45];

function loadParams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { totalMin: 20, effort: 'moderate', style: 'hills' };
    const parsed = JSON.parse(raw);
    if (parsed?.v !== PARAMS_VERSION) return { totalMin: 20, effort: 'moderate', style: 'hills' };
    const { v: _v, ...rest } = parsed;
    return { totalMin: 20, effort: 'moderate', style: 'hills', ...rest };
  } catch {
    return { totalMin: 20, effort: 'moderate', style: 'hills' };
  }
}

function Chip({ active, onClick, children, color = 'emerald' }) {
  const activeClass =
    color === 'amber'
      ? 'bg-amber-500 text-slate-950 border-amber-400'
      : color === 'rose'
      ? 'bg-rose-500 text-white border-rose-400'
      : 'bg-emerald-500 text-slate-950 border-emerald-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
        active
          ? activeClass
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

const PHASE_COLOR = {
  warmup: 'bg-amber-500',
  bike_flat: 'bg-emerald-500',
  bike_climb: 'bg-amber-500',
  bike_surge: 'bg-rose-500',
  bike_recovery: 'bg-cyan-500',
  cooldown: 'bg-indigo-500',
};

export function QuickRideCard({ onStart, onSave }) {
  const [params, setParams] = useState(loadParams);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [saved, setSaved] = useState(false);

  const update = (patch) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, v: PARAMS_VERSION }));
      } catch {
        // Storage unavailable
      }
      return next;
    });
    setSaved(false);
  };

  const workout = useMemo(
    () => generateBikeWorkout({ ...params, seed }),
    [params, seed]
  );

  const effortCfg = BIKE_EFFORTS[params.effort] || BIKE_EFFORTS.moderate;
  const styleCfg = BIKE_STYLES[params.style] || BIKE_STYLES.hills;

  const handleShuffle = () => {
    setSeed(Math.floor(Math.random() * 1e9));
    setSaved(false);
  };

  const handleSave = () => {
    if (onSave) {
      onSave({ ...workout, id: `custom-bike-${Date.now()}`, isCustom: true });
      setSaved(true);
    }
  };

  return (
    <section className="bg-gradient-to-br from-teal-950/60 to-slate-900 border border-teal-500/30 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      {/* Title Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bike className="w-5 h-5 text-teal-400" />
          <h2 className="text-sm font-black text-white uppercase tracking-wide">Quick Ride</h2>
          <span className="text-xs text-slate-400">Indoor Cycling & Peloton</span>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700 text-teal-300">
          {workout.stats.archetypeLabel}
        </span>
      </div>

      {/* Goal Presets */}
      <div>
        <Label>Goal preset</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {BIKE_PRESETS.map((preset) => {
            const isActive =
              params.totalMin === preset.totalMin &&
              params.effort === preset.effort &&
              params.style === preset.style;
            return (
              <Chip
                key={preset.id}
                active={isActive}
                onClick={() =>
                  update({
                    totalMin: preset.totalMin,
                    effort: preset.effort,
                    style: preset.style,
                  })
                }
              >
                {preset.label}
              </Chip>
            );
          })}
        </div>
      </div>

      {/* Session Length */}
      <div>
        <Label value={`${params.totalMin} min`}>Session length</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {LENGTH_CHIPS.map((m) => (
            <Chip
              key={m}
              active={params.totalMin === m}
              onClick={() => update({ totalMin: m })}
            >
              {m}m
            </Chip>
          ))}
        </div>
      </div>

      {/* Effort Intensity (Gentle / Moderate / Hard) */}
      <div>
        <Label value={effortCfg.zoneLabel}>Intensity & Target Zone</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.values(BIKE_EFFORTS).map((eff) => (
            <Chip
              key={eff.id}
              active={params.effort === eff.id}
              color={eff.color}
              onClick={() => update({ effort: eff.id })}
            >
              {eff.label}
            </Chip>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
          <span className="font-semibold text-slate-300">{effortCfg.description}.</span>
          <span>Resistance {effortCfg.resMin}–{effortCfg.resMax}.</span>
        </p>
      </div>

      {/* Workout Style (Rolling Hills / Speed Surges / Steady Rhythm) */}
      <div>
        <Label value={styleCfg.subtitle}>Workout Style</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.values(BIKE_STYLES).map((st) => (
            <Chip
              key={st.id}
              active={params.style === st.id}
              onClick={() => update({ style: st.id })}
            >
              {st.label}
            </Chip>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">
          {styleCfg.description}
        </p>
      </div>

      {/* Segmented Timeline Bar Preview */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold text-slate-300">
            {workout.intervals.length} segments • Max Res {workout.stats.peakResistance}
          </span>
          <span className="font-mono">{workout.stats.totalMin} min</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-900 border border-slate-800 flex overflow-hidden p-0.5 gap-0.5">
          {workout.intervals.map((iv, i) => (
            <div
              key={iv.id || i}
              style={{ flexGrow: iv.duration }}
              className={`h-full rounded-sm ${PHASE_COLOR[iv.phase] || 'bg-slate-600'}`}
              title={`${iv.name} (${iv.duration}s, Res: ${iv.resistance}, Cad: ${iv.cadence})`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Warm/Climb
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Flat
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Surge
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Recover
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Cooldown
          </span>
        </div>
      </div>

      {/* Action Deck */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleShuffle}
          className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-black uppercase tracking-wider border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
        >
          <Shuffle className="w-3.5 h-3.5 text-teal-400" />
          <span>Shuffle</span>
        </button>

        {onSave && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saved}
            className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              saved
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {saved ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Save className="w-3.5 h-3.5 text-slate-400" />}
            <span>{saved ? 'Saved' : 'Save'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onStart(workout)}
          className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 active:scale-95 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all"
        >
          <Play className="w-4 h-4 fill-slate-950" />
          <span>Start Ride</span>
        </button>
      </div>
    </section>
  );
}
export default QuickRideCard;
