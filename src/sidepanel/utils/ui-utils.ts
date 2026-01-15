/**
 * UI Utility Functions
 * 
 * PURPOSE: Manage UI visibility states and display transitions for the extension.
 * These are pure functions that handle showing/hiding loading screens, errors,
 * progress bars, and main content areas.
 * 
 * EXTRACTED FROM: sidepanel.ts (lines 1233-1306)
 * 
 * WHY THIS FILE EXISTS:
 * - Reduce sidepanel.ts from 1300+ lines
 * - Provide reusable UI state management functions
 * - Enable unit testing of UI transitions
 * - Generic enough to use in other web applications
 * 
 * WHAT IT DOES:
 * - Shows/hides loading screens
 * - Shows/hides error messages
 * - Manages progress bar visibility and updates
 * - Transitions between different UI states
 * 
 * ARCHITECTURE:
 * - Pure functions with no external dependencies
 * - All functions work directly with DOM elements by ID
 * - No state management - just UI manipulation
 * - Null-safe DOM queries
 */

/**
 * Show main content and hide loading screen
 * Used after successful initialization or error recovery
 */
export function showMainContent(): void {
  const loading = document.getElementById('loading');
  const mainContent = document.getElementById('main-content');
  
  if (loading) loading.style.display = 'none';
  if (mainContent) mainContent.style.display = 'flex';
}

/**
 * Show error state with message
 * Hides both loading and main content, shows error boundary
 * 
 * @param title - Error title (currently unused but kept for future)
 * @param error - Error object or message to display
 */
export function showError(title: string, error: any): void {
  const loading = document.getElementById('loading');
  const mainContent = document.getElementById('main-content');
  const errorBoundary = document.getElementById('error-boundary');
  const errorMessage = document.getElementById('error-message');
  
  if (loading) loading.style.display = 'none';
  if (mainContent) mainContent.style.display = 'none';
  if (errorBoundary) errorBoundary.style.display = 'flex';
  if (errorMessage) {
    errorMessage.textContent = error?.message || 'An unexpected error occurred.';
  }
}

/**
 * Hide error state
 * Typically called before retrying an operation
 */
export function hideError(): void {
  const errorBoundary = document.getElementById('error-boundary');
  if (errorBoundary) errorBoundary.style.display = 'none';
}

/**
 * Show progress bar
 * Called at the start of bulk operations
 */
export function showProgressBar(): void {
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.display = 'block';
  }
}

/**
 * Update progress bar with current status
 * 
 * @param current - Current item number being processed
 * @param total - Total number of items to process
 * @param message - Status message to display
 */
export function updateProgress(current: number, total: number, message: string): void {
  const progressFill = document.getElementById('progress-bar-fill');
  const progressText = document.getElementById('progress-text');
  
  if (progressFill && progressText) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = message;
  }
}

/**
 * Hide progress bar
 * Called after bulk operations complete
 */
export function hideProgressBar(): void {
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) {
    progressBar.style.display = 'none';
  }
}

/**
 * Show toast notification - DISABLED
 * Toast notifications removed as they're unnecessary visual clutter
 * Function kept for backward compatibility but does nothing
 * 
 * @param message - Message to display (ignored)
 * @param type - Toast type (ignored)
 */
export function showToast(message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info'): void {
  // Toast notifications disabled - users can see what's happening in the UI directly
  return;
}