// ===================================================================
// ELEMENT POSITIONER - Smart Overlay Positioning
// ===================================================================
// Enhanced element positioning system with intelligent fallback logic,
// viewport boundary detection, and collision avoidance.
// ===================================================================

import { calculateOptimalPosition, getBoundingRect } from '../utils/utils.js';

/**
 * Positioning options for overlays
 */
export interface PositioningOptions {
  /** Preferred position relative to target */
  preferredPosition?: 'above' | 'below' | 'left' | 'right';
  /** Pixel offset from calculated position */
  offset?: { x: number; y: number };
  /** Viewport constraints */
  viewport?: { width: number; height: number };
  /** Margin from viewport edges */
  viewportMargin?: number;
  /** Whether to avoid collisions with other overlays */
  avoidCollisions?: boolean;
  /** Minimum distance from other overlays when avoiding collisions */
  collisionMargin?: number;
  /** Whether to flip position if it doesn't fit */
  allowPositionFlipping?: boolean;
  /** Custom boundary element to constrain within */
  boundaryElement?: Element;
}

/**
 * Result of positioning calculation
 */
export interface PositioningResult {
  /** Final calculated position */
  position: { x: number; y: number };
  /** Actual position used (may differ from preferred due to constraints) */
  actualPosition: 'above' | 'below' | 'left' | 'right';
  /** Whether the overlay fits completely in the viewport */
  fitsInViewport: boolean;
  /** Whether position was flipped from preferred */
  wasFlipped: boolean;
  /** Available space in each direction */
  availableSpace: {
    above: number;
    below: number;
    left: number;
    right: number;
  };
}

/**
 * Represents an existing overlay for collision detection
 */
export interface ExistingOverlay {
  element: HTMLElement;
  bounds: DOMRect;
}

/**
 * Creates an enhanced element positioner with smart positioning logic
 */
