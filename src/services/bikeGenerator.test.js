import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBikeWorkout, BIKE_PRESETS } from './bikeGenerator.js';

test('generateBikeWorkout produces valid workouts for all presets', () => {
  for (const preset of BIKE_PRESETS) {
    const workout = generateBikeWorkout({
      totalMin: preset.totalMin,
      effort: preset.effort,
      style: preset.style,
      seed: 42,
    });

    assert.ok(workout.id, 'Workout should have an id');
    assert.strictEqual(workout.activity, 'bike', 'Activity should be bike');
    assert.ok(workout.title, 'Workout should have a title');
    assert.ok(workout.intervals.length >= 3, 'Workout should have at least 3 intervals');

    // Check warmup
    assert.strictEqual(workout.intervals[0].phase, 'warmup');
    assert.ok(workout.intervals[0].startClips.length > 0);

    // Check cooldown
    const last = workout.intervals[workout.intervals.length - 1];
    assert.strictEqual(last.phase, 'cooldown');
    assert.ok(last.startClips.length > 0);

    // Check all intervals have valid resistance, cadence, and startClips
    for (const iv of workout.intervals) {
      assert.ok(iv.duration > 0, 'Duration should be positive');
      assert.ok(iv.cadence, 'Interval should specify cadence');
      assert.ok(Number.isFinite(iv.resistance), 'Interval should specify resistance');
      assert.ok(Array.isArray(iv.startClips) && iv.startClips.length > 0, 'startClips should be non-empty array');
    }

    // Check total time matches within reasonable range of requested minutes
    const actualSec = workout.intervals.reduce((s, iv) => s + iv.duration, 0);
    const expectedSec = preset.totalMin * 60;
    assert.ok(
      Math.abs(actualSec - expectedSec) <= 60,
      `Actual seconds (${actualSec}) should match requested (${expectedSec}) within 60s`
    );
  }
});

test('generateBikeWorkout produces deterministic workouts from seeds', () => {
  const w1 = generateBikeWorkout({ totalMin: 20, effort: 'moderate', style: 'hills', seed: 999 });
  const w2 = generateBikeWorkout({ totalMin: 20, effort: 'moderate', style: 'hills', seed: 999 });
  const w3 = generateBikeWorkout({ totalMin: 20, effort: 'moderate', style: 'hills', seed: 1000 });

  assert.deepStrictEqual(
    w1.intervals.map((i) => i.duration),
    w2.intervals.map((i) => i.duration)
  );
  assert.deepStrictEqual(
    w1.intervals.map((i) => i.resistance),
    w2.intervals.map((i) => i.resistance)
  );
  assert.notDeepStrictEqual(
    w1.intervals.map((i) => i.duration),
    w3.intervals.map((i) => i.duration)
  );
});

test('physiology: post-warmup on-ramp precedes high intensity across styles', () => {
  const styles = ['hills', 'surges', 'tempo'];
  const durations = [15, 20, 30, 45, 60];

  for (const style of styles) {
    for (const totalMin of durations) {
      const w = generateBikeWorkout({ totalMin, effort: 'hard', style, seed: 123 });
      assert.strictEqual(w.intervals[0].phase, 'warmup', 'Interval 0 must be warmup');
      assert.strictEqual(w.intervals[1].phase, 'bike_flat', 'Interval 1 must be flat road on-ramp');
      assert.strictEqual(w.intervals[1].position, 'saddle', 'On-ramp must be seated in saddle');
      assert.ok(w.intervals[1].duration >= 60, 'On-ramp duration must be at least 60s');
    }
  }
});

test('physiology & orthopedics: standing climb torque floor and duration limits', () => {
  // Check across 50 random seeds and various effort/duration combos
  for (let seed = 1; seed <= 50; seed++) {
    const w = generateBikeWorkout({ totalMin: 30, effort: 'hard', style: 'hills', seed });
    
    for (let i = 0; i < w.intervals.length; i++) {
      const iv = w.intervals[i];
      if (iv.position === 'standing') {
        // Torque floor: standing on flywheel requires resistance >= 40 to prevent hyperextension/shear
        assert.ok(
          iv.resistance >= 40,
          `Standing climb resistance (${iv.resistance}) must be >= 40 for safety (seed ${seed})`
        );
        // Duration limit: max 90s standing cap
        assert.ok(
          iv.duration <= 90,
          `Standing climb duration (${iv.duration}s) must not exceed 90s (seed ${seed})`
        );
        // Seated recovery guarantee: the interval immediately following must be seated
        if (i + 1 < w.intervals.length) {
          const next = w.intervals[i + 1];
          assert.strictEqual(
            next.position,
            'saddle',
            `Interval immediately following standing climb must be seated in saddle (seed ${seed})`
          );
        }
      }
    }
  }

  // Gentle rides must NEVER have standing climbs
  for (let seed = 1; seed <= 20; seed++) {
    const gentleHills = generateBikeWorkout({ totalMin: 20, effort: 'gentle', style: 'hills', seed });
    const standingIntervals = gentleHills.intervals.filter((iv) => iv.position === 'standing');
    assert.strictEqual(standingIntervals.length, 0, 'Gentle effort must never have standing intervals');
  }
});

