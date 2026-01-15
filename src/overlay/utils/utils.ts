import { debug } from '../../shared/utils/debug.js';
// ===================================================================
// OVERLAY UTILITIES - Enhanced Helper Functions
// ===================================================================
// Modernized utility functions for the overlay system with improved
// type safety and performance optimizations.
// ===================================================================

/**
 * Generates a unique instance ID for overlay instances
 * Uses crypto.randomUUID if available, falls back to timestamp + random
 */
export function generateInstanceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return `overlay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Checks if a point is within a rectangle
 * Used for hover detection and positioning calculations
 */
export function isPointInRect(
  x: number, 
  y: number, 
  rect: { left: number; top: number; right: number; bottom: number }
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Gets the bounding rect with proper fallbacks for edge cases
 */
export function getBoundingRect(element: Element): DOMRect {
  const rect = element.getBoundingClientRect();
  
  // Handle edge case where element has no dimensions
  if (rect.width === 0 && rect.height === 0) {
    // For text nodes or inline elements, use range to get proper bounds
    const range = document.createRange();
    range.selectNodeContents(element);
    const rangeRect = range.getBoundingClientRect();
    range.detach();
    
    if (rangeRect.width > 0 || rangeRect.height > 0) {
      return rangeRect;
    }
  }
  
  return rect;
}

/**
 * Calculates the optimal position for an overlay relative to a target element
 * with screen boundary detection and fallback positioning
 */
export function calculateOptimalPosition(
  targetRect: DOMRect,
  overlayWidth: number,
  overlayHeight: number,
  preferredPosition: 'above' | 'below' | 'left' | 'right' = 'below',
  offset: { x: number; y: number } = { x: 0, y: 0 },
  viewport: { width: number; height: number } = { 
    width: window.innerWidth, 
    height: window.innerHeight 
  }
): { x: number; y: number; position: 'above' | 'below' | 'left' | 'right' } {
  const positions = {
    below: {
      x: targetRect.left + (targetRect.width / 2) - (overlayWidth / 2) + offset.x,
      y: targetRect.bottom + offset.y,
    },
    above: {
      x: targetRect.left + (targetRect.width / 2) - (overlayWidth / 2) + offset.x,
      y: targetRect.top - overlayHeight + offset.y,
    },
    right: {
      x: targetRect.right + offset.x,
      y: targetRect.top + (targetRect.height / 2) - (overlayHeight / 2) + offset.y,
    },
    left: {
      x: targetRect.left - overlayWidth + offset.x,
      y: targetRect.top + (targetRect.height / 2) - (overlayHeight / 2) + offset.y,
    },
  };

  // Check if preferred position fits in viewport
  const preferred = positions[preferredPosition];
  if (
    preferred.x >= 0 && 
    preferred.x + overlayWidth <= viewport.width &&
    preferred.y >= 0 && 
    preferred.y + overlayHeight <= viewport.height
  ) {
    return { ...preferred, position: preferredPosition };
  }

  // Try alternative positions in order of preference
  const alternatives: Array<'below' | 'above' | 'right' | 'left'> = 
    preferredPosition === 'above' ? ['below', 'right', 'left'] :
    preferredPosition === 'below' ? ['above', 'right', 'left'] :
    preferredPosition === 'left' ? ['right', 'below', 'above'] :
    ['left', 'below', 'above'];

  for (const alt of alternatives) {
    const pos = positions[alt];
    if (
      pos.x >= 0 && 
      pos.x + overlayWidth <= viewport.width &&
      pos.y >= 0 && 
      pos.y + overlayHeight <= viewport.height
    ) {
      return { ...pos, position: alt };
    }
  }

  // If no position fits perfectly, use preferred with boundary clamping
  const clamped = {
    x: Math.max(0, Math.min(preferred.x, viewport.width - overlayWidth)),
    y: Math.max(0, Math.min(preferred.y, viewport.height - overlayHeight)),
    position: preferredPosition,
  };

  return clamped;
}

/**
 * Debounces a function to improve performance
 * Useful for mouse movement and resize event handlers
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Throttles a function to limit execution frequency
 * Better for continuous events like mouse movement
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T, 
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Safely removes an element from the DOM with error handling
 */
export function safeRemoveElement(element: Element | null): boolean {
  if (!element || !element.parentNode) {
    return false;
  }
  
  try {
    element.parentNode.removeChild(element);
    return true;
  } catch (error) {
    debug.warn('Failed to remove element:', error);
    return false;
  }
}

/**
 * Gets the computed z-index of an element with proper number conversion
 */
export function getComputedZIndex(element: Element): number {
  const computed = window.getComputedStyle(element);
  const zIndex = computed.zIndex;
  
  if (zIndex === 'auto' || zIndex === '') {
    return 0;
  }
  
  const parsed = parseInt(zIndex, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Finds the highest z-index currently used in the document
 * Useful for ensuring overlays appear on top
 */
export function findHighestZIndex(): number {
  const elements = document.querySelectorAll('*');
  let highest = 0;
  
  for (const element of elements) {
    const zIndex = getComputedZIndex(element);
    if (zIndex > highest) {
      highest = zIndex;
    }
  }
  
  return highest;
}

/**
 * Creates a performance-optimized RAF-based animation function
 */
export function animateWithRAF(
  duration: number,
  easing: (t: number) => number = (t) => t, // Linear easing by default
  onUpdate: (progress: number) => void,
  onComplete?: () => void
): () => void {
  let startTime: number | null = null;
  let animationId: number | null = null;
  
  const animate = (currentTime: number) => {
    if (startTime === null) {
      startTime = currentTime;
    }
    
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(progress);
    
    onUpdate(easedProgress);
    
    if (progress < 1) {
      animationId = requestAnimationFrame(animate);
    } else {
      onComplete?.();
      animationId = null;
    }
  };
  
  animationId = requestAnimationFrame(animate);
  
  // Return cleanup function
  return () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };
}

/**
 * Common easing functions for animations
 */
export const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
} as const;

/**
 * Checks if an element is visible in the viewport
 */
export function isElementVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
  
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < viewport.height &&
    rect.left < viewport.width
  );
}

/**
 * Gets the scroll offset of the document
 */
export function getScrollOffset(): { x: number; y: number } {
  return {
    x: window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
    y: window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0,
  };
}

/**
 * Converts a relative position to absolute screen coordinates
 */
export function relativeToAbsolute(
  relativeX: number, 
  relativeY: number, 
  containerElement: Element
): { x: number; y: number } {
  const containerRect = getBoundingRect(containerElement);
  const scroll = getScrollOffset();
  
  return {
    x: containerRect.left + relativeX + scroll.x,
    y: containerRect.top + relativeY + scroll.y,
  };
}

/**
 * Type-safe event listener management
 */
export class EventListenerManager {
  private listeners: Array<{
    element: Element | Window | Document;
    event: string;
    handler: EventListener;
    options?: AddEventListenerOptions;
  }> = [];

  add<K extends keyof ElementEventMap>(
    element: Element,
    event: K,
    handler: (this: Element, ev: ElementEventMap[K]) => any,
    options?: AddEventListenerOptions
  ): void;
  add<K extends keyof WindowEventMap>(
    element: Window,
    event: K,
    handler: (this: Window, ev: WindowEventMap[K]) => any,
    options?: AddEventListenerOptions
  ): void;
  add<K extends keyof DocumentEventMap>(
    element: Document,
    event: K,
    handler: (this: Document, ev: DocumentEventMap[K]) => any,
    options?: AddEventListenerOptions
  ): void;
  add(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);
    this.listeners.push({ element, event, handler, options });
  }

  removeAll(): void {
    for (const { element, event, handler, options } of this.listeners) {
      element.removeEventListener(event, handler, options);
    }
    this.listeners = [];
  }

  remove(
    element: Element | Window | Document,
    event: string,
    handler: EventListener
  ): void {
    element.removeEventListener(event, handler);
    this.listeners = this.listeners.filter(
      listener => !(
        listener.element === element &&
        listener.event === event &&
        listener.handler === handler
      )
    );
  }
}