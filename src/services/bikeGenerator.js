/**
 * Quick Ride Generator for IntervalCoach (Cycling / Peloton)
 * 
 * Physiologically designed for 30–50 year olds:
 * - Protects knees: Avoids high resistance at low RPM (<55) or low resistance at hyper RPM (>105).
 * - Decouples Effort (Gentle / Moderate / Hard) from Workout Style (Hills / Surges / Tempo).
 * - Pure, deterministic function: (params, seed) => workout.
 * - Audio: Chains modular clips [position, resistance, cadence, duration].
 */

// Available durations with pre-recorded clips in audioManager
export const BIKE_CLIP_DURATIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];

export const BIKE_EFFORTS = {
  gentle: {
    id: 'gentle',
    label: 'Gentle',
    zoneLabel: 'Aerobic Base (Zone 2)',
    description: 'Conversational flush, easy on joints',
    resMin: 25,
    resMax: 35,
    cadenceFlats: 'cad_80_90',
    cadenceClimbs: 'cad_70_80',
    cadenceSurges: 'cad_80_90',
    cadenceLabelFlats: '80–90 RPM',
    cadenceLabelClimbs: '70–80 RPM',
    cadenceLabelSurges: '85–95 RPM',
    color: 'emerald',
  },
  moderate: {
    id: 'moderate',
    label: 'Moderate',
    zoneLabel: 'Tempo / Aerobic Threshold',
    description: 'Comfortably hard, solid sweat',
    resMin: 30,
    resMax: 42,
    cadenceFlats: 'cad_80_90',
    cadenceClimbs: 'cad_60_70',
    cadenceSurges: 'cad_90_100',
    cadenceLabelFlats: '80–90 RPM',
    cadenceLabelClimbs: '65–75 RPM',
    cadenceLabelSurges: '90–100 RPM',
    color: 'amber',
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    zoneLabel: 'HIIT / Vigorous Surges',
    description: 'High intensity bursts with full recoveries',
    resMin: 35,
    resMax: 50,
    cadenceFlats: 'cad_80_90',
    cadenceClimbs: 'cad_60_70',
    cadenceSurges: 'cad_fast',
    cadenceLabelFlats: '80–90 RPM',
    cadenceLabelClimbs: '60–70 RPM',
    cadenceLabelSurges: '100+ RPM',
    color: 'rose',
  },
};

export const BIKE_STYLES = {
  hills: {
    id: 'hills',
    label: 'Rolling Hills',
    subtitle: 'Strength & Climbs',
    description: 'Alternating seated and standing climbs to build muscular endurance.',
  },
  surges: {
    id: 'surges',
    label: 'Speed Surges',
    subtitle: 'Cadence Intervals',
    description: 'High cadence speed bursts paired with active recovery flushes.',
  },
  tempo: {
    id: 'tempo',
    label: 'Steady Rhythm',
    subtitle: 'Aerobic Cadence',
    description: 'Sustained endurance blocks focusing on smooth, consistent power.',
  },
};

export const BIKE_PRESETS = [
  {
    id: 'aerobic-flush',
    label: 'Aerobic Flush',
    totalMin: 20,
    effort: 'gentle',
    style: 'tempo',
  },
  {
    id: 'rolling-hills',
    label: 'Rolling Hills',
    totalMin: 30,
    effort: 'moderate',
    style: 'hills',
  },
  {
    id: 'hiit-surges',
    label: 'HIIT Surges',
    totalMin: 20,
    effort: 'hard',
    style: 'surges',
  },
  {
    id: 'power-climb',
    label: 'Power Climb',
    totalMin: 30,
    effort: 'hard',
    style: 'hills',
  },
];

/**
 * Pseudo-random generator seeded for reproducibility
 */
