// ===================================================================
// OVERLAY SYSTEM - Main Entry Point
// ===================================================================
// Public API for the enhanced overlay system with React support
// and Chrome extension optimizations.
// ===================================================================

import React from 'react';

// Core overlay manager
import { createOverlayManager } from './core/OverlayManager.js';
export { createOverlayManager };
export default createOverlayManager;

// Type definitions
export type {
  // Core types
  OverlayManager,
  OverlayOptions,
  StandaloneOverlayOptions,
  OverlayInstance,
  OverlayRegistration,
  OverlayTarget,
  OverlayManagerMetrics,
  OverlayDebugInfo,
  
  // Component creator types
  ComponentOptions,
  StandaloneComponentOptions,
  ElementComponentCreator,
  TextComponentCreator,
  StandaloneComponentCreator,
  ComponentCreatorReturnType,
  
  // Search function types
  SearchFunction,
  TextSearchFunction,
  
  // Error types
  OverlayError,
  OverlayErrorCode,
  
  // React types
  ReactElement,
} from './core/types.js';

// React components and utilities
export {
  createOverlayContainer,
  OverlayWrapper,
  OverlayLoading,
  OverlayError as OverlayErrorComponent,
} from './components/OverlayContainer.js';

export {
  renderReactElement,
  createReactRenderer,
  withOverlayEnhancements,
  useOverlayLifecycle,
  getReactVersion,
  OverlayDebugComponent,
} from './components/ReactElementRenderer.js';

// Services
export { createMouseElementTracker, createAdvancedMouseElementTracker } from './services/MouseElementTracker.js';
export { createMouseMovementTracker, createAdvancedMouseMovementTracker } from './services/MouseMovementTracker.js';
export { createDragController, createOverlayDragController } from './services/DragController.js';
export { createElementPositioner } from './services/ElementPositioner.js';
export { createTextRangeTracker } from './services/TextRangeTracker.js';

// Service types
export type { 
  MouseElementTrackerOptions,
  MouseElementResult,
  MouseMovementTrackerOptions,
  MousePosition,
  MouseMovementCallback,
  DragController,
  DragControllerOptions,
  DragState,
  DragCallbacks,
  PositioningOptions,
  PositioningResult,
  TextRangeMatch,
  TextRangeTrackerOptions,
  TextRangeCallback,
} from './services/MouseElementTracker.js';

// Utilities
export {
  generateInstanceId,
  isPointInRect,
  getBoundingRect,
  calculateOptimalPosition,
  debounce,
  throttle,
  safeRemoveElement,
  getComputedZIndex,
  findHighestZIndex,
  animateWithRAF,
  easingFunctions,
  isElementVisible,
  getScrollOffset,
  relativeToAbsolute,
  EventListenerManager,
} from './utils/utils.js';

export {
  computeConvexHull,
  isPointInConvexPolygon,
  isInConvexHull,
  rectToPoints,
  getPointsFromElements,
  calculatePolygonArea,
  calculatePolygonCentroid,
  expandConvexHull,
  debugDrawConvexHull,
} from './utils/ConvexHull.js';

export type { Point } from './utils/ConvexHull.js';

// Registry
export { OverlayRegistry } from './core/OverlayRegistry.js';

// ===================================================================
// CONVENIENCE FACTORY FUNCTIONS
// ===================================================================

/**
 * Creates an overlay manager with sensible defaults for Chrome extension usage
 */
export function createExtensionOverlayManager(customStyles?: string): ReturnType<typeof createOverlayManager> {
  const extensionStyles = `
    /* Chrome extension specific styles */
    .overlay-manager-content {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
    }
    
    .overlay-card {
      font-size: 13px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* Ensure overlays appear above all page content */
    .overlay-instance {
      z-index: 2147483647 !important; /* Maximum z-index */
    }
    
    /* Better contrast for overlays on various backgrounds */
    .overlay-card {
      backdrop-filter: blur(8px);
      background: rgba(255, 255, 255, 0.95);
    }
    
    @supports not (backdrop-filter: blur(8px)) {
      .overlay-card {
        background: rgba(255, 255, 255, 0.98);
      }
    }
    
    ${customStyles || ''}
  `;

  return createOverlayManager(document, window, extensionStyles);
}

/**
 * Creates a simple text-based overlay for quick testing
 */
