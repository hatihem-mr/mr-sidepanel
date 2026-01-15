// ===================================================================
// OVERLAY CONTAINER - React-Based Shadow DOM Container
// ===================================================================
// Modernized overlay container using React with Shadow DOM isolation
// for styling and improved cross-browser compatibility.
// ===================================================================

import React from 'react';
import ReactDOM from 'react-dom';
import { debug } from '../../shared/utils/debug.js';

/**
 * Configuration for overlay container
 */
export interface OverlayContainerConfig {
  /** Custom styles to inject into shadow DOM */
  styles?: string;
  /** Container ID for unique identification */
  containerId?: string;
  /** Whether to use Shadow DOM for style isolation */
  useShadowDOM?: boolean;
}

/**
 * Result object from creating overlay container
 */
export interface OverlayContainerResult {
  /** Main container element */
  container: HTMLDivElement;
  /** Content container where overlays are rendered */
  contentContainer: HTMLDivElement;
  /** Shadow root if Shadow DOM is used */
  shadowRoot: ShadowRoot | null;
  /** Function to inject additional styles */
  injectStyles: (cssText: string) => void;
  /** Function to render React elements */
  renderReactElement: (element: React.ReactElement, target?: HTMLElement) => void;
  /** Function to destroy the container */
  destroyContainer: () => void;
}

/**
 * Default styles for overlay container
 */
const DEFAULT_OVERLAY_STYLES = `
  /* Reset and base styles */
  * {
    box-sizing: border-box;
  }

  /* Overlay container styles */
  .overlay-manager-content {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 2147483647; /* Maximum z-index for full-screen overlays */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  }

  /* Individual overlay instances */
  .overlay-instance {
    position: absolute;
    pointer-events: auto;
    z-index: 2147483647; /* Maximum z-index for full-screen overlays */
  }

  /* Dragging states */
  .overlay-instance.dragging {
    user-select: none;
    cursor: grabbing !important;
  }

  .overlay-instance .drag-handle {
    cursor: grab;
    user-select: none;
  }

  .overlay-instance.dragging .drag-handle {
    cursor: grabbing;
  }

  /* Default overlay card styling */
  .overlay-card {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 400px;
    min-width: 200px;
  }

  .overlay-card-header {
    padding: 12px 16px;
    border-bottom: 1px solid #e1e5e9;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8f9fa;
    border-radius: 8px 8px 0 0;
  }

  .overlay-card-title {
    font-weight: 600;
    margin: 0;
    font-size: 14px;
    color: #2c3e50;
  }

  .overlay-card-close {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #6c757d;
    padding: 4px;
    line-height: 1;
    border-radius: 4px;
  }

  .overlay-card-close:hover {
    background: #e9ecef;
    color: #495057;
  }

  .overlay-card-content {
    padding: 16px;
  }

  /* Animation classes */
  .overlay-enter {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .overlay-enter-active {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  .overlay-exit {
    opacity: 1;
    transform: scale(1) translateY(0);
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .overlay-exit-active {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }

  /* Muck Rack specific styling */
  .muck-rack-overlay {
    font-family: inherit;
  }

  .muck-rack-overlay .overlay-card {
    border-color: #0066cc;
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.15);
  }

  .muck-rack-overlay .overlay-card-header {
    background: linear-gradient(135deg, #0066cc 0%, #004499 100%);
    color: white;
    border-bottom-color: #0066cc;
  }

  .muck-rack-overlay .overlay-card-close {
    color: rgba(255, 255, 255, 0.8);
  }

  .muck-rack-overlay .overlay-card-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  /* Loading states */
  .overlay-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: #6c757d;
  }

  .overlay-loading::after {
    content: '';
    width: 16px;
    height: 16px;
    border: 2px solid #e1e5e9;
    border-top-color: #0066cc;
    border-radius: 50%;
    animation: overlay-spin 1s linear infinite;
    margin-left: 8px;
  }

  @keyframes overlay-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Error states */
  .overlay-error {
    padding: 16px;
    background: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    color: #721c24;
    font-size: 13px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .overlay-card {
      max-width: calc(100vw - 32px);
      margin: 16px;
    }
  }
`;

/**
 * Creates a single shared overlay container with Shadow DOM isolation
 */
