// ===================================================================
// OVERLAY MANAGER - Main Orchestrator for Overlay System  
// ===================================================================
// Enhanced overlay manager that coordinates all overlay functionality
// with modern React integration, performance optimizations, and
// comprehensive error handling for Chrome extension usage.
// ===================================================================

import React from 'react';
import { createMouseElementTracker } from '../services/MouseElementTracker.js';
import { createMouseMovementTracker } from '../services/MouseMovementTracker.js';
import { createOverlayContainer } from '../components/OverlayContainer.js';
import { renderReactElement } from '../components/ReactElementRenderer.js';
import { createDragController } from '../services/DragController.js';
import type { DragController } from '../services/DragController.js';
import { createElementPositioner } from '../services/ElementPositioner.js';
import { createTextRangeTracker } from '../services/TextRangeTracker.js';
import type { TextRangeMatch } from '../services/TextRangeTracker.js';
import { generateInstanceId, isPointInRect } from '../utils/utils.js';
import { debug } from '../../shared/utils/debug.js';
import {
  isTextComponentCreator,
  type ComponentCreatorReturnType,
  type ComponentOptions,
  type ElementComponentCreator,
  type OverlayInstance,
  type OverlayManager,
  type OverlayOptions,
  type OverlayRegistration,
  type OverlayTarget,
  type SearchFunction,
  type StandaloneComponentCreator,
  type StandaloneComponentOptions,
  type StandaloneOverlayOptions,
  type TextComponentCreator,
  type TextSearchFunction,
  type OverlayManagerMetrics,
  type OverlayDebugInfo,
  OverlayError,
  OverlayErrorCode,
} from './types.js';
import { OverlayRegistry } from './OverlayRegistry.js';
import { isInConvexHull } from '../utils/ConvexHull.js';

/**
 * Enhanced overlay manager implementation with comprehensive features
 */
