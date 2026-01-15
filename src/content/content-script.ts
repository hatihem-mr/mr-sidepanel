// ===================================================================
// MUCK RACK SUPPORT ASSISTANT - CONTENT SCRIPT (INTERCOM INTEGRATION)
// ===================================================================
// Import ONLY for initialization - not for overlay creation
import { initializeMainPageOverlays } from '../overlay/content-integration.js';
import { debug } from '../shared/utils/debug.js';
// This content script runs on Intercom pages and provides:
// 1. Text selection detection and AI analysis popup
// 2. Secure DOM manipulation for popups and notifications
// 3. Communication bridge to service worker and side panel
// 4. Context extraction from Intercom conversations
//
// INJECTION SCOPE: Only runs on Intercom domains (see manifest.json)
// - https://widget.intercom.io/*
// - https://app.intercom.com/*
//
// WHY CONTENT SCRIPT IS NEEDED:
// - Access to page DOM and user selections
// - Intercept text selection events
// - Create floating UI elements (AI popups, overlays)
// - Extract conversation context for AI analysis
// - Bridge between webpage and extension contexts
// - Enable full-screen overlays that work across the entire page
//
// SECURITY CONSIDERATIONS:
// - Runs in isolated world (separate from page JS)
// - Limited DOM access (can read/modify but isolated)
// - No access to page variables or functions
// - Safe DOM utilities prevent XSS attacks
// - Input sanitization for all user data
//
// COMMUNICATION ARCHITECTURE:
// ┌──────────────────┐    User Action   ┌─────────────────┐
// │   Intercom Page  │ ───────────────► │ Content Script  │
// │                  │                  │  (This File)    │
// │ • Text selection │    DOM Events    │                 │
// │ • Conversations  │ ◄─────────────── │ • Selection UI  │
// │ • User interface │                  │ • AI popups     │
// └──────────────────┘                  │ • Text analysis │
//                                       └─────────────────┘
//                                                │
//                                   chrome.runtime.sendMessage
//                                                ▼
//                                       ┌─────────────────┐
//                                       │ Service Worker  │
//                                       │                 │
//                                       │ • Message route │
//                                       │ • Side panel    │
//                                       └─────────────────┘
//
// DEBUGGING CONTENT SCRIPT:
// - Use browser DevTools on the Intercom page (F12)
// - Content script logs appear in page console
// - Check if script is injected: chrome://extensions
// - Verify manifest.json matches are correct
// - Test in different Intercom contexts (widget vs app)
// ===================================================================

/**
 * Content script for Intercom page integration
 * Provides context extraction and text selection helpers
 */

// ===================================================================
// SECURITY UTILITIES - Safe DOM Manipulation
// ===================================================================
// These utilities prevent XSS attacks by sanitizing user input
// and safely creating DOM elements. Critical for security since
// content scripts can modify page DOM.

/**
 * Sanitize text input to prevent XSS attacks
 * 
 * SECURITY MEASURES:
 * - Remove HTML angle brackets (< >)
 * - Strip javascript: protocol attempts
 * - Remove event handler attributes (onclick, onload, etc.)
 * - Limit length to prevent DoS attacks
 * - Preserve only safe text content
 */
function safeSanitizeText(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 1000); // Limit length
}

function safeCreateElement(tagName: string, textContent?: string, className?: string): HTMLElement {
  const element = document.createElement(tagName);
  if (textContent) {
    element.textContent = textContent;
  }
  if (className) {
    element.className = className;
  }
  return element;
}

// Track if we've already initialized to prevent duplicate listeners
let isInitialized = false;

// Global marker to prevent multiple overlay system initializations across script injections
const GLOBAL_OVERLAY_MARKER = 'muckrack_overlay_initialized';

