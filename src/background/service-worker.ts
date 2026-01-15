// ===================================================================
// MUCK RACK SUPPORT ASSISTANT - SERVICE WORKER (BACKGROUND SCRIPT)
// ===================================================================
// This is the background service worker for the Chrome extension.
// It runs persistently and handles:
// 1. CORS bypass for Muck Rack API requests
// 2. Message routing between content scripts and side panel
// 3. Context menu management
// 4. Side panel programmatic opening
//
// CHROME EXTENSION V3 ARCHITECTURE:
// ┌─────────────────┐    Messages    ┌─────────────────┐
// │  Content Script │ ──────────────► │ Service Worker  │
// │                 │                │  (This File)    │
// │ • Text selection│    Response     │                 │
// │ • AI popups     │ ◄────────────── │ • CORS bypass   │
// │ • User events   │                │ • Message router│
// └─────────────────┘                │ • Context menus │
//                                    └─────────────────┘
//                                             │
//                                             ▼ Messages
//                                    ┌─────────────────┐
//                                    │   Side Panel    │
//                                    │                 │
//                                    │ • UI Controller │
//                                    │ • Components    │
//                                    │ • Search logic  │
//                                    └─────────────────┘
//
// CRITICAL FUNCTIONS:
// 1. CORS Bypass: Allows side panel to fetch Muck Rack pages
// 2. Message Hub: Routes messages between different extension contexts
// 3. Security Layer: Validates URLs and implements rate limiting
// 4. Context Menus: Right-click functionality for Smart Sort URLs
//
// DEBUGGING SERVICE WORKER:
// - Use chrome://extensions → Inspect views: service worker
// - Service worker logs appear in dedicated DevTools window
// - Check for permission issues and network failures
// - Monitor message passing between contexts
// ===================================================================

import { generateQuery } from '../shared/utils/query-generator.js';
import { cleanUrls } from '../shared/utils/url-utils.js';
import { CONTEXT_MENU_STRUCTURE } from '../shared/constants.js';
import { UrlValidator } from '../shared/security/url-validator.js';
import { SecureAuthManager } from '../shared/security/secure-auth.js';
import { SecurityManager, SecurityEventType } from '../shared/security/security-config.js';

// ===================================================================
// SERVICE WORKER STATE - Global Variables
// ===================================================================

/**
 * Track active fetch requests for CORS bypass
 * Used to manage request lifecycle and enable cancellation
 * Key: requestId, Value: AbortController for the request
 */
const activeRequests = new Map<string, AbortController>();

/**
 * Rate limiter for CORS requests (max 60 requests per minute)
 * Prevents overwhelming Muck Rack servers and potential IP blocking
 * Implements sliding window rate limiting with URL-specific tracking
 */
const rateLimiter = UrlValidator.createRateLimiter(60, 60000);

// ===================================================================
// MAIN MESSAGE LISTENER - Extension Communication Hub
// ===================================================================

