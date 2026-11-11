/**
 * Quick Run generator for IntervalCoach.
 *
 * A pure, deterministic ("dumb") function: same params + seed => same workout.
 * Produces the standard workout object (intervals[] of { id, phase, name,
 * duration, effort, cue }) so RunningScreen / audioManager work unchanged.
 *
 * Layout: 2 min warm-up, main block (R W R W ... R), 2 min cooldown.
 * "Run %" is the share of the MAIN block (warm-up/cooldown excluded) spent running.
 */

// Durations (seconds) that have pre-recorded voice clips (see audioManager DURATION_TAGS).
export const CLIP_DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];

export const WARMUP_SEC = 120;
export const COOLDOWN_SEC = 120;
export const RUN_EFFORT = 55;
export const MAX_RUN_HARD_CAP = 300; // longest voice clip

export const INTENSITY_LEVELS = {
  gentle: {
    id: 'gentle',
    label: 'Gentle',
    description: 'Easy jogs, softer ramp (30–50%)',
    effortMin: 30,
    effortMax: 50,
    firstRunCap: 35,
    secondRunCap: 45,
    baseRange: [33, 43],
    surgeDelta: 4,
    durBoostMax: 0,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    description: 'Gradual build, steady pace (35–65%)',
    effortMin: 35,
    effortMax: 65,
    firstRunCap: 40,
    secondRunCap: 50,
    baseRange: [44, 56],
    surgeDelta: 8,
    durBoostMax: 5,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    description: 'Easy start, stronger push (40–80%)',
    effortMin: 40,
    effortMax: 80,
    firstRunCap: 40,
    secondRunCap: 55,
    baseRange: [52, 68],
    surgeDelta: 12,
    durBoostMax: 5,
  },
};

export const ARCHETYPES = {
  snappy: { id: 'snappy', label: 'Snappy Repeats' },
  pyramid: { id: 'pyramid', label: 'Middle Peak' },
  steady: { id: 'steady', label: 'Steady Rhythm' },
  cruise: { id: 'cruise', label: 'Longer Blocks' },
};

/**
 * Calculates a gradual, adult-friendly effort progression for runs and walks.
 * - Enforces an easy on-ramp: Run 1 is always capped (<= 40% default, <= 35% gentle),
 *   and Run 2 stays conservative so workouts never spike straight out of warm-up.
 * - Intensity level ('gentle' | 'normal' | 'hard') sets the effort ceiling and slope.
 * - Overall runPct gently nudges base effort within the chosen intensity's band.
 */
export function calculateEffortArc(runs, walks, runPct, rng, intensity = 'normal') {
  const n = runs.length;
  if (!n) return { runEfforts: [], walkNames: [] };

  const cfg = INTENSITY_LEVELS[intensity] || INTENSITY_LEVELS.normal;
  const pctNorm = clamp((runPct - 10) / 80, 0, 1);
  const baseEffort = cfg.baseRange[0] + pctNorm * (cfg.baseRange[1] - cfg.baseRange[0]);

  // Available effort steps in voice clips: 30..95 in steps of 5
  const snapEffort = (val, lo = cfg.effortMin, hi = cfg.effortMax) =>
    clamp(Math.round(val / 5) * 5, lo, hi);

  // Progression shape per shuffle seed:
  // 0: Gradual Ramp (starts low, builds steadily toward final third)
  // 1: Gentle Pyramid (starts low, peaks in middle, eases off slightly at finish)
  // 2: Rolling Surges (alternates steady and slightly firmer pushes after warm-in)
  const styleRoll = rng ? Math.floor(rng() * 3) : 0;

  const runEfforts = runs.map((dur, i) => {
    const progress = n > 1 ? i / (n - 1) : 0;
    let curveDelta = 0;

    if (styleRoll === 0) {
      curveDelta = (progress - 0.35) * (cfg.surgeDelta * 1.8);
    } else if (styleRoll === 1) {
      curveDelta = Math.sin(progress * Math.PI) * (cfg.surgeDelta * 1.4) - cfg.surgeDelta * 0.4;
    } else {
      const wave = i >= 2 && i % 2 === 1 ? cfg.surgeDelta * 0.7 : -cfg.surgeDelta * 0.3;
      curveDelta = wave + progress * (cfg.surgeDelta * 0.8);
    }

    // Duration modifier only applies AFTER the first two on-ramp intervals,
    // so short 15-min runs never spike to high effort right after warm-up.
    let durModifier = 0;
    if (i >= 2) {
      if (dur <= 30) durModifier = cfg.durBoostMax;
      else if (dur >= 240) durModifier = -10;
      else if (dur >= 180) durModifier = -5;
    }

    const jitter = rng ? (rng() - 0.5) * 5 : 0;
    let hiCap = cfg.effortMax;
    if (i === 0) hiCap = Math.min(hiCap, cfg.firstRunCap);
    else if (i === 1) hiCap = Math.min(hiCap, cfg.secondRunCap);

    // Ensure Run 1 starts gently even if baseEffort is toward the top of the band.
    const onRampBias = i === 0 ? -10 : i === 1 ? -5 : 0;
    const raw = baseEffort + onRampBias + curveDelta + durModifier + jitter;
    return snapEffort(raw, cfg.effortMin, hiCap);
  });

  // Walk naming & style
  const walkNames = walks.map((dur, i) => {
    const precedingRunEffort = runEfforts[i] || 50;
    const precedingRunDur = runs[i] || 60;
    const isHard = precedingRunEffort >= 65 || precedingRunDur >= 120;
    return isHard ? 'Recovery Walk' : intensity === 'gentle' ? 'Easy Walk' : 'Brisk Walk';
  });

  return { runEfforts, walkNames };
}