// Initialize content script
function initializeContentScript() {
  if (isInitialized) return;
  isInitialized = true;

  // Content script initialization logging removed - too verbose
  
  if (window !== window.top) {
    debug.log('⚠️  CONTENT SCRIPT RUNNING IN IFRAME - Setting up cross-frame overlay bridge!');
    debug.log('⚠️  Parent window origin:', window.parent.origin);
    try {
      debug.log('⚠️  Top window location:', window.top?.location.href);
    } catch (e) {
      debug.log('⚠️  Cannot access top window (cross-origin):', e.message);
    }
    
    // Setup cross-frame overlay bridge for iframe contexts
    setupCrossFrameOverlayBridge();
  } else {
    debug.log('✅ Content script running in main window context');

    // CRITICAL: Check if overlay system is already initialized globally
    if ((window as any)[GLOBAL_OVERLAY_MARKER]) {
      debug.log('⚠️ Overlay system already initialized, skipping to prevent duplicates');
      // IMPORTANT: Verify overlay manager is still accessible globally
      if ((window as any).mainPageOverlayManager) {
        debug.log('✅ Global overlay manager is available');
      } else {
        debug.warn('⚠️ Overlay system marked as initialized but global manager is missing - reinitializing');
        // Re-initialize if the global manager is missing
        initializeMainPageOverlays();
      }
    } else {
      // Initialize overlay system directly in main window
      initializeMainPageOverlays();
      // Mark as initialized globally
      (window as any)[GLOBAL_OVERLAY_MARKER] = true;
    }
  }
  
  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener(handleMessage);
  debug.log('🚀 Message listener registered');
  
  // Add visual indicators for AI features - REMOVED: annoying blue AI button
  // addAIFeatureIndicators();
  
  // Observe page changes for dynamic content
  observePageChanges();
  
  // Start extension context monitoring for auto-recovery
  startExtensionContextMonitoring();
  
  // Setup text selection monitoring for search terms auto-update
  setupSelectionMonitoring();
  
  debug.log('✅ CONTENT SCRIPT FULLY INITIALIZED');
}

/**
 * Handle messages from the extension
 */
function handleMessage(
  message: any, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response: any) => void
): boolean {
  
  
  switch (message.type || message.action) {
    case 'GET_SELECTED_TEXT':
      handleGetSelectedText(sendResponse);
      return true;
      
    case 'GET_CONVERSATION_CONTEXT':
      handleGetConversationContext(sendResponse);
      return true;
      
    case 'INJECT_ANALYSIS':
      handleInjectAnalysis(message.data, sendResponse);
      return true;
      
    case 'health-check':
      debug.log('💚 Health check received from background script');
      handleHealthCheck(message, sendResponse);
      return false;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
}

// ===================================================================
// AUTO-RETRY AND EXTENSION CONTEXT RECOVERY SYSTEM  
// ===================================================================
// Based on webray-m project patterns for automatic recovery

/**
 * Handle health check from background script
 * Responds to periodic health checks and detects extension context issues
 */
function handleHealthCheck(message: any, sendResponse: (response: any) => void) {
  try {
    const timestamp = message?.timestamp || Date.now();
    
    // Verify extension context is still valid
    if (chrome.runtime && chrome.runtime.id) {
      // Health check logging removed - too verbose
      sendResponse({ 
        healthy: true, 
        timestamp: timestamp,
        contextValid: true,
        overlaySystemActive: typeof (window as any).createMainPageTestOverlay === 'function'
      });
    } else {
      // This is expected during extension reload/update - not an error, just info
      sendResponse({ 
        healthy: false, 
        timestamp: timestamp,
        contextValid: false,
        error: 'Extension context invalid'
      });
    }
  } catch (error) {
    const timestamp = message?.timestamp || Date.now();
    sendResponse({ 
      healthy: false, 
      timestamp: timestamp,
      contextValid: false,
      error: error.message || 'Health check failed'
    });
  }
}

/**
 * Extension context monitoring and auto-recovery system
 * Detects when extension context becomes invalid and shows user-friendly recovery options
 */
let contextMonitorInterval: number | null = null;
let contextValid = true;
let recoveryNotificationShown = false;

function startExtensionContextMonitoring() {
  // Clear any existing monitoring
  if (contextMonitorInterval) {
    clearInterval(contextMonitorInterval);
  }
  
  // Reduced frequency context monitoring - check every 30 seconds instead of 5
  contextMonitorInterval = setInterval(async () => {
    try {
      // Test extension context validity
      if (!chrome.runtime || !chrome.runtime.id) {
        throw new Error('Extension context invalidated');
      }
      
      // Test communication with background script (lightweight)
      chrome.runtime.sendMessage({ action: 'health-check-response', healthy: true });
      
      // If we get here, context is valid
      if (!contextValid) {
        contextValid = true;
        recoveryNotificationShown = false;
      }
      
    } catch (error) {
      if (contextValid) {
        contextValid = false;
        handleContextLoss();
      }
    }
  }, 30000); // Check every 30 seconds instead of 5
}

/**
 * Handle extension context loss with automatic recovery only
 */
function handleContextLoss() {
  if (recoveryNotificationShown) return;
  
  recoveryNotificationShown = true;
  
  // Only attempt automatic recovery in background - no user notification
  attemptAutomaticRecovery();
}


/**
 * Attempt automatic recovery without user intervention
 */
async function attemptAutomaticRecovery() {
  
  // Wait a few seconds for potential extension reloading to complete
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Test if extension context has been restored
    if (chrome.runtime && chrome.runtime.id) {
      debug.log('✅ [ContentScript] Automatic recovery successful!');
      contextValid = true;
      recoveryNotificationShown = false;
      
      // Reinitialize systems that depend on extension context
      reinitializeExtensionDependentSystems();
      return true;
    }
  } catch (error) {
    debug.log('⚠️ [ContentScript] Automatic recovery failed, auto-injection will handle it');
  }
  
  return false;
}