function createSeededRng(seed) {
  let s = Math.abs(seed | 0) || 123456789;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function durationClipKey(sec) {
  if (sec % 60 === 0) return `for_${sec / 60}m`;
  return `for_${sec}s`;
}

function snapResistance(val, maxCap = 55) {
  const rounded = Math.round(val / 5) * 5;
  return Math.min(maxCap, Math.max(25, rounded));
}

/**
 * Generate a complete, physiologically sound cycling workout.
 */
export function generateBikeWorkout({
  totalMin = 20,
  effort = 'moderate',
  style = 'hills',
  kneeFriendly = false,
  seed = Date.now(),
} = {}) {
  const rng = createSeededRng(seed);
  const effortCfg = BIKE_EFFORTS[effort] || BIKE_EFFORTS.moderate;
  const styleCfg = BIKE_STYLES[style] || BIKE_STYLES.hills;

  // Orthopedic Joint-Protect Constraints
  // If kneeFriendly is enabled:
  // 1. Cap resistance at 35 to prevent high patellofemoral compressive force
  // 2. Lock 100% of intervals into the saddle (zero standing)
  // 3. Cadence strictly locked to joint-sparing 80-90 RPM window
  const maxResCap = kneeFriendly ? 35 : 55;
  const surgeCadenceClip = kneeFriendly ? 'cad_80_90' : effortCfg.cadenceSurges;
  const surgeCadenceLabel = kneeFriendly ? '80–90 RPM' : effortCfg.cadenceLabelSurges;
  const climbCadenceClip = kneeFriendly ? 'cad_70_80' : effortCfg.cadenceClimbs;
  const climbCadenceLabel = kneeFriendly ? '75–85 RPM' : effortCfg.cadenceLabelClimbs;

  // Warmup, On-Ramp, and Cooldown scaling
  const warmupSec = totalMin >= 30 ? 180 : 120;
  const onRampSec = totalMin >= 30 ? 90 : 60;
  const cooldownSec = totalMin >= 30 ? 180 : 120;
  const mainSec = Math.max(180, totalMin * 60 - warmupSec - onRampSec - cooldownSec);

  const intervals = [];

  // 1. Warm-up Spin
  intervals.push({
    id: 'bike-warmup',
    phase: 'warmup',
    name: 'Warm-up Spin',
    duration: warmupSec,
    cadence: '80–90 RPM',
    resistance: Math.min(maxResCap, effortCfg.resMin),
    position: 'saddle',
    startClips: ['ride_warmup', `res_${Math.min(maxResCap, effortCfg.resMin)}`, 'cad_80_90', durationClipKey(warmupSec)],
    warningClip: 'warn_bike',
    cue: `Warm-up spin at resistance ${Math.min(maxResCap, effortCfg.resMin)}, cadence 80 to 90 for ${warmupSec / 60} minutes.`,
  });

  // 2. Post-Warmup On-Ramp (Safe physiological transition to main load)
  intervals.push({
    id: 'bike-onramp',
    phase: 'bike_flat',
    name: 'Base Cadence On-Ramp',
    duration: onRampSec,
    cadence: effortCfg.cadenceLabelFlats,
    resistance: Math.min(maxResCap, effortCfg.resMin),
    position: 'saddle',
    startClips: ['pos_in_saddle', `res_${Math.min(maxResCap, effortCfg.resMin)}`, effortCfg.cadenceFlats, durationClipKey(onRampSec)],
    warningClip: style === 'hills' ? 'warn_climb' : (style === 'surges' ? 'warn_surge' : 'warn_bike'),
    cue: `Settle in on flat road. Resistance ${Math.min(maxResCap, effortCfg.resMin)}, cadence ${effortCfg.cadenceLabelFlats} for ${onRampSec} seconds.`,
  });

  // 3. Main Block Generation
  let currentSec = 0;
  let intervalCounter = 1;

  if (style === 'surges') {
    // Alternating surges and recoveries with cluster periodization for longer workouts
    const surgeDur = effort === 'hard' ? 45 : 60;
    const recDur = effort === 'hard' ? 60 : (effort === 'gentle' ? 60 : 45);
    const flushDur = 90;
    let surgeCount = 0;

    while (currentSec < mainSec - 30) {
      const remainingSec = mainSec - currentSec;

      // Periodized Surge Sets: Insert an aerobic clearing flush every 3 surges on rides >= 30m
      if (totalMin >= 30 && surgeCount > 0 && surgeCount % 3 === 0 && remainingSec >= flushDur + surgeDur) {
        const flushRes = Math.min(maxResCap, effortCfg.resMin);
        intervals.push({
          id: `bike-flush-${intervalCounter++}`,
          phase: 'bike_flat',
          name: 'Aerobic Clearing Flush',
          duration: flushDur,
          cadence: '80–90 RPM',
          resistance: flushRes,
          position: 'saddle',
          startClips: ['pos_spin_out', `res_${flushRes}`, 'cad_80_90', durationClipKey(flushDur)],
          warningClip: 'warn_surge',
          cue: `Clear the legs with an aerobic flush. Resistance ${flushRes}, cadence 80 to 90 for 90 seconds.`,
        });
        currentSec += flushDur;
        continue;
      }

      // Work Interval (Surge)
      const roundSurge = Math.min(surgeDur, remainingSec);
      const surgeBonus = kneeFriendly ? 5 : (effort === 'hard' ? 10 : 5);
      const surgeRes = snapResistance(effortCfg.resMin + surgeBonus, maxResCap);
      surgeCount++;

      intervals.push({
        id: `bike-surge-${intervalCounter++}`,
        phase: 'bike_surge',
        name: `Speed Surge ${surgeCount}`,
        duration: roundSurge,
        cadence: surgeCadenceLabel,
        resistance: surgeRes,
        position: 'saddle',
        startClips: ['pos_surge', `res_${surgeRes}`, surgeCadenceClip, durationClipKey(roundSurge)],
        warningClip: 'warn_recovery',
        cue: `Speed surge! Cadence ${surgeCadenceLabel}, resistance ${surgeRes} for ${roundSurge} seconds.`,
      });
      currentSec += roundSurge;

      if (currentSec < mainSec - 30) {
        const remainingAfterSurge = mainSec - currentSec;
        const roundRec = Math.min(recDur, remainingAfterSurge);
        const recRes = Math.min(maxResCap, effortCfg.resMin);
        const isNearEnd = (currentSec + roundRec >= mainSec - 30);

        intervals.push({
          id: `bike-rec-${intervalCounter++}`,
          phase: 'bike_recovery',
          name: `Recovery Flush ${surgeCount}`,
          duration: roundRec,
          cadence: '75–85 RPM',
          resistance: recRes,
          position: 'saddle',
          startClips: ['pos_spin_out', `res_${recRes}`, 'cad_70_80', durationClipKey(roundRec)],
          warningClip: isNearEnd ? 'warn_cooldown' : 'warn_surge',
          cue: `Recovery spin. Resistance ${recRes}, cadence 75 to 85 for ${roundRec} seconds.`,
        });
        currentSec += roundRec;
      }
    }
  } else if (style === 'hills') {
    // Alternating flat roads and climbs with orthopedic torque floor & seated recoveries
    const seatedClimbDurs = [60, 90, 120];
    const standingClimbDurs = [60, 90]; // Max 90s standing cap to prevent lumbar fatigue & patellar overload
    const recDurs = [60, 90];
    let isClimbing = false;
    let climbCount = 0;

    while (currentSec < mainSec - 45) {
      const remainingSec = mainSec - currentSec;
      if (!isClimbing) {
        // Climb segment
        climbCount++;
        const standRoll = rng();
        // Knee-Friendly mode is 100% seated!
        const isStanding = !kneeFriendly && effort !== 'gentle' && (standRoll > 0.45 || effort === 'hard');
        const candidateDurs = isStanding ? standingClimbDurs : seatedClimbDurs;
        const durChoice = candidateDurs[Math.floor(rng() * candidateDurs.length)];
        const dur = Math.min(durChoice, remainingSec >= 150 ? durChoice : (remainingSec >= 90 ? 90 : 60));

        // Orthopedic Torque Floor: Standing on an indoor cycle requires >= 40 resistance
        // to prevent flywheel runaway / hyperextension shear forces on the knees.
        // In knee-friendly mode, resistance is capped at 35 and rider stays in saddle.
        const climbBonus = kneeFriendly ? 5 : (effort === 'hard' ? 15 : (effort === 'moderate' ? 10 : 5));
        const baseClimbRes = snapResistance(effortCfg.resMin + climbBonus, maxResCap);
        const climbRes = isStanding ? Math.max(40, baseClimbRes) : baseClimbRes;
        const position = isStanding ? 'standing' : 'saddle';
        const posClip = isStanding ? 'pos_out_saddle' : 'pos_climb';

        intervals.push({
          id: `bike-climb-${intervalCounter++}`,
          phase: 'bike_climb',
          name: isStanding ? `Standing Climb ${climbCount}` : `Seated Hill Climb ${climbCount}`,
          duration: dur,
          cadence: climbCadenceLabel,
          resistance: climbRes,
          position,
          startClips: [posClip, `res_${climbRes}`, climbCadenceClip, durationClipKey(dur)],
          warningClip: 'warn_recovery',
          cue: `${isStanding ? 'Rise up out of the saddle' : 'Heavy climb'}. Resistance ${climbRes}, cadence ${climbCadenceLabel} for ${dur} seconds.`,
        });

        currentSec += dur;
        isClimbing = true;
      } else {
        // Flat recovery road (ALWAYS seated to restore biomechanics and lower heart rate spike)
        const durChoice = recDurs[Math.floor(rng() * recDurs.length)];
        const dur = Math.min(durChoice, remainingSec);
        const flatRes = snapResistance(effortCfg.resMin, maxResCap);
        const isNearEnd = (currentSec + dur >= mainSec - 45);

        intervals.push({
          id: `bike-flat-${intervalCounter++}`,
          phase: 'bike_flat',
          name: 'Flat Road Recovery',
          duration: dur,
          cadence: effortCfg.cadenceLabelFlats,
          resistance: flatRes,
          position: 'saddle',
          startClips: ['pos_in_saddle', `res_${flatRes}`, effortCfg.cadenceFlats, durationClipKey(dur)],
          warningClip: isNearEnd ? 'warn_cooldown' : 'warn_climb',
          cue: `Back in the saddle on flat road. Resistance ${flatRes}, cadence ${effortCfg.cadenceLabelFlats} for ${dur} seconds.`,
        });

        currentSec += dur;
        isClimbing = false;
      }
    }
  } else {
    // Steady Rhythm / Tempo blocks: sustained aerobic cadence with regular flush spins
    const targetBlockDur = totalMin >= 30 ? 240 : 180;
    const recDur = 60;
    let blockCount = 0;

    while (currentSec < mainSec - 45) {
      const remainingSec = mainSec - currentSec;
      blockCount++;
      // If remaining is small, fit remaining directly
      const dur = remainingSec <= targetBlockDur + 60
        ? remainingSec
        : Math.min(targetBlockDur, remainingSec - recDur);

      const tempoBonus = kneeFriendly ? 0 : (effort === 'gentle' ? 0 : 5);
      const tempoRes = snapResistance(effortCfg.resMin + tempoBonus, maxResCap);
      const isNearEnd = (currentSec + dur >= mainSec - 45);

      intervals.push({
        id: `bike-tempo-${intervalCounter++}`,
        phase: 'bike_flat',
        name: `Endurance Block ${blockCount}`,
        duration: dur,
        cadence: effortCfg.cadenceLabelFlats,
        resistance: tempoRes,
        position: 'saddle',
        startClips: ['pos_in_saddle', `res_${tempoRes}`, effortCfg.cadenceFlats, durationClipKey(dur)],
        warningClip: isNearEnd ? 'warn_cooldown' : 'warn_recovery',
        cue: `Settle into steady rhythm. Resistance ${tempoRes}, cadence ${effortCfg.cadenceLabelFlats} for ${Math.round(dur / 60)} minutes.`,
      });
      currentSec += dur;

      if (currentSec < mainSec - 45) {
        const flushDur = Math.min(recDur, mainSec - currentSec);
        intervals.push({
          id: `bike-flush-${intervalCounter++}`,
          phase: 'bike_recovery',
          name: 'Aerobic Flush',
          duration: flushDur,
          cadence: '75–85 RPM',
          resistance: Math.min(maxResCap, effortCfg.resMin),
          position: 'saddle',
          startClips: ['pos_spin_out', `res_${Math.min(maxResCap, effortCfg.resMin)}`, 'cad_70_80', durationClipKey(flushDur)],
          warningClip: 'warn_bike',
          cue: `Easy spin flush. Resistance ${Math.min(maxResCap, effortCfg.resMin)}, cadence 75 to 85 for ${flushDur} seconds.`,
        });
        currentSec += flushDur;
      }
    }
  }

  // 4. Two-Stage Hemodynamic Cooldown
  // Stage 1: Active Flush (60s at base resistance to maintain muscle pump & venous return)
  const stage1Sec = 60;
  const stage1Res = Math.min(maxResCap, effortCfg.resMin);
  intervals.push({
    id: 'bike-cooldown-flush',
    phase: 'bike_recovery',
    name: 'Active Flush Spin',
    duration: stage1Sec,
    cadence: '75–85 RPM',
    resistance: stage1Res,
    position: 'saddle',
    startClips: ['pos_spin_out', `res_${stage1Res}`, 'cad_70_80', 'for_1m'],
    warningClip: 'warn_cooldown',
    cue: `Active flush spin at resistance ${stage1Res}, cadence 75 to 85 for 1 minute.`,
  });

  // Stage 2: Final Cool-down Spin (resistance 25, parasympathetic autonomic reset)
  const stage2Sec = Math.max(60, cooldownSec - stage1Sec);
  intervals.push({
    id: 'bike-cooldown-final',
    phase: 'cooldown',
    name: 'Cool-down Spin',
    duration: stage2Sec,
    cadence: '70–80 RPM',
    resistance: 25,
    position: 'saddle',
    startClips: ['ride_cooldown', 'res_25', 'cad_70_80', durationClipKey(stage2Sec)],
    warningClip: null,
    cue: `Great job! Cool-down spin at resistance 25 for ${stage2Sec / 60} minutes to bring your heart rate down.`,
  });

  const totalSec = intervals.reduce((acc, curr) => acc + curr.duration, 0);

  return {
    id: `bike-${style}-${effort}-${Date.now()}`,
    title: `${totalMin}-Min ${styleCfg.label}`,
    subtitle: `${kneeFriendly ? '🛡️ Knee-Friendly • ' : ''}${effortCfg.label} • ${styleCfg.subtitle}`,
    description: `${styleCfg.description} Target ${effortCfg.zoneLabel}.${kneeFriendly ? ' Knee-protect mode: 100% seated, capped torque, smooth cadence.' : ''}`,
    activity: 'bike',
    level: effortCfg.label,
    category: 'Cycling',
    accentColor: effortCfg.color,
    kneeFriendly: Boolean(kneeFriendly),
    intervals,
    stats: {
      totalSec,
      totalMin: Math.round(totalSec / 60),
      effort: effortCfg.label,
      style: styleCfg.label,
      archetypeLabel: `${kneeFriendly ? '🛡️ ' : ''}${effortCfg.label} ${styleCfg.label}`,
      peakResistance: Math.max(...intervals.map((i) => i.resistance || 25)),
      warmupSec,
      cooldownSec,
      kneeFriendly: Boolean(kneeFriendly),
    },
  };
}
