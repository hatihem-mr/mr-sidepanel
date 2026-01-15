// ===================================================================
// OVERLAY SYSTEM TYPES - Enhanced and Modernized
// ===================================================================
// Comprehensive type definitions for the overlay system, modernized
// for the Muck Rack Support Assistant Chrome Extension.
//
// IMPROVEMENTS FROM ORIGINAL:
// 1. Stricter TypeScript types (no 'unknown' where possible)
// 2. Better React integration with modern patterns
// 3. Chrome extension specific types
// 4. Enhanced error handling interfaces
// 5. Performance monitoring types
// ===================================================================

import type React from 'react';
import type { ReactElement, JSX } from 'react';
import type { TextRangeMatch } from '../services/TextRangeTracker';
import type { DragController } from '../services/DragController';

// ===================================================================
// CORE SEARCH AND TARGET TYPES
// ===================================================================

/**
 * Function to search for target elements in the DOM
 * Can be synchronous or asynchronous for flexibility
 */
export type SearchFunction = (elements: Element[]) => Promise<Element | null | undefined> | Element | null | undefined;

/**
 * Function to search for text ranges within elements
 * Used for text-based overlays and highlighting
 */
export type TextSearchFunction = (element: Element) => TextRangeMatch[];

/**
 * Modern React element type supporting both React 17 and 18
 */
export type ReactElement = React.ReactElement | JSX.Element;

/**
 * Union type supporting both element and text range targets
 * Enables overlays on DOM elements or selected text
 */
export type OverlayTarget = Element | TextRangeMatch;

// ===================================================================
// OVERLAY CONFIGURATION OPTIONS
// ===================================================================

/**
 * Base overlay options with enhanced positioning and behavior control
 */
export interface OverlayOptions {
  /** Whether the overlay can be dragged by user */
  draggable?: boolean;
  /** CSS selector for elements that act as drag handles */
  dragHandleSelector?: string;
  /** Initial positioning relative to target element */
  initialPosition?: 'below' | 'above' | 'right' | 'left';
  /** Pixel offset from the calculated position */
  offset?: { x: number; y: number };
  /** Whether overlay should auto-dismiss on outside click */
  dismissOnOutsideClick?: boolean;
  /** Whether overlay should auto-dismiss on Escape key */
  dismissOnEscape?: boolean;
  /** Custom z-index (will be adjusted relative to other overlays) */
  baseZIndex?: number;
  /** Animation configuration */
  animation?: {
    enter?: string; // CSS animation name for entry
    exit?: string;  // CSS animation name for exit
    duration?: number; // Animation duration in ms
  };
}

/**
 * Options for standalone overlays that don't target specific elements
 */
export interface StandaloneOverlayOptions extends OverlayOptions {
  /** Absolute positioning for standalone overlays */
  position?: { 
    top?: number; 
    left?: number; 
    right?: number; 
    bottom?: number; 
  };
}

/**
 * Viewport positioning using CSS positioning strings
 */
export type ViewportPosition = { 
  top?: string; 
  left?: string; 
  right?: string; 
  bottom?: string; 
};

// ===================================================================
// COMPONENT CREATOR INTERFACES
// ===================================================================

/**
 * Base options passed to all component creators
 * Provides essential functionality for overlay management
 */
export interface ComponentOptions {
  /** Function to close this specific overlay */
  closeOverlay: () => void;
  /** Function to bring this overlay to front */
  bringToFront: () => void;
  /** Reference to the overlay manager for advanced operations */
  overlayManager?: OverlayManager;
}

/**
 * Extended options for standalone components
 */
export interface StandaloneComponentOptions extends ComponentOptions {
  /** Viewport dimensions for responsive behavior */
  viewport?: {
    width: number;
    height: number;
  };
}

/**
 * Return type for component creators with enhanced error handling
 */
export type ComponentCreatorReturnType<T> =
  | Promise<{
      element: HTMLElement | ReactElement;
      instance: T;
      cleanup?: () => void; // Optional cleanup function
    } | null>
  | {
      element: HTMLElement | ReactElement;
      instance: T;
      cleanup?: () => void;
    }
  | null;

