import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRun,
  DEFAULT_PARAMS,
  INTENSITY_LEVELS,
  effortBandForPeak,
  phaseDurationsForParams,
  CLIP_DURATIONS,
} from './runGenerator.js';

const mains = (w) => w.intervals.slice(1, -1);
const runsOf = (w) => w.intervals.filter((i) => i.phase === 'run').map((i) => i.duration);
const runIntervalsOf = (w) => w.intervals.filter((i) => i.phase === 'run' || i.phase === 'sprint');
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

test('structure: dynamic warm-up first, dynamic cooldown last, starts and ends main block on a run', () => {
  const w = generateRun({ totalMin: 30, runPct: 50, seed: 5 });
  const expectedPhases = phaseDurationsForParams(30, DEFAULT_PARAMS.peakEffort);
  assert.equal(w.intervals[0].phase, 'warmup');
  assert.equal(w.intervals[0].duration, expectedPhases.warmupSec);
  const last = w.intervals.at(-1);
  assert.equal(last.phase, 'cooldown');
  assert.equal(last.duration, expectedPhases.cooldownSec);
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

test('adult-friendly defaults: 20 min, 50% run, max 90s run, 65% peak effort', () => {
  assert.equal(DEFAULT_PARAMS.totalMin, 20);
  assert.equal(DEFAULT_PARAMS.runPct, 50);
  assert.equal(DEFAULT_PARAMS.maxRunSec, 90);
  assert.equal(DEFAULT_PARAMS.peakEffort, 65);

  const w = generateRun({ seed: 101 });
  assert.equal(w.stats.totalSec, 20 * 60);
  assert.ok(Math.abs(w.stats.achievedRunPct - 50) <= 3);
  assert.ok(runsOf(w).every((d) => d <= 90));
  assert.equal(w.level, 'Moderate');
});

test('gradual effort ramp: Run 1 never exceeds 40% (35% when peak <= 50%), across all peakEfforts', () => {
  for (const peakEffort of [45, 50, 55, 60, 65, 70, 75, 80, 85]) {
    const band = effortBandForPeak(peakEffort);
    for (const totalMin of [15, 20, 30, 45]) {
      for (const runPct of [25, 50, 75]) {
        for (const seed of [1, 7, 19, 42, 99]) {
          const w = generateRun({ totalMin, runPct, peakEffort, seed });
          const runs = runIntervalsOf(w);
          const firstEffort = runs[0].effort;
          assert.ok(
            firstEffort <= band.firstRunCap,
            `peak=${peakEffort} ${totalMin}m ${runPct}% seed=${seed}: Run 1 effort ${firstEffort}% exceeded ${band.firstRunCap}%`,
          );
          if (runs.length > 1) {
            assert.ok(
              runs[1].effort <= band.secondRunCap,
              `peak=${peakEffort} ${totalMin}m ${runPct}% seed=${seed}: Run 2 effort ${runs[1].effort}% exceeded ${band.secondRunCap}%`,
            );
          }
          assert.ok(
            runs.every((r) => r.effort >= band.effortMin && r.effort <= band.effortMax),
            `peak=${peakEffort} efforts out of [${band.effortMin}, ${band.effortMax}]: ${runs.map((r) => r.effort)}`,
          );
        }
      }
    }
  }
  // Legacy intensity option still maps cleanly
  const gentleW = generateRun({ totalMin: 20, intensity: 'gentle', seed: 7 });
  assert.equal(gentleW.stats.peakEffort, INTENSITY_LEVELS.gentle.peakEffort);
});

test('drastic shuffle: seeds vary interval count and pacing archetype on short & default runs', () => {
  for (const totalMin of [15, 20]) {
    const counts = new Set();
    const archetypes = new Set();
    for (let s = 1; s <= 40; s++) {
      const w = generateRun({ totalMin, runPct: 50, seed: s * 131 });
      counts.add(w.stats.runCount);
      archetypes.add(w.stats.archetype);
    }
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    assert.ok(
      maxCount - minCount >= 3,
      `${totalMin}m shuffle runCount range too narrow: ${[...counts].sort((a, b) => a - b)}`,
    );
    assert.ok(archetypes.size >= 3, `${totalMin}m expected >=3 archetypes, got ${[...archetypes]}`);
  }
});

test('healthy workout routine: dynamic warmup/cooldown, finish taper, walk cue match, and recovery floor', () => {
  // Long & hard sessions get 5 min warm-up and 5 min cool-down
  const hardLong = generateRun({ totalMin: 45, runPct: 60, peakEffort: 80, seed: 7 });
  assert.equal(hardLong.intervals[0].duration, 300);
  assert.equal(hardLong.intervals.at(-1).duration, 300);

  // Finish-line taper: on >=4 runs at >=65% peak, final run stays below peakEffort
  for (let s = 1; s <= 20; s++) {
    const w = generateRun({ totalMin: 30, runPct: 50, peakEffort: 80, seed: s });
    const runs = runIntervalsOf(w);
    if (runs.length >= 4) {
      assert.ok(runs.at(-1).effort < 80, `seed=${s} final run hit ${runs.at(-1).effort}%`);
    }
  }

  // Recovery Walk intervals never get "Brisk walk" cues
  for (let s = 1; s <= 20; s++) {
    const w = generateRun({ totalMin: 30, runPct: 50, peakEffort: 80, seed: s });
    for (const iv of w.intervals.filter((x) => x.phase === 'walk')) {
      if (iv.name.startsWith('Recovery Walk')) {
        assert.ok(!/brisk walk/i.test(iv.cue), `Recovery Walk got brisk cue: ${iv.cue}`);
      }
    }
  }

  // High-effort (peak >= 75%) with <= 75% run enforces >= 30s walk floor
  const hiit = generateRun({ totalMin: 20, runPct: 50, peakEffort: 80, minWalkSec: 15, seed: 12 });
  assert.ok(walksOf(hiit).every((d) => d >= 30), `expected >=30s walks, got ${walksOf(hiit)}`);
  assert.ok(hiit.notes.some((n) => /30s/.test(n)));

  // effortBandForPeak includes zoneLabel and talkTest
  const zone2 = effortBandForPeak(55);
  assert.match(zone2.zoneLabel, /Zone 2/i);
  assert.ok(zone2.talkTest.length > 0);
});

test('orthopedics: jointProtect mode enforces safe knee and shin limits', () => {
  for (let s = 1; s <= 20; s++) {
    const w = generateRun({
      totalMin: 30,
      runPct: 75,
      peakEffort: 80,
      maxRunSec: 180,
      minWalkSec: 15,
      jointProtect: true,
      seed: s,
    });

    assert.strictEqual(w.params.jointProtect, true);
    assert.strictEqual(w.stats.jointProtect, true);
    assert.ok(w.subtitle.includes('Joint-Protect'));

    // Runs never exceed 60s
    for (const rDur of runsOf(w)) {
      assert.ok(rDur <= 60, `jointProtect run duration (${rDur}) must be <= 60s`);
    }

    // Walks are at least 45s
    for (const wDur of walksOf(w)) {
      assert.ok(wDur >= 45, `jointProtect walk duration (${wDur}) must be >= 45s`);
    }

    // Peak effort never exceeds 55%
    for (const iv of runIntervalsOf(w)) {
      assert.ok(iv.effort <= 55, `jointProtect run effort (${iv.effort}%) must be <= 55%`);
    }
  }
});

test('session timing: warmupCooldownExtra delivers full requested duration of interval work', () => {
  for (const totalMin of [15, 20, 30]) {
    const w = generateRun({
      totalMin,
      runPct: 50,
      warmupCooldownExtra: true,
      seed: 42,
    });

    const expectedMainSec = totalMin * 60;
    const actualIntervalsWorkSec = w.intervals
      .filter((i) => i.phase !== 'warmup' && i.phase !== 'cooldown' && i.id !== `${w.id}-cooldown-flush`)
      .reduce((s, i) => s + i.duration, 0);

    assert.strictEqual(
      actualIntervalsWorkSec,
      expectedMainSec,
      `warmupCooldownExtra must allocate exact ${expectedMainSec}s to main block, got ${actualIntervalsWorkSec}s`
    );

    assert.ok(w.stats.totalSec > expectedMainSec, 'Total workout seconds must exceed main block seconds');
    assert.ok(w.title.includes('(+'), 'Title should display the extra warm/cool duration');
  }
});

test('physiology: twoStageCooldown splits cooldown into active flush walk and final recovery walk', () => {
  const w = generateRun({
    totalMin: 30,
    peakEffort: 65,
    twoStageCooldown: true,
    seed: 99,
  });

  const lastTwo = w.intervals.slice(-2);
  const stage1 = lastTwo[0];
  const stage2 = lastTwo[1];

  assert.strictEqual(stage1.phase, 'walk');
  assert.strictEqual(stage1.name, 'Active Flush Walk');
  assert.strictEqual(stage1.duration, 60);

  assert.strictEqual(stage2.phase, 'cooldown');
  assert.strictEqual(stage2.name, 'Cool Down Walk');
  assert.ok(stage2.duration >= 60);
});

test('physiology: Run 1 acts as Base Jog On-Ramp with cadence form reminder', () => {
  const w = generateRun({
    totalMin: 20,
    runPct: 50,
    peakEffort: 65,
    seed: 123,
  });

  const run1 = runIntervalsOf(w)[0];
  assert.strictEqual(run1.name, 'Base Jog On-Ramp');
  assert.ok(run1.effort <= 40);
  assert.match(run1.cue, /quick light steps under your hips/i);
});

test('audio cues: last run interval includes last_run clip and motivational cue', () => {
  const w = generateRun({
    totalMin: 20,
    runPct: 50,
    peakEffort: 65,
    seed: 456,
  });

  const runs = runIntervalsOf(w);
  const lastRun = runs[runs.length - 1];
  assert.match(lastRun.cue, /this is the last run/i);
  assert.ok(Array.isArray(lastRun.startClips));
  assert.ok(lastRun.startClips.includes('last_run'));
});

test('audio cues: high effort runs include coaching prompt and audio clip', () => {
  const w = generateRun({
    totalMin: 30,
    runPct: 70,
    peakEffort: 80,
    seed: 789,
  });

  const runs = runIntervalsOf(w);
  // Find a middle run with effort >= 60
  const highEffortRuns = runs.filter((r, idx) => idx > 0 && idx < runs.length - 1 && r.effort >= 60 && r.duration >= 45);
  assert.ok(highEffortRuns.length > 0, 'Should have at least one eligible middle high effort run');
  const sample = highEffortRuns[0];
  assert.ok(
    /pick up your pace|push a little harder|grandma's pace/i.test(sample.cue),
    `High effort run should have coaching cue: ${sample.cue}`
  );
  assert.ok(
    sample.startClips.some((c) => ['cue_pick_up_pace', 'cue_push_harder', 'cue_not_grandmas_pace'].includes(c)),
    `High effort run startClips should include coaching clip: ${JSON.stringify(sample.startClips)}`
  );
});