export function createSimpleTextOverlay(
  text: string,
  pattern: RegExp,
  options: OverlayOptions = {}
): string {
  const manager = createExtensionOverlayManager();
  
  return manager.addTextOverlay(
    pattern,
    (targetElement, textMatch, componentOptions) => ({
      element: (
        <div className="simple-text-overlay">
          <h4>Text Match Found</h4>
          <p><strong>Pattern:</strong> {pattern.source}</p>
          <p><strong>Matched:</strong> "{textMatch.text}"</p>
          <p><strong>Element:</strong> {targetElement.tagName}</p>
          <button onClick={componentOptions.closeOverlay}>Close</button>
        </div>
      ),
      instance: { text, pattern, textMatch },
    }),
    {
      draggable: true,
      initialPosition: 'below',
      ...options,
    }
  );
}

/**
 * Creates a simple element-based overlay for testing
 */
export function createSimpleElementOverlay(
  selector: string,
  content: string,
  options: OverlayOptions = {}
): string {
  const manager = createExtensionOverlayManager();
  
  return manager.addElementOverlay(
    (elements) => elements.find(el => el.matches(selector)),
    (targetElement, componentOptions) => ({
      element: (
        <div className="simple-element-overlay">
          <h4>Element Found</h4>
          <p><strong>Selector:</strong> {selector}</p>
          <p><strong>Tag:</strong> {targetElement.tagName}</p>
          <p><strong>Content:</strong> {content}</p>
          <button onClick={componentOptions.closeOverlay}>Close</button>
        </div>
      ),
      instance: { selector, content, targetElement },
    }),
    {
      draggable: true,
      initialPosition: 'right',
      ...options,
    }
  );
}

/**
 * Creates a "Hello World" overlay for basic testing
 */
export function createHelloWorldOverlay(): string {
  const manager = createExtensionOverlayManager();
  
  // Function to get current time as HH:MM format
  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert to 12-hour format
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };
  
  // Create a time display component that updates every minute
  const TimeDisplay = () => {
    const [currentTime, setCurrentTime] = React.useState(getCurrentTime());
    
    React.useEffect(() => {
      // Update immediately
      setCurrentTime(getCurrentTime());
      
      // Calculate milliseconds until next minute
      const now = new Date();
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      
      // First update at the next minute mark
      const firstTimeout = setTimeout(() => {
        setCurrentTime(getCurrentTime());
        
        // Then update every minute
        const interval = setInterval(() => {
          setCurrentTime(getCurrentTime());
        }, 60000); // Update every 60 seconds
        
        // Cleanup interval on unmount
        return () => clearInterval(interval);
      }, msUntilNextMinute);
      
      // Cleanup timeout on unmount
      return () => clearTimeout(firstTimeout);
    }, []);
    
    return <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>{currentTime}</span>;
  };
  
  return manager.addOverlay(
    (componentOptions) => ({
      element: (
        <div className="hello-world-overlay overlay-card">
          <div className="overlay-card-header drag-handle">
            <h3 className="overlay-card-title">🎉 Hello World!</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <TimeDisplay />
              <button 
                className="overlay-card-close"
                onClick={componentOptions.closeOverlay}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
          <div className="overlay-card-content">
            <p>Overlay system is working correctly!</p>
            <p><small>This overlay can be dragged around by the header.</small></p>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button onClick={componentOptions.bringToFront}>Bring to Front</button>
            </div>
          </div>
        </div>
      ),
      instance: { message: 'Hello World' },
    }),
    {
      draggable: true,
      initialPosition: 'center', // Use center positioning
      dismissOnOutsideClick: true,
      dismissOnEscape: true,
    }
  );
}

// ===================================================================
// VERSION AND DEBUG INFO
// ===================================================================

/**
 * Overlay system version information
 */
export const VERSION = '2.2.0';
export const BUILD_DATE = new Date().toISOString();

/**
 * Gets system information for debugging
 */
export function getSystemInfo(): {
  version: string;
  buildDate: string;
  userAgent: string;
  isChrome: boolean;
  isFirefox: boolean;
  supportsCustomElements: boolean;
  supportsShadowDOM: boolean;
  supportsBackdropFilter: boolean;
} {
  return {
    version: VERSION,
    buildDate: BUILD_DATE,
    userAgent: navigator.userAgent,
    isChrome: /Chrome/.test(navigator.userAgent),
    isFirefox: /Firefox/.test(navigator.userAgent),
    supportsCustomElements: 'customElements' in window,
    supportsShadowDOM: 'attachShadow' in Element.prototype,
    supportsBackdropFilter: CSS.supports('backdrop-filter', 'blur(1px)'),
  };
}