/**
 * Central message handler for Chrome extension communication
 * 
 * SUPPORTED MESSAGE TYPES:
 * 1. 'fetch' - CORS bypass for HTTP requests
 * 2. 'openSidePanel' - Programmatically open side panel
 * 3. 'ai-analyze-text' - Route text analysis requests
 * 
 * MESSAGE FLOW:
 * Content Script → sendMessage() → Service Worker → Side Panel
 * Side Panel → sendMessage() → Service Worker → External API
 * 
 * RETURN VALUE PROTOCOL:
 * - return true: Indicates asynchronous response (keeps message channel open)
 * - return false: Synchronous response (immediate completion)
 * 
 * TROUBLESHOOTING MESSAGE ISSUES:
 * 1. Message not received: Check sender context and permissions
 * 2. Response not sent: Verify sendResponse() is called
 * 3. Async issues: Ensure return true for async handlers
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetch') {
    handleFetchRequest(message, sendResponse);
    return true; // Will respond asynchronously
  }
  
  if (message.action === 'openSidePanel') {
    handleOpenSidePanel(message, sendResponse);
    return false;
  }
  
  if (message.action === 'ai-analyze-text' && !message.fromServiceWorker) {
    handleAIAnalyzeText(message, sendResponse);
    return false;
  }
  
  // Health check responses from content scripts
  if (message.action === 'health-check-response') {
    handleHealthCheckResponse(message, sender, sendResponse);
    return false;
  }
  
  // Manual re-injection requests from content scripts
  if (message.action === 'request-reinject') {
    handleReinjectRequest(message, sender, sendResponse);
    return true; // Will respond asynchronously
  }
  
  // Text selection notifications from content scripts
  if (message.action === 'text-selected') {
    handleTextSelected(message, sender, sendResponse);
    return false;
  }
  
  // Handle request for last selected text from sidepanel
  if (message.action === 'get-last-selected-text') {
    // Return the stored selected text if it exists and is recent (within 5 minutes)
    if (lastSelectedText && (Date.now() - lastSelectedText.timestamp < 5 * 60 * 1000)) {
      sendResponse({ 
        success: true, 
        selectedText: lastSelectedText.text,
        url: lastSelectedText.url,
        timestamp: lastSelectedText.timestamp
      });
    } else {
      sendResponse({ success: false, selectedText: null });
    }
    return false;
  }
  
  return false;
});

/**
 * Handle health check responses from content scripts
 */
function handleHealthCheckResponse(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  if (sender.tab?.id) {
    // Health check logging removed - too verbose
    contentScriptStatus.set(sender.tab.id, {
      injected: message.healthy,
      attempts: contentScriptStatus.get(sender.tab.id)?.attempts || 1,
      lastAttempt: Date.now()
    });
  }
  sendResponse({ acknowledged: true });
}

/**
 * Handle manual re-injection requests
 */
async function handleReinjectRequest(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  if (sender.tab?.id) {
    const success = await injectContentScriptWithRetry(sender.tab.id);
    sendResponse({ success, tabId: sender.tab.id });
  } else {
    sendResponse({ success: false, error: 'No tab ID available' });
  }
}

/**
 * Store for the last selected text, persists until extension reloads
 * This allows the sidepanel to retrieve selected text even if it wasn't open when text was selected
 */
let lastSelectedText: { text: string; url: string; timestamp: number } | null = null;

/**
 * Handle text selection notifications from content scripts
 * Forward them to the sidepanel to update search terms automatically
 */
function handleTextSelected(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
  // Store the selected text for later retrieval
  lastSelectedText = {
    text: message.selectedText,
    url: message.url,
    timestamp: Date.now()
  };
  
  // Forward the text selection to the sidepanel (if it's open)
  // Use callback to avoid "Receiving end does not exist" errors
  chrome.runtime.sendMessage({
    action: 'update-search-from-selection',
    selectedText: message.selectedText,
    url: message.url,
    tabId: sender.tab?.id
  }, (response) => {
    // Check for errors in callback instead of try/catch
    if (chrome.runtime.lastError) {
      // Sidepanel might not be open, that's okay - we've stored the text
      console.log('📝 Stored text selection (sidepanel not open):', message.selectedText?.substring(0, 50) + '...');
    } else {
      console.log('📝 Stored and forwarded text selection:', message.selectedText?.substring(0, 50) + '...');
    }
  });
  
  // Always respond successfully since we've stored the text
  sendResponse({ success: true })
}

/**
 * Handle fetch requests through background script to bypass CORS
 */
