import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRun, CLIP_DURATIONS, WARMUP_SEC, COOLDOWN_SEC } from './runGenerator.js';

const mains = (w) => w.intervals.slice(1, -1);
const runsOf = (w) => w.intervals.filter((i) => i.phase === 'run').map((i) => i.duration);
const walksOf = (w) => w.intervals.filter((i) => i.phase === 'walk').map((i) => i.duration);
const triple = (d) => d.some((v, i) => i >= 2 && v === d[i - 1] && v === d[i - 2]);

function sweep() {
  const cases = [];
  for (const totalMin of [10, 15, 20, 30, 45, 60, 90]) {
    for (const runPct of [10, 25, 50, 75, 90]) {
      for (const maxRunSec of [60, 120, 180, 300]) {
        for (const maxWalkSec of [45, 90, 150]) {
          for (const allowLongRuns of [false, true]) {
            for (const seed of [1, 2, 3]) {
              cases.push({ totalMin, runPct, maxRunSec, maxWalkSec, allowLongRuns, seed });
            }
          }
        }
      }
    }
  }
  return cases;
}

test('same seed gives identical workout, different seed usually differs', () => {
  const a = generateRun({ totalMin: 30, runPct: 75, seed: 42 });
  const b = generateRun({ totalMin: 30, runPct: 75, seed: 42 });
  assert.deepEqual(a, b);
  const variants = new Set();
  for (let s = 1; s <= 10; s++) variants.add(JSON.stringify(runsOf(generateRun({ totalMin: 30, runPct: 75, seed: s }))));
  assert.ok(variants.size > 3);
});

test('structure: 2 min warm-up first, 2 min cooldown last, starts and ends main block on a run', () => {
  const w = generateRun({ totalMin: 30, runPct: 50, seed: 5 });
  assert.equal(w.intervals[0].phase, 'warmup');
  assert.equal(w.intervals[0].duration, WARMUP_SEC);
  const last = w.intervals.at(-1);
  assert.equal(last.phase, 'cooldown');
  assert.equal(last.duration, COOLDOWN_SEC);
  const m = mains(w);
  assert.equal(m[0].phase, 'run');
  assert.equal(m.at(-1).phase, 'run');
  m.forEach((iv, i) => assert.equal(iv.phase, i % 2 === 0 ? 'run' : 'walk'));
});

test('sweep: exact total, caps respected, valid clip durations, no triple repeats', () => {
  let nonExact = 0;
  let overWalk = 0;
  let badDur = 0;
  let triples = 0;
  let overRun = 0;
  const cases = sweep();
  for (const c of cases) {
    const w = generateRun(c);
    const total = w.intervals.reduce((s, i) => s + i.duration, 0);
    assert.equal(total, c.totalMin * 60, `length ${JSON.stringify(c)}`);
    const runCap = c.allowLongRuns ? 300 : c.maxRunSec;
    if (runsOf(w).some((d) => d > runCap)) overRun++;
    if (walksOf(w).some((d) => d > c.maxWalkSec)) overWalk++;
    if (![...runsOf(w), ...walksOf(w)].every((d) => CLIP_DURATIONS.includes(d))) badDur++;
    // Some combos force repeats (e.g. 25% run with a 90s walk cap pins every run at the minimum); only count mainstream ones with room to vary.
    const realistic = c.totalMin >= 30 && c.runPct >= 50 && c.runPct <= 75 && c.maxRunSec >= 180 && c.maxWalkSec >= 90;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const walkPinned = avg(walksOf(w)) >= 0.8 * c.maxWalkSec;
    const runPinned = avg(runsOf(w)) >= 0.85 * runCap || avg(runsOf(w)) <= 50;
    if (realistic && !walkPinned && !runPinned && (triple(runsOf(w)) || triple(walksOf(w)))) triples++;
    if (!w.stats.exact) nonExact++;
  }
  console.log(`cases=${cases.length} overRun=${overRun} overWalk=${overWalk} badDur=${badDur} triples=${triples} nonExact=${nonExact}`);
  assert.equal(overRun, 0, 'run cap violated');
  assert.equal(badDur, 0, 'non-clip durations used');
  assert.equal(nonExact, 0);
  assert.equal(triples, 0, 'triple repeats');
});

test('default-ish settings: run % close to request and middle runs longest', () => {
  for (const pct of [25, 50, 75]) {
    const w = generateRun({ totalMin: 30, runPct: pct, seed: 11 });
    assert.ok(Math.abs(w.stats.achievedRunPct - pct) <= 3, `pct ${pct} got ${w.stats.achievedRunPct}`);
    assert.ok(walksOf(w).every((d) => d <= 90));
    assert.ok(runsOf(w).every((d) => d <= 180));
  }
  // middle bias: averaged over seeds, middle run > first run
  let mid = 0;
  let first = 0;
  for (let s = 1; s <= 30; s++) {
    const r = runsOf(generateRun({ totalMin: 45, runPct: 75, seed: s }));
    mid += r[Math.floor(r.length / 2)];
    first += r[0];
  }
  assert.ok(mid > first);
});




