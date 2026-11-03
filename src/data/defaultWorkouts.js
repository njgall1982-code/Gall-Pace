/**
 * Prebuilt Workout Library for IntervalCoach
 * 
 * Each interval has:
 * - id: unique string
 * - phase: 'warmup' | 'run' | 'walk' | 'sprint' | 'cooldown'
 * - name: Display title (e.g. "Warm-Up Walk", "Base Run", "Recovery Walk", "Push Surge")
 * - duration: duration in seconds
 * - effort: target effort percentage (e.g. 40, 60, 75, 80, 90) or null for easy walk
 * - cue: specific speech cue to announce at start
 */

export const DEFAULT_WORKOUTS = [
  {
    id: 'base-builder',
    title: 'The Base Builder',
    subtitle: 'Foundation Aerobic Run/Walk',
    description: 'Classic runner adaptation: progressive runs interspersed with brisk walking recoveries to build aerobic endurance.',
    level: 'Beginner / Intermediate',
    category: 'Endurance',
    accentColor: 'emerald',
    tags: ['Popular', 'Aerobic Base', '11.5 Mins'],
    intervals: [
      { id: 'bb-1', phase: 'warmup', name: 'Warm-up Walk', duration: 180, effort: null, cue: 'Starting with a 3 minute warm up walk. Relax your shoulders and find a steady stride.' },
      { id: 'bb-2', phase: 'walk', name: 'Recovery Walk', duration: 60, effort: null, cue: 'Brisk walk for 1 minute. Prepare for your first light run.' },
      { id: 'bb-3', phase: 'run', name: 'Base Run', duration: 120, effort: 40, cue: 'Run at 40 percent effort for 2 minutes. Easy, conversational pace.' },
      { id: 'bb-4', phase: 'sprint', name: 'Speed Surge', duration: 30, effort: 75, cue: 'Pick it up! Run at 75 percent effort for 30 seconds.' },
      { id: 'bb-5', phase: 'walk', name: 'Recovery Walk', duration: 60, effort: null, cue: 'Walk and catch your breath for 1 minute.' },
      { id: 'bb-6', phase: 'run', name: 'Tempo Run', duration: 180, effort: 60, cue: 'Now settle into a run at 60 percent effort for 3 minutes. Strong, steady rhythm.' },
      { id: 'bb-7', phase: 'cooldown', name: 'Cool Down Walk', duration: 180, effort: null, cue: 'Great job! 3 minute cool down walk. Let your heart rate recover.' }
    ]
  },
  {
    id: 'pyramid-mix',
    title: 'The Pyramid Mix',
    subtitle: 'Ascending & Descending Effort Intervals',
    description: 'Ascend the mountain from 40% to 60% to 80% peak effort, then step back down. Teaches pace control and mental toughness.',
    level: 'Intermediate',
    category: 'Varied Intervals',
    accentColor: 'indigo',
    tags: ['Pyramid', 'Lactate Threshold', '18 Mins'],
    intervals: [
      { id: 'pyr-1', phase: 'warmup', name: 'Warm-up Walk', duration: 180, effort: null, cue: 'Starting with a 3 minute warm up walk.' },
      { id: 'pyr-2', phase: 'run', name: 'Level 1: Easy Run', duration: 60, effort: 40, cue: 'First step: Run at 40 percent effort for 1 minute.' },
      { id: 'pyr-3', phase: 'walk', name: 'Walk Recovery', duration: 60, effort: null, cue: 'Walk for 1 minute. Catch your breath.' },
      { id: 'pyr-4', phase: 'run', name: 'Level 2: Moderate Run', duration: 120, effort: 60, cue: 'Step two: Run at 60 percent effort for 2 minutes.' },
      { id: 'pyr-5', phase: 'walk', name: 'Walk Recovery', duration: 60, effort: null, cue: 'Walk for 1 minute.' },
      { id: 'pyr-6', phase: 'run', name: 'Peak: High Effort Run', duration: 180, effort: 80, cue: 'Pyramid peak! Run at 80 percent effort for 3 minutes. Dig deep!' },
      { id: 'pyr-7', phase: 'walk', name: 'Extended Walk Recovery', duration: 90, effort: null, cue: 'Awesome push. Extended walk recovery for 90 seconds.' },
      { id: 'pyr-8', phase: 'run', name: 'Step Down: Moderate Run', duration: 120, effort: 60, cue: 'Heading down the pyramid: Run at 60 percent effort for 2 minutes.' },
      { id: 'pyr-9', phase: 'walk', name: 'Walk Recovery', duration: 60, effort: null, cue: 'Walk for 1 minute.' },
      { id: 'pyr-10', phase: 'run', name: 'Step Down: Easy Run', duration: 60, effort: 40, cue: 'Final run interval: Easy jog at 40 percent effort for 1 minute.' },
      { id: 'pyr-11', phase: 'cooldown', name: 'Cool Down Walk', duration: 180, effort: null, cue: 'Pyramid conquered! 3 minute cool down walk.' }
    ]
  },
  {
    id: 'quick-burn',
    title: 'Quick Burn',
    subtitle: 'Snappy 20-Min HIIT Interval Session',
    description: 'High-efficiency 20-minute fat-burning interval blast: 8 explosive 1-minute runs paired with active recovery walks.',
    level: 'All Levels',
    category: 'HIIT / Cardio',
    accentColor: 'amber',
    tags: ['20 Minutes', 'High Calorie', 'Snappy'],
    intervals: [
      { id: 'qb-1', phase: 'warmup', name: 'Warm-up Walk', duration: 120, effort: null, cue: '2 minute brisk warm up walk. Get your muscles ready.' },
      // 8 rounds of 1m run @ 85% / 1m walk
      { id: 'qb-2', phase: 'run', name: 'Burn Interval 1', duration: 60, effort: 85, cue: 'Interval 1 of 8: Run at 85 percent effort for 1 minute!' },
      { id: 'qb-3', phase: 'walk', name: 'Walk Recovery 1', duration: 60, effort: null, cue: 'Walk for 1 minute to recover.' },
      { id: 'qb-4', phase: 'run', name: 'Burn Interval 2', duration: 60, effort: 85, cue: 'Interval 2: Run at 85 percent effort for 1 minute.' },
      { id: 'qb-5', phase: 'walk', name: 'Walk Recovery 2', duration: 60, effort: null, cue: 'Walk for 1 minute.' },
      { id: 'qb-6', phase: 'run', name: 'Burn Interval 3', duration: 60, effort: 85, cue: 'Interval 3: Power through for 1 minute.' },
      { id: 'qb-7', phase: 'walk', name: 'Walk Recovery 3', duration: 60, effort: null, cue: 'Walk for 1 minute. Breathe deeply.' },
      { id: 'qb-8', phase: 'run', name: 'Burn Interval 4', duration: 60, effort: 85, cue: 'Interval 4: Halfway mark for sprint sets! 1 minute run.' },
      { id: 'qb-9', phase: 'walk', name: 'Walk Recovery 4', duration: 60, effort: null, cue: 'Walk for 1 minute.' },
      { id: 'qb-10', phase: 'run', name: 'Burn Interval 5', duration: 60, effort: 85, cue: 'Interval 5: Keep your form tall and fast for 1 minute.' },
      { id: 'qb-11', phase: 'walk', name: 'Walk Recovery 5', duration: 60, effort: null, cue: 'Walk for 1 minute.' },
      { id: 'qb-12', phase: 'run', name: 'Burn Interval 6', duration: 60, effort: 85, cue: 'Interval 6: Push your tempo for 1 minute.' },
      { id: 'qb-13', phase: 'walk', name: 'Walk Recovery 6', duration: 60, effort: null, cue: 'Walk for 1 minute.' },
      { id: 'qb-14', phase: 'run', name: 'Burn Interval 7', duration: 60, effort: 85, cue: 'Interval 7: Penultimate push! 1 minute at 85 percent.' },
      { id: 'qb-15', phase: 'walk', name: 'Walk Recovery 7', duration: 60, effort: null, cue: 'Last recovery walk for 1 minute.' },
      { id: 'qb-16', phase: 'run', name: 'Final Sprint Burn', duration: 60, effort: 90, cue: 'Final round! Empty the tank for 1 minute!' },
      { id: 'qb-17', phase: 'cooldown', name: 'Cool Down Walk', duration: 120, effort: null, cue: 'Workout complete! 2 minute cool down walk to ease your heart.' }
    ]
  },
  {
    id: 'couch-to-run',
    title: 'Beginner Run/Walk (Couch-to-5K)',
    subtitle: 'Gentle Progression for New Runners',
    description: 'Low-impact alternating 60-second jogs with generous 90-second recovery walks. Gentle on joints while building stamina.',
    level: 'Beginner Friendly',
    category: 'Gentle Start',
    accentColor: 'cyan',
    tags: ['Beginner', 'Low Impact', '20 Mins'],
    intervals: [
      { id: 'ctr-1', phase: 'warmup', name: 'Warm-up Walk', duration: 180, effort: null, cue: 'Warm up walk for 3 minutes. Nice easy pace.' },
      { id: 'ctr-2', phase: 'run', name: 'Gentle Jog 1', duration: 60, effort: 45, cue: 'Jog lightly for 60 seconds. Keep it easy and relaxed.' },
      { id: 'ctr-3', phase: 'walk', name: 'Walk Recovery 1', duration: 90, effort: null, cue: 'Walk for 90 seconds.' },
      { id: 'ctr-4', phase: 'run', name: 'Gentle Jog 2', duration: 60, effort: 45, cue: 'Jog lightly for 60 seconds.' },
      { id: 'ctr-5', phase: 'walk', name: 'Walk Recovery 2', duration: 90, effort: null, cue: 'Walk for 90 seconds.' },
      { id: 'ctr-6', phase: 'run', name: 'Gentle Jog 3', duration: 60, effort: 50, cue: 'Jog for 60 seconds.' },
      { id: 'ctr-7', phase: 'walk', name: 'Walk Recovery 3', duration: 90, effort: null, cue: 'Walk for 90 seconds.' },
      { id: 'ctr-8', phase: 'run', name: 'Gentle Jog 4', duration: 60, effort: 50, cue: 'Final jog for 60 seconds. Looking great!' },
      { id: 'ctr-9', phase: 'cooldown', name: 'Cool Down Walk', duration: 180, effort: null, cue: 'All done! 3 minute cool down walk.' }
    ]
  },
  {
    id: 'speed-burst-sprints',
    title: 'Tabata Sprint Surges',
    subtitle: 'Explosive Fast-Twitch Power',
    description: 'Short, sharp 30-second explosive sprints paired with 30-second recovery jogs/walks. Maximum calorie afterburn.',
    level: 'Advanced',
    category: 'Speed & Power',
    accentColor: 'rose',
    tags: ['Speed', 'Sprint', '12 Mins'],
    intervals: [
      { id: 'sb-1', phase: 'warmup', name: 'Warm-up Walk', duration: 180, effort: null, cue: '3 minute warm up walk. Get muscles primed for explosive sprints.' },
      { id: 'sb-2', phase: 'sprint', name: 'Sprint 1', duration: 30, effort: 95, cue: 'Sprint at 95 percent effort for 30 seconds!' },
      { id: 'sb-3', phase: 'walk', name: 'Walk Recovery', duration: 30, effort: null, cue: 'Walk and breathe for 30 seconds.' },
      { id: 'sb-4', phase: 'sprint', name: 'Sprint 2', duration: 30, effort: 95, cue: 'Sprint 2! 30 seconds explosive speed!' },
      { id: 'sb-5', phase: 'walk', name: 'Walk Recovery', duration: 30, effort: null, cue: 'Walk for 30 seconds.' },
      { id: 'sb-6', phase: 'sprint', name: 'Sprint 3', duration: 30, effort: 95, cue: 'Sprint 3! Fast turnover for 30 seconds!' },
      { id: 'sb-7', phase: 'walk', name: 'Walk Recovery', duration: 30, effort: null, cue: 'Walk for 30 seconds.' },
      { id: 'sb-8', phase: 'sprint', name: 'Sprint 4', duration: 30, effort: 100, cue: 'Final sprint! All out sprint for 30 seconds!' },
      { id: 'sb-9', phase: 'cooldown', name: 'Cool Down Walk', duration: 180, effort: null, cue: 'Awesome intensity! 3 minute cool down walk.' }
    ]
  }
];