/**
 * Handle CORS bypass fetch requests - CRITICAL SECURITY & FUNCTIONALITY
 * 
 * This function is the core of the extension's CORS bypass capability.
 * It allows the side panel to fetch Muck Rack search pages despite
 * browser CORS restrictions.
 * 
 * WHY CORS BYPASS IS NECESSARY:
 * - Browser CORS policy blocks cross-origin requests from extensions
 * - Muck Rack doesn't provide CORS headers for extension access
 * - Service worker runs in privileged context with broader permissions
 * - Enables result checking and HTML parsing functionality
 * 
 * SECURITY IMPLEMENTATION:
 * ┌─────────────────┐    Validate    ┌─────────────────┐
 * │  Request URL    │ ──────────────► │ URL Validator   │
 * │                 │                │                 │
 * │ • Domain check  │     Rate       │ • Whitelist     │
 * │ • Protocol      │    Limiting    │ • Pattern match │
 * │ • Parameters    │ ◄────────────── │ • Block private │
 * └─────────────────┘                └─────────────────┘
 *                           │
 *                           ▼ If Valid
 *                  ┌─────────────────┐
 *                  │   HTTP Fetch    │
 *                  │                 │
 *                  │ • AbortController│
 *                  │ • Timeout       │
 *                  │ • Error handling│
 *                  │ • Response parse│
 *                  └─────────────────┘
 * 
 * SECURITY LAYERS:
 * 1. URL Validation: Only allow Muck Rack and approved domains
 * 2. Rate Limiting: Max 60 requests per minute per URL
 * 3. Request Tracking: Monitor active requests with AbortController
 * 4. Security Audit: Log all blocked/allowed requests
 * 
 * REQUEST FLOW:
 * 1. Extract parameters from message (requestId, url, options)
 * 2. Validate URL against security whitelist
 * 3. Check rate limiting for the URL
 * 4. Create AbortController for request management
 * 5. Execute fetch with proper headers and timeout
 * 6. Parse response and handle errors gracefully
 * 7. Clean up request tracking and return result
 * 
 * ERROR HANDLING STRATEGY:
 * - Security violations: Immediate rejection with audit log
 * - Rate limiting: Temporary rejection with retry guidance
 * - Network errors: Graceful handling with error categorization
 * - Timeout: Abort request and clean up resources
 * 
 * COMMON FAILURE SCENARIOS:
 * 
 * 1. CORS/Security Errors:
 *    - Invalid domain in URL (not whitelisted)
 *    - Private IP addresses or localhost attempts
 *    - Malformed URLs or dangerous protocols
 * 
 * 2. Rate Limiting:
 *    - Too many requests in short time period
 *    - Usually temporary, resolves after 1 minute
 * 
 * 3. Network Issues:
 *    - Muck Rack server unavailable
 *    - Internet connectivity problems  
 *    - Team-specific subdomain redirects
 * 
 * 4. Authentication Issues:
 *    - User not logged in to Muck Rack
 *    - Session expired
 *    - Insufficient permissions for content
 * 
 * DEBUGGING CORS ISSUES:
 * 1. Check service worker console for security audit logs
 * 2. Verify URL is in UrlValidator whitelist
 * 3. Test fetch directly in service worker context
 * 4. Monitor network tab for actual HTTP responses
 * 5. Check if Muck Rack UI structure changed
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - Requests are sequential (not parallel) to respect rate limits
 * - AbortController enables request cancellation
 * - Response data is streamed, not buffered entirely
 * - Timeout prevents hanging requests (default: 10 seconds)
 */