/**
 * Reinitialize systems that depend on extension context
 */
function reinitializeExtensionDependentSystems() {
  
  try {
    // Reinitialize overlay system if needed
    if (window === window.top && typeof (window as any).initializeMainPageOverlays === 'function') {
      (window as any).initializeMainPageOverlays();
    }
    
    debug.log('✅ [ContentScript] Extension-dependent systems reinitialized');
  } catch (error) {
    debug.error('❌ [ContentScript] Failed to reinitialize systems:', error);
  }
}

/**
 * Clean up monitoring when page unloads
 */
window.addEventListener('beforeunload', () => {
  if (contextMonitorInterval) {
    clearInterval(contextMonitorInterval);
    contextMonitorInterval = null;
  }
});

/**
 * Get currently selected text
 */
function handleGetSelectedText(sendResponse: (response: any) => void) {
  try {
    const selectedText = window.getSelection()?.toString().trim() || '';
    
    sendResponse({
      success: true,
      data: {
        selectedText,
        url: window.location.href,
        title: document.title
      }
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: `Failed to get selected text: ${error.message}`
    });
  }
}

/**
 * Extract conversation context from Intercom page
 */
function handleGetConversationContext(sendResponse: (response: any) => void) {
  try {
    const context = extractConversationContext();
    
    sendResponse({
      success: true,
      data: context
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: `Failed to get conversation context: ${error.message}`
    });
  }
}

// REMOVED: Simple overlay system - using complex overlay system with full drag controller and positioning

/**
 * Extract conversation messages and metadata
 */
function extractConversationContext(): any {
  const context = {
    messages: [] as string[],
    customerInfo: extractCustomerInfo(),
    conversationMeta: extractConversationMeta(),
    url: window.location.href,
    timestamp: Date.now()
  };

  // Try different selectors for conversation messages
  const messageSelectors = [
    '[data-testid="conversation-part"]',
    '.conversation__message',
    '[class*="message"]',
    '[class*="conversation-part"]',
    '.message-body',
    '.conversation-body'
  ];

  for (const selector of messageSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach(element => {
        const text = element.textContent?.trim();
        if (text && text.length > 10) {
          context.messages.push(text);
        }
      });
      break; // Use the first selector that finds messages
    }
  }

  // Limit to last 10 messages to avoid token limits
  context.messages = context.messages.slice(-10);

  return context;
}

/**
 * Extract customer information from the page
 */