/**
 * Generic component creator interface
 */
export interface ComponentCreator<TargetType, T = unknown> {
  (targetElement: TargetType, options: ComponentOptions): ComponentCreatorReturnType<T>;
}

/**
 * Component creator for DOM element-based overlays
 */
export interface ElementComponentCreator<T = unknown> {
  (targetElement: Element, options: StandaloneComponentOptions): ComponentCreatorReturnType<T>;
}

/**
 * Component creator for text-based overlays
 */
export interface TextComponentCreator<T = unknown> {
  (
    targetElement: Element,
    targetTextMatch: TextRangeMatch,
    options: StandaloneComponentOptions,
  ): ComponentCreatorReturnType<T>;
}

/**
 * Type guard to check if a creator is text-based
 */
export function isTextComponentCreator<T>(creator: unknown): creator is TextComponentCreator<T> {
  return typeof creator === 'function' && creator.length === 3;
}

/**
 * Component creator for standalone overlays
 */
export interface StandaloneComponentCreator<T = unknown> {
  (options: StandaloneComponentOptions): ComponentCreatorReturnType<T>;
}

// ===================================================================
// OVERLAY INSTANCE AND REGISTRATION
// ===================================================================

/**
 * Enhanced overlay instance with comprehensive state tracking
 */
export interface OverlayInstance<T> {
  /** The rendered DOM element or React element */
  element: HTMLElement | null;
  /** Wrapper element for positioning and dragging */
  wrapper: HTMLElement | null;
  /** Instance data returned by component creator */
  instance: T;
  /** Configuration options for this overlay */
  options: OverlayOptions;
  /** Whether this is a React component */
  isReact: boolean;
  /** Drag controller if dragging is enabled */
  dragController: DragController | undefined;
  /** Target DOM element (null for standalone overlays) */
  targetElement: Element | null;
  /** Text match data for text-based overlays */
  textMatch?: TextRangeMatch | null;
  /** Whether overlay is currently active/visible */
  isActive: boolean;
  /** Custom cleanup function from component creator */
  cleanup?: () => void;
  /** Mark overlay as disposed (for debugging) */
  markAsDisposed?: () => void;
  /** Timeout for convex hull detection */
  inConvexHullTimeout?: NodeJS.Timeout;
  /** Unique identifier for this overlay instance */
  instanceId: string;
  /** Creation timestamp for debugging and analytics */
  createdAt: number;
  /** Performance metrics */
  metrics?: {
    renderTime: number;
    positioningTime: number;
    interactionCount: number;
  };
}

/**
 * Enhanced overlay registration with better type safety
 */
export interface OverlayRegistration<T> {
  /** Function to find target elements or text ranges */
  searchFn: SearchFunction | TextSearchFunction;
  /** Function to create overlay component */
  componentCreator: TextComponentCreator<T> | ElementComponentCreator<T>;
  /** Configuration options with defaults applied */
  options: Required<OverlayOptions>;
  /** Map of active instances keyed by unique ID */
  instances: Map<string, OverlayInstance<T>>;
  /** Whether this overlay targets text ranges */
  isTextBased: boolean;
  /** Registration timestamp */
  registeredAt: number;
  /** Usage statistics */
  stats?: {
    totalCreated: number;
    currentActive: number;
    averageLifetime: number;
  };
}

// ===================================================================
// OVERLAY MANAGER INTERFACE
// ===================================================================

/**
 * Main overlay manager interface with enhanced capabilities
 */
export interface OverlayManager {
  /** Add a standalone overlay without target element */
  addOverlay: <T>(
    componentCreator: StandaloneComponentCreator<T>, 
    options?: StandaloneOverlayOptions
  ) => string; // Returns overlay ID

  /** Add overlay that targets DOM elements */
  addElementOverlay: <T>(
    searchFn: SearchFunction,
    componentCreator: ElementComponentCreator<T>,
    options?: OverlayOptions,
  ) => string; // Returns registration ID

  /** Add overlay that targets text selections */
  addTextOverlay: <T>(
    pattern: RegExp,
    componentCreator: TextComponentCreator<T>,
    options?: OverlayOptions,
  ) => string; // Returns registration ID

