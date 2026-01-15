// ===================================================================
// MUCK RACK SUPPORT ASSISTANT - MAIN SIDE PANEL CONTROLLER
// ===================================================================
// This is the central controller for the Chrome extension's side panel UI.
// It manages tab navigation, component initialization, and coordinates 
// communication between different parts of the extension.
//
// ARCHITECTURE OVERVIEW:
// ┌─────────────────┬──────────────────┬─────────────────┐
// │   Content       │   Service        │   Side Panel    │
// │   Script        │   Worker         │   (This File)   │
// │                 │                  │                 │
// │ • Text selection│ • CORS bypass    │ • UI Controller │
// │ • AI popups     │ • Message router │ • Tab management│
// │ • Intercom page │ • Context menus  │ • Components    │
// │   integration   │ • Storage proxy  │ • Event handling│
// └─────────────────┴──────────────────┴─────────────────┘
//
// COMMUNICATION FLOW:
// Content Script → Service Worker → Side Panel (via chrome.runtime.onMessage)
// Components → Side Panel → Service Worker (via custom DOM events)
// Side Panel ↔ Chrome Storage (via StorageService)
//
// DEBUGGING TIPS:
// - Use Chrome DevTools on side panel (right-click → Inspect)
// - Check service worker logs in chrome://extensions
// - Custom events can be monitored via console.log in event listeners
// - Storage issues: Check chrome://extensions → Storage
// ===================================================================

import { SearchTabComponent } from './components/search-tab.js';
import { AITabComponent } from './components/ai-tab.js';
import { HistoryTabComponent } from './components/history-tab.js';
import { StorageService } from '../shared/api/storage.js';
import { SelectionUpdateService } from '../shared/services/selection-update.js';
import { DEFAULT_SETTINGS } from '../shared/constants.js';
import { SafeDOM } from '../shared/utils/safe-dom.js';
import { extractSearchResults } from '../shared/utils/result-extractor.js';
// NEW: Import UI utilities for DOM manipulation
import { showMainContent, showError, hideError, showProgressBar, updateProgress, hideProgressBar, showToast } from './utils/ui-utils.js';
// NEW: Import event handlers (handleSearchInitiated and handleSearchCompleted are inline)
import { 
  handleComponentError as handleComponentErrorFn,
  handleTextAnalysisRequest as handleTextAnalysisRequestFn,
  handleOpenDetailedResults as handleOpenDetailedResultsFn
} from './handlers/event-handlers.js';
// NEW: Import search execution functions - Phase 1, 2 & 3
import { extractArticleResults, checkSearchResults, executeSearch } from './services/search-executor.js';
// NEW: Import settings management - Phase 4
import { SettingsManager } from './services/settings-manager.js';
// NEW: Import main page overlay service
import { MainPageOverlayService } from '../overlay/services/main-page-overlay.js';
import type { AppSettings } from '../shared/types/index.js';

/**
 * Main side panel application controller
 * 
 * RESPONSIBILITIES:
 * - Initialize and manage Lit Element components (search, results, ai, history tabs)
 * - Handle tab navigation and active state management
 * - Coordinate communication between components via DOM events
 * - Manage application settings and theme state
 * - Process search execution and result checking
 * - Handle text selection updates from content script
 * - Manage progress bar and loading states
 * 
 * LIFECYCLE:
 * 1. Constructor → initializeApp()
 * 2. Load settings from Chrome storage
 * 3. Apply theme and initialize components
 * 4. Set up event listeners for DOM events and Chrome messages
 * 5. Check Intercom context and populate selected text
 * 6. Show main content and hide loading screen
 * 
 * TROUBLESHOOTING:
 * - If components don't load: Check custom element registration in initializeComponents()
 * - If theme doesn't work: Check updateThemeIcon() and SVG symbol definitions in HTML
 * - If search fails: Check executeSearch() and CORS proxy in service worker
 * - If events don't fire: Verify event listeners in setupEventListeners()
 */
