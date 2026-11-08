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
export const RUN_EFFORT = 60;
export const MAX_RUN_HARD_CAP = 300; // longest voice clip

const MIN_RUN = 45;          // default shortest run (user-adjustable, floor 15s)
const MIN_RUN_RELAXED = 30;
const MIN_WALK = 30;         // default shortest walk (user-adjustable, floor 15s)
const SHORTEST_ALLOWED = 15;

export const DEFAULT_PARAMS = {
  totalMin: 30,
  runPct: 50,          // 10..90
  maxRunSec: 180,
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

/**
 * Decide how many runs and how much total run time. Returns
 * { n, R, runLo, relaxedWalk } where R is the total run seconds.
 */
function plan(main, runTarget, runCap, walkCap, minRunPref, minWalk) {
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
    // normal minimum run, then a segment count near the ideal one.
    const good = cands.filter((c) => c.dev <= tol);
    const pool = good.length ? good : cands;
    pool.sort((a, b) =>
      good.length
        ? a.minRun !== b.minRun ? b.minRun - a.minRun : Math.abs(a.n - desired) - Math.abs(b.n - desired)
        : a.dev - b.dev || Math.abs(a.n - desired) - Math.abs(b.n - desired));
    return pool[0];
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

  const { n, R, minRun, relaxedWalk } = plan(main, runTarget, runCap, walkCap, params.minRunSec, minWalk);
  const W = main - R;
  const walkHi = relaxedWalk ? Math.max(walkCap, Math.ceil(W / (n - 1))) : walkCap;

  // --- runs ---
  const runW = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0.5 : i / (n - 1);
    const shape = params.longerRunsInMiddle ? 0.55 + 0.9 * Math.exp(-(((x - 0.5) / 0.28) ** 2)) : 1;
    runW.push(shape * (1 + (rng() * 2 - 1) * 0.15));
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
    walkW.push(base * (1 + (rng() * 2 - 1) * 0.1));
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
  };
}

// ---------- public API ----------

export function normalizeParams(input = {}) {
  const p = { ...DEFAULT_PARAMS, ...input };
  p.totalMin = clamp(Math.round(p.totalMin), 10, 90);
  p.runPct = clamp(Math.round(p.runPct), 10, 90);
  p.maxRunSec = clamp(Math.round(p.maxRunSec), 60, MAX_RUN_HARD_CAP);
  p.maxWalkSec = clamp(Math.round(p.maxWalkSec), 45, 150);
  p.minRunSec = clamp(Math.round(p.minRunSec), SHORTEST_ALLOWED, Math.min(p.maxRunSec, 120));
  p.minWalkSec = clamp(Math.round(p.minWalkSec), SHORTEST_ALLOWED, p.maxWalkSec);
  return p;
}

/**
 * generateRun({ totalMin, runPct, maxRunSec, maxWalkSec, allowLongRuns,
 *               longerRunsInMiddle, walkScaling, seed })
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
  const intervals = [
    {
      id: `${id}-warmup`, phase: 'warmup', name: 'Warm-up Walk', duration: WARMUP_SEC, effort: null,
      cue: `Starting with a ${WARMUP_SEC / 60} minute warm up walk. Relax your shoulders and find a steady stride.`,
    },
  ];

  const runCueFns = [
    (d) => `Run at ${RUN_EFFORT} percent effort for ${d}.`,
    (d) => `Time to run. ${d} at ${RUN_EFFORT} percent effort.`,
    (d) => `Let's go! Run for ${d} at a steady ${RUN_EFFORT} percent effort.`,
  ];
  const walkCueFns = [
    (d) => `Walk and catch your breath for ${d}.`,
    (d) => `Recovery walk for ${d}.`,
    (d) => `Easy walk for ${d}. Shake it out.`,
  ];

  result.runs.forEach((dur, i) => {
    intervals.push({
      id: `${id}-run-${i + 1}`, phase: 'run', name: `Run ${i + 1}`, duration: dur, effort: RUN_EFFORT,
      cue: pick(runCueFns)(durationWords(dur)),
    });
    if (i < result.walks.length) {
      intervals.push({
        id: `${id}-walk-${i + 1}`, phase: 'walk', name: `Recovery Walk ${i + 1}`, duration: result.walks[i], effort: null,
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

  const notes = [];
  if (result.relaxedWalk) {
    notes.push('Some walks run longer than your max walk to fit this mix. Raise max walk or lower run % to avoid that.');
  } else if (Math.abs(achievedRunPct - params.runPct) > 3) {
    notes.push(`Built ${achievedRunPct}% run to stay within your max run / max walk limits.`);
  }
  if (!result.ok) notes.push('Could not hit the exact length with standard interval times.');

  return {
    id,
    title: `${params.totalMin} min · ${achievedRunPct}% run`,
    subtitle: 'Quick Run',
    description: `Generated run/walk mix: ${result.runs.length} runs, longest ${formatClock(longestRun)}.`,
    level: 'Custom',
    category: 'Generated',
    accentColor: 'emerald',
    tags: ['Generated', `${params.totalMin} Mins`],
    generated: true,
    params: { ...params, seed },
    stats: {
      totalSec,
      runSec,
      walkSec,
      achievedRunPct,
      runCount: result.runs.length,
      longestRun,
      exact: result.ok,
    },
    notes,
    intervals,
  };
}

export default generateRun;