export function createOverlayContainer(
  config: OverlayContainerConfig = {}
): OverlayContainerResult {
  const {
    styles = '',
    containerId = 'overlay-manager-container-6a4ce2c7-49ba-4c4e-818f-510faeddc746',
    useShadowDOM = true,
  } = config;

  // Check if container already exists
  let container = document.getElementById(containerId) as HTMLDivElement | null;
  let contentContainer: HTMLDivElement;
  let shadowRoot: ShadowRoot | null = null;
  let styleSheet: CSSStyleSheet | null = null;

  /**
   * Injects CSS styles into the container
   */
  const injectStyles = (cssText: string): void => {
    if (!shadowRoot) {
      // Fallback: inject into document head
      const styleElement = document.createElement('style');
      styleElement.innerHTML = cssText;
      styleElement.setAttribute('data-overlay-styles', 'true');
      document.head.appendChild(styleElement);
      return;
    }

    try {
      if (navigator.userAgent.includes('Firefox')) {
        // Firefox fallback: use style element
        const styleElement = document.createElement('style');
        styleElement.innerHTML = cssText;
        shadowRoot.appendChild(styleElement);
      } else {
        // Modern browsers: use constructed stylesheets
        if (!styleSheet) {
          styleSheet = new CSSStyleSheet();
          shadowRoot.adoptedStyleSheets = [styleSheet];
        }
        
        const existingText = styleSheet.cssRules.length > 0 ? 
          Array.from(styleSheet.cssRules).map(rule => rule.cssText).join('\n') : '';
        
        styleSheet.replaceSync(existingText + '\n' + cssText);
      }
    } catch (error) {
      debug.warn('Failed to inject overlay styles:', error);
      
      // Ultimate fallback
      const styleElement = document.createElement('style');
      styleElement.innerHTML = cssText;
      (shadowRoot || document.head).appendChild(styleElement);
    }
  };

  /**
   * Renders a React element into the overlay container
   */
  const renderReactElement = (element: React.ReactElement, target?: HTMLElement): void => {
    const renderTarget = target || contentContainer;
    
    try {
      // Create a root for React 18
      if ('createRoot' in ReactDOM) {
        // React 18 concurrent features
        const { createRoot } = ReactDOM as any;
        const root = createRoot(renderTarget);
        root.render(element);
      } else {
        // React 17 fallback
        ReactDOM.render(element, renderTarget);
      }
    } catch (error) {
      debug.error('Failed to render React element in overlay:', error);
      
      // Fallback: render error message
      renderTarget.innerHTML = `
        <div class="overlay-error">
          Failed to render overlay: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      `;
    }
  };

  /**
   * Destroys the container and cleans up resources
   */
  const destroyContainer = (): void => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    
    // Clean up injected styles in document head
    const styleElements = document.querySelectorAll('style[data-overlay-styles]');
    styleElements.forEach(el => el.remove());
    
    container = null;
    contentContainer = null as any;
    shadowRoot = null;
    styleSheet = null;
  };

  // Create or reuse existing container
  if (!container || !container.shadowRoot) {
    container = document.createElement('div');
    container.id = containerId;

    // Apply container styles for proper positioning
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '2147483647', // Maximum z-index
      isolation: 'isolate', // Create new stacking context
    });

    if (useShadowDOM) {
      try {
        // Create shadow DOM for style isolation
        shadowRoot = container.attachShadow({ mode: 'open' });
        
        // Create content container inside shadow DOM
        contentContainer = document.createElement('div');
        contentContainer.className = 'overlay-manager-content';
        shadowRoot.appendChild(contentContainer);
      } catch (error) {
        debug.warn('Shadow DOM not supported, falling back to regular DOM');
        useShadowDOM && (config.useShadowDOM = false);
      }
    }

    if (!useShadowDOM || !shadowRoot) {
      // Fallback: use regular DOM
      contentContainer = document.createElement('div');
      contentContainer.className = 'overlay-manager-content';
      container.appendChild(contentContainer);
    }

    // Append to document body
    document.body.appendChild(container);
  } else {
    // Reuse existing container
    shadowRoot = container.shadowRoot;
    contentContainer = (shadowRoot || container).querySelector('.overlay-manager-content') as HTMLDivElement;
    
    if (!contentContainer) {
      contentContainer = document.createElement('div');
      contentContainer.className = 'overlay-manager-content';
      (shadowRoot || container).appendChild(contentContainer);
    }
  }

  // Inject default styles
  injectStyles(DEFAULT_OVERLAY_STYLES);
  
  // Inject custom styles if provided
  if (styles) {
    injectStyles(styles);
  }

  return {
    container,
    contentContainer,
    shadowRoot,
    injectStyles,
    renderReactElement,
    destroyContainer,
  };
}

/**
 * React component wrapper for overlay content
 */
export interface OverlayWrapperProps {
  /** Child components to render */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether this overlay is being dragged */
  isDragging?: boolean;
  /** Animation state */
  animationState?: 'enter' | 'enter-active' | 'exit' | 'exit-active';
  /** Callback when close button is clicked */
  onClose?: () => void;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Custom title for the overlay */
  title?: string;
  /** Whether to show header */
  showHeader?: boolean;
}

/**
 * Standard React wrapper component for overlay content
 */
export const OverlayWrapper: React.FC<OverlayWrapperProps> = ({
  children,
  className = '',
  isDragging = false,
  animationState,
  onClose,
  showCloseButton = true,
  title,
  showHeader = true,
}) => {
  const wrapperClasses = [
    'overlay-card',
    className,
    isDragging ? 'dragging' : '',
    animationState ? `overlay-${animationState}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {showHeader && (
        <div className="overlay-card-header drag-handle">
          {title && <h3 className="overlay-card-title">{title}</h3>}
          {showCloseButton && (
            <button
              className="overlay-card-close"
              onClick={onClose}
              aria-label="Close overlay"
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      )}
      
      <div className="overlay-card-content">
        {children}
      </div>
    </div>
  );
};

/**
 * Loading component for async overlay content
 */
export const OverlayLoading: React.FC<{ message?: string }> = ({ 
  message = 'Loading...' 
}) => (
  <div className="overlay-loading">
    {message}
  </div>
);

/**
 * Error component for overlay errors
 */
export const OverlayError: React.FC<{ 
  message: string; 
  onRetry?: () => void; 
}> = ({ message, onRetry }) => (
  <div className="overlay-error">
    <div>{message}</div>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          marginTop: '8px',
          padding: '4px 8px',
          background: 'transparent',
          border: '1px solid currentColor',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
        }}
      >
        Retry
      </button>
    )}
  </div>
);