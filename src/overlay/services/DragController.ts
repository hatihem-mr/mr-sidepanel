// ===================================================================
// DRAG CONTROLLER - Enhanced Dragging Functionality
// ===================================================================
// Modernized drag controller with improved performance, better touch
// support, and enhanced features for the overlay system.
// ===================================================================

import { EventListenerManager } from '../utils/utils.js';

/**
 * Configuration options for the drag controller
 */
export interface DragControllerOptions {
  /** The element to make draggable */
  element: HTMLElement;
  /** CSS selector for the handle elements that trigger dragging */
  handleSelector: string;
  /** Window object for event handling */
  window: Window & typeof globalThis;
  /** Document object for event handling */
  document: Document;
  /** Whether to constrain dragging to viewport bounds */
  constrainToViewport?: boolean;
  /** Custom boundary element to constrain dragging within */
  boundaryElement?: Element;
  /** Whether to animate drag start/end */
  animated?: boolean;
  /** Custom drag cursor */
  dragCursor?: string;
  /** Whether to add visual feedback during drag */
  addVisualFeedback?: boolean;
}

/**
 * Current drag state information
 */
export interface DragState {
  /** Whether currently dragging */
  isDragging: boolean;
  /** Whether element has been moved from original position */
  wasDragged: boolean;
  /** Current position */
  currentPosition: { x: number; y: number };
  /** Original position before any dragging */
  originalPosition: { x: number; y: number };
  /** Starting position of current drag */
  dragStartPosition: { x: number; y: number };
  /** Mouse offset from element corner when drag started */
  mouseOffset: { x: number; y: number };
}

/**
 * Drag event callbacks
 */
export interface DragCallbacks {
  /** Called when drag starts */
  onDragStart?: (state: DragState) => void;
  /** Called during drag movement */
  onDragMove?: (state: DragState) => void;
  /** Called when drag ends */
  onDragEnd?: (state: DragState) => void;
  /** Called when position is reset */
  onReset?: () => void;
}

/**
 * Enhanced drag controller interface
 */
export interface DragController {
  /** Current drag state */
  readonly state: DragState;
  /** Whether the element is currently being dragged */
  readonly isDragging: boolean;
  /** Whether the element has been dragged from its original position */
  readonly wasDragged: boolean;
  /** Reset the element to its original position */
  resetDraggedState(): void;
  /** Set the position programmatically */
  setPosition(x: number, y: number): void;
  /** Get the current position */
  getPosition(): { x: number; y: number };
  /** Enable/disable dragging */
  setEnabled(enabled: boolean): void;
  /** Clean up all event listeners and resources */
  cleanup(): void;
}

/**
 * Creates an enhanced drag controller with modern features
 */