function extractCustomerInfo(): any {
  const customerInfo: any = {
    name: null,
    email: null,
    company: null
  };

  // Try to extract customer name
  const nameSelectors = [
    '[data-testid="customer-name"]',
    '.customer-name',
    '.contact-name',
    'span[data-conversation-title]',
    '.conversation-header .truncate'
  ];

  for (const selector of nameSelectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      customerInfo.name = element.textContent.trim();
      break;
    }
  }

  // Try to extract email
  const emailSelectors = [
    '[data-testid="customer-email"]',
    '.customer-email',
    '.contact-email'
  ];

  for (const selector of emailSelectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text && text.includes('@')) {
      customerInfo.email = text;
      break;
    }
  }

  // Try to extract company
  const companySelectors = [
    '[data-testid="customer-company"]',
    '.customer-company',
    '.contact-company'
  ];

  for (const selector of companySelectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      customerInfo.company = element.textContent.trim();
      break;
    }
  }

  return customerInfo;
}

/**
 * Extract conversation metadata
 */
function extractConversationMeta(): any {
  const meta: any = {
    conversationId: null,
    status: null,
    assignee: null,
    tags: []
  };

  // Extract conversation ID from URL
  const urlMatch = window.location.href.match(/conversations\/(\d+)/);
  if (urlMatch) {
    meta.conversationId = urlMatch[1];
  }

  // Try to extract conversation status
  const statusSelectors = [
    '[data-testid="conversation-status"]',
    '.conversation-status',
    '.status-indicator'
  ];

  for (const selector of statusSelectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      meta.status = element.textContent.trim();
      break;
    }
  }

  // Try to extract assignee
  const assigneeSelectors = [
    '[data-testid="assignee"]',
    '.assignee',
    '.conversation-assignee'
  ];

  for (const selector of assigneeSelectors) {
    const element = document.querySelector(selector);
    if (element?.textContent?.trim()) {
      meta.assignee = element.textContent.trim();
      break;
    }
  }

  // Try to extract tags
  const tagSelectors = [
    '[data-testid="conversation-tag"]',
    '.conversation-tag',
    '.tag'
  ];

  const tagElements = document.querySelectorAll(tagSelectors.join(', '));
  tagElements.forEach(element => {
    const text = element.textContent?.trim();
    if (text) {
      meta.tags.push(text);
    }
  });

  return meta;
}

/**
 * Inject AI analysis results into the page
 */
function handleInjectAnalysis(data: any, sendResponse: (response: any) => void) {
  try {
    // Create a floating notification with the analysis
    createAnalysisNotification(data);
    
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: `Failed to inject analysis: ${error.message}`
    });
  }
}

/**
 * Create a notification with AI analysis results
 */