export function createElementPositioner(): {
  calculatePosition: (
    targetElement: Element,
    overlayDimensions: { width: number; height: number },
    options?: PositioningOptions
  ) => PositioningResult;
  calculatePositionForTextRange: (
    textRange: Range,
    overlayDimensions: { width: number; height: number },
    options?: PositioningOptions
  ) => PositioningResult;
  findBestPositionWithCollisionAvoidance: (
    targetBounds: DOMRect,
    overlayDimensions: { width: number; height: number },
    existingOverlays: ExistingOverlay[],
    options?: PositioningOptions
  ) => PositioningResult;
  registerOverlay: (overlay: HTMLElement) => void;
  unregisterOverlay: (overlay: HTMLElement) => void;
  getAllRegisteredOverlays: () => ExistingOverlay[];
} {
  // Registry of existing overlays for collision detection
  const overlayRegistry = new WeakMap<HTMLElement, ExistingOverlay>();
  const registeredOverlays = new Set<HTMLElement>();

  /**
   * Gets the current viewport dimensions and scroll position
   */
  function getViewportInfo(): { 
    width: number; 
    height: number; 
    scrollX: number; 
    scrollY: number; 
  } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.pageXOffset || document.documentElement.scrollLeft || 0,
      scrollY: window.pageYOffset || document.documentElement.scrollTop || 0,
    };
  }

  /**
   * Calculates available space around a target element
   */
  function calculateAvailableSpace(
    targetBounds: DOMRect,
    viewport: { width: number; height: number } = getViewportInfo()
  ): PositioningResult['availableSpace'] {
    return {
      above: targetBounds.top,
      below: viewport.height - targetBounds.bottom,
      left: targetBounds.left,
      right: viewport.width - targetBounds.right,
    };
  }

  /**
   * Checks if a rectangle collides with existing overlays
   */
  function checkCollisions(
    bounds: DOMRect,
    existingOverlays: ExistingOverlay[],
    margin: number = 0
  ): boolean {
    for (const existing of existingOverlays) {
      const expandedBounds = {
        left: existing.bounds.left - margin,
        top: existing.bounds.top - margin,
        right: existing.bounds.right + margin,
        bottom: existing.bounds.bottom + margin,
      };

      if (
        bounds.left < expandedBounds.right &&
        bounds.right > expandedBounds.left &&
        bounds.top < expandedBounds.bottom &&
        bounds.bottom > expandedBounds.top
      ) {
        return true; // Collision detected
      }
    }

    return false;
  }

  /**
   * Calculates position for a DOM element target
   */
  function calculatePosition(
    targetElement: Element,
    overlayDimensions: { width: number; height: number },
    options: PositioningOptions = {}
  ): PositioningResult {
    const targetBounds = getBoundingRect(targetElement);
    const existingOverlays = options.avoidCollisions ? getAllRegisteredOverlays() : [];
    
    return findBestPositionWithCollisionAvoidance(
      targetBounds,
      overlayDimensions,
      existingOverlays,
      options
    );
  }

  /**
   * Calculates position for a text range target
   */
  function calculatePositionForTextRange(
    textRange: Range,
    overlayDimensions: { width: number; height: number },
    options: PositioningOptions = {}
  ): PositioningResult {
    const targetBounds = textRange.getBoundingClientRect();
    const existingOverlays = options.avoidCollisions ? getAllRegisteredOverlays() : [];
    
    return findBestPositionWithCollisionAvoidance(
      targetBounds,
      overlayDimensions,
      existingOverlays,
      options
    );
  }

  /**
   * Finds the best position considering viewport constraints and collision avoidance
   */
  function findBestPositionWithCollisionAvoidance(
    targetBounds: DOMRect,
    overlayDimensions: { width: number; height: number },
    existingOverlays: ExistingOverlay[],
    options: PositioningOptions = {}
  ): PositioningResult {
    const {
      preferredPosition = 'below',
      offset = { x: 0, y: 0 },
      viewport = getViewportInfo(),
      viewportMargin = 10,
      avoidCollisions = true,
      collisionMargin = 5,
      allowPositionFlipping = true,
      boundaryElement,
    } = options;

    const availableSpace = calculateAvailableSpace(targetBounds, viewport);
    
    // Adjust viewport for margins
    const constrainedViewport = {
      width: viewport.width - (viewportMargin * 2),
      height: viewport.height - (viewportMargin * 2),
    };

    // Try preferred position first
    let result = tryPosition(
      targetBounds,
      overlayDimensions,
      preferredPosition,
      offset,
      constrainedViewport,
      existingOverlays,
      avoidCollisions,
      collisionMargin
    );

    if (result.fitsInViewport && (!avoidCollisions || !result.hasCollision)) {
      return {
        position: result.position,
        actualPosition: preferredPosition,
        fitsInViewport: true,
        wasFlipped: false,
        availableSpace,
      };
    }

    // Try alternative positions if flipping is allowed
    if (allowPositionFlipping) {
      const alternatives: Array<'above' | 'below' | 'left' | 'right'> = 
        preferredPosition === 'above' ? ['below', 'right', 'left'] :
        preferredPosition === 'below' ? ['above', 'right', 'left'] :
        preferredPosition === 'left' ? ['right', 'below', 'above'] :
        ['left', 'below', 'above'];

      for (const altPosition of alternatives) {
        result = tryPosition(
          targetBounds,
          overlayDimensions,
          altPosition,
          offset,
          constrainedViewport,
          existingOverlays,
          avoidCollisions,
          collisionMargin
        );

        if (result.fitsInViewport && (!avoidCollisions || !result.hasCollision)) {
          return {
            position: result.position,
            actualPosition: altPosition,
            fitsInViewport: true,
            wasFlipped: true,
            availableSpace,
          };
        }
      }
    }

    // If no position works perfectly, use the original preferred position with clamping
    const clampedResult = calculateOptimalPosition(
      targetBounds,
      overlayDimensions.width,
      overlayDimensions.height,
      preferredPosition,
      offset,
      constrainedViewport
    );

    return {
      position: { x: clampedResult.x + viewportMargin, y: clampedResult.y + viewportMargin },
      actualPosition: clampedResult.position,
      fitsInViewport: false,
      wasFlipped: clampedResult.position !== preferredPosition,
      availableSpace,
    };
  }

  /**
   * Tries a specific position and checks if it fits and avoids collisions
   */
  function tryPosition(
    targetBounds: DOMRect,
    overlayDimensions: { width: number; height: number },
    position: 'above' | 'below' | 'left' | 'right',
    offset: { x: number; y: number },
    viewport: { width: number; height: number },
    existingOverlays: ExistingOverlay[],
    avoidCollisions: boolean,
    collisionMargin: number
  ): { position: { x: number; y: number }; fitsInViewport: boolean; hasCollision: boolean } {
    const calculated = calculateOptimalPosition(
      targetBounds,
      overlayDimensions.width,
      overlayDimensions.height,
      position,
      offset,
      viewport
    );

    // Check if it fits in viewport
    const fitsInViewport = 
      calculated.x >= 0 &&
      calculated.y >= 0 &&
      calculated.x + overlayDimensions.width <= viewport.width &&
      calculated.y + overlayDimensions.height <= viewport.height;

    // Check for collisions
    let hasCollision = false;
    if (avoidCollisions && existingOverlays.length > 0) {
      const overlayBounds = new DOMRect(
        calculated.x,
        calculated.y,
        overlayDimensions.width,
        overlayDimensions.height
      );
      hasCollision = checkCollisions(overlayBounds, existingOverlays, collisionMargin);
    }

    return {
      position: { x: calculated.x, y: calculated.y },
      fitsInViewport,
      hasCollision,
    };
  }

  /**
   * Registers an overlay for collision detection
   */
  function registerOverlay(overlay: HTMLElement): void {
    const bounds = overlay.getBoundingClientRect();
    const overlayData: ExistingOverlay = { element: overlay, bounds };
    
    overlayRegistry.set(overlay, overlayData);
    registeredOverlays.add(overlay);
  }

  /**
   * Unregisters an overlay from collision detection
   */
  function unregisterOverlay(overlay: HTMLElement): void {
    overlayRegistry.delete(overlay);
    registeredOverlays.delete(overlay);
  }

  /**
   * Gets all currently registered overlays with updated bounds
   */
  function getAllRegisteredOverlays(): ExistingOverlay[] {
    const overlays: ExistingOverlay[] = [];
    
    for (const overlay of registeredOverlays) {
      if (document.contains(overlay)) {
        const bounds = overlay.getBoundingClientRect();
        overlays.push({ element: overlay, bounds });
      } else {
        // Clean up overlays that are no longer in the DOM
        unregisterOverlay(overlay);
      }
    }
    
    return overlays;
  }

  return {
    calculatePosition,
    calculatePositionForTextRange,
    findBestPositionWithCollisionAvoidance,
    registerOverlay,
    unregisterOverlay,
    getAllRegisteredOverlays,
  };
}

/**
 * Utility function to create an element positioner with Chrome extension optimizations
 */
export function createExtensionElementPositioner(): ReturnType<typeof createElementPositioner> {
  return createElementPositioner();
}