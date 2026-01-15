import { debug } from '../../shared/utils/debug.js';
// ===================================================================
// MOUSE MOVEMENT TRACKER - Optimized Mouse Event Processing
// ===================================================================
// Enhanced mouse movement tracking with configurable intervals and
// performance optimizations for smooth overlay interactions.
// ===================================================================

/**
 * Configuration options for mouse movement tracker
 */
export interface MouseMovementTrackerOptions {
  /** Time interval between position updates (ms) */
  timeInterval?: number;
  /** Frame interval for throttling updates */
  frameInterval?: number;
  /** Whether to track mouse movement on the entire document */
  trackGlobally?: boolean;
  /** Custom target element to track mouse on */
  targetElement?: Element;
}

/**
 * Mouse position data with timing information
 */
export interface MousePosition {
  x: number;
  y: number;
  timestamp: number;
  /** Whether this position represents a significant movement */
  isSignificantMove?: boolean;
}

/**
 * Mouse movement event callback
 */
export type MouseMovementCallback = (position: MousePosition) => void;

/**
 * Creates an optimized mouse movement tracker with configurable performance settings
 */
export function createMouseMovementTracker(
  options: MouseMovementTrackerOptions = {}
): {
  onMouseMove: (callback: MouseMovementCallback) => () => void;
  getCurrentPosition: () => MousePosition | null;
  getLastPositions: (count: number) => MousePosition[];
  clearHistory: () => void;
  destroy: () => void;
} {
  const {
    timeInterval = 100,
    frameInterval = 5,
    trackGlobally = true,
    targetElement,
  } = options;

  let isDestroyed = false;
  let lastUpdateTime = 0;
  let frameCount = 0;
  let currentPosition: MousePosition | null = null;
  let positionHistory: MousePosition[] = [];
  const callbacks = new Set<MouseMovementCallback>();
  
  // Maximum history length to prevent memory leaks
  const MAX_HISTORY_LENGTH = 100;

  /**
   * Determines if movement is significant enough to trigger callbacks
   */
  function isSignificantMovement(
    newX: number, 
    newY: number, 
    lastPosition: MousePosition | null
  ): boolean {
    if (!lastPosition) {
      return true; // First movement is always significant
    }

    // Minimum pixel distance to consider significant
    const MIN_DISTANCE = 2;
    const distance = Math.sqrt(
      Math.pow(newX - lastPosition.x, 2) + 
      Math.pow(newY - lastPosition.y, 2)
    );

    return distance >= MIN_DISTANCE;
  }

  /**
   * Internal mouse move handler with throttling and optimization
   */
  function handleMouseMove(event: MouseEvent): void {
    if (isDestroyed) {
      return;
    }

    const now = performance.now();
    frameCount++;

    // Time-based throttling
    if (now - lastUpdateTime < timeInterval) {
      return;
    }

    // Frame-based throttling
    if (frameCount % frameInterval !== 0) {
      return;
    }

    const newX = event.clientX;
    const newY = event.clientY;

    // Check if movement is significant
    if (!isSignificantMovement(newX, newY, currentPosition)) {
      return;
    }

    lastUpdateTime = now;

    const position: MousePosition = {
      x: newX,
      y: newY,
      timestamp: now,
      isSignificantMove: true,
    };

    // Update current position
    currentPosition = position;

    // Add to history
    positionHistory.push(position);
    if (positionHistory.length > MAX_HISTORY_LENGTH) {
      positionHistory.shift(); // Remove oldest position
    }

    // Notify all callbacks
    callbacks.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
        debug.warn('MouseMovementTracker: Callback error:', error);
      }
    });
  }

  // Set up event listener
  const targetEl = targetElement || (trackGlobally ? document : document.body);
  targetEl.addEventListener('mousemove', handleMouseMove, { passive: true });

  /**
   * Registers a callback for mouse movement events
   * Returns an unsubscribe function
   */
  function onMouseMove(callback: MouseMovementCallback): () => void {
    callbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
    };
  }

  /**
   * Gets the current mouse position
   */
  function getCurrentPosition(): MousePosition | null {
    return currentPosition;
  }

  /**
   * Gets the last N mouse positions from history
   */
  function getLastPositions(count: number): MousePosition[] {
    const requestedCount = Math.min(count, positionHistory.length);
    return positionHistory.slice(-requestedCount);
  }

  /**
   * Clears the position history
   */
  function clearHistory(): void {
    positionHistory = [];
  }

  /**
   * Destroys the tracker and cleans up all resources
   */
  function destroy(): void {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    callbacks.clear();
    targetEl.removeEventListener('mousemove', handleMouseMove);
    currentPosition = null;
    positionHistory = [];
  }

  return {
    onMouseMove,
    getCurrentPosition,
    getLastPositions,
    clearHistory,
    destroy,
  };
}

