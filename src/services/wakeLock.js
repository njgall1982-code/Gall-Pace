/**
 * Screen WakeLock API helper
 * Keeps the phone screen awake during active running workouts
 * so runners can glance at the countdown anytime.
 */

class WakeLockService {
  constructor() {
    this.wakeLock = null;
    this.isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
    
    // Automatically reacquire wake lock if user switches apps and comes back
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.wakeLock !== null && document.visibilityState === 'visible') {
          this.request();
        }
      });
    }
  }

  async request() {
    if (!this.isSupported) return false;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request error:', err);
      return false;
    }
  }

  async release() {
    if (this.wakeLock !== null) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
      } catch (err) {
        console.warn('Wake Lock release error:', err);
      }
    }
  }

  isActive() {
    return this.wakeLock !== null;
  }
}

export const wakeLockService = new WakeLockService();
export default wakeLockService;