class SidePanelApp {
  // ===================================================================
  // CLASS PROPERTIES - Core State Management
  // ===================================================================
  
  /**
   * Currently active tab ID ('search', 'results', 'ai', 'history')
   * Used to manage tab switching and component activation
   * IMPORTANT: Must match data-tab attributes in HTML and tab panel IDs
   */
  private currentTab: string = 'search';
  
  /**
   * Application settings loaded from Chrome storage
   * Includes theme preference, API keys, and user preferences
   * Falls back to DEFAULT_SETTINGS if storage fails
   * CRITICAL: Changes here must be saved back to storage via StorageService
   */
  private settings: AppSettings = DEFAULT_SETTINGS;
  
  /**
   * Settings manager instance for theme and configuration management
   * NEW: Phase 4 - Extracted settings management to separate service
   */
  private settingsManager: SettingsManager = new SettingsManager();
  
  /**
   * Map of initialized Lit Element components by tab ID
   * Key: tab ID ('search', 'results', 'ai', 'history')
   * Value: Component instance (SearchTabComponent, ResultsTabComponent, etc.)
   * 
   * USAGE PATTERN:
   * const searchComponent = this.components.get('search');
   * if (searchComponent && typeof searchComponent.methodName === 'function') {
   *   searchComponent.methodName(data);
   * }
   * 
   * TROUBLESHOOTING: If component methods fail, check:
   * 1. Component is registered in initializeComponents()
   * 2. Custom element is defined in customElements.define()
   * 3. Method exists on the component class
   */
  private components: Map<string, any> = new Map();

  constructor() {
    this.initializeApp();
  }

  /**
   * Initialize the application - Main entry point for the side panel
   * 
   * EXECUTION FLOW:
   * 1. Load user settings from Chrome storage (theme, API keys, preferences)
   * 2. Apply theme to document body and update theme toggle icon
   * 3. Register and initialize all Lit Element components
   * 4. Set up DOM and Chrome message event listeners
   * 5. Check if current page is Intercom (for AI features)
   * 6. Attempt to populate search with selected text from active tab
   * 7. Show main content and hide loading spinner
   * 
   * CRITICAL ERROR HANDLING:
   * If any step fails, error is logged and showError() displays user-friendly message
   * Most common failure points:
   * - Settings loading (storage permission issues)
   * - Component initialization (custom element conflicts)
   * - Selected text population (content script not injected)
   * 
   * DEBUGGING:
   * - Check browser console for specific error details
   * - Verify chrome://extensions shows extension is active
   * - Check if content script is injected on current page
   */
  private async initializeApp(): Promise<void> {
    try {
      // Load settings from Chrome storage - contains theme preference, API keys, etc.
      // NEW: Using SettingsManager (Phase 4 extraction)
      this.settings = await this.settingsManager.initialize();
      
      // Apply theme to document.body and update toggle icon state
      // NEW: Using SettingsManager (Phase 4 extraction)
      this.settingsManager.applyTheme();
      
      // Register custom elements and store component references
      this.initializeComponents();
      
      // Set up all DOM event listeners and Chrome message handlers
      this.setupEventListeners();
      
      // Check if we're on Intercom page for AI features (shows/hides AI tab)
      this.checkIntercomContext();
      
      // Get selected text from current page and populate search input
      this.populateWithSelectedText();
      
      // Hide loading spinner and show main application UI
      // Using imported function from ui-utils.ts
      showMainContent();
      
    } catch (error) {
      console.error('Failed to initialize side panel:', error);
      // Using imported function from ui-utils.ts
      showError('Failed to initialize application', error);
    }
  }