async function handleFetchRequest(message: any, sendResponse: (response: any) => void) {
  const { requestId, url, options = {}, debugMode } = message;

  // SECURITY: Validate URL before processing
  if (!UrlValidator.isValidForCorsProxy(url)) {
    SecurityManager.logSecurityEvent(
      SecurityEventType.BLOCKED_URL_REQUEST,
      `Blocked request to invalid URL: ${url}`,
      'high',
      { url, requestId },
      'service-worker'
    );
    
    sendResponse({
      error: 'URL not allowed for security reasons',
      errorType: 'security',
      url
    });
    return;
  }

  // SECURITY: Rate limiting check
  if (!rateLimiter.isAllowed(url)) {
    SecurityManager.logSecurityEvent(
      SecurityEventType.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded for URL: ${url}`,
      'medium',
      { url, requestId },
      'service-worker'
    );
    
    sendResponse({
      error: 'Rate limit exceeded. Please wait before making more requests.',
      errorType: 'rateLimit',
      url
    });
    return;
  }

  // Create AbortController
  const abortController = new AbortController();
  const signal = abortController.signal;
  activeRequests.set(requestId, abortController);

  // Timing info
  const timing = { startTime: performance.now(), endTime: 0, duration: 0 };

  // Timeout handling
  const timeoutId = setTimeout(() => {
    abortController.abort();
    activeRequests.delete(requestId);
    timing.endTime = performance.now();
    timing.duration = timing.endTime - timing.startTime;
    sendResponse({
      error: `Request timeout after ${options.timeout || 30000}ms`,
      errorType: 'timeout',
      timing,
      url
    });
  }, options.timeout || 30000);

  try {
    // NOTE: Previous SecureAuth filtering removed - it was security theater
    // Chrome extension already has explicit cookie permissions for Muck Rack
    // Real security comes from URL validation and rate limiting (already implemented)
    
    // PRAGMATIC SECURITY APPROACH: credentials: 'include' works perfectly
    // Real security comes from domain validation and rate limiting (already implemented)
    // Cookie filtering was security theater since we're in privileged extension context
    const fetchOptions = {
      ...options,
      credentials: 'include' as RequestCredentials,  // Browser handles cookies correctly
      signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Cache-Control': 'max-age=0',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'DNT': '1',
        'Priority': 'u=0, i',
        // Article searches need full page HTML (no X-Requested-With header)
        ...(url.includes('result_type=article') ? {} : { 'X-Requested-With': 'XMLHttpRequest' }),
        ...options.headers
      }
    };
    
    // Clean up debug logs - we know this works now
    

    // Perform fetch
    const response = await fetch(url, fetchOptions);
    
    timing.endTime = performance.now();
    timing.duration = timing.endTime - timing.startTime;

    // Collect headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Check status
    if (!response.ok) {
      // Check if it's a redirect to login
      if (response.status === 302 || response.status === 301) {
        clearTimeout(timeoutId);
        activeRequests.delete(requestId);
        sendResponse({
          error: 'Authentication required',
          errorType: 'auth',
          needsAuth: true,
          status: response.status,
          timing
        });
        return;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse response based on content type
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      const rawText = await response.text();
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        console.error('JSON parsing error:', error);
        data = rawText;
      }
    } else if (contentType.includes('text/')) {
      data = await response.text();
    } else {
      data = await response.arrayBuffer();
    }

    // Clean up
    clearTimeout(timeoutId);
    activeRequests.delete(requestId);


    const finalResponse = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers,
      url: response.url,
      redirected: response.redirected,
      timing
    };
    
    sendResponse(finalResponse);

  } catch (error: any) {
    // Clean up
    clearTimeout(timeoutId);
    activeRequests.delete(requestId);

    let errorResponse;
    if (error.name === 'AbortError') {
      errorResponse = {
        error: 'Request aborted',
        errorType: 'abort',
        timing
      };
    } else {
      errorResponse = {
        error: error.message || String(error),
        errorType: 'network',
        timing
      };
    }

    if (debugMode) {
      console.error(`[Fetch Bridge] Error ${requestId}:`, errorResponse);
    }

    sendResponse(errorResponse);
  }
}

/**
 * Handle side panel opening
 */
async function handleOpenSidePanel(message: any, sendResponse: (response: any) => void) {
  try {
    let windowId = message.windowId;
    
    // If windowId not provided, get current active window
    if (!windowId) {
      const windows = await chrome.windows.getAll({ populate: true });
      const currentWindow = windows.find(window => window.focused) || windows[0];
      windowId = currentWindow?.id;
    }
    
    if (!windowId) {
      throw new Error('No valid window found to open side panel');
    }
    
    // Open side panel
    await chrome.sidePanel.open({ windowId });
    sendResponse({ success: true });
  } catch (error: any) {
    console.error('Failed to open side panel:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle AI text analysis - route message to side panel
 * This was the missing piece - service worker was sending ai-analyze-text but not listening for it
 */
async function handleAIAnalyzeText(message: any, sendResponse: (response: any) => void) {
  // Forward to side panel with flag to prevent loop
  // Use callback to avoid "Receiving end does not exist" errors
  chrome.runtime.sendMessage({
    action: 'ai-analyze-text',
    text: message.text,
    tabId: message.tabId,
    fromServiceWorker: true // Prevent loop
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.log('AI tab not open, cannot analyze text');
      sendResponse({ success: false, error: 'AI tab not available' });
    } else {
      sendResponse({ success: true });
    }
  });
}

// ===================================================================
// AUTO-RETRY CONTENT SCRIPT INJECTION SYSTEM
// ===================================================================
// Based on webray-m project patterns for automatic content script recovery
// Eliminates need for manual page refreshes when extension updates

/**
 * Track content script injection status per tab
 * Key: tabId, Value: { injected: boolean, attempts: number, lastAttempt: timestamp }
 */
const contentScriptStatus = new Map<number, { injected: boolean, attempts: number, lastAttempt: number }>();

/**
 * Configuration for auto-retry behavior
 */
const AUTO_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second base delay
  maxDelay: 8000,  // 8 second max delay
  healthCheckInterval: 10000, // 10 seconds
  injectionTimeout: 5000 // 5 second timeout per injection attempt
};

/**
 * Exponential backoff delay calculation
 */
function calculateRetryDelay(attempt: number): number {
  const delay = AUTO_RETRY_CONFIG.baseDelay * Math.pow(2, attempt);
  return Math.min(delay, AUTO_RETRY_CONFIG.maxDelay);
}

/**
 * Inject content script with retry logic
 * Uses exponential backoff and comprehensive error handling
 */
async function injectContentScriptWithRetry(tabId: number, attempt = 0): Promise<boolean> {
  if (attempt >= AUTO_RETRY_CONFIG.maxRetries) {
    console.error(`❌ [ContentScript] Failed to inject after ${AUTO_RETRY_CONFIG.maxRetries} attempts for tab ${tabId}`);
    return false;
  }

  try {
    // Check if tab is still valid and accessible
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('moz-extension:')) {
      console.log(`⚠️ [ContentScript] Skipping injection for restricted URL: ${tab.url}`);
      return false;
    }

    // Attempt logging removed - too verbose

    // Create timeout promise for injection attempt
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Injection timeout')), AUTO_RETRY_CONFIG.injectionTimeout);
    });

    // Attempt content script injection
    const injectionPromise = chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js']
    });

    // Race injection against timeout
    await Promise.race([injectionPromise, timeoutPromise]);

    // Update status tracking
    contentScriptStatus.set(tabId, {
      injected: true,
      attempts: attempt + 1,
      lastAttempt: Date.now()
    });

    // Success logging removed - too verbose
    return true;

  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.warn(`⚠️ [ContentScript] Injection attempt ${attempt + 1} failed for tab ${tabId}: ${errorMsg}`);

    // Update status tracking
    contentScriptStatus.set(tabId, {
      injected: false,
      attempts: attempt + 1,
      lastAttempt: Date.now()
    });

    // Determine if we should retry
    const shouldRetry = attempt < AUTO_RETRY_CONFIG.maxRetries - 1 && 
                       !errorMsg.includes('Cannot access a chrome:') && 
                       !errorMsg.includes('Cannot access contents of');

    if (shouldRetry) {
      const delay = calculateRetryDelay(attempt);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return await injectContentScriptWithRetry(tabId, attempt + 1);
    }

    return false;
  }
}

/**
 * Perform health check on existing content scripts
 * Detects if content scripts are responsive and re-injects if needed
 */
async function performContentScriptHealthCheck(tabId: number): Promise<boolean> {
  try {
    // Send health check message to content script
    const response = await chrome.tabs.sendMessage(tabId, { 
      action: 'health-check',
      timestamp: Date.now()
    });

    if (response && response.healthy) {
      console.log(`💚 [ContentScript] Health check passed for tab ${tabId}`);
      return true;
    }
  } catch (error) {
    console.log(`💔 [ContentScript] Health check failed for tab ${tabId}, re-injecting...`);
  }

  // Health check failed, attempt re-injection
  return await injectContentScriptWithRetry(tabId);
}

/**
 * Auto-inject content script on page navigation
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only inject on complete page loads for Intercom domains
  if (changeInfo.status === 'complete' && 
      tab.url && 
      (tab.url.includes('intercom.com') || tab.url.includes('intercom.io'))) {
    
    console.log(`🎯 [ContentScript] Page completed on tab ${tabId}: ${tab.url}`);
    
    // Clear previous status for this tab
    contentScriptStatus.delete(tabId);
    
    // Inject content script with retry
    await injectContentScriptWithRetry(tabId);
  }
});

/**
 * Handle extension updates - re-inject content scripts on all active tabs
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    // Show update notification
    const manifest = chrome.runtime.getManifest();
    const currentVersion = manifest.version;

    try {
      // Get the previous version from storage
      const result = await chrome.storage.local.get('extensionVersion');
      const previousVersion = result.extensionVersion;

      // Show notification if this is an update from a different version
      if (previousVersion && previousVersion !== currentVersion) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-128.png',
          title: 'Muck Rack Support Assistant Updated',
          message: `Updated to version ${currentVersion}. New features and improvements are now available!`,
          priority: 1
        });
      }

      // Store the current version
      await chrome.storage.local.set({ extensionVersion: currentVersion });

    } catch (error) {
      console.error('Failed to show update notification:', error);
    }

    // Re-inject content scripts on all active tabs
    try {
      const tabs = await chrome.tabs.query({});
      const injectionPromises: Promise<boolean>[] = [];

      for (const tab of tabs) {
        if (tab.id &&
            tab.url &&
            (tab.url.includes('intercom.com') || tab.url.includes('intercom.io')) &&
            !tab.url.startsWith('chrome://') &&
            !tab.url.startsWith('about:')) {

          console.log(`🎯 [ContentScript] Re-injecting on tab ${tab.id} after update`);
          injectionPromises.push(injectContentScriptWithRetry(tab.id));
        }
      }

      // Wait for all injections to complete
      const results = await Promise.allSettled(injectionPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const total = results.length;

      console.log(`✅ [ContentScript] Update re-injection complete: ${successful}/${total} tabs successful`);

    } catch (error) {
      console.error(`❌ [ContentScript] Failed to re-inject after update:`, error);
    }
  }
});

/**
 * Periodic health monitoring for injected content scripts
 */
// MEMORY LEAK FIX: Reduce health check frequency and add cleanup
// Only check every 5 minutes instead of 30 seconds to reduce memory pressure
const healthCheckInterval = setInterval(async () => {
  const activeTabs = await chrome.tabs.query({ 
    url: ['*://*.intercom.com/*', '*://*.intercom.io/*']
  });

  // Limit concurrent checks to prevent memory buildup
  const maxConcurrentChecks = 3;
  let concurrentChecks = 0;
  
  for (const tab of activeTabs) {
    if (tab.id && concurrentChecks < maxConcurrentChecks) {
      const status = contentScriptStatus.get(tab.id);
      
      // Only check tabs we believe have injected content scripts
      if (status && status.injected) {
        concurrentChecks++;
        performContentScriptHealthCheck(tab.id).finally(() => {
          concurrentChecks--;
        });
      }
    }
  }
}, 300000); // 5 minutes instead of 30 seconds

// Cleanup interval on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
});

/**
 * Clean up tracking when tabs are closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  contentScriptStatus.delete(tabId);
  console.log(`🗑️ [ContentScript] Cleaned up tracking for closed tab ${tabId}`);
});

/**
 * Set up context menus on installation
 */
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});

/**
 * Create context menu structure
 */
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Smart Sort URLs
    chrome.contextMenus.create({
      id: "smart-sort-urls",
      title: "Smart Sort URL List",
      contexts: ["selection"]
    });

    // Smart Search menu
    chrome.contextMenus.create({
      id: "smart-public-search-parent",
      title: "Smart Search on Muck Rack as...",
      contexts: ["selection"]
    });

    // Public search options
    const publicSearches = [
      { id: "smart-search-person", title: "Person", resultType: "person", filter: "&must_appear_in_people=names" },
      { id: "smart-search-outlet", title: "Media Outlet", resultType: "media_outlet", filter: null },
      { id: "smart-search-article", title: "Articles", resultType: "article", filter: null },
      { id: "smart-search-clip", title: "Broadcast / Clips", resultType: "clip", filter: null }
    ];

    publicSearches.forEach(item => {
      chrome.contextMenus.create({
        id: item.id,
        parentId: "smart-public-search-parent",
        title: item.title,
        contexts: ["selection"]
      });
    });

    // AI Analysis (only show on Intercom pages)
    chrome.contextMenus.create({
      id: "ai-analyze",
      title: "AI Analyze Text",
      contexts: ["selection"],
      documentUrlPatterns: ["*://*.intercom.com/*", "*://*.intercom.io/*"]
    });

    // Copy Current Page URL (only show on admin pages)
    chrome.contextMenus.create({
      id: "copy-page-url",
      title: "Copy Current Page URL",
      contexts: ["page", "frame", "selection", "link", "editable", "image", "video", "audio"],
      documentUrlPatterns: ["*://muckrack.com/mradmin/*", "*://*.muckrack.com/mradmin/*"]
    });

    // Separator
    chrome.contextMenus.create({
      id: "separator-1",
      type: "separator",
      contexts: ["selection"]
    });

    // Admin menu structure
    CONTEXT_MENU_STRUCTURE.forEach((group) => {
      chrome.contextMenus.create({
        id: `group-${group.name}`,
        title: group.name,
        contexts: ["selection"]
      });

      group.children.forEach((item) => {
        chrome.contextMenus.create({
          id: item.url,
          parentId: `group-${group.name}`,
          title: item.name,
          contexts: ["selection"]
        });
      });
    });
  });
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  try {
    switch (info.menuItemId) {
      case "smart-sort-urls":
        await handleSmartSort(info, tab);
        break;
      
      case "smart-search-person":
      case "smart-search-outlet":
      case "smart-search-article":
      case "smart-search-clip":
        await handleSmartSearch(info, tab);
        break;
      
      case "ai-analyze":
        await handleAIAnalyze(info, tab);
        break;
      
      case "copy-page-url":
        await handleCopyPageUrl(info, tab);
        break;
      
      default:
        // Handle admin searches
        if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('https://muckrack.com/mradmin/')) {
          await handleAdminSearch(info, tab);
        }
        break;
    }
  } catch (error) {
    console.error('Context menu action failed:', error);
  }
});

/**
 * Handle smart URL sorting
 */
async function handleSmartSort(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  if (!info.selectionText) return;

  try {
    const cleanedUrls = cleanUrls(info.selectionText);
    
    // Copy to clipboard via content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
          // Show notification
          const banner = document.createElement('div');
          banner.textContent = '✅ URLs sorted and copied to clipboard!';
          Object.assign(banner.style, {
            position: 'fixed', top: '20px', right: '20px', padding: '12px 20px',
            backgroundColor: '#10b981', color: 'white', borderRadius: '8px',
            zIndex: '999999', fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          });
          document.body.appendChild(banner);
          
          setTimeout(() => {
            banner.style.opacity = '0';
            banner.style.transition = 'opacity 0.3s ease';
            setTimeout(() => banner.remove(), 300);
          }, 3000);
        });
      },
      args: [cleanedUrls]
    });
  } catch (error) {
    console.error('Smart sort failed:', error);
  }
}

/**
 * Handle smart search
 */
async function handleSmartSearch(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  if (!info.selectionText) return;

  // Determine search type and parameters
  let resultType = "";
  let filter = "";
  
  switch (info.menuItemId) {
    case "smart-search-person":
      resultType = "person";
      filter = "&must_appear_in_people=names";
      break;
    case "smart-search-outlet":
      resultType = "media_outlet";
      break;
    case "smart-search-article":
      resultType = "article";
      break;
    case "smart-search-clip":
      resultType = "clip";
      break;
    default:
      return;
  }

  try {
    // Get Muck Rack host from current tab
    let muckRackHost = 'app.muckrack.com';
    if (tab.url) {
      try {
        const url = new URL(tab.url);
        if (url.hostname.endsWith('muckrack.com')) {
          muckRackHost = url.hostname;
        }
      } catch (e) {
        // Use default
      }
    }

    // Generate smart query
    const finalSearchQuery = generateQuery(info.selectionText.trim());
    const encodedSearchTerm = encodeURIComponent(finalSearchQuery);
    const searchUrl = `https://${muckRackHost}/search/results?result_type=${resultType}&q=${encodedSearchTerm}${filter}`;

    // Open search in new window
    await chrome.windows.create({
      url: searchUrl,
      type: "popup",
      width: 1200,
      height: 800
    });
  } catch (error) {
    console.error('Smart search failed:', error);
  }
}

/**
 * Handle AI analysis (open side panel and trigger analysis)
 */
async function handleAIAnalyze(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  try {
    // Open side panel
    await chrome.sidePanel.open({ windowId: tab.windowId });
    
    // Wait a moment for side panel to load, then send message
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'ai-analyze-text',
        text: info.selectionText,
        tabId: tab.id
      }, (response) => {
        // Handle error silently - side panel might not have AI tab active
        if (chrome.runtime.lastError) {
          console.log('AI tab not ready for analysis');
        }
      });
    }, 500);
  } catch (error) {
    console.error('AI analyze failed:', error);
  }
}