export function createDragController(
  options: DragControllerOptions,
  callbacks: DragCallbacks = {}
): DragController {
  const {
    element,
    handleSelector,
    window,
    document,
    constrainToViewport = true,
    boundaryElement,
    animated = true,
    dragCursor = 'grabbing',
    addVisualFeedback = true,
  } = options;

  const {
    onDragStart,
    onDragMove,
    onDragEnd,
    onReset,
  } = callbacks;

  const eventManager = new EventListenerManager();
  let isEnabled = true;
  let handles: HTMLElement[] = [];

  // Initialize drag state
  const state: DragState = {
    isDragging: false,
    wasDragged: false,
    currentPosition: { x: 0, y: 0 },
    originalPosition: { x: -1, y: -1 },
    dragStartPosition: { x: 0, y: 0 },
    mouseOffset: { x: 0, y: 0 },
  };

  /**
   * Stores the original position when first initialized
   */
  function storeOriginalPosition(): void {
    if (state.originalPosition.x === -1 && state.originalPosition.y === -1) {
      const style = window.getComputedStyle(element);
      const computedLeft = style.left === 'auto' ? 0 : parseInt(style.left, 10);
      const computedTop = style.top === 'auto' ? 0 : parseInt(style.top, 10);

      state.originalPosition = {
        x: isNaN(computedLeft) ? 0 : computedLeft,
        y: isNaN(computedTop) ? 0 : computedTop,
      };

      state.currentPosition = { ...state.originalPosition };
    }
  }

  /**
   * Updates drag handles based on the selector
   */
  function updateHandles(): void {
    handles = Array.from(element.querySelectorAll(handleSelector)) as HTMLElement[];
    
    // If no handles found, use the element itself
    if (handles.length === 0) {
      handles = [element];
    }

    // Set up handle event listeners
    handles.forEach(handle => {
      // Mouse events
      eventManager.add(handle, 'mousedown', handleMouseDown);
      
      // Touch events for mobile support
      eventManager.add(handle, 'touchstart', handleTouchStart);
      
      // Visual feedback
      if (addVisualFeedback) {
        handle.style.cursor = 'grab';
        handle.style.userSelect = 'none';
      }
    });
  }

  /**
   * Calculates boundary constraints for position
   */
  function calculateConstraints(x: number, y: number): { x: number; y: number } {
    let constrainedX = x;
    let constrainedY = y;

    if (constrainToViewport || boundaryElement) {
      const elementRect = element.getBoundingClientRect();
      const elementWidth = elementRect.width;
      const elementHeight = elementRect.height;

      let boundaryRect: DOMRect;
      
      if (boundaryElement) {
        boundaryRect = boundaryElement.getBoundingClientRect();
      } else {
        // Use viewport bounds
        boundaryRect = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
      }

      // Constrain to boundary
      constrainedX = Math.max(boundaryRect.left, Math.min(x, boundaryRect.right - elementWidth));
      constrainedY = Math.max(boundaryRect.top, Math.min(y, boundaryRect.bottom - elementHeight));
    }

    return { x: constrainedX, y: constrainedY };
  }

  /**
   * Updates element position with constraints and animation
   */
  function updatePosition(x: number, y: number, animate: boolean = false): void {
    const constrainedPos = calculateConstraints(x, y);
    
    if (animate && animated) {
      element.style.transition = 'left 0.2s ease, top 0.2s ease';
      
      // Remove transition after animation
      setTimeout(() => {
        element.style.transition = '';
      }, 200);
    } else {
      element.style.transition = '';
    }

    element.style.left = `${constrainedPos.x}px`;
    element.style.top = `${constrainedPos.y}px`;
    
    state.currentPosition = constrainedPos;
  }

  /**
   * Mouse down handler to start dragging
   */
  function handleMouseDown(event: MouseEvent): void {
    if (!isEnabled || event.button !== 0) { // Only left mouse button
      return;
    }

    // Don't drag if clicking on interactive elements
    const target = event.target as HTMLElement;
    const interactiveElements = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'];
    if (interactiveElements.includes(target.tagName)) {
      return;
    }

    startDrag(event.clientX, event.clientY);
    event.preventDefault();
    
    // Add document-level event listeners for drag
    eventManager.add(document, 'mousemove', handleMouseMove);
    eventManager.add(document, 'mouseup', handleMouseUp);
    eventManager.add(document, 'selectstart', preventDefault); // Prevent text selection
  }

  /**
   * Touch start handler for mobile support
   */
  function handleTouchStart(event: TouchEvent): void {
    if (!isEnabled || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    startDrag(touch.clientX, touch.clientY);
    event.preventDefault();
    
    // Add document-level touch event listeners
    eventManager.add(document, 'touchmove', handleTouchMove);
    eventManager.add(document, 'touchend', handleTouchEnd);
    eventManager.add(document, 'touchcancel', handleTouchEnd);
  }

  /**
   * Starts the drag operation
   */
  function startDrag(clientX: number, clientY: number): void {
    storeOriginalPosition();
    
    const elementRect = element.getBoundingClientRect();
    
    state.isDragging = true;
    state.dragStartPosition = { x: clientX, y: clientY };
    state.mouseOffset = {
      x: clientX - elementRect.left,
      y: clientY - elementRect.top,
    };

    // Visual feedback
    if (addVisualFeedback) {
      element.style.cursor = dragCursor;
      element.style.zIndex = String(parseInt(element.style.zIndex || '0') + 1000);
      
      // Add dragging class for CSS styling
      element.classList.add('dragging');
    }

    onDragStart?.(state);
  }

  /**
   * Mouse move handler during drag
   */
  function handleMouseMove(event: MouseEvent): void {
    if (!state.isDragging) return;
    
    performDrag(event.clientX, event.clientY);
    event.preventDefault();
  }

  /**
   * Touch move handler during drag
   */
  function handleTouchMove(event: TouchEvent): void {
    if (!state.isDragging || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    performDrag(touch.clientX, touch.clientY);
    event.preventDefault();
  }

  /**
   * Performs the actual drag movement
   */
  function performDrag(clientX: number, clientY: number): void {
    const newX = clientX - state.mouseOffset.x;
    const newY = clientY - state.mouseOffset.y;
    
    updatePosition(newX, newY, false);
    state.wasDragged = true;
    
    onDragMove?.(state);
  }

  /**
   * Mouse up handler to end dragging
   */
  function handleMouseUp(event: MouseEvent): void {
    endDrag();
    
    // Remove document-level event listeners
    eventManager.remove(document, 'mousemove', handleMouseMove);
    eventManager.remove(document, 'mouseup', handleMouseUp);
    eventManager.remove(document, 'selectstart', preventDefault);
  }

  /**
   * Touch end handler to end dragging
   */
  function handleTouchEnd(event: TouchEvent): void {
    endDrag();
    
    // Remove document-level touch event listeners
    eventManager.remove(document, 'touchmove', handleTouchMove);
    eventManager.remove(document, 'touchend', handleTouchEnd);
    eventManager.remove(document, 'touchcancel', handleTouchEnd);
  }

  /**
   * Ends the drag operation
   */
  function endDrag(): void {
    if (!state.isDragging) return;
    
    state.isDragging = false;

    // Reset visual feedback
    if (addVisualFeedback) {
      element.style.cursor = '';
      element.style.zIndex = String(Math.max(0, parseInt(element.style.zIndex || '0') - 1000));
      element.classList.remove('dragging');
      
      // Reset handle cursors
      handles.forEach(handle => {
        handle.style.cursor = 'grab';
      });
    }

    onDragEnd?.(state);
  }

  /**
   * Prevents default behavior (used for text selection prevention)
   */
  function preventDefault(event: Event): void {
    event.preventDefault();
  }

  /**
   * Resets element to original position
   */
  function resetDraggedState(): void {
    if (state.originalPosition.x !== -1 && state.originalPosition.y !== -1) {
      updatePosition(state.originalPosition.x, state.originalPosition.y, animated);
      state.wasDragged = false;
      onReset?.();
    }
  }

  /**
   * Sets position programmatically
   */
  function setPosition(x: number, y: number): void {
    updatePosition(x, y, false);
    state.wasDragged = true;
  }

  /**
   * Gets current position
   */
  function getPosition(): { x: number; y: number } {
    return { ...state.currentPosition };
  }

  /**
   * Enables or disables dragging
   */
  function setEnabled(enabled: boolean): void {
    isEnabled = enabled;
    
    if (addVisualFeedback) {
      handles.forEach(handle => {
        handle.style.cursor = enabled ? 'grab' : 'default';
        handle.style.pointerEvents = enabled ? 'auto' : 'none';
      });
    }
  }

  /**
   * Cleans up all resources
   */
  function cleanup(): void {
    eventManager.removeAll();
    handles = [];
    
    // Reset element styles
    if (addVisualFeedback) {
      element.style.cursor = '';
      element.style.transition = '';
      element.classList.remove('dragging');
    }
  }

  // Initialize
  storeOriginalPosition();
  updateHandles();

  return {
    get state() { return { ...state }; },
    get isDragging() { return state.isDragging; },
    get wasDragged() { return state.wasDragged; },
    resetDraggedState,
    setPosition,
    getPosition,
    setEnabled,
    cleanup,
  };
}

/**
 * Creates a drag controller with sensible defaults for overlay usage
 */
export function createOverlayDragController(
  element: HTMLElement,
  handleSelector: string = '.drag-handle',
  callbacks: DragCallbacks = {}
): DragController {
  return createDragController({
    element,
    handleSelector,
    window,
    document,
    constrainToViewport: true,
    animated: true,
    dragCursor: 'grabbing',
    addVisualFeedback: true,
  }, callbacks);
}