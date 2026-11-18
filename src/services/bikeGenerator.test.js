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