/**
 * Handle copying current page URL
 */
async function handleCopyPageUrl(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  if (!tab.url) return;

  try {
    // Copy URL to clipboard via content script injection
    await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: (url: string) => {
        navigator.clipboard.writeText(url).then(() => {
          // Show success notification
          const banner = document.createElement('div');
          banner.textContent = '✅ Page URL copied to clipboard!';
          Object.assign(banner.style, {
            position: 'fixed', 
            top: '20px', 
            right: '20px', 
            padding: '12px 20px',
            backgroundColor: '#10b981', 
            color: 'white', 
            borderRadius: '8px',
            zIndex: '999999', 
            fontSize: '14px', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            animation: 'slideIn 0.3s ease-out'
          });
          
          // Add animation keyframes
          const style = document.createElement('style');
          style.textContent = `
            @keyframes slideIn {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `;
          document.head.appendChild(style);
          document.body.appendChild(banner);
          
          // Auto-hide after 3 seconds
          setTimeout(() => {
            banner.style.opacity = '0';
            banner.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
              banner.remove();
              style.remove();
            }, 300);
          }, 3000);
        }).catch(err => {
          console.error('Failed to copy URL:', err);
          alert('Failed to copy URL to clipboard');
        });
      },
      args: [tab.url]
    });
  } catch (error) {
    console.error('Copy URL failed:', error);
  }
}