function createAnalysisNotification(analysis: any) {
  // Remove any existing notifications
  const existing = document.getElementById('muckrack-ai-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'muckrack-ai-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 350px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #1e293b;
    animation: slideIn 0.3s ease-out;
  `;

  // Create notification content safely to prevent XSS
  const headerDiv = safeCreateElement('div');
  headerDiv.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;';
  
  const titleSection = safeCreateElement('div');
  titleSection.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const icon = safeCreateElement('svg');
  icon.setAttribute('width', '16');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', '#2563eb');
  const iconPath = safeCreateElement('path');
  iconPath.setAttribute('d', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
  icon.appendChild(iconPath);
  
  const title = safeCreateElement('strong', 'AI Analysis Complete');
  title.style.color = '#2563eb';
  
  titleSection.appendChild(icon);
  titleSection.appendChild(title);
  
  const closeBtn = safeCreateElement('button');
  closeBtn.id = 'close-analysis';
  closeBtn.style.cssText = 'background: none; border: none; color: #64748b; cursor: pointer; padding: 4px;';
  const closeIcon = safeCreateElement('svg');
  closeIcon.setAttribute('width', '14');
  closeIcon.setAttribute('height', '14');
  closeIcon.setAttribute('viewBox', '0 0 24 24');
  closeIcon.setAttribute('fill', 'none');
  closeIcon.setAttribute('stroke', 'currentColor');
  closeIcon.setAttribute('stroke-width', '2');
  const line1 = safeCreateElement('line');
  line1.setAttribute('x1', '18');
  line1.setAttribute('y1', '6');
  line1.setAttribute('x2', '6');
  line1.setAttribute('y2', '18');
  const line2 = safeCreateElement('line');
  line2.setAttribute('x1', '6');
  line2.setAttribute('y1', '6');
  line2.setAttribute('x2', '18');
  line2.setAttribute('y2', '18');
  closeIcon.appendChild(line1);
  closeIcon.appendChild(line2);
  closeBtn.appendChild(closeIcon);
  
  headerDiv.appendChild(titleSection);
  headerDiv.appendChild(closeBtn);
  
  // Safe analysis content container
  const analysisDiv = safeCreateElement('div', safeSanitizeText(analysis.analysis || 'Analysis completed successfully'));
  analysisDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 6px; font-size: 13px;';
  
  // Buttons container
  const buttonsDiv = safeCreateElement('div');
  buttonsDiv.style.cssText = 'display: flex; gap: 8px;';
  
  const copyBtn = safeCreateElement('button', 'Copy Reply');
  copyBtn.id = 'copy-reply';
  copyBtn.style.cssText = 'flex: 1; background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;';
  
  const openBtn = safeCreateElement('button', 'Open Side Panel');
  openBtn.id = 'open-sidepanel';
  openBtn.style.cssText = 'flex: 1; background: #2563eb; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;';
  
  buttonsDiv.appendChild(copyBtn);
  buttonsDiv.appendChild(openBtn);
  
  // Assemble notification
  notification.appendChild(headerDiv);
  notification.appendChild(analysisDiv);
  notification.appendChild(buttonsDiv);

  // Add CSS animation
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

  // Add event listeners
  notification.querySelector('#close-analysis')?.addEventListener('click', () => {
    notification.remove();
  });

  notification.querySelector('#copy-reply')?.addEventListener('click', () => {
    if (analysis.suggestedReply) {
      navigator.clipboard.writeText(analysis.suggestedReply);
      showToast('Reply copied to clipboard');
    }
  });

  notification.querySelector('#open-sidepanel')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSidePanel' });
    notification.remove();
  });

  document.body.appendChild(notification);

  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 10000);
}

/**
 * Show a simple toast notification
 */
function showToast(message: string) {
  // Toast notifications disabled - users can see what's happening in the UI directly
  return;
}

/**
 * Add visual indicators for AI features
 */
function addAIFeatureIndicators() {
  // Add a subtle indicator that AI features are available
  const indicator = document.createElement('div');
  indicator.id = 'muckrack-ai-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    background: linear-gradient(135deg, #2563eb, #06b6d4);
    color: white;
    padding: 8px 4px;
    border-radius: 6px 0 0 6px;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11px;
    font-weight: 600;
    z-index: 9999;
    cursor: pointer;
    transition: transform 0.3s ease;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  `;
  indicator.textContent = 'AI';
  indicator.title = 'Muck Rack AI features available - Click to open side panel';

  indicator.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSidePanel' });
  });

  indicator.addEventListener('mouseenter', () => {
    indicator.style.transform = 'translateY(-50%) translateX(-4px)';
  });

  indicator.addEventListener('mouseleave', () => {
    indicator.style.transform = 'translateY(-50%) translateX(0)';
  });

  document.body.appendChild(indicator);
}

/**
 * Observe page changes for dynamic content
 */