  /** Inject custom CSS styles into the overlay container */
  addStyles: (styles: string) => void;

  /** Remove specific overlay by ID */
  removeOverlay: (overlayId: string) => boolean;

  /** Remove overlay registration by ID */
  removeOverlayRegistration: (registrationId: string) => boolean;

  /** Get overlay instance by ID */
  getOverlay: <T>(overlayId: string) => OverlayInstance<T> | null;

  /** Get all active overlay instances */
  getAllActiveOverlays: () => OverlayInstance<unknown>[];

  /** Clear element cache and force re-evaluation */
  clearCache: () => void;

  /** Destroy overlay manager and clean up all resources */
  destroy: () => void;

  /** Get performance metrics */
  getMetrics: () => OverlayManagerMetrics;

  /** Enable/disable debug mode */
  setDebugMode: (enabled: boolean) => void;
}

// ===================================================================
// CHROME EXTENSION SPECIFIC TYPES
// ===================================================================

/**
 * Message types for Chrome extension communication
 */
export interface OverlayMessage {
  action: 'CREATE_OVERLAY' | 'DESTROY_OVERLAY' | 'UPDATE_OVERLAY' | 'QUERY_OVERLAYS';
  overlayId?: string;
  payload?: unknown;
  timestamp: number;
}

/**
 * Muck Rack specific overlay data
 */
export interface MuckRackOverlayData {
  /** Type of Muck Rack element */
  elementType: 'journalist' | 'outlet' | 'article' | 'search-result';
  /** Extracted data from the element */
  data: {
    name?: string;
    outlet?: string;
    role?: string;
    searchUrl?: string;
    adminUrl?: string;
    metadata?: Record<string, unknown>;
  };
  /** Available actions for this element */
  actions: Array<{
    label: string;
    action: 'search' | 'navigate' | 'copy' | 'analyze';
    url?: string;
    payload?: unknown;
  }>;
}

// ===================================================================
// PERFORMANCE AND DEBUGGING TYPES
// ===================================================================

/**
 * Performance metrics for overlay manager
 */
export interface OverlayManagerMetrics {
  /** Total overlays created since initialization */
  totalOverlaysCreated: number;
  /** Currently active overlays */
  activeOverlayCount: number;
  /** Average overlay lifetime in milliseconds */
  averageOverlayLifetime: number;
  /** Peak memory usage estimate */
  peakMemoryUsage: number;
  /** Performance timing data */
  timing: {
    averageRenderTime: number;
    averagePositioningTime: number;
    slowestRenderTime: number;
  };
  /** Error statistics */
  errors: {
    totalErrors: number;
    recentErrors: Array<{
      message: string;
      timestamp: number;
      overlayId?: string;
    }>;
  };
}

/**
 * Debug information for troubleshooting
 */
export interface OverlayDebugInfo {
  /** Current manager state */
  managerState: {
    isDestroyed: boolean;
    registrationCount: number;
    activeInstanceCount: number;
    highestZIndex: number;
  };
  /** Active registrations with details */
  registrations: Array<{
    id: string;
    isTextBased: boolean;
    instanceCount: number;
    options: OverlayOptions;
  }>;
  /** DOM state information */
  domState: {
    containerExists: boolean;
    shadowRootAttached: boolean;
    stylesInjected: boolean;
  };
}

// ===================================================================
// ERROR HANDLING TYPES
// ===================================================================

/**
 * Enhanced error types for better debugging
 */
export class OverlayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly overlayId?: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OverlayError';
  }
}

/**
 * Error codes for different failure scenarios
 */
export enum OverlayErrorCode {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  COMPONENT_CREATION_FAILED = 'COMPONENT_CREATION_FAILED',
  POSITIONING_FAILED = 'POSITIONING_FAILED',
  DRAG_SETUP_FAILED = 'DRAG_SETUP_FAILED',
  CLEANUP_FAILED = 'CLEANUP_FAILED',
  INVALID_TARGET = 'INVALID_TARGET',
  CONTAINER_NOT_FOUND = 'CONTAINER_NOT_FOUND',
  REACT_RENDER_FAILED = 'REACT_RENDER_FAILED'
}