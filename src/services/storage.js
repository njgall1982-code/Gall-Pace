/**
 * LocalStorage Service for IntervalCoach
 * Manages custom workouts, user audio preferences, and workout history.
 */

const CUSTOM_WORKOUTS_KEY = 'intervalcoach_custom_workouts';
const SETTINGS_KEY = 'intervalcoach_settings';
const HISTORY_KEY = 'intervalcoach_history';

export const storageService = {
  getCustomWorkouts() {
    try {
      const data = localStorage.getItem(CUSTOM_WORKOUTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading custom workouts:', e);
      return [];
    }
  },

  saveCustomWorkout(workout) {
    try {
      const existing = this.getCustomWorkouts();
      const index = existing.findIndex(w => w.id === workout.id);
      let updated;
      if (index >= 0) {
        updated = [...existing];
        updated[index] = workout;
      } else {
        updated = [workout, ...existing];
      }
      localStorage.setItem(CUSTOM_WORKOUTS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error saving custom workout:', e);
      return [];
    }
  },

  deleteCustomWorkout(id) {
    try {
      const existing = this.getCustomWorkouts();
      const updated = existing.filter(w => w.id !== id);
      localStorage.setItem(CUSTOM_WORKOUTS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error deleting custom workout:', e);
      return [];
    }
  },

  getSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      const defaults = {
        chimeEnabled: false,
        tenSecondWarning: true,
        countdownBeeps: true,
        halfwayCues: true,
        speechRate: 0.98,
        speechPitch: 1.0,
        speechVolume: 1.0,
        selectedVoiceURI: null,
        hapticVibration: true,
      };
      return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    } catch (e) {
      console.error('Error reading settings:', e);
      return {};
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving settings:', e);
    }
  },

  logCompletedWorkout(summary) {
    try {
      const existing = this.getHistory();
      const updated = [
        {
          ...summary,
          id: 'log-' + Date.now(),
          date: new Date().toISOString()
        },
        ...existing
      ].slice(0, 30); // Keep last 30
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error logging workout history:', e);
      return [];
    }
  },

  getHistory() {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }
};

export default storageService;

