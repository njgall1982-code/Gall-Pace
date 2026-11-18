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

function snapResistance(val) {
  const rounded = Math.round(val / 5) * 5;
  return Math.min(55, Math.max(25, rounded));
}

/**
 * Generate a complete, physiologically sound cycling workout.
 */
export function generateBikeWorkout({
  totalMin = 20,
  effort = 'moderate',
  style = 'hills',
  seed = Date.now(),
} = {}) {
  const rng = createSeededRng(seed);
  const effortCfg = BIKE_EFFORTS[effort] || BIKE_EFFORTS.moderate;
  const styleCfg = BIKE_STYLES[style] || BIKE_STYLES.hills;

  // Warmup and cooldown scaling
  const warmupSec = totalMin >= 30 ? 180 : 120;
  const cooldownSec = totalMin >= 30 ? 180 : 120;
  const mainSec = Math.max(300, totalMin * 60 - warmupSec - cooldownSec);

  const intervals = [];

  // 1. Warm-up
  intervals.push({
    id: 'bike-warmup',
    phase: 'warmup',
    name: 'Warm-up Spin',
    duration: warmupSec,
    cadence: '80–90 RPM',
    resistance: effortCfg.resMin,
    position: 'saddle',
    startClips: ['ride_warmup', `res_${effortCfg.resMin}`, 'cad_80_90', durationClipKey(warmupSec)],
    warningClip: 'warn_bike',
    cue: `Warm-up spin at resistance ${effortCfg.resMin}, cadence 80 to 90 for ${warmupSec / 60} minutes.`,
  });

  // 2. Main Block Generation
  let currentSec = 0;
  let intervalCounter = 1;

  if (style === 'surges') {
    // Alternating surges and recoveries
    const surgeDur = effort === 'hard' ? 45 : 60;
    const recDur = effort === 'hard' ? 60 : (effort === 'gentle' ? 60 : 45);
    const roundDur = surgeDur + recDur;
    const numRounds = Math.max(2, Math.floor(mainSec / roundDur));
    const extraPerRound = Math.floor((mainSec - numRounds * roundDur) / numRounds);

    for (let r = 0; r < numRounds; r++) {
      const isLastRound = r === numRounds - 1;
      const roundSurge = surgeDur;
      // Distribute any remaining seconds into recoveries
      let roundRec = recDur + (extraPerRound > 0 ? (extraPerRound >= 30 ? 30 : 0) : 0);
      if (isLastRound) {
        const remaining = mainSec - currentSec - roundSurge;
        if (remaining >= 30) roundRec = Math.min(180, remaining);
      }

      // Work Interval (Surge)
      const surgeRes = snapResistance(effortCfg.resMin + (effort === 'hard' ? 10 : 5));
      intervals.push({
        id: `bike-surge-${intervalCounter++}`,
        phase: 'bike_surge',
        name: `Speed Surge ${r + 1}`,
        duration: roundSurge,
        cadence: effortCfg.cadenceLabelSurges,
        resistance: surgeRes,
        position: 'saddle',
        startClips: ['pos_surge', `res_${surgeRes}`, effortCfg.cadenceSurges, durationClipKey(roundSurge)],
        warningClip: 'warn_recovery',
        cue: `Speed surge! Cadence ${effortCfg.cadenceLabelSurges}, resistance ${surgeRes} for ${roundSurge} seconds.`,
      });
      currentSec += roundSurge;

      // Recovery Interval
      const recRes = effortCfg.resMin;
      intervals.push({
        id: `bike-rec-${intervalCounter++}`,
        phase: 'bike_recovery',
        name: `Recovery Flush ${r + 1}`,
        duration: roundRec,
        cadence: '75–85 RPM',
        resistance: recRes,
        position: 'saddle',
        startClips: ['pos_spin_out', `res_${recRes}`, 'cad_70_80', durationClipKey(roundRec)],
        warningClip: isLastRound ? 'warn_cooldown' : 'warn_surge',
        cue: `Recovery spin. Resistance ${recRes}, cadence 75 to 85 for ${roundRec} seconds.`,
      });
      currentSec += roundRec;
    }
  } else if (style === 'hills') {
    // Alternating flat roads and climbs
    const climbDurs = [60, 90, 120];
    const recDurs = [60, 90];
    let isClimbing = false;

    while (currentSec < mainSec - 45) {
      const remainingSec = mainSec - currentSec;
      if (!isClimbing) {
        // Climb segment
        const durChoice = climbDurs[Math.floor(rng() * climbDurs.length)];
        const dur = Math.min(durChoice, remainingSec >= 150 ? durChoice : (remainingSec >= 90 ? 90 : 60));
        const standRoll = rng();
        const isStanding = effort !== 'gentle' && (standRoll > 0.45 || effort === 'hard');
        const climbRes = snapResistance(effortCfg.resMin + (effort === 'hard' ? 15 : (effort === 'moderate' ? 10 : 5)));
        const position = isStanding ? 'standing' : 'saddle';
        const posClip = isStanding ? 'pos_out_saddle' : 'pos_climb';

        intervals.push({
          id: `bike-climb-${intervalCounter++}`,
          phase: 'bike_climb',
          name: isStanding ? 'Standing Climb' : 'Seated Hill Climb',
          duration: dur,
          cadence: effortCfg.cadenceLabelClimbs,
          resistance: climbRes,
          position,
          startClips: [posClip, `res_${climbRes}`, effortCfg.cadenceClimbs, durationClipKey(dur)],
          warningClip: 'warn_recovery',
          cue: `${isStanding ? 'Rise up out of the saddle' : 'Heavy climb'}. Resistance ${climbRes}, cadence ${effortCfg.cadenceLabelClimbs} for ${dur} seconds.`,
        });

        currentSec += dur;
        isClimbing = true;
      } else {
        // Flat recovery / transition segment
        const durChoice = recDurs[Math.floor(rng() * recDurs.length)];
        const dur = Math.min(durChoice, remainingSec);
        const flatRes = snapResistance(effortCfg.resMin);

        intervals.push({
          id: `bike-flat-${intervalCounter++}`,
          phase: 'bike_flat',
          name: 'Flat Road Tempo',
          duration: dur,
          cadence: effortCfg.cadenceLabelFlats,
          resistance: flatRes,
          position: 'saddle',
          startClips: ['pos_in_saddle', `res_${flatRes}`, effortCfg.cadenceFlats, durationClipKey(dur)],
          warningClip: 'warn_climb',
          cue: `Back in the saddle on flat road. Resistance ${flatRes}, cadence ${effortCfg.cadenceLabelFlats} for ${dur} seconds.`,
        });

        currentSec += dur;
        isClimbing = false;
      }
    }
  } else {
    // Steady Rhythm / Tempo blocks: repeat blocks until mainSec is filled
    const targetBlockDur = totalMin >= 30 ? 240 : 180;
    const recDur = 60;

    while (currentSec < mainSec - 45) {
      const remainingSec = mainSec - currentSec;
      // If remaining is small, fit remaining directly
      const dur = remainingSec <= targetBlockDur + 60
        ? remainingSec
        : Math.min(targetBlockDur, remainingSec - recDur);

      const tempoRes = snapResistance(effortCfg.resMin + (effort === 'gentle' ? 0 : 5));

      intervals.push({
        id: `bike-tempo-${intervalCounter++}`,
        phase: 'bike_flat',
        name: `Endurance Block ${intervals.filter((i) => i.phase === 'bike_flat').length + 1}`,
        duration: dur,
        cadence: effortCfg.cadenceLabelFlats,
        resistance: tempoRes,
        position: 'saddle',
        startClips: ['pos_in_saddle', `res_${tempoRes}`, effortCfg.cadenceFlats, durationClipKey(dur)],
        warningClip: 'warn_recovery',
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
          resistance: effortCfg.resMin,
          position: 'saddle',
          startClips: ['pos_spin_out', `res_${effortCfg.resMin}`, 'cad_70_80', durationClipKey(flushDur)],
          warningClip: 'warn_bike',
          cue: `Easy spin flush. Resistance ${effortCfg.resMin}, cadence 75 to 85.`,
        });
        currentSec += flushDur;
      }
    }
  }

  // 3. Cool-Down
  intervals.push({
    id: 'bike-cooldown',
    phase: 'cooldown',
    name: 'Cool-down Spin',
    duration: cooldownSec,
    cadence: '70–80 RPM',
    resistance: 25,
    position: 'saddle',
    startClips: ['ride_cooldown', 'res_25', 'cad_70_80', durationClipKey(cooldownSec)],
    warningClip: null,
    cue: `Great job! Cool-down spin at resistance 25 for ${cooldownSec / 60} minutes to flush your legs.`,
  });

  const totalSec = intervals.reduce((acc, curr) => acc + curr.duration, 0);

  return {
    id: `bike-${style}-${effort}-${Date.now()}`,
    title: `${totalMin}-Min ${styleCfg.label}`,
    subtitle: `${effortCfg.label} • ${styleCfg.subtitle}`,
    description: `${styleCfg.description} Target ${effortCfg.zoneLabel}.`,
    activity: 'bike',
    level: effortCfg.label,
    category: 'Cycling',
    accentColor: effortCfg.color,
    intervals,
    stats: {
      totalSec,
      totalMin: Math.round(totalSec / 60),
      effort: effortCfg.label,
      style: styleCfg.label,
      archetypeLabel: `${effortCfg.label} ${styleCfg.label}`,
      peakResistance: Math.max(...intervals.map((i) => i.resistance || 25)),
      warmupSec,
      cooldownSec,
    },
  };
}