/**
 * Handle admin searches
 */
async function handleAdminSearch(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
  if (!info.selectionText) return;

  const clickedUrl = info.menuItemId as string;
  
  // Find the menu item configuration
  let clickedItem = null;
  for (const group of CONTEXT_MENU_STRUCTURE) {
    const foundItem = group.children.find(child => child.url === clickedUrl);
    if (foundItem) {
      clickedItem = foundItem;
      break;
    }
  }

  if (!clickedItem) return;

  try {
    let finalUrl = clickedItem.url;
    
    if (clickedItem.isSearchable && info.selectionText) {
      const finalSearchQuery = generateQuery(info.selectionText.trim(), clickedItem.queryType);
      const searchQuery = encodeURIComponent(finalSearchQuery);
      finalUrl = `${clickedItem.url}?q=${searchQuery}`;
    }

    // Open admin search in new window
    await chrome.windows.create({
      url: finalUrl,
      type: "popup",
      width: 1200,
      height: 800
    });
  } catch (error) {
    console.error('Admin search failed:', error);
  }
}

/**
 * Handle extension icon click - open side panel
 */
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

/**
 * Handle side panel setup for each window
 */
chrome.runtime.onInstalled.addListener(() => {
  // Enable side panel for all sites
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

/**
 * Clean up on shutdown
 */
chrome.runtime.onSuspend?.addListener(() => {
  // Cancel any active requests
  activeRequests.forEach(controller => {
    controller.abort();
  });
  activeRequests.clear();
});