function createOverlayManager(
  document: Document, 
  window: Window & typeof globalThis, 
  styles?: string
): OverlayManager {
  // Unique manager identifier for debugging
  const overlayManagerId = `data-overlay-manager-${Math.random().toString(36).substring(2, 15)}`;
  const overlayManagerElementTracker = `data-overlay-manager-element-${Math.random().toString(36).substring(2, 15)}`;

  // Core services initialization
  const registry = new OverlayRegistry();
  const elementCache = createMouseElementTracker();
  const mouseTracker = createMouseMovementTracker({ timeInterval: 100, frameInterval: 5 });
  const positioner = createElementPositioner();

  // Get or create shared container with React support
  const {
    contentContainer: sharedContainer,
    destroyContainer: destroyContentContainer,
    injectStyles: injectSharedContainerStyles,
    renderReactElement: containerReactRenderer,
  } = createOverlayContainer({ styles });

  // Inject custom styles if provided
  if (styles) {
    injectSharedContainerStyles(styles);
  }

  // Create text range tracker for text-based overlays
  const textRangeTracker = createTextRangeTracker(document);

  // Track the highest z-index currently in use
  let currentHighestZIndex = 10000;
  let showingOverlay = false;
  let isDestroyed = false;
  let debugMode = false;

  /**
   * Logs debug information if debug mode is enabled
   */
  function debugLog(message: string, ...args: any[]): void {
    if (debugMode) {
      debug.log(`[OverlayManager] ${message}`, ...args);
    }
  }

  /**
   * Records an error with the registry
   */
  function recordError(error: string | Error, overlayId?: string): void {
    const message = error instanceof Error ? error.message : error;
    registry.recordError(message, overlayId);
    debug.error(`[OverlayManager] ${message}`, { overlayId, error });
  }

  /**
   * Brings an overlay to the front by incrementing its z-index
   */
  function bringOverlayToFront(instanceWrapper: HTMLElement): void {
    currentHighestZIndex += 1;
    instanceWrapper.style.zIndex = currentHighestZIndex.toString();
    positioner.registerOverlay(instanceWrapper);
  }

  /**
   * Creates a wrapper element for an overlay instance
   */
  function createInstanceWrapper(instanceId: string): HTMLElement {
    const instanceWrapper = document.createElement('div');
    instanceWrapper.classList.add('overlay-instance');
    instanceWrapper.setAttribute(overlayManagerId, 'true');
    instanceWrapper.dataset.instanceId = instanceId;

    // Apply positioning styles
    Object.assign(instanceWrapper.style, {
      display: 'block',
      visibility: 'visible',
      position: 'absolute',
      left: '0px',
      top: '0px',
      zIndex: (++currentHighestZIndex).toString(),
    });

    return instanceWrapper;
  }

  /**
   * Shows an overlay for a matched element or text range
   */
  async function showOverlay<T>(
    overlay: OverlayRegistration<T>, 
    target: OverlayTarget, 
    textMatch?: TextRangeMatch,
    registrationId?: string
  ): Promise<void> {
    if (showingOverlay || isDestroyed) return;

    showingOverlay = true;
    const instanceId = generateInstanceId();
    const startTime = performance.now();

    try {
      debugLog('Creating overlay instance', { instanceId, target, textMatch });

      // Create component options
      const componentOptions: ComponentOptions = {
        closeOverlay: () => {
          const instance = registry.getInstance(instanceId);
          if (instance) {
            hideOverlay(instance);
          }
        },
        bringToFront: () => {
          const instance = registry.getInstance(instanceId);
          if (instance?.wrapper) {
            bringOverlayToFront(instance.wrapper);
          }
        },
        overlayManager: {
          addOverlay,
          addElementOverlay,
          addTextOverlay,
          addStyles: injectSharedContainerStyles,
          removeOverlay: (overlayId: string) => {
            const instance = registry.getInstance(overlayId);
            return instance ? hideOverlay(instance) : false;
          },
          removeOverlayRegistration: registry.removeRegistration.bind(registry),
          getOverlay: registry.getInstance.bind(registry),
          getAllActiveOverlays: registry.getAllInstances.bind(registry),
          clearCache: elementCache.clearCache,
          destroy,
          getMetrics: registry.getMetrics.bind(registry),
          setDebugMode,
        } as OverlayManager,
      };

      // Create component based on overlay type
      let componentResult: Awaited<ComponentCreatorReturnType<T>>;
      
      if (overlay.isTextBased && textMatch) {
        if (!isTextComponentCreator(overlay.componentCreator)) {
          throw new OverlayError(
            'Text-based overlay requires text component creator',
            OverlayErrorCode.COMPONENT_CREATION_FAILED,
            instanceId
          );
        }
        
        componentResult = await overlay.componentCreator(
          target as Element,
          textMatch,
          componentOptions as StandaloneComponentOptions
        );
      } else {
        componentResult = await (overlay.componentCreator as ElementComponentCreator<T>)(
          target as Element,
          componentOptions as StandaloneComponentOptions
        );
      }

      if (!componentResult) {
        throw new OverlayError(
          'Component creator returned null',
          OverlayErrorCode.COMPONENT_CREATION_FAILED,
          instanceId
        );
      }

      const { element, instance, cleanup } = componentResult;

      // Create wrapper element
      const instanceWrapper = createInstanceWrapper(instanceId);
      const isReact = React.isValidElement(element);

      // Create overlay instance
      const overlayInstance: OverlayInstance<T> = {
        element: isReact ? instanceWrapper : element as HTMLElement,
        wrapper: instanceWrapper,
        instance,
        options: overlay.options,
        isReact,
        dragController: undefined,
        targetElement: target instanceof Element ? target : null,
        textMatch: textMatch || null,
        isActive: true,
        cleanup,
        instanceId,
        createdAt: Date.now(),
        metrics: {
          renderTime: 0,
          positioningTime: 0,
          interactionCount: 0,
        },
      };

      // Render component
      const renderStartTime = performance.now();
      
      if (isReact) {
        // Render React component
        const renderResult = renderReactElement(
          element as React.ReactElement,
          instanceWrapper,
          {
            onRenderComplete: () => {
              const renderTime = performance.now() - renderStartTime;
              registry.recordMetrics(instanceId, renderTime);
              debugLog('React component rendered', { instanceId, renderTime });
            },
            onRenderError: (error) => {
              recordError(error, instanceId);
            },
          }
        );

        // Store unmount function for cleanup
        overlayInstance.cleanup = () => {
          cleanup?.();
          renderResult.unmount();
        };
      } else {
        // Handle HTML element
        instanceWrapper.appendChild(element as HTMLElement);
        const renderTime = performance.now() - renderStartTime;
        registry.recordMetrics(instanceId, renderTime);
      }

      // Position the overlay
      const positionStartTime = performance.now();
      await positionOverlay(overlayInstance, textMatch);
      const positionTime = performance.now() - positionStartTime;

      // Update metrics
      if (overlayInstance.metrics) {
        overlayInstance.metrics.positioningTime = positionTime;
      }

      // Set up dragging if enabled
      if (overlay.options.draggable) {
        try {
          overlayInstance.dragController = createDragController({
            element: instanceWrapper,
            handleSelector: overlay.options.dragHandleSelector || '.drag-handle',
            window,
            document,
            constrainToViewport: false, // Allow movement across entire screen
            animated: true,
          });
        } catch (error) {
          recordError(new OverlayError(
            `Failed to set up dragging: ${error}`,
            OverlayErrorCode.DRAG_SETUP_FAILED,
            instanceId
          ), instanceId);
        }
      }

      // Add to registry
      debugLog('Attempting to register overlay instance', { registrationId, instanceId });
      const registrationSuccess = registry.addInstance(registrationId || '', overlayInstance);
      debugLog('Registration result', { registrationSuccess, registrationId });
      
      if (!registrationSuccess) {
        throw new OverlayError(
          'Failed to register overlay instance',
          OverlayErrorCode.INITIALIZATION_FAILED,
          instanceId
        );
      }

      // Add to DOM
      sharedContainer.appendChild(instanceWrapper);

      // Set up event listeners
      setupOverlayEventListeners(overlayInstance);

      // Bring to front
      bringOverlayToFront(instanceWrapper);

      debugLog('Overlay instance created successfully', {
        instanceId,
        renderTime: overlayInstance.metrics?.renderTime,
        positionTime,
        totalTime: performance.now() - startTime,
      });

    } catch (error) {
      recordError(error instanceof Error ? error : new Error(String(error)), instanceId);
      throw error;
    } finally {
      showingOverlay = false;
    }
  }

  /**
   * Positions an overlay relative to its target or using absolute positioning
   */
  async function positionOverlay<T>(
    overlayInstance: OverlayInstance<T>,
    textMatch?: TextRangeMatch
  ): Promise<void> {
    if (!overlayInstance.wrapper) {
      return;
    }

    try {
      // Check if this is a standalone overlay with absolute positioning
      const options = overlayInstance.options as StandaloneOverlayOptions;
      if (options.position && (options.position.top !== undefined || options.position.left !== undefined)) {
        // Use absolute positioning for standalone overlays
        debugLog('Using absolute positioning for standalone overlay', {
          instanceId: overlayInstance.instanceId,
          position: options.position
        });
        
        if (options.position.top !== undefined) {
          overlayInstance.wrapper.style.top = `${options.position.top}px`;
        }
        if (options.position.left !== undefined) {
          overlayInstance.wrapper.style.left = `${options.position.left}px`;
        }
        if (options.position.right !== undefined) {
          overlayInstance.wrapper.style.right = `${options.position.right}px`;
          overlayInstance.wrapper.style.left = 'auto';
        }
        if (options.position.bottom !== undefined) {
          overlayInstance.wrapper.style.bottom = `${options.position.bottom}px`;
          overlayInstance.wrapper.style.top = 'auto';
        }
        
        return;
      }
      
      // For element-based overlays, use relative positioning
      if (!overlayInstance.targetElement) {
        debugLog('No target element and no absolute position - skipping positioning');
        return;
      }

      // Get overlay dimensions
      const tempStyle = overlayInstance.wrapper.style.cssText;
      overlayInstance.wrapper.style.cssText = tempStyle + '; visibility: hidden; position: absolute; top: -9999px; left: -9999px;';
      
      const rect = overlayInstance.wrapper.getBoundingClientRect();
      const dimensions = { width: rect.width, height: rect.height };
      
      // Restore original style
      overlayInstance.wrapper.style.cssText = tempStyle;

      // Calculate position
      let positionResult;
      
      if (textMatch) {
        positionResult = positioner.calculatePositionForTextRange(
          textMatch.range,
          dimensions,
          {
            preferredPosition: overlayInstance.options.initialPosition,
            offset: overlayInstance.options.offset,
            avoidCollisions: true,
          }
        );
      } else {
        positionResult = positioner.calculatePosition(
          overlayInstance.targetElement,
          dimensions,
          {
            preferredPosition: overlayInstance.options.initialPosition,
            offset: overlayInstance.options.offset,
            avoidCollisions: true,
          }
        );
      }

      // Apply position
      overlayInstance.wrapper.style.left = `${positionResult.position.x}px`;
      overlayInstance.wrapper.style.top = `${positionResult.position.y}px`;

      debugLog('Overlay positioned', {
        instanceId: overlayInstance.instanceId,
        position: positionResult.position,
        actualPosition: positionResult.actualPosition,
        fitsInViewport: positionResult.fitsInViewport,
      });

    } catch (error) {
      recordError(new OverlayError(
        `Positioning failed: ${error}`,
        OverlayErrorCode.POSITIONING_FAILED,
        overlayInstance.instanceId
      ), overlayInstance.instanceId);
    }
  }

  /**
   * Sets up event listeners for an overlay instance
   */
  function setupOverlayEventListeners<T>(overlayInstance: OverlayInstance<T>): void {
    if (!overlayInstance.wrapper) return;

    const { options } = overlayInstance;

    // Click to bring to front
    overlayInstance.wrapper.addEventListener('mousedown', () => {
      bringOverlayToFront(overlayInstance.wrapper!);
      if (overlayInstance.metrics) {
        overlayInstance.metrics.interactionCount++;
      }
    });

    // Outside click to dismiss
    if (options.dismissOnOutsideClick) {
      const handleOutsideClick = (event: MouseEvent) => {
        if (!overlayInstance.wrapper?.contains(event.target as Node)) {
          hideOverlay(overlayInstance);
        }
      };

      // Add delay to prevent immediate dismissal
      setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
        
        // Store cleanup reference
        const originalCleanup = overlayInstance.cleanup;
        overlayInstance.cleanup = () => {
          document.removeEventListener('click', handleOutsideClick);
          originalCleanup?.();
        };
      }, 100);
    }

    // Escape key to dismiss
    if (options.dismissOnEscape) {
      const handleEscapeKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          hideOverlay(overlayInstance);
        }
      };

      document.addEventListener('keydown', handleEscapeKey);
      
      // Store cleanup reference
      const originalCleanup = overlayInstance.cleanup;
      overlayInstance.cleanup = () => {
        document.removeEventListener('keydown', handleEscapeKey);
        originalCleanup?.();
      };
    }
  }

  /**
   * Hides and cleans up an overlay instance
   */
  function hideOverlay<T>(overlayInstance: OverlayInstance<T>): boolean {
    try {
      // Get call stack to see what triggered the hide
      const stack = new Error().stack;
      debugLog('Hiding overlay', { 
        instanceId: overlayInstance.instanceId,
        callStack: stack?.split('\n').slice(1, 4).join(' | ')
      });

      // Mark as inactive
      overlayInstance.isActive = false;

      // Clean up drag controller
      if (overlayInstance.dragController) {
        overlayInstance.dragController.cleanup();
      }

      // Remove from DOM
      if (overlayInstance.wrapper && overlayInstance.wrapper.parentNode) {
        overlayInstance.wrapper.parentNode.removeChild(overlayInstance.wrapper);
      }

      // Clean up component
      if (overlayInstance.cleanup) {
        overlayInstance.cleanup();
      }

      // Unregister from positioner
      if (overlayInstance.wrapper) {
        positioner.unregisterOverlay(overlayInstance.wrapper);
      }

      // Remove from registry
      registry.removeInstance(overlayInstance.instanceId);

      return true;
    } catch (error) {
      recordError(new OverlayError(
        `Failed to hide overlay: ${error}`,
        OverlayErrorCode.CLEANUP_FAILED,
        overlayInstance.instanceId
      ), overlayInstance.instanceId);
      return false;
    }
  }

  /**
   * Processes all registrations to find and show matching overlays
   */
  async function processRegistrations(): Promise<void> {
    if (isDestroyed) return;

    const registrationsWithIds = registry.getAllRegistrationsWithIds();
    
    for (const { id: registrationId, registration } of registrationsWithIds) {
      try {
        if (registration.isTextBased) {
          // Process text-based overlays
          const textMatches = textRangeTracker.findTextMatches(
            registration.searchFn as RegExp
          );
          
          for (const match of textMatches) {
            await showOverlay(registration, match.containerElement, match, registrationId);
          }
        } else {
          // Process element-based overlays
          const elements = document.querySelectorAll('*');
          const elementArray = Array.from(elements);
          
          const target = await (registration.searchFn as SearchFunction)(elementArray);
          
          if (target) {
            await showOverlay(registration, target, undefined, registrationId);
          }
        }
      } catch (error) {
        recordError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // ===================================================================
  // PUBLIC API IMPLEMENTATION
  // ===================================================================

  /**
   * Adds a standalone overlay without target element
   */
  function addOverlay<T>(
    componentCreator: StandaloneComponentCreator<T>,
    options: StandaloneOverlayOptions = {}
  ): string {
    debugLog('Starting addOverlay', { options });
    
    const registrationId = registry.addRegistration(
      () => document.body, // Dummy search function for standalone
      componentCreator as ElementComponentCreator<T>,
      options,
      false
    );
    
    debugLog('Registration created', { registrationId });

    // Immediately create the overlay
    setTimeout(() => {
      debugLog('setTimeout executing', { registrationId });
      const registration = registry.getRegistration(registrationId);
      debugLog('Retrieved registration', { registration: !!registration });
      
      if (registration) {
        showOverlay(registration, document.body, undefined, registrationId);
      } else {
        recordError(`Registration not found in setTimeout: ${registrationId}`);
      }
    }, 0);

    return registrationId;
  }

  /**
   * Adds overlay that targets DOM elements
   */
  function addElementOverlay<T>(
    searchFn: SearchFunction,
    componentCreator: ElementComponentCreator<T>,
    options: OverlayOptions = {}
  ): string {
    const registrationId = registry.addRegistration(
      searchFn,
      componentCreator,
      options,
      false
    );

    // Start processing
    setTimeout(processRegistrations, 0);

    return registrationId;
  }

  /**
   * Adds overlay that targets text selections
   */
  function addTextOverlay<T>(
    pattern: RegExp,
    componentCreator: TextComponentCreator<T>,
    options: OverlayOptions = {}
  ): string {
    const registrationId = registry.addRegistration(
      pattern as any, // Cast to satisfy type - will be used as RegExp
      componentCreator as ElementComponentCreator<T>,
      options,
      true
    );

    // Start processing
    setTimeout(processRegistrations, 0);

    return registrationId;
  }

  /**
   * Injects custom CSS styles
   */
  function addStyles(styles: string): void {
    injectSharedContainerStyles(styles);
  }

  /**
   * Removes specific overlay by ID
   */
  function removeOverlay(overlayId: string): boolean {
    const instance = registry.getInstance(overlayId);
    return instance ? hideOverlay(instance) : false;
  }

  /**
   * Removes overlay registration by ID
   */
  function removeOverlayRegistration(registrationId: string): boolean {
    return registry.removeRegistration(registrationId);
  }

  /**
   * Gets overlay instance by ID
   */
  function getOverlay<T>(overlayId: string): OverlayInstance<T> | null {
    return registry.getInstance<T>(overlayId);
  }

  /**
   * Gets all active overlay instances
   */
  function getAllActiveOverlays(): OverlayInstance<unknown>[] {
    return registry.getAllInstances();
  }

  /**
   * Clears element cache and forces re-evaluation
   */
  function clearCache(): void {
    elementCache.clearCache();
  }

  /**
   * Gets performance metrics
   */
  function getMetrics(): OverlayManagerMetrics {
    return registry.getMetrics();
  }

  /**
   * Enables/disables debug mode
   */
  function setDebugMode(enabled: boolean): void {
    debugMode = enabled;
    debugLog('Debug mode', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Destroys overlay manager and cleans up all resources
   */
  function destroy(): void {
    if (isDestroyed) return;
    
    debugLog('Destroying overlay manager');
    isDestroyed = true;

    // Clean up all instances
    const instances = registry.getAllInstances();
    instances.forEach(instance => hideOverlay(instance));

    // Destroy services
    elementCache.destroy();
    mouseTracker.destroy();
    textRangeTracker.destroy();
    registry.destroy();

    // Destroy container
    destroyContentContainer();

    debugLog('Overlay manager destroyed');
  }

  // Disable mouse tracking for now to prevent continuous overlay creation
  // TODO: Re-enable for element-based overlays only
  // mouseTracker.onMouseMove((position) => {
  //   if (isDestroyed) return;
  //   
  //   const elements = elementCache.getElementsUnderMouse(position.x, position.y);
  //   
  //   if (elements.changed) {
  //     // Process registrations for new elements
  //     processRegistrations();
  //   }
  // });

  return {
    addOverlay,
    addElementOverlay,
    addTextOverlay,
    addStyles,
    removeOverlay,
    removeOverlayRegistration,
    getOverlay,
    getAllActiveOverlays,
    clearCache,
    destroy,
    getMetrics,
    setDebugMode,
  };
}

export { createOverlayManager };
export default createOverlayManager;