const MIN_RUN = 30;          // default shortest run (user-adjustable, floor 15s)
const MIN_RUN_RELAXED = 30;
const MIN_WALK = 15;         // default shortest walk (user-adjustable, floor 15s)
const SHORTEST_ALLOWED = 15;

export const DEFAULT_PARAMS = {
  totalMin: 20,
  runPct: 50,          // 10..90
  intensity: 'normal', // 'gentle' | 'normal' | 'hard'
  maxRunSec: 90,
  maxWalkSec: 90,
  allowLongRuns: false, // true lifts the run cap to MAX_RUN_HARD_CAP
  longerRunsInMiddle: true,
  walkScaling: 'scaled', // 'scaled' | 'even'
  minRunSec: MIN_RUN,   // shortest run, floor 15
  minWalkSec: MIN_WALK, // shortest walk, floor 15
};

const MAX_ATTEMPTS = 12;

// ---------- helpers ----------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sum = (arr) => arr.reduce((s, v) => s + v, 0);
const round15 = (v) => Math.round(v / 15) * 15;

/** Spread `total` across items by weight, respecting per-item [lo, hi] (water-filling). */
function allocate(total, weights, lo, hi) {
  const n = weights.length;
  const vals = new Array(n).fill(0);
  let free = weights.map((_, i) => i);
  let remaining = total;
  for (let guard = 0; guard < n + 2 && free.length; guard++) {
    const sw = sum(free.map((i) => weights[i]));
    let violated = false;
    for (const i of free) vals[i] = (remaining * weights[i]) / sw;
    for (const i of [...free]) {
      if (vals[i] < lo || vals[i] > hi) {
        vals[i] = clamp(vals[i], lo, hi);
        remaining -= vals[i];
        free = free.filter((j) => j !== i);
        violated = true;
      }
    }
    if (!violated) break;
  }
  return vals;
}

function allowedList(lo, hi) {
  const list = CLIP_DURATIONS.filter((d) => d >= lo && d <= hi);
  return list.length ? list : [clamp(round15(lo), SHORTEST_ALLOWED, Math.max(SHORTEST_ALLOWED, hi))];
}

function snapTo(list, v) {
  let best = list[0];
  for (const d of list) if (Math.abs(d - v) < Math.abs(best - v)) best = d;
  return best;
}

/**
 * Nudge segment durations (moving along their allowed lists) until they sum to
 * `target`. Greedy single moves first, then an exhaustive pair search.
 */
