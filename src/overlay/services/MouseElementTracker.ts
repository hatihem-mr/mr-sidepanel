import { debug } from '../../shared/utils/debug.js';
// ===================================================================
// MOUSE ELEMENT TRACKER - Optimized Element Detection
// ===================================================================
// Enhanced mouse element tracking with performance optimizations
// and better caching strategies for the Chrome extension context.
// ===================================================================

/**
 * Configuration options for mouse element tracker
 */
export interface MouseElementTrackerOptions {
  /** Cache duration in milliseconds before refreshing element lookup */
  cacheDuration?: number;
  /** Whether to return only the top element or all elements at position */
  returnSingleElement?: boolean;
  /** Custom filter function to exclude certain elements */
  elementFilter?: (element: Element) => boolean;
}

/**
 * Result from mouse element tracking
 */
export interface MouseElementResult {
  /** Whether the elements changed since last query */
  changed: boolean;
  /** Elements currently under the mouse cursor */
  cachedElements: Element[];
  /** Timestamp of when elements were cached */
  timestamp: number;
}

/**
 * Creates an enhanced mouse element tracker with performance optimizations
 * and Chrome extension specific improvements
 */
export function createMouseElementTracker(
  options: MouseElementTrackerOptions = {}
): {
  getElementsUnderMouse: (x: number, y: number, returnSingleElement?: boolean) => MouseElementResult;
  clearCache: () => void;
  destroy: () => void;
} {
  const {
    cacheDuration = 50, // 50ms cache by default for smooth performance
    elementFilter,
  } = options;

  let cachedElements: Element[] = [];
  let lastLookupTime = 0;
  let lastX = -1;
  let lastY = -1;
  let isDestroyed = false;

  /**
   * Filters elements based on configuration and Chrome extension context
   */
  function filterElements(elements: Element[]): Element[] {
    if (!elementFilter) {
      return elements;
    }

    return elements.filter(elementFilter);
  }

  /**
   * Gets all elements under the mouse at specified coordinates with caching
   */
  function getElementsUnderMouse(
    x: number,
    y: number,
    returnSingleElement: boolean = false
  ): MouseElementResult {
    if (isDestroyed) {
      return {
        changed: false,
        cachedElements: [],
        timestamp: 0,
      };
    }

    const now = performance.now();
    const positionChanged = x !== lastX || y !== lastY;
    const cacheExpired = now - lastLookupTime > cacheDuration;

    // Return cached results if position hasn't changed and cache is still valid
    if (!positionChanged && !cacheExpired) {
      return {
        changed: false,
        cachedElements,
        timestamp: lastLookupTime,
      };
    }

    // Update tracking variables
    lastLookupTime = now;
    lastX = x;
    lastY = y;

    let newElements: Element[];

    try {
      if (returnSingleElement) {
        // Get only the topmost element for performance
        const element = document.elementFromPoint(x, y);
        newElements = element ? [element] : [];
      } else {
        // Get all elements at the position
        const elementsFromPoint = document.elementsFromPoint(x, y);
        newElements = Array.from(elementsFromPoint);
      }

      // Apply filtering
      newElements = filterElements(newElements);

      // Check if elements actually changed
      const elementsChanged = !areElementArraysEqual(cachedElements, newElements);
      
      // Update cache
      cachedElements = newElements;

      return {
        changed: elementsChanged,
        cachedElements: newElements,
        timestamp: now,
      };
    } catch (error) {
      debug.warn('MouseElementTracker: Error getting elements at point:', error);
      return {
        changed: false,
        cachedElements: [],
        timestamp: now,
      };
    }
  }

  /**
   * Compares two element arrays for equality
   */
  function areElementArraysEqual(arr1: Element[], arr2: Element[]): boolean {
    if (arr1.length !== arr2.length) {
      return false;
    }

    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clears the element cache and forces refresh on next query
   */
  function clearCache(): void {
    cachedElements = [];
    lastLookupTime = 0;
    lastX = -1;
    lastY = -1;
  }

  /**
   * Destroys the tracker and cleans up resources
   */
  function destroy(): void {
    clearCache();
    isDestroyed = true;
  }

  return {
    getElementsUnderMouse,
    clearCache,
    destroy,
  };
}

/**
 * Enhanced mouse element tracker with additional Chrome extension features
 */
export function createAdvancedMouseElementTracker(
  options: MouseElementTrackerOptions & {
    /** Exclude overlay elements from detection */
    excludeOverlays?: boolean;
    /** Exclude extension-related elements */
    excludeExtensionElements?: boolean;
    /** Track element hierarchy changes */
    trackHierarchyChanges?: boolean;
  } = {}
): ReturnType<typeof createMouseElementTracker> & {
  getElementHierarchy: (x: number, y: number) => Element[];
  getDeepestElement: (x: number, y: number) => Element | null;
} {
  const {
    excludeOverlays = true,
    excludeExtensionElements = true,
    trackHierarchyChanges = false,
    ...baseOptions
  } = options;

  // Create enhanced element filter
  const enhancedFilter = (element: Element): boolean => {
    // Exclude overlay elements
    if (excludeOverlays && element.closest('[data-overlay-manager], .overlay-instance')) {
      return false;
    }

    // Exclude extension elements
    if (excludeExtensionElements) {
      const id = element.id;
      const className = element.className;
      
      if (
        id?.includes('chrome-extension') ||
        id?.includes('overlay-manager') ||
        typeof className === 'string' && (
          className.includes('chrome-extension') ||
          className.includes('overlay-')
        )
      ) {
        return false;
      }
    }

    // Apply custom filter if provided
    if (baseOptions.elementFilter) {
      return baseOptions.elementFilter(element);
    }

    return true;
  };

  const baseTracker = createMouseElementTracker({
    ...baseOptions,
    elementFilter: enhancedFilter,
  });

  /**
   * Gets the full element hierarchy at a position
   */
  function getElementHierarchy(x: number, y: number): Element[] {
    try {
      const allElements = document.elementsFromPoint(x, y);
      return enhancedFilter ? allElements.filter(enhancedFilter) : allElements;
    } catch (error) {
      debug.warn('Advanced MouseElementTracker: Error getting hierarchy:', error);
      return [];
    }
  }

  /**
   * Gets the deepest (most specific) element at a position
   */
  function getDeepestElement(x: number, y: number): Element | null {
    const hierarchy = getElementHierarchy(x, y);
    return hierarchy.length > 0 ? hierarchy[0] : null;
  }

  return {
    ...baseTracker,
    getElementHierarchy,
    getDeepestElement,
  };
}

/**
 * Utility function to create a mouse element tracker with sensible defaults
 * for Chrome extension usage
 */
export function createExtensionMouseTracker(): ReturnType<typeof createAdvancedMouseElementTracker> {
  return createAdvancedMouseElementTracker({
    cacheDuration: 100, // Slightly longer cache for extension context
    excludeOverlays: true,
    excludeExtensionElements: true,
    trackHierarchyChanges: true,
    elementFilter: (element) => {
      // Additional filtering for extension context
      const tagName = element.tagName.toLowerCase();
      
      // Exclude script and style elements
      if (tagName === 'script' || tagName === 'style') {
        return false;
      }

      // Exclude hidden elements
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }

      return true;
    },
  });
}