export const PHASE_CONFIG = {
  warmup: {
    label: 'WARM UP',
    badgeText: 'WARM UP',
    bgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    primaryColor: '#f59e0b',
    glowClass: 'shadow-[0_0_30px_rgba(245,158,11,0.35)]',
    cardBorder: 'border-amber-500/30',
    icon: 'Flame',
    defaultEffort: 30
  },
  run: {
    label: 'RUN',
    badgeText: 'RUN',
    bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    primaryColor: '#22c55e',
    glowClass: 'shadow-[0_0_30px_rgba(34,197,94,0.35)]',
    cardBorder: 'border-emerald-500/30',
    icon: 'Zap',
    defaultEffort: 60
  },
  walk: {
    label: 'WALK',
    badgeText: 'WALK',
    bgClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    primaryColor: '#06b6d4',
    glowClass: 'shadow-[0_0_30px_rgba(6,182,212,0.35)]',
    cardBorder: 'border-cyan-500/30',
    icon: 'Footprints',
    defaultEffort: null
  },
  sprint: {
    label: 'SPRINT',
    badgeText: 'SPRINT',
    bgClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    primaryColor: '#f43f5e',
    glowClass: 'shadow-[0_0_30px_rgba(244,63,94,0.35)]',
    cardBorder: 'border-rose-500/30',
    icon: 'Gauge',
    defaultEffort: 85
  },
  cooldown: {
    label: 'COOL DOWN',
    badgeText: 'COOL DOWN',
    bgClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    primaryColor: '#818cf8',
    glowClass: 'shadow-[0_0_30px_rgba(129,140,248,0.35)]',
    cardBorder: 'border-indigo-500/30',
    icon: 'Wind',
    defaultEffort: null
  }
};

/**
 * Helper to calculate total workout duration in seconds
 */
export function getWorkoutDuration(workout) {
  if (!workout || !workout.intervals) return 0;
  return workout.intervals.reduce((acc, curr) => acc + (curr.duration || 0), 0);
}

/**
 * Format seconds to MM:SS string
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to human friendly string e.g. "20m 30s"
 */
export function formatTimeHuman(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