function reconcile(segs, target) {
  const moveOf = (s, dir) => {
    const i = s.list.indexOf(s.dur);
    const next = s.list[i + dir];
    return next === undefined ? null : next - s.dur;
  };

  for (let guard = 0; guard < 300; guard++) {
    const diff = target - sum(segs.map((s) => s.dur));
    if (diff === 0) return true;
    const dir = Math.sign(diff);
    const cands = segs.filter((s) => {
      const m = moveOf(s, dir);
      return m !== null && Math.abs(m) <= Math.abs(diff);
    });
    if (!cands.length) break;
    cands.sort((a, b) => (dir > 0 ? b.w - a.w : b.dur - a.dur));
    const pick = cands[0];
    pick.dur += moveOf(pick, dir);
  }

  const diff = target - sum(segs.map((s) => s.dur));
  if (diff === 0) return true;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i; j < segs.length; j++) {
      for (const di of [-1, 1]) {
        for (const dj of [-1, 1]) {
          if (i === j && di !== dj) continue;
          const mi = moveOf(segs[i], di);
          if (mi === null) continue;
          let total = mi;
          let mj = null;
          if (i !== j) {
            mj = moveOf(segs[j], dj);
            if (mj === null) continue;
            total += mj;
          }
          if (total === diff) {
            segs[i].dur += mi;
            if (mj !== null) segs[j].dur += mj;
            return true;
          }
        }
      }
    }
  }
  return false;
}

export function durationWords(sec) {
  if (sec === 150) return '2 and a half minutes';
  if (sec >= 60 && sec % 60 === 0) {
    const m = sec / 60;
    return m === 1 ? '1 minute' : `${m} minutes`;
  }
  return `${sec} seconds`;
}

export function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------- planning ----------

const ARCHETYPE_LIST = ['snappy', 'pyramid', 'steady', 'cruise'];

function pickArchetype(params, rng) {
  const roll = rng();
  if (!params.longerRunsInMiddle) {
    // Skip pyramid emphasis when user explicitly disabled middle-heavy runs.
    const flatTypes = ['snappy', 'steady', 'cruise'];
    return flatTypes[Math.floor(roll * flatTypes.length)];
  }
  return ARCHETYPE_LIST[Math.floor(roll * ARCHETYPE_LIST.length)];
}

/**
 * Decide how many runs and how much total run time. Returns
 * { n, R, minRun, relaxedWalk } where R is the total run seconds.
 */
function plan(main, runTarget, runCap, walkCap, minRunPref, minWalk, archetype = 'pyramid', rng = null) {
  const desired = Math.max(2, Math.round(runTarget / (0.6 * runCap)));
  const tol = Math.max(30, main * 0.02);
  const cands = [];

  for (const minRun of [...new Set([minRunPref, Math.min(minRunPref, MIN_RUN_RELAXED)])]) {
    for (let n = 2; n <= 150; n++) {
      const lower = Math.max(n * minRun, main - (n - 1) * walkCap);
      const upper = Math.min(n * runCap, main - (n - 1) * minWalk);
      if (lower > upper) continue;
      const R = clamp(runTarget, lower, upper);
      cands.push({ n, R, minRun, relaxedWalk: false, dev: Math.abs(R - runTarget) });
    }
  }

  if (cands.length) {
    // Prefer arrangements that hit the requested run % (within tolerance), then the
    // normal minimum run, then pick interval count n according to the shuffle archetype.
    const good = cands.filter((c) => c.dev <= tol);
    const pool = good.length ? good : cands;
    const bestMinRun = Math.max(...pool.map((c) => c.minRun));
    const bestPool = good.length ? pool.filter((c) => c.minRun === bestMinRun) : pool;

    const minN = Math.min(...bestPool.map((c) => c.n));
    const maxN = Math.max(...bestPool.map((c) => c.n));
    // Keep very long runs (60-90m) from exploding into 80+ micro-intervals while
    // still letting 15-30m runs hit high-density snappy intervals.
    const capN = Math.max(minN, Math.min(maxN, 36));
    const jitter = rng ? rng() : 0.5;
    let targetN = desired;

    if (capN > minN) {
      if (archetype === 'snappy') {
        targetN = Math.round(minN + (capN - minN) * (0.68 + jitter * 0.3));
      } else if (archetype === 'cruise') {
        targetN = Math.round(minN + (capN - minN) * (0.04 + jitter * 0.24));
      } else if (archetype === 'steady') {
        targetN = Math.round(minN + (capN - minN) * (0.35 + jitter * 0.3));
      } else {
        targetN = Math.round(minN + (capN - minN) * (0.28 + jitter * 0.36));
      }
    }

    bestPool.sort((a, b) =>
      good.length
        ? Math.abs(a.n - targetN) - Math.abs(b.n - targetN)
        : a.dev - b.dev || Math.abs(a.n - targetN) - Math.abs(b.n - targetN));
    return bestPool[0];
  }

  // No arrangement honours every cap: keep the run cap and let walks run long
  // (but never beyond the longest voice clip).
  const wTarget = main - runTarget;
  const n = Math.max(desired, Math.ceil(wTarget / MAX_RUN_HARD_CAP) + 1);
  const relaxedMin = Math.min(minRunPref, MIN_RUN_RELAXED);
  const R = clamp(runTarget, n * relaxedMin, Math.min(n * runCap, main - (n - 1) * minWalk));
  return { n, R, minRun: relaxedMin, relaxedWalk: true };
}