/**
 * Enhanced mouse movement tracker with additional features for overlay system
 */
export function createAdvancedMouseMovementTracker(
  options: MouseMovementTrackerOptions & {
    /** Enable velocity calculation */
    calculateVelocity?: boolean;
    /** Enable direction tracking */
    trackDirection?: boolean;
    /** Minimum velocity to trigger callbacks (pixels/ms) */
    minVelocityThreshold?: number;
  } = {}
): ReturnType<typeof createMouseMovementTracker> & {
  getCurrentVelocity: () => { speed: number; direction: number } | null;
  getAverageVelocity: (samples?: number) => { speed: number; direction: number } | null;
  isMouseMoving: () => boolean;
} {
  const {
    calculateVelocity = true,
    trackDirection = true,
    minVelocityThreshold = 0.1,
    ...baseOptions
  } = options;

  const baseTracker = createMouseMovementTracker(baseOptions);
  let velocityHistory: Array<{ speed: number; direction: number; timestamp: number }> = [];
  let lastVelocityCalculation = 0;
  
  // Override the mouse move callback to calculate velocity
  let velocityCallback: MouseMovementCallback | null = null;

  if (calculateVelocity) {
    velocityCallback = (position: MousePosition) => {
      const positions = baseTracker.getLastPositions(2);
      if (positions.length < 2) {
        return;
      }

      const [prev, curr] = positions.slice(-2);
      const deltaX = curr.x - prev.x;
      const deltaY = curr.y - prev.y;
      const deltaTime = curr.timestamp - prev.timestamp;

      if (deltaTime > 0) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const speed = distance / deltaTime; // pixels per millisecond
        const direction = Math.atan2(deltaY, deltaX); // radians

        // Only record if above threshold
        if (speed >= minVelocityThreshold) {
          velocityHistory.push({
            speed,
            direction,
            timestamp: curr.timestamp,
          });

          // Keep history manageable
          if (velocityHistory.length > 50) {
            velocityHistory.shift();
          }
        }
      }
    };

    baseTracker.onMouseMove(velocityCallback);
  }

  /**
   * Gets the current mouse velocity
   */
  function getCurrentVelocity(): { speed: number; direction: number } | null {
    if (velocityHistory.length === 0) {
      return null;
    }

    return velocityHistory[velocityHistory.length - 1];
  }

  /**
   * Gets the average velocity over the last N samples
   */
  function getAverageVelocity(samples: number = 5): { speed: number; direction: number } | null {
    if (velocityHistory.length === 0) {
      return null;
    }

    const recentSamples = velocityHistory.slice(-samples);
    const avgSpeed = recentSamples.reduce((sum, v) => sum + v.speed, 0) / recentSamples.length;
    
    // Calculate average direction (circular mean)
    let sinSum = 0;
    let cosSum = 0;
    for (const sample of recentSamples) {
      sinSum += Math.sin(sample.direction);
      cosSum += Math.cos(sample.direction);
    }
    const avgDirection = Math.atan2(sinSum / recentSamples.length, cosSum / recentSamples.length);

    return {
      speed: avgSpeed,
      direction: avgDirection,
    };
  }

  /**
   * Determines if the mouse is currently moving based on recent velocity
   */
  function isMouseMoving(): boolean {
    if (velocityHistory.length === 0) {
      return false;
    }

    const now = performance.now();
    const recentVelocity = velocityHistory.find(v => now - v.timestamp < 200); // Within last 200ms
    
    return recentVelocity !== undefined && recentVelocity.speed > minVelocityThreshold;
  }

  return {
    ...baseTracker,
    getCurrentVelocity,
    getAverageVelocity,
    isMouseMoving,
  };
}

/**
 * Utility function to create a mouse movement tracker with sensible defaults
 * for Chrome extension overlay usage
 */
export function createExtensionMouseMovementTracker(): ReturnType<typeof createAdvancedMouseMovementTracker> {
  return createAdvancedMouseMovementTracker({
    timeInterval: 50, // Smooth tracking for overlays
    frameInterval: 2, // Higher frequency for responsive overlays
    trackGlobally: true,
    calculateVelocity: true,
    trackDirection: true,
    minVelocityThreshold: 0.05, // Sensitive to slow movements
  });
}

/**
 * Debounced mouse movement tracker for less frequent updates
 */
export function createDebouncedMouseTracker(
  debounceMs: number = 150
): ReturnType<typeof createMouseMovementTracker> {
  const baseTracker = createMouseMovementTracker({
    timeInterval: debounceMs,
    frameInterval: 1,
  });

  return baseTracker;
}