function observePageChanges() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if new conversation messages were added
        const addedNodes = Array.from(mutation.addedNodes);
        const hasNewMessages = addedNodes.some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            return element.querySelector('[data-testid="conversation-part"]') ||
                   element.matches('[data-testid="conversation-part"]');
          }
          return false;
        });

        if (hasNewMessages) {
          // Notify extension that new messages are available
          chrome.runtime.sendMessage({
            action: 'conversation-updated',
            data: { timestamp: Date.now() }
          });
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Setup text selection monitoring for auto-updating search terms
 * This notifies the sidepanel when text is selected on the page
 * ONLY works on Intercom pages to prevent feedback loops
 */
function setupSelectionMonitoring() {
  // Only enable on Intercom domains to prevent feedback loops with the extension itself
  const isIntercomPage = window.location.href.includes('intercom.com') || 
                         window.location.href.includes('intercom.io');
  
  if (!isIntercomPage) {
    debug.log('⚠️ Selection monitoring disabled - not on Intercom page');
    return;
  }
  
  let lastSelectedText = '';
  
  // Listen for text selection changes
  document.addEventListener('mouseup', () => {
    // Small delay to ensure selection is finalized
    setTimeout(() => {
      const selectedText = window.getSelection()?.toString().trim() || '';
      
      // Only notify if text changed and is meaningful (>3 chars)
      if (selectedText !== lastSelectedText && selectedText.length > 3) {
        lastSelectedText = selectedText;
        
        // Send message to background script, which will forward to sidepanel
        try {
          chrome.runtime.sendMessage({
            action: 'text-selected',
            selectedText: selectedText,
            url: window.location.href
          });
          debug.log('📝 Selected text notification sent:', selectedText.substring(0, 50) + '...');
        } catch (error) {
          // Extension context might be invalid, ignore silently
          debug.log('⚠️ Could not send selection notification (extension context invalid)');
        }
      }
    }, 100);
  });
  
  // Also listen for keyboard-based selections
  document.addEventListener('keyup', (e) => {
    // Only check for selection-related key combinations
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      setTimeout(() => {
        const selectedText = window.getSelection()?.toString().trim() || '';
        
        if (selectedText !== lastSelectedText && selectedText.length > 3) {
          lastSelectedText = selectedText;
          
          try {
            chrome.runtime.sendMessage({
              action: 'text-selected',
              selectedText: selectedText,
              url: window.location.href
            });
            debug.log('⌨️ Keyboard selected text notification sent:', selectedText.substring(0, 50) + '...');
          } catch (error) {
            debug.log('⚠️ Could not send selection notification (extension context invalid)');
          }
        }
      }, 100);
    }
  });
  
  debug.log('✅ Text selection monitoring enabled');
}

/**
 * Text selection enhancement removed - "Analyze with AI" popup was annoying and useless
 */

/**
 * Text selection popup function removed - "Analyze with AI" popup was annoying and useless
 */

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

// Text selection enhancement removed - popup was annoying and useless

/**
 * Setup cross-frame overlay bridge for iframe contexts
 * This allows overlays to be created in the parent window when content script runs in iframe
 */
function setupCrossFrameOverlayBridge() {
  debug.log('🌉 Setting up cross-frame overlay bridge...');
  
  // Post message to parent window requesting overlay system setup
  try {
    window.parent.postMessage({
      type: 'MUCKRACK_SETUP_OVERLAY_BRIDGE',
      source: 'muckrack-extension-iframe',
      origin: window.location.origin,
      timestamp: Date.now()
    }, '*');
    
    debug.log('✅ Cross-frame setup message sent to parent window');
  } catch (error) {
    debug.error('❌ Failed to setup cross-frame bridge:', error);
  }
  
  // Listen for responses from parent window
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'MUCKRACK_OVERLAY_BRIDGE_READY') {
      debug.log('✅ Cross-frame overlay bridge established!');
      
      // Make overlay functions available but route through parent window
      (window as any).createMainPageTestOverlay = () => {
        window.parent.postMessage({
          type: 'MUCKRACK_CREATE_OVERLAY',
          source: 'muckrack-extension-iframe'
        }, '*');
      };
    }
  });
}

// Initialize based on context - ENSURE CONTENT SCRIPT RUNS
if (window !== window.top) {
  debug.log('🎯 In iframe context - cross-frame bridge will be setup during initialization');
} else {
  debug.log('🎯 In main window context - overlay system ready for messages');
}

// CRITICAL: Ensure content script initialization is called
if (!isInitialized) {
  initializeContentScript();
}

// REMOVED: injectOverlayFunctionsIntoMainPage() function - not needed anymore