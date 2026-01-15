// ===================================================================
// REACT ELEMENT RENDERER - Advanced React Integration for Overlays
// ===================================================================
// Enhanced React rendering system with support for both React 17/18,
// error boundaries, and performance optimizations.
// ===================================================================

import React, { ErrorInfo, Component, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { OverlayLoading, OverlayError } from './OverlayContainer.js';
import { debug } from '../../shared/utils/debug.js';

/**
 * Configuration for React element rendering
 */
export interface RenderConfig {
  /** Whether to use React 18 concurrent features */
  useConcurrentFeatures?: boolean;
  /** Whether to wrap in error boundary */
  useErrorBoundary?: boolean;
  /** Whether to wrap in Suspense for async components */
  useSuspense?: boolean;
  /** Custom loading component */
  LoadingComponent?: React.ComponentType;
  /** Custom error component */
  ErrorComponent?: React.ComponentType<{ error: Error; retry: () => void }>;
  /** Callback for render completion */
  onRenderComplete?: () => void;
  /** Callback for render errors */
  onRenderError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Props for the enhanced error boundary
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  ErrorComponent?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
}

/**
 * State for the error boundary
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Enhanced error boundary for overlay components
 */
class OverlayErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debug.error('OverlayErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      errorInfo,
    });

    // Call error callback if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { ErrorComponent } = this.props;
      
      if (ErrorComponent) {
        return <ErrorComponent error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <OverlayError
          message={`Component Error: ${this.state.error.message}`}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Wrapper component that applies all enhancement features
 */
interface EnhancedWrapperProps {
  children: React.ReactNode;
  config: RenderConfig;
  onRetry: () => void;
}

const EnhancedWrapper: React.FC<EnhancedWrapperProps> = ({ 
  children, 
  config, 
  onRetry 
}) => {
  const {
    useErrorBoundary = true,
    useSuspense = true,
    LoadingComponent = OverlayLoading,
    ErrorComponent,
    onRenderError,
  } = config;

  let content = children;

  // Wrap in Suspense for async components
  if (useSuspense) {
    content = (
      <Suspense fallback={<LoadingComponent />}>
        {content}
      </Suspense>
    );
  }

  // Wrap in error boundary
  if (useErrorBoundary) {
    content = (
      <OverlayErrorBoundary
        ErrorComponent={ErrorComponent}
        onError={onRenderError}
        onRetry={onRetry}
      >
        {content}
      </OverlayErrorBoundary>
    );
  }

  return <>{content}</>;
};

/**
 * Renders a React element into a target DOM element with enhanced features
 */
export function renderReactElement(
  element: React.ReactElement,
  targetElement: HTMLElement,
  config: RenderConfig = {}
): {
  unmount: () => void;
  update: (newElement: React.ReactElement) => void;
} {
  const {
    useConcurrentFeatures = true,
    onRenderComplete,
    onRenderError,
  } = config;

  let isUnmounted = false;
  let root: any = null; // React 18 root
  let retryCount = 0;

  /**
   * Handles retry attempts for failed renders
   */
  const handleRetry = () => {
    if (isUnmounted) return;
    
    retryCount++;
    debug.log(`Retrying overlay render (attempt ${retryCount})`);
    
    // Re-render the original element
    performRender(element);
  };

  /**
   * Performs the actual rendering with error handling
   */
  const performRender = (elementToRender: React.ReactElement) => {
    if (isUnmounted) return;

    try {
      const enhancedElement = (
        <EnhancedWrapper config={config} onRetry={handleRetry}>
          {elementToRender}
        </EnhancedWrapper>
      );

      // Try React 18 concurrent features first
      if (useConcurrentFeatures && 'createRoot' in ReactDOM) {
        const { createRoot } = ReactDOM as any;
        
        if (!root) {
          root = createRoot(targetElement);
        }
        
        root.render(enhancedElement);
      } else {
        // Fallback to React 17 render
        ReactDOM.render(enhancedElement, targetElement);
      }

      // Call completion callback
      onRenderComplete?.();
      
    } catch (error) {
      debug.error('Failed to render React element:', error);
      
      // Call error callback
      if (error instanceof Error) {
        onRenderError?.(error, { componentStack: 'Unknown' });
      }

      // Render fallback error UI
      targetElement.innerHTML = `
        <div class="overlay-error">
          <div>Render Error: ${error instanceof Error ? error.message : 'Unknown error'}</div>
          <button onclick="this.parentElement.dispatchEvent(new CustomEvent('overlay-retry'))">
            Retry
          </button>
        </div>
      `;

      // Set up retry listener
      targetElement.addEventListener('overlay-retry', handleRetry, { once: true });
    }
  };

  /**
   * Updates the rendered element
   */
  const update = (newElement: React.ReactElement) => {
    if (isUnmounted) {
      debug.warn('Cannot update unmounted overlay element');
      return;
    }

    performRender(newElement);
  };

  /**
   * Unmounts the component and cleans up
   */
  const unmount = () => {
    if (isUnmounted) return;
    
    isUnmounted = true;

    try {
      if (root) {
        // React 18 unmount
        root.unmount();
      } else {
        // React 17 unmount
        ReactDOM.unmountComponentAtNode(targetElement);
      }
    } catch (error) {
      debug.warn('Error during overlay unmount:', error);
    }

    // Clean up any remaining content
    if (targetElement.parentNode) {
      targetElement.innerHTML = '';
    }

    root = null;
  };

  // Perform initial render
  performRender(element);

  return {
    unmount,
    update,
  };
}

/**
 * Creates a React component renderer with default configuration
 */
export function createReactRenderer(defaultConfig: RenderConfig = {}) {
  return {
    render: (element: React.ReactElement, target: HTMLElement, config?: RenderConfig) =>
      renderReactElement(element, target, { ...defaultConfig, ...config }),
  };
}

/**
 * Higher-order component for overlay-specific enhancements
 */
export function withOverlayEnhancements<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P & { overlayId?: string }> {
  const EnhancedComponent: React.FC<P & { overlayId?: string }> = (props) => {
    const { overlayId, ...restProps } = props;

    // Add overlay-specific context or providers here if needed
    return (
      <div data-overlay-id={overlayId} className="overlay-enhanced-component">
        <WrappedComponent {...(restProps as P)} />
      </div>
    );
  };

  EnhancedComponent.displayName = `withOverlayEnhancements(${WrappedComponent.displayName || WrappedComponent.name})`;

  return EnhancedComponent;
}

/**
 * Hook for overlay component lifecycle (React 16.8+)
 */
export function useOverlayLifecycle(overlayId: string) {
  const [isVisible, setIsVisible] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    // Set up any overlay-specific lifecycle handlers
    const handleOverlayEvent = (event: CustomEvent) => {
      if (event.detail.overlayId === overlayId) {
        switch (event.detail.type) {
          case 'hide':
            setIsVisible(false);
            break;
          case 'show':
            setIsVisible(true);
            break;
          case 'error':
            setError(event.detail.error);
            break;
        }
      }
    };

    document.addEventListener('overlay-event' as any, handleOverlayEvent);
    
    return () => {
      document.removeEventListener('overlay-event' as any, handleOverlayEvent);
    };
  }, [overlayId]);

  const hide = React.useCallback(() => {
    setIsVisible(false);
    document.dispatchEvent(new CustomEvent('overlay-event', {
      detail: { overlayId, type: 'hide' }
    }));
  }, [overlayId]);

  const show = React.useCallback(() => {
    setIsVisible(true);
    document.dispatchEvent(new CustomEvent('overlay-event', {
      detail: { overlayId, type: 'show' }
    }));
  }, [overlayId]);

  return {
    isVisible,
    error,
    hide,
    show,
    clearError: () => setError(null),
  };
}

/**
 * Utility function to check React version compatibility
 */
export function getReactVersion(): { major: number; minor: number; supports18: boolean } {
  const version = React.version || '16.0.0';
  const [major, minor] = version.split('.').map(Number);
  
  return {
    major,
    minor,
    supports18: major >= 18,
  };
}

/**
 * Debug component for testing overlay rendering
 */
export const OverlayDebugComponent: React.FC<{
  message?: string;
  onAction?: (action: string) => void;
}> = ({ message = 'Debug Overlay', onAction }) => (
  <div style={{
    padding: '16px',
    background: '#f0f8ff',
    border: '2px dashed #4a90e2',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '12px',
  }}>
    <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>🐛 {message}</h4>
    <p style={{ margin: '0 0 12px 0', color: '#7f8c8d' }}>
      React Version: {React.version} | 
      Supports 18: {getReactVersion().supports18 ? 'Yes' : 'No'}
    </p>
    
    {onAction && (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => onAction('close')}>Close</button>
        <button onClick={() => onAction('move')}>Move</button>
        <button onClick={() => onAction('resize')}>Resize</button>
      </div>
    )}
  </div>
);