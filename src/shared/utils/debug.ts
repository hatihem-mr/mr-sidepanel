/**
 * Debug Logging Utility
 *
 * Provides conditional logging based on build mode:
 * - Development builds (npm run dev): All logs enabled
 * - Production builds (npm run build): Only errors/warnings enabled
 *
 * Usage:
 *   import { debug } from '../shared/utils/debug.js';
 *   debug.log('This only shows in dev mode');
 *   debug.error('This always shows');
 */

// Check if we're in development mode (set by esbuild.config.js)
export const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Debug logging functions that respect build mode
 */
export const debug = {
  /**
   * Development-only logs - hidden in production builds
   */
  log: (...args: any[]) => {
    if (IS_DEV) {
      console.log(...args);
    }
  },

  /**
   * Development-only info logs - hidden in production builds
   */
  info: (...args: any[]) => {
    if (IS_DEV) {
      console.info(...args);
    }
  },

  /**
   * Development-only debug logs - hidden in production builds
   */
  debug: (...args: any[]) => {
    if (IS_DEV) {
      console.debug(...args);
    }
  },

  /**
   * Warnings - always shown (important for troubleshooting)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Errors - always shown (critical information)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Grouped logs for development - hidden in production
   */
  group: (label: string) => {
    if (IS_DEV) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (IS_DEV) {
      console.groupEnd();
    }
  },

  /**
   * Table display for development - hidden in production
   */
  table: (data: any) => {
    if (IS_DEV) {
      console.table(data);
    }
  }
};

/**
 * Helper to create namespaced debug loggers
 * Usage: const log = createDebugLogger('OverlayManager');
 *        log('Starting overlay...'); // "[OverlayManager] Starting overlay..."
 */
export function createDebugLogger(namespace: string) {
  return (...args: any[]) => {
    if (IS_DEV) {
      console.log(`[${namespace}]`, ...args);
    }
  };
}
