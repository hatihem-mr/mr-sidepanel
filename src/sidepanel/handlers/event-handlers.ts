/**
 * Event Handler Functions
 * 
 * PURPOSE: Handle various events from components and Chrome extension messages.
 * These functions process events from search operations, component errors,
 * and communication between different parts of the extension.
 * 
 * EXTRACTED FROM: sidepanel.ts (event handler methods)
 * 
 * WHY THIS FILE EXISTS:
 * - Separate event handling logic from main controller
 * - Makes event flow easier to understand and test
 * - Reduces sidepanel.ts complexity
 * - Groups related event handling functions together
 * 
 * WHAT IT DOES:
 * - Handles search initiation and completion events
 * - Processes component error events
 * - Manages text analysis requests from content script
 * - Opens detailed results in popup windows
 * 
 * DEPENDENCIES:
 * - Requires access to components map
 * - Uses UI utility functions for progress bar
 * - Calls search execution methods
 * - Interacts with SelectionUpdateService
 */

import { showProgressBar, hideProgressBar, showToast } from '../utils/ui-utils.js';
import { SelectionUpdateService } from '../../shared/services/selection-update.js';

// handleSearchInitiated moved back to sidepanel.ts inline due to complexity
// with function binding - keeping other handlers here

// handleSearchCompleted moved back to sidepanel.ts inline due to component binding issues

/**
 * Handle component error events
 * Logs error and shows toast notification
 * 
 * @param detail - Error detail from component
 */
export function handleComponentError(detail: any): void {
  console.error('Component error:', detail);
  showToast(`Error: ${detail.message}`, 'danger');
}

/**
 * Handle text analysis request from content script
 * Updates search text seamlessly without changing tabs
 * 
 * @param text - Selected text to analyze
 */
export function handleTextAnalysisRequest(text: string): void {
  try {
    // Use SelectionUpdateService to handle the update
    // This will respect typing state and update the search component safely
    const selectionService = SelectionUpdateService.getInstance();
    selectionService.handleSelectedText(text);
    
  } catch (error) {
    console.error('❌ Failed to handle text analysis request:', error);
  }
}

/**
 * Handle opening detailed results in a new popup window
 * 
 * @param detail - Event detail containing results data
 */
export function handleOpenDetailedResults(detail: any): void {
  const { results, summary, searchType, searchLocation, itemType } = detail;
  
  // Create data object for popup
  const data = {
    results,
    summary,
    searchType: searchType || 'Media Outlets',
    searchLocation: searchLocation || '',
    itemType: itemType || 'outlet'
  };
  
  // Store data in session storage first - use unique key to prevent stale data
  const dataKey = `results_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem(dataKey, JSON.stringify(data));
  
  // Create popup URL with data key
  const popupUrl = chrome.runtime.getURL(`results-window.html#${dataKey}`);
  
  // Create the popup window with unique name to prevent reusing old window
  const uniqueWindowName = `muckrack-detailed-results-${Date.now()}`;
  const popup = window.open(
    popupUrl,
    uniqueWindowName, 
    'width=800,height=600,scrollbars=yes,resizable=yes'
  );
  
  if (!popup) {
    showToast('Please allow popups for this extension', 'warning');
    return;
  }
  
  // Focus the popup
  popup.focus();
}