test('physiology: two-stage hemodynamic cooldown structure', () => {
  const durations = [15, 20, 30, 45, 60];
  for (const totalMin of durations) {
    const w = generateBikeWorkout({ totalMin, effort: 'moderate', style: 'surges', seed: 55 });
    const n = w.intervals.length;
    const stage1 = w.intervals[n - 2];
    const stage2 = w.intervals[n - 1];

    // Stage 1: Active Flush
    assert.strictEqual(stage1.phase, 'bike_recovery', 'Stage 1 cooldown must be active flush');
    assert.strictEqual(stage1.duration, 60, 'Stage 1 cooldown flush must be 60 seconds');
    assert.strictEqual(stage1.position, 'saddle');

    // Stage 2: Final Cool-down Spin
    assert.strictEqual(stage2.phase, 'cooldown', 'Stage 2 cooldown must be final cooldown');
    assert.strictEqual(stage2.resistance, 25, 'Stage 2 cooldown must spin down at baseline 25 resistance');
    assert.strictEqual(stage2.position, 'saddle');
    assert.ok(stage2.duration >= 60, 'Stage 2 cooldown duration must be at least 60s');
  }
});

test('physiology: periodized surge clusters for long workouts (>= 30m)', () => {
  const wLong = generateBikeWorkout({ totalMin: 30, effort: 'hard', style: 'surges', seed: 777 });
  const flushes = wLong.intervals.filter((iv) => iv.name === 'Aerobic Clearing Flush');
  assert.ok(flushes.length >= 1, 'Long surge ride (30m+) must include at least one aerobic clearing flush block');
  assert.strictEqual(flushes[0].duration, 90, 'Clearing flush block should be 90s');
  assert.strictEqual(flushes[0].position, 'saddle');
});

test('orthopedics: kneeFriendly mode guarantees 100% seated, resistance <= 35, and smooth cadences', () => {
  const styles = ['hills', 'surges', 'tempo'];
  const efforts = ['gentle', 'moderate', 'hard'];
  const durations = [15, 20, 30, 45, 60];

  for (const style of styles) {
    for (const effort of efforts) {
      for (const totalMin of durations) {
        const w = generateBikeWorkout({
          totalMin,
          effort,
          style,
          kneeFriendly: true,
          seed: 42,
        });

        assert.strictEqual(w.kneeFriendly, true);
        assert.ok(w.subtitle.includes('Knee-Friendly'));

        // 1. Guarantee: 100% of intervals are seated in saddle (ZERO standing climbs)
        for (const iv of w.intervals) {
          assert.strictEqual(
            iv.position,
            'saddle',
            `Every interval in Knee-Friendly mode must be in saddle, found ${iv.position} in ${iv.name}`
          );
          // Never use standing audio clip
          assert.ok(
            !iv.startClips.includes('pos_out_saddle'),
            'Knee-Friendly ride must never play pos_out_saddle audio'
          );
        }

        // 2. Guarantee: Peak resistance never exceeds 35
        assert.ok(
          w.stats.peakResistance <= 35,
          `Peak resistance in Knee-Friendly mode (${w.stats.peakResistance}) must not exceed 35`
        );
        for (const iv of w.intervals) {
          assert.ok(
            iv.resistance <= 35,
            `Interval ${iv.name} resistance (${iv.resistance}) must not exceed 35`
          );
        }

        // 3. Guarantee: Cadence never asks for fast/hyper sprint (>100 RPM)
        for (const iv of w.intervals) {
          assert.ok(
            !iv.startClips.includes('cad_fast'),
            'Knee-Friendly ride must avoid hyper-cadence sprint'
          );
        }
      }
    }
  }
});