  /**
   * Initialize Lit components
   */
  private initializeComponents(): void {
    // Register custom elements
    if (!customElements.get('search-tab-component')) {
      customElements.define('search-tab-component', SearchTabComponent);
    }
    if (!customElements.get('ai-tab-component')) {
      customElements.define('ai-tab-component', AITabComponent);
    }
    if (!customElements.get('history-tab-component')) {
      customElements.define('history-tab-component', HistoryTabComponent);
    }

    // Store component references
    const searchTab = document.querySelector('search-tab-component') as SearchTabComponent;
    const aiTab = document.querySelector('ai-tab-component') as AITabComponent;
    const historyTab = document.querySelector('history-tab-component') as HistoryTabComponent;

    this.components.set('search', searchTab);
    this.components.set('ai', aiTab);
    this.components.set('history', historyTab);

    // Pass settings to components
    this.components.forEach(component => {
      if (component && typeof component.updateSettings === 'function') {
        component.updateSettings(this.settings);
      }
    });
  }

  /**
   * Set up global event listeners - CRITICAL for extension communication
   * 
   * This method establishes all the communication pathways between:
   * - Tab navigation (user clicks)
   * - Component events (custom DOM events)
   * - Chrome extension messages (from content script/service worker)
   * - Theme toggle functionality
   * 
   * EVENT COMMUNICATION ARCHITECTURE:
   * ┌─────────────────┐    DOM Events    ┌─────────────────────┐
   * │   Components    │ ───────────────► │   SidePanelApp      │
   * │ - search-tab    │                  │   (This File)       │
   * │ - results-tab   │                  │                     │
   * │ - ai-tab        │                  │ Chrome Messages     │
   * │ - history-tab   │                  │        ▼            │
   * └─────────────────┘                  │ ┌─────────────────┐ │
   *                                      │ │ Content Script  │ │
   *                                      │ │ Service Worker  │ │
   *                                      │ └─────────────────┘ │
   *                                      └─────────────────────┘
   * 
   * CRITICAL EVENT TYPES:
   * - 'search-initiated': From search-tab when user starts search
   * - 'search-completed': Internal event after search execution
   * - 'switch-tab': From components requesting tab changes
   * - 'ai-analyze-text': From content script for text analysis
   * - 'refresh-selected-text': Manual refresh of selected text
   * 
   * TROUBLESHOOTING EVENT ISSUES:
   * 1. Event not firing: Check event name spelling and bubbles: true
   * 2. Handler not called: Verify addEventListener is registered
   * 3. Data not passed: Check event.detail structure
   * 4. Chrome messages failing: Verify sender permissions and context
   */
  private setupEventListeners(): void {
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const tabId = target.dataset.tab;
        if (tabId) {
          this.switchTab(tabId);
        }
      });
    });

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle?.addEventListener('click', () => {
      // NEW: Using SettingsManager (Phase 4 extraction)
      this.settingsManager.toggleTheme().then(() => {
        // Keep local settings in sync
        this.settings = this.settingsManager.getSettings();
      }).catch(error => {
        console.error('Theme toggle failed:', error);
        this.showToast('Failed to save theme setting', 'danger');
      });
    });



    // Initialize console debugging for overlay service
    MainPageOverlayService.initializeConsoleDebugging();
    
    // Listen for refresh events from search tab
    window.addEventListener('refresh-selected-text', () => {
      this.populateWithSelectedText();
    });

    // Auto-refresh when text selection changes
    this.setupAutoRefresh();


    // Error retry
    const retryBtn = document.getElementById('retry-btn');
    retryBtn?.addEventListener('click', () => {
      // Using imported function from ui-utils.ts
      hideError();
      this.initializeApp();
    });

    // Listen for search initiation to execute searches
    document.addEventListener('search-initiated', async (event: any) => {
      const { terms, location, checkResults } = event.detail;
      
      // Show progress bar if checking results
      if (checkResults && location.supportsResultCheck) {
        // Using imported function from ui-utils.ts
        showProgressBar();
      }
      
      try {
        // Execute the search using imported function from search-executor.ts (Phase 3)
        const searchResult = await executeSearch(terms, location, checkResults);
        
        // Hide progress bar
        // Using imported function from ui-utils.ts
        hideProgressBar();
        
        // Extract results and summary from the search result object
        const results = searchResult.results || [];
        const summary = searchResult.summary || { total: 0, found: 0, empty: 0 };
        
        // Dispatch custom event with results
        document.dispatchEvent(new CustomEvent('search-completed', {
          detail: { 
            results: results, 
            summary: summary
          },
          bubbles: true
        }));
        
      } catch (error) {
        console.error('Search failed:', error);
        // Using imported function from ui-utils.ts
        hideProgressBar();
        // Using imported function from ui-utils.ts
        showToast('Search failed. Please try again.', 'danger');
      }
    });

    // Listen for search completion to show results tab
    document.addEventListener('search-completed', (event: any) => {
      const { results, summary } = event.detail;
      
      // Pass results to the results tab component
      const resultsComponent = this.components.get('results');
      if (resultsComponent && typeof resultsComponent.displayResults === 'function') {
        resultsComponent.displayResults(results, summary);
      }
      
      // Show results tab
      const resultsTabBtn = document.getElementById('results-tab-btn');
      const resultsCount = document.getElementById('results-count');
      
      if (resultsTabBtn && resultsCount) {
        resultsTabBtn.style.display = 'flex';
        resultsCount.textContent = summary.total.toString();
      }
      
      // Switch to results tab
      this.switchTab('results');
    });

    // Listen for component errors
    document.addEventListener('component-error', (event: any) => {
      // Using imported function from event-handlers.ts
      handleComponentErrorFn(event.detail);
    });

    // Listen for detailed results request
    document.addEventListener('open-detailed-results', (event: any) => {
      // Using imported function from event-handlers.ts
      handleOpenDetailedResultsFn(event.detail);
    });

    // Listen for notification events from child components - DISABLED
    // Toast notifications removed as they're unnecessary visual clutter
    // document.addEventListener('show-notification', (event: any) => {
    //   this.showToast(event.detail.message, event.detail.type);
    // });

    // Listen for tab switch requests from components
    document.addEventListener('switch-tab', (event: any) => {
      const { tab } = event.detail;
      if (tab) {
        this.switchTab(tab);
      }
    });

    // Listen for ai-analyze-text messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'ai-analyze-text') {
        // Using imported function from event-handlers.ts
        handleTextAnalysisRequestFn(message.text);
        sendResponse({ success: true });
      }
      
      // Handle automatic search term updates from text selection
      if (message.action === 'update-search-from-selection') {
        this.handleSelectionUpdate(message.selectedText);
        sendResponse({ success: true });
      }
    });

  }

  /**
   * Get selected text from current page and populate search input
   * 
   * SELECTION STRATEGY (Dual Approach):
   * 1. PRIMARY: Try content script communication (if available)
   * 2. FALLBACK: Script injection into active tab (universal method)
   * 
   * WHY DUAL APPROACH?
   * - Content script only works on Intercom pages (limited by manifest.json)
   * - Script injection works on any page but requires activeTab permission
   * - This ensures text selection works across all websites
   * 
   * COMMUNICATION FLOW:
   * ┌────────────────┐    Message     ┌─────────────────┐
   * │   Active Tab   │ ──────────────► │   Side Panel    │
   * │                │                │                 │
   * │ Content Script │    OR via      │ Populate Search │
   * │      OR        │ Script Inject  │     Input       │
   * │ Injected Code  │                │                 │
   * └────────────────┘                └─────────────────┘
   * 
   * TROUBLESHOOTING TEXT SELECTION ISSUES:
   * 1. No text populated:
   *    - Check if activeTab permission is granted
   *    - Verify user has actually selected text on page
   *    - Check if page blocks script injection (rare)
   * 
   * 2. Content script method fails:
   *    - Content script only works on Intercom domains
   *    - Check manifest.json content_scripts matches array
   *    - Verify script injection fallback is working
   * 
   * 3. Script injection fails:
   *    - Some pages (chrome://, extension pages) block injection
   *    - CSP (Content Security Policy) may block execution
   *    - Network/loading issues during script execution
   * 
   * SUCCESS CRITERIA:
   * - Selected text length > 0 after trimming
   * - Search component exists and has populateSearchText method
   * - Text is properly passed to search component
   */
  private async populateWithSelectedText(): Promise<void> {
    try {
      
      // First check if there's a recently selected text stored in the service worker
      try {
        const storedResponse = await chrome.runtime.sendMessage({ action: 'get-last-selected-text' });
        if (storedResponse?.success && storedResponse.selectedText) {
          console.log('📝 Found stored selected text:', storedResponse.selectedText.substring(0, 50) + '...');
          const searchComponent = this.components.get('search');
          if (searchComponent && typeof searchComponent.populateSearchText === 'function') {
            searchComponent.populateSearchText(storedResponse.selectedText);
            return; // Exit early if we found stored text
          }
        }
      } catch (e) {
        console.log('📝 No stored selected text found');
      }
      
      // If no stored text, try to get currently selected text
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        return;
      }

      let selectedText = '';

      // First try content script (for pages that have it)
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'GET_SELECTED_TEXT'
        });
        
        if (response?.success && response.data?.selectedText) {
          selectedText = response.data.selectedText.trim();
        } else {
        }
      } catch (contentScriptError) {
        
        // Fallback to script injection (for other pages)
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              try {
                const selectedText = window.getSelection()?.toString().trim() || '';
                return {
                  success: true,
                  selectedText,
                  url: window.location.href,
                  title: document.title
                };
              } catch (error) {
                return {
                  success: false,
                  error: error.message
                };
              }
            }
          });

          const result = results[0]?.result;
          if (result?.success && result.selectedText) {
            selectedText = result.selectedText;
          }
        } catch (injectionError) {
        }
      }
      
      if (selectedText) {
        
        // Populate the search tab with selected text
        const searchComponent = this.components.get('search');
        
        if (searchComponent && typeof searchComponent.populateSearchText === 'function') {
          searchComponent.populateSearchText(selectedText);
        } else {
        }
      } else {
      }
    } catch (error) {
      console.error('🔍 populateWithSelectedText: Error:', error);
    }
  }

  /**
   * Setup auto-refresh for text selection changes
   * Uses event-based approach instead of aggressive polling
   */
  private setupAutoRefresh(): void {
    let lastSelectedText = '';
    let isUserTyping = false;
    let typingTimeout: number | null = null;
    let selectionCheckTimeout: number | null = null;
    
    // Efficient selection check - only when needed
    const checkSelection = async () => {
      try {
        if (isUserTyping) return;
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;
        
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString().trim() || ''
        });
        
        const currentText = results[0]?.result || '';
        
        // If selection changed and it's meaningful text (>3 chars)
        if (currentText !== lastSelectedText && currentText.length > 3) {
          lastSelectedText = currentText;
          
          const searchComponent = this.components.get('search');
          if (searchComponent && typeof searchComponent.populateSearchText === 'function') {
            searchComponent.populateSearchText(currentText);
          }
        }
      } catch (error) {
        // Silently ignore errors (tab might be inactive, etc.)
      }
    };
    
    // Track typing in search box to prevent interference
    document.addEventListener('input', (e) => {
      const target = e.target as Element;
      if (target.matches('textarea, input[type="text"], input[type="search"]')) {
        isUserTyping = true;
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          isUserTyping = false;
        }, 3000);
      }
    });
    
    // Listen for tab activation (user switches to this side panel)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !isUserTyping) {
        // Debounced check when side panel becomes visible
        if (selectionCheckTimeout) clearTimeout(selectionCheckTimeout);
        selectionCheckTimeout = setTimeout(checkSelection, 500);
      }
    });
    
    // Listen for manual refresh requests only
    window.addEventListener('refresh-selected-text', () => {
      if (!isUserTyping) {
        if (selectionCheckTimeout) clearTimeout(selectionCheckTimeout);
        selectionCheckTimeout = setTimeout(checkSelection, 100);
      }
    });
  }

  /**
   * Check if we're on an Intercom page to show AI features
   */
  private async checkIntercomContext(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isIntercom = tab?.url?.includes('intercom.com') || tab?.url?.includes('intercom.io');
      
      const aiTabBtn = document.getElementById('ai-tab-btn');
      if (aiTabBtn) {
        aiTabBtn.style.display = isIntercom ? 'flex' : 'none';
      }

      // Notify AI component about context
      const aiComponent = this.components.get('ai');
      if (aiComponent && typeof aiComponent.updateContext === 'function') {
        aiComponent.updateContext({ isIntercom, tabUrl: tab?.url });
      }
    } catch (error) {
      console.warn('Could not check Intercom context:', error);
    }
  }

  /**
   * Switch between tabs
   */
  private switchTab(tabId: string): void {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab panels
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabId}-tab`);
    });

    this.currentTab = tabId;

    // Notify component that it's now active
    const component = this.components.get(tabId);
    if (component && typeof component.onTabActivated === 'function') {
      component.onTabActivated();
    }

  }

  /**
   * Handle automatic search term updates from text selection
   */
  private handleSelectionUpdate(selectedText: string): void {
    try {
      // Use the SelectionUpdateService to handle the update properly
      const selectionService = SelectionUpdateService.getInstance();
      selectionService.handleSelectedText(selectedText);
      
      console.log('✅ Automatic search term update from selection:', selectedText.substring(0, 50) + '...');
    } catch (error) {
      console.warn('❌ Failed to update search terms from selection:', error);
    }
  }

  /**
   * Handle search initiation
   */
  private async handleSearchInitiated(detail: any): Promise<void> {
    const { terms, location, checkResults } = detail;
    
    // Show progress bar if checking results
    if (checkResults && location.supportsResultCheck) {
      // Using imported function from ui-utils.ts
      showProgressBar();
    }
    
    try {
      // Execute the search using imported function from search-executor.ts (Phase 3)
      const searchResult = await executeSearch(terms, location, checkResults);
      
      // Hide progress bar
      // Using imported function from ui-utils.ts
      hideProgressBar();
      
      // Dispatch search-completed event
      document.dispatchEvent(new CustomEvent('search-completed', {
        detail: searchResult
      }));
      
    } catch (error) {
      // Using imported function from ui-utils.ts
      hideProgressBar();
      console.error('Search execution failed:', error);
      this.showToast(`Search failed: ${error.message}`, 'danger');
    }
  }

  /**
   * Handle search completion
   */
  private handleSearchCompleted(detail: any): void {
    const { results, summary } = detail;
    
    // Pass results to the results tab component
    const resultsComponent = this.components.get('results');
    if (resultsComponent && typeof resultsComponent.displayResults === 'function') {
      resultsComponent.displayResults(results, summary);
    }
    
    // Show results tab
    const resultsTabBtn = document.getElementById('results-tab-btn');
    const resultsCount = document.getElementById('results-count');
    
    if (resultsTabBtn && resultsCount) {
      resultsTabBtn.style.display = 'flex';
      resultsCount.textContent = summary.total.toString();
    }

    // Switch to results tab
    this.switchTab('results');

  }

  /**
   * Display a toast notification
   */
  private showToast(message: string, type: 'success' | 'danger' | 'warning' = 'success'): void {
    // Using imported function from ui-utils.ts
    showToast(message, type);
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new SidePanelApp());
} else {
  new SidePanelApp();
}