function countTriples(segs) {
  let c = 0;
  for (const kind of ['run', 'walk']) {
    const d = segs.filter((s) => s.kind === kind).map((s) => s.dur);
    for (let i = 2; i < d.length; i++) if (d[i] === d[i - 1] && d[i] === d[i - 2]) c++;
  }
  return c;
}

/**
 * Break up any run of three identical durations by moving one segment a step and
 * compensating with an opposite step elsewhere (so the total stays exact).
 */
function breakTriples(segs) {
  const step = (s, dir) => {
    const next = s.list[s.list.indexOf(s.dur) + dir];
    return next === undefined ? null : next - s.dur;
  };
  for (let pass = 0; pass < 60; pass++) {
    const before = countTriples(segs);
    if (!before) return;
    let fixed = false;
    // Same-kind partners only, so the run/walk split is preserved.
    const order = (m) => segs.filter((s) => s !== m && s.kind === m.kind);
    outer: for (const m of segs) {
      for (const dm of [-1, 1]) {
        const sm = step(m, dm);
        if (sm === null) continue;
        for (const p of order(m)) {
          for (const dp of [-1, 1]) {
            const sp = step(p, dp);
            if (sp === null || sp !== -sm) continue;
            m.dur += sm;
            p.dur += sp;
            if (countTriples(segs) < before) { fixed = true; break outer; }
            m.dur -= sm;
            p.dur -= sp;
          }
        }
      }
    }
    if (!fixed) return;
  }
}
function buildOnce(params, main, rng) {
  const runCap = params.allowLongRuns ? MAX_RUN_HARD_CAP : Math.min(params.maxRunSec, MAX_RUN_HARD_CAP);
  const minWalk = params.minWalkSec;
  const walkCap = Math.max(minWalk, params.maxWalkSec);
  const runTarget = round15(main * (params.runPct / 100));
  const archetype = pickArchetype(params, rng);

  const { n, R, minRun, relaxedWalk } = plan(
    main,
    runTarget,
    runCap,
    walkCap,
    params.minRunSec,
    minWalk,
    archetype,
    rng,
  );
  const W = main - R;
  const walkHi = relaxedWalk ? Math.max(walkCap, Math.ceil(W / (n - 1))) : walkCap;

  // --- runs ---
  const runW = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0.5 : i / (n - 1);
    const bell = Math.exp(-(((x - 0.5) / 0.28) ** 2));
    let shape = 1;
    let spread = 0.15;

    if (archetype === 'pyramid') {
      shape = params.longerRunsInMiddle ? 0.45 + 1.15 * bell : 1;
      spread = 0.15;
    } else if (archetype === 'snappy') {
      shape = params.longerRunsInMiddle ? 0.85 + 0.25 * bell : 1;
      spread = 0.28;
    } else if (archetype === 'steady') {
      shape = params.longerRunsInMiddle ? 0.9 + 0.2 * bell : 1;
      spread = 0.08;
    } else {
      // 'cruise'
      shape = params.longerRunsInMiddle ? 0.7 + 0.65 * bell : 1;
      spread = 0.22;
    }

    runW.push(shape * (1 + (rng() * 2 - 1) * spread));
  }
  const runList = allowedList(minRun, runCap);
  const runVals = allocate(R, runW, minRun, runCap);
  const runs = runVals.map((v, i) => ({ kind: 'run', dur: snapTo(runList, v), w: runW[i], list: runList }));

  // --- walks ---
  const walkCount = n - 1;
  const walkList = allowedList(minWalk, walkHi);
  const walkW = [];
  for (let i = 0; i < walkCount; i++) {
    const base = params.walkScaling === 'even' ? 1 : runs[i].dur;
    const walkSpread = archetype === 'steady' ? 0.06 : 0.14;
    walkW.push(base * (1 + (rng() * 2 - 1) * walkSpread));
  }
  const walkVals = allocate(W, walkW, minWalk, walkHi);
  const walks = walkVals.map((v, i) => ({ kind: 'walk', dur: snapTo(walkList, v), w: walkW[i], list: walkList }));

  // --- make the totals exact ---
  let ok = reconcile(runs, R) && reconcile(walks, W);
  if (!ok) ok = reconcile([...runs, ...walks], main);

  if (ok) {
    // Sequence order matters for the repeat check; segs here are in order per kind.
    breakTriples([...runs, ...walks]);
  }

  const total = sum(runs.map((s) => s.dur)) + sum(walks.map((s) => s.dur));
  return {
    ok: ok && total === main,
    triples: countTriples([...runs, ...walks]),
    runs: runs.map((s) => s.dur),
    walks: walks.map((s) => s.dur),
    relaxedWalk,
    runCap,
    walkCap,
    archetype,
  };
}

// ---------- public API ----------

export function normalizeParams(input = {}) {
  const p = { ...DEFAULT_PARAMS, ...input };
  p.totalMin = clamp(Math.round(p.totalMin), 10, 90);
  p.runPct = clamp(Math.round(p.runPct), 10, 90);
  p.intensity = INTENSITY_LEVELS[p.intensity] ? p.intensity : DEFAULT_PARAMS.intensity;
  p.maxRunSec = clamp(Math.round(p.maxRunSec), 60, MAX_RUN_HARD_CAP);
  p.maxWalkSec = clamp(Math.round(p.maxWalkSec), 45, 150);
  p.minRunSec = clamp(Math.round(p.minRunSec), SHORTEST_ALLOWED, Math.min(p.maxRunSec, 120));
  p.minWalkSec = clamp(Math.round(p.minWalkSec), SHORTEST_ALLOWED, p.maxWalkSec);
  return p;
}

/**
 * generateRun({ totalMin, runPct, intensity, maxRunSec, maxWalkSec,
 *               allowLongRuns, longerRunsInMiddle, walkScaling, seed })
 */
export function generateRun(input = {}) {
  const seed = Number.isFinite(input.seed) ? input.seed : Math.floor(Math.random() * 1e9);
  const params = normalizeParams(input);
  const main = params.totalMin * 60 - WARMUP_SEC - COOLDOWN_SEC;

  // Retry with derived seeds until exact and no three identical segments in a row.
  let result = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(seed + attempt * 7919);
    const r = buildOnce(params, main, rng);
    if (!result || (r.ok && !result.ok) || (r.ok === result.ok && r.triples < result.triples)) result = r;
    if (r.ok && r.triples === 0) {
      result = r;
      break;
    }
  }

  const cueRng = mulberry32(seed ^ 0x9e3779b9);
  const pick = (arr) => arr[Math.floor(cueRng() * arr.length)];
  const id = `gen-${seed}`;

  // Generate dynamic efforts and walk styles
  const { runEfforts, walkNames } = calculateEffortArc(
    result.runs,
    result.walks,
    params.runPct,
    cueRng,
    params.intensity,
  );

  const intervals = [
    {
      id: `${id}-warmup`, phase: 'warmup', name: 'Warm-up Walk', duration: WARMUP_SEC, effort: null,
      cue: `Starting with a ${WARMUP_SEC / 60} minute warm up walk. Relax your shoulders and find a steady stride.`,
    },
  ];

  const runCueFns = [
    (d, eff) => `Run at ${eff} percent effort for ${d}.`,
    (d, eff) => `Time to run. ${d} at ${eff} percent effort.`,
    (d, eff) => `Let's go! Run for ${d} at ${eff} percent effort.`,
  ];
  const walkCueFns = [
    (d) => `Walk and catch your breath for ${d}.`,
    (d) => `Recovery walk for ${d}.`,
    (d) => `Easy walk for ${d}. Shake it out.`,
    (d) => `Brisk walk for ${d}. Keep the rhythm going.`,
  ];

  result.runs.forEach((dur, i) => {
    const eff = runEfforts[i] || RUN_EFFORT;
    const isSprint = eff >= 95;
    intervals.push({
      id: `${id}-run-${i + 1}`,
      phase: isSprint ? 'sprint' : 'run',
      name: isSprint ? `Sprint ${i + 1}` : `Run ${i + 1}`,
      duration: dur,
      effort: eff,
      cue: pick(runCueFns)(durationWords(dur), eff),
    });
    if (i < result.walks.length) {
      const walkName = walkNames[i] || 'Recovery Walk';
      intervals.push({
        id: `${id}-walk-${i + 1}`,
        phase: 'walk',
        name: `${walkName} ${i + 1}`,
        duration: result.walks[i],
        effort: null,
        cue: pick(walkCueFns)(durationWords(result.walks[i])),
      });
    }
  });

  intervals.push({
    id: `${id}-cooldown`, phase: 'cooldown', name: 'Cool Down Walk', duration: COOLDOWN_SEC, effort: null,
    cue: `Great job! ${COOLDOWN_SEC / 60} minute cool down walk. Let your heart rate recover.`,
  });

  const runSec = sum(result.runs);
  const walkSec = sum(result.walks);
  const achievedRunPct = Math.round((runSec / main) * 100);
  const totalSec = sum(intervals.map((i) => i.duration));
  const longestRun = Math.max(...result.runs);
  const minEffort = runEfforts.length ? Math.min(...runEfforts) : RUN_EFFORT;
  const maxEffort = runEfforts.length ? Math.max(...runEfforts) : RUN_EFFORT;
  const startEffort = runEfforts[0] || RUN_EFFORT;
  const intensityCfg = INTENSITY_LEVELS[params.intensity] || INTENSITY_LEVELS.normal;
  const archetypeCfg = ARCHETYPES[result.archetype] || ARCHETYPES.pyramid;

  const notes = [];
  if (result.relaxedWalk) {
    notes.push('Some walks run longer than your max walk to fit this mix. Raise max walk or lower run % to avoid that.');
  } else if (Math.abs(achievedRunPct - params.runPct) > 3) {
    notes.push(`Built ${achievedRunPct}% run to stay within your max run / max walk limits.`);
  }
  if (!result.ok) notes.push('Could not hit the exact length with standard interval times.');

  return {
    id,
    title: `${params.totalMin} min · ${intensityCfg.label} · ${achievedRunPct}% run`,
    subtitle: `Quick Run · ${archetypeCfg.label}`,
    description: `Generated ${intensityCfg.label.toLowerCase()} run/walk mix: ${result.runs.length} runs (${startEffort}%–${maxEffort}% effort), longest ${formatClock(longestRun)}.`,
    level: intensityCfg.label,
    category: 'Generated',
    accentColor: 'emerald',
    tags: ['Generated', intensityCfg.label, `${params.totalMin} Mins`],
    generated: true,
    params: { ...params, seed },
    stats: {
      totalSec,
      runSec,
      walkSec,
      achievedRunPct,
      runCount: result.runs.length,
      longestRun,
      minEffort,
      maxEffort,
      startEffort,
      intensity: params.intensity,
      archetype: result.archetype,
      archetypeLabel: archetypeCfg.label,
      exact: result.ok,
    },
    notes,
    intervals,
  };
}

export default generateRun;









