// ===================================================================
// OVERLAY CONTENT SCRIPT INTEGRATION
// ===================================================================
// This module provides overlay functionality that runs in the main page
// context via content script, allowing overlays to appear across the
// entire screen instead of being constrained to the extension.
// ===================================================================

import { createExtensionOverlayManager } from './index.js';
import { createSVGIcon } from './utils/svg-icons.js';
import { AdminDataCacheManager } from './services/admin-data-cache.js';
import { ThemeColors, initializeThemeCache, getThemeColors } from './utils/theme-manager.js';
import { createCollapsibleSection, setupCollapsibleHandlers } from './utils/collapsible-section.js';
import { OverlayMinimizeManager, MinimizedOverlay } from './services/overlay-minimize-manager.js';
import { parseAdminUserHTML } from './utils/admin-html-parser.js';
import { debug } from '../shared/utils/debug.js';

// Global overlay manager for the main page
let globalOverlayManager: ReturnType<typeof createExtensionOverlayManager> | null = null;

// Global minimize manager instance
let globalMinimizeManager: OverlayMinimizeManager | null = null;

// OverlayMinimizeManager class moved to src/overlay/services/overlay-minimize-manager.ts
// AdminDataCacheManager class moved to src/overlay/services/admin-data-cache.ts
// Theme management (ThemeColors, initializeThemeCache, getThemeColors) moved to src/overlay/utils/theme-manager.js
// createSVGIcon function moved to src/overlay/utils/svg-icons.ts

/**
 * Initialize overlay system on the main page
 */
export function initializeMainPageOverlays(): void {
  if (globalOverlayManager) {
    debug.log('🎯 Overlay system already initialized on main page');
    return;
  }

  try {
    // Initialize theme cache
    initializeThemeCache();
    
    // Create overlay manager in main page context
    globalOverlayManager = createExtensionOverlayManager();
    globalOverlayManager.setDebugMode(true);
    
    debug.log('✅ Main page overlay system initialized');
    
    // Make it globally accessible for testing
    (window as any).mainPageOverlayManager = globalOverlayManager;
    
  } catch (error) {
    debug.error('❌ Failed to initialize main page overlay system:', error);
  }
}

/**
 * Create a test overlay on the main page
 */
export function createMainPageTestOverlay(): string | null {
  // Check both local and global overlay managers
  const overlayManager = globalOverlayManager || (window as any).mainPageOverlayManager;
  
  if (!overlayManager) {
    debug.error('❌ Overlay manager not initialized. Call initializeMainPageOverlays() first.');
    return null;
  }

  try {
    const overlayId = overlayManager.addOverlay(
      (target, componentOptions) => {
        const container = document.createElement('div');
        container.className = 'main-page-overlay overlay-card';
        container.style.cssText = `
          background: white;
          border: 3px solid #FF5722;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          min-width: 350px;
          position: relative;
        `;
        
        const header = document.createElement('div');
        header.className = 'overlay-card-header drag-handle';
        header.style.cssText = `
          background: linear-gradient(135deg, #FF5722 0%, #E64A19 100%);
          color: white;
          padding: 16px 20px;
          border-bottom: 1px solid #D84315;
          cursor: grab;
          user-select: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 8px 8px 0 0;
        `;
        
        const title = document.createElement('h3');
        title.textContent = '🌐 FULL SCREEN OVERLAY!';
        title.style.cssText = 'margin: 0; font-size: 16px; font-weight: 600;';
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 4px 8px;
          color: white;
          border-radius: 4px;
        `;
        closeBtn.addEventListener('mouseover', () => closeBtn.style.background = 'rgba(255,255,255,0.2)');
        closeBtn.addEventListener('mouseout', () => closeBtn.style.background = 'none');
        closeBtn.addEventListener('click', () => {
          try {
            componentOptions.closeOverlay();
          } catch (error) {
            debug.error('🔥 Error calling closeOverlay():', error);
          }
        });
        
        const content = document.createElement('div');
        content.style.cssText = 'padding: 20px; background: white; color: #333; border-radius: 0 0 8px 8px;';
        
        // Create content safely without innerHTML to avoid CSP issues
        const successP = document.createElement('p');
        successP.innerHTML = '<strong>🎉 SUCCESS! This overlay runs on the MAIN PAGE!</strong>';
        
        const feature1P = document.createElement('p');
        feature1P.textContent = '✅ Can move anywhere on the screen';
        
        const feature2P = document.createElement('p');
        feature2P.textContent = '✅ Not constrained to extension';
        
        const feature3P = document.createElement('p');
        feature3P.textContent = '✅ Perfect for Intercom usage';
        
        const dragHintP = document.createElement('p');
        const small = document.createElement('small');
        small.textContent = 'Drag the orange header to move around!';
        dragHintP.appendChild(small);
        
        // Create test button with proper event listener (CSP compliant)
        const buttonDiv = document.createElement('div');
        buttonDiv.style.marginTop = '12px';
        
        const testButton = document.createElement('button');
        testButton.textContent = 'Test REAL Admin Fetch';
        testButton.style.cssText = `
          background: #2196F3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 8px;
        `;
        
        const fakeButton = document.createElement('button');
        fakeButton.textContent = 'Fake Demo';
        fakeButton.style.cssText = `
          background: #4CAF50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 8px;
        `;
        
        // Real admin data fetch with enhanced debugging
        testButton.addEventListener('click', async () => {
          testButton.textContent = 'Fetching...';
          testButton.disabled = true;
          
          try {
            
            // Use the service worker bridge to fetch real admin data
            const response = await chrome.runtime.sendMessage({
              action: 'fetch',
              url: 'https://muckrack.com/mradmin/directory/mediaoutlet/?q=techcrunch',
              options: {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
              }
            });
            
            
            // Check different response scenarios
            if (response && response.data) {
              testButton.textContent = '✅ Real Data!';
              setTimeout(() => {
                testButton.textContent = 'Test REAL Admin Fetch';
                testButton.disabled = false;
              }, 3000);
            } else if (response && response.error) {
              testButton.textContent = `❌ ${response.errorType || 'Error'}`;
              debug.error('🔥 Admin fetch failed:', response.error);
              debug.error('🔥 Error type:', response.errorType);
              debug.error('🔥 Status:', response.status);
              setTimeout(() => {
                testButton.textContent = 'Test REAL Admin Fetch';
                testButton.disabled = false;
              }, 3000);
            } else {
              testButton.textContent = '❌ Unexpected Response';
              debug.error('🔥 Unexpected response format:', response);
              setTimeout(() => {
                testButton.textContent = 'Test REAL Admin Fetch';
                testButton.disabled = false;
              }, 2000);
            }
          } catch (error) {
            debug.error('🔥 Admin fetch error:', error);
            testButton.textContent = '❌ Failed';
            setTimeout(() => {
              testButton.textContent = 'Test REAL Admin Fetch';
              testButton.disabled = false;
            }, 2000);
          }
        });
        
        // Fake demo for testing UI
        fakeButton.addEventListener('click', () => {
          fakeButton.textContent = 'Simulating...';
          fakeButton.disabled = true;
          
          setTimeout(() => {
            fakeButton.textContent = '✅ Demo Done!';
            setTimeout(() => {
              fakeButton.textContent = 'Fake Demo';
              fakeButton.disabled = false;
            }, 2000);
          }, 1000);
        });
        
        const buttonHint = document.createElement('small');
        buttonHint.innerHTML = '<strong>Blue:</strong> Real MR admin API | <strong>Green:</strong> Fake demo';
        buttonHint.style.color = '#666';
        
        buttonDiv.appendChild(testButton);
        buttonDiv.appendChild(fakeButton);
        buttonDiv.appendChild(document.createElement('br'));
        buttonDiv.appendChild(buttonHint);
        
        // Assemble content
        content.appendChild(successP);
        content.appendChild(feature1P);
        content.appendChild(feature2P);
        content.appendChild(feature3P);
        content.appendChild(dragHintP);
        content.appendChild(buttonDiv);
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        container.appendChild(header);
        container.appendChild(content);
        
        return { element: container, instance: { type: 'main-page-test' } };
      },
      {
        draggable: true,
        position: { 
          top: window.innerHeight / 2 - 150,  // Center vertically
          left: window.innerWidth / 2 - 175   // Center horizontally
        },
        dismissOnOutsideClick: false,
        dismissOnEscape: true, // Allow Esc to close
      }
    );
    
    return overlayId;
    
  } catch (error) {
    debug.error('❌ Failed to create main page overlay:', error);
    return null;
  }
}

/**
 * Listen for messages from extension to control overlays
 */
function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    debug.log('📨 Content script received message:', message);
    
    switch (message.type) {
      case 'CREATE_MAIN_PAGE_OVERLAY':
        const overlayId = createMainPageTestOverlay();
        sendResponse({ success: !!overlayId, overlayId });
        break;
        
      case 'INITIALIZE_OVERLAYS':
        initializeMainPageOverlays();
        sendResponse({ success: true });
        break;
        
      default:
        debug.log('🤷 Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  });
}

/**
 * Initialize email detection system for admin user lookups
 * Simple approach: Only create pill once per email, never recreate
 * 
 * TODO: Admin Page Overlay Replacement System
 * - Detect when user clicks admin links in Intercom
 * - Auto-navigate to specific sections (Authentication, Email Sending, etc.)
 * - Extract data and show in our overlay instead of admin page
 * - Replace/hide original admin page content with clean overlay interface
 * This would provide seamless admin data access without leaving Intercom context
 */
function initializeEmailDetection(): void {
  debug.log('🔧 Email detection ENABLED with debugging and safeguards');
  
  // Track active pills by email to prevent duplicates - make it global for cleanup
  const activePills = new Map<string, HTMLElement>();
  (window as any).muckrackActivePills = activePills;
  
  // DEBUGGING: Track overlay creation to prevent spam
  const activeOverlays = new Map<string, string>(); // email -> overlayId
  (window as any).muckrackActiveOverlays = activeOverlays;
  
  // Email regex pattern
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  
  // Debounced mouse move handler
  let mouseMoveTimeout: NodeJS.Timeout | null = null;
  
  function handleMouseMove(event: MouseEvent) {
    // Clear previous timeout
    if (mouseMoveTimeout) {
      clearTimeout(mouseMoveTimeout);
    }
    
    // Debounce to prevent excessive processing
    mouseMoveTimeout = setTimeout(() => {
      processMousePosition(event);
    }, 100); // 100ms debounce
  }
  
  function processMousePosition(event: MouseEvent) {
    const target = event.target as Element;
    if (!target) return;
    
    // IMPORTANT: Check if we're hovering over an element inside an overlay
    // Don't show pills for emails inside overlays (minimized or full)
    let checkElement: Element | null = target;
    while (checkElement) {
      // Check for overlay classes or IDs that indicate we're inside an overlay
      if (checkElement.classList.contains('overlay-card') || 
          checkElement.classList.contains('admin-user-overlay') ||
          checkElement.classList.contains('minimized-overlay-item') ||
          checkElement.classList.contains('muckrack-email-hover-pill') ||
          checkElement.id?.includes('overlay') ||
          checkElement.id?.includes('muckrack-admin-overlay')) {
        // We're inside an overlay - don't show the pill
        return;
      }
      checkElement = checkElement.parentElement;
    }
    
    // Check if the element or its parent contains an email
    let emailElement: Element | null = null;
    let email: string | null = null;
    
    // Check current element and up to 3 parents for email content
    let currentElement: Element | null = target;
    for (let i = 0; i < 4 && currentElement; i++) {
      const text = currentElement.textContent?.trim() || '';
      const emails = text.match(emailRegex);
      
      if (emails && emails.length === 1) {
        // Found exactly one email - check if it's the primary content
        const foundEmail = emails[0];
        if (text === foundEmail || text.length - foundEmail.length <= 15) {
          emailElement = currentElement;
          email = foundEmail;
          break;
        }
      }
      currentElement = currentElement.parentElement;
    }
    
    if (email && emailElement && !activePills.has(email)) {
      // DEBUGGING: Check if overlay already exists
      const activeOverlays = (window as any).muckrackActiveOverlays;
      if (activeOverlays && activeOverlays.has(email)) {
        debug.log('🚨 SAFEGUARD: Overlay already exists for', email, 'skipping pill creation');
        return;
      }
      
      // Create pill for this email (ONCE)
      const rect = emailElement.getBoundingClientRect();
      const pill = createEmailHoverPill(email, rect.right + 10, rect.top);
      
      // Safety check - only proceed if pill was created successfully
      if (pill) {
        activePills.set(email, pill);
        
        
        // Auto-remove timer with debugging - 1 second (fast response)
        const removeTimer = setTimeout(() => {
          try {
            if (pill && pill.parentNode) {
              pill.remove();
            }
            const globalActivePills = (window as any).muckrackActivePills;
            if (globalActivePills && globalActivePills.has(email)) {
              globalActivePills.delete(email);
            }
          } catch (error) {
            debug.error('🔍 Error removing pill:', error);
          }
        }, 1000);
        
        // Store timer ID for potential cleanup
        (pill as any).removeTimer = removeTimer;
      }
    }
  }
  
  // Clean up function
  function cleanupPills() {
    activePills.forEach((pill, email) => {
      if (pill.parentNode) {
        pill.remove();
      }
    });
    activePills.clear();
    
    // Also clean up any orphaned pills that might exist
    const orphanedPills = document.querySelectorAll('.muckrack-email-hover-pill');
    orphanedPills.forEach(pill => pill.remove());
  }
  
  // MEMORY LEAK FIX: Store listeners for proper cleanup
  const listeners = {
    mousemove: handleMouseMove,
    beforeunload: cleanupPills
  };
  
  // Add mouse move listener with cleanup tracking
  document.addEventListener('mousemove', listeners.mousemove, { passive: true });
  
  // Multiple cleanup scenarios to prevent memory leaks
  window.addEventListener('beforeunload', listeners.beforeunload);
  
  // Cleanup after 10 minutes of inactivity to prevent memory buildup
  setTimeout(() => {
    document.removeEventListener('mousemove', listeners.mousemove);
    window.removeEventListener('beforeunload', listeners.beforeunload);
    cleanupPills();
  }, 600000); // 10 minutes
  
  debug.log('✅ SIMPLE email detection system initialized');
}

/**
 * Create a small hover pill for email lookup
 */
function createEmailHoverPill(email: string, x: number, y: number): HTMLElement {
  const pill = document.createElement('div');
  pill.className = 'muckrack-email-hover-pill';
  pill.dataset.email = email;
  
  // Apply MuckRack-style design - small icon button
  pill.style.cssText = `
    position: fixed;
    top: ${y - 20}px;
    left: ${x + 5}px;
    z-index: 2147483647;
    background: #16A085;
    color: white;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    user-select: none;
    transition: all 0.15s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
  `;
  
  pill.textContent = '👤';
  pill.title = `Lookup admin data for ${email}`;
  
  // Hover effects and state management - MuckRack style (no shadow)
  pill.addEventListener('mouseenter', () => {
    pill.style.background = '#138D75'; // MR green hover
    pill.style.transform = 'scale(1.1)';
    // Let the email detection system know we're hovering the pill
    (window as any).emailDetectionPillHovered = true;
  });
  
  pill.addEventListener('mouseleave', () => {
    pill.style.background = '#16A085'; // MR green
    pill.style.transform = 'scale(1)';
    // Clear the hover state
    (window as any).emailDetectionPillHovered = false;
  });
  
  // Click handler to create admin lookup overlay
  pill.addEventListener('click', (event) => {
    
    // SAFEGUARD: Check if overlay already exists
    const activeOverlays = (window as any).muckrackActiveOverlays;
    if (activeOverlays && activeOverlays.has(email)) {
      debug.log('🚨 SAFEGUARD: Overlay already exists for', email, 'ignoring click');
      return;
    }
    
    // Get position BEFORE hiding the pill
    const pillRect = pill.getBoundingClientRect();
    
    event.stopPropagation();
    event.preventDefault();
    
    // User clicked - pill will be removed anyway
    
    // CRITICAL: Close any existing overlays first to prevent multiple overlays
    const existingOverlays = document.querySelectorAll('[id^="muckrack-admin-overlay-"]');
    existingOverlays.forEach(overlay => overlay.remove());
    
    // Clean up from global tracking map
    const globalActivePills = (window as any).muckrackActivePills;
    if (globalActivePills && globalActivePills.has(email)) {
      globalActivePills.delete(email);
    }
    
    // Remove the pill DOM element immediately
    pill.remove();
    
    // Create new overlay with the correct position
    const overlayId = createAdminUserLookupOverlay(email, pillRect.right + 10, pillRect.top);
    
    // Track overlay to prevent duplicates
    if (overlayId && activeOverlays) {
      activeOverlays.set(email, overlayId);
    }
  });
  
  document.body.appendChild(pill);
  return pill;
}

/**
 * Create overlay with admin user data for the given email
 */
async function createAdminUserLookupOverlay(email: string, x?: number, y?: number, preloadedAdminData?: any): Promise<string | null> {
  // Check both local and global overlay managers
  const overlayManager = globalOverlayManager || (window as any).mainPageOverlayManager;
  
  if (!overlayManager) {
    debug.error('❌ Overlay manager not initialized');
    return null;
  }

  try {
    // Overlay creation logging removed - too verbose
    
    const overlayId = overlayManager.addOverlay(
      (target, componentOptions) => {
        // Get theme colors for dynamic styling
        const theme = getThemeColors();
        
        const container = document.createElement('div');
        container.className = 'admin-user-overlay overlay-card';
        container.style.cssText = `
          background: ${theme.bgElevated};
          border: 1px solid ${theme.border};
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          width: 300px;
          position: relative;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;
        
        const header = document.createElement('div');
        header.className = 'overlay-card-header drag-handle';
        header.style.cssText = `
          background: #2C5282;
          color: white;
          padding: 8px 12px;
          cursor: grab;
          user-select: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 16px 16px 0 0;
          font-weight: 500;
          font-size: 12px;
        `;
        
        const title = document.createElement('h3');
        title.innerHTML = `${createSVGIcon('user', 14)} ${email}`;
        title.style.cssText = 'margin: 0; font-size: 13px; font-weight: 500; color: white; display: flex; align-items: center; gap: 6px;';
        
        // Button container for minimize and close
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; align-items: center; gap: 4px;';
        
        // Minimize button
        const minimizeBtn = document.createElement('button');
        minimizeBtn.innerHTML = createSVGIcon('minimize', 14);
        minimizeBtn.style.cssText = `
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 4px;
          color: white;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        minimizeBtn.addEventListener('mouseover', () => minimizeBtn.style.background = 'rgba(255,255,255,0.2)');
        minimizeBtn.addEventListener('mouseout', () => minimizeBtn.style.background = 'none');
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 2px 4px;
          color: white;
          border-radius: 2px;
        `;
        closeBtn.addEventListener('mouseover', () => closeBtn.style.background = 'rgba(255,255,255,0.2)');
        closeBtn.addEventListener('mouseout', () => closeBtn.style.background = 'none');
        closeBtn.addEventListener('click', () => {
          // Clean up overlay tracking when overlay is closed
          const activeOverlays = (window as any).muckrackActiveOverlays;
          if (activeOverlays && activeOverlays.has(email)) {
            activeOverlays.delete(email);
            debug.log('🗑️ Overlay tracking cleaned up for:', email);
          }
          componentOptions.closeOverlay();
        });
        
        const content = document.createElement('div');
        content.style.cssText = `padding: 8px; background: ${theme.bgElevated}; color: ${theme.textPrimary}; border-radius: 0 0 16px 16px; line-height: 1.3;`;
        
        // Add CSS animation for loading spinner if not already added
        if (!document.getElementById('overlay-spinner-styles')) {
          const style = document.createElement('style');
          style.id = 'overlay-spinner-styles';
          style.textContent = `
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `;
          document.head.appendChild(style);
        }
        
        // Loading state - MuckRack style
        const loadingDiv = document.createElement('div');
        loadingDiv.style.cssText = 'text-align: center; padding: 12px 0;';
        loadingDiv.innerHTML = `
          <div style="color: #16A085; margin-bottom: 4px;">${createSVGIcon('loading', 14)}</div>
          <p style="margin: 0 0 4px 0; font-weight: 500; color: ${theme.textPrimary}; font-size: 12px;">Fetching data...</p>
        `;
        content.appendChild(loadingDiv);
        
        // Initialize minimize manager if needed
        if (!globalMinimizeManager) {
          globalMinimizeManager = new OverlayMinimizeManager();
        }
        
        // Add minimize button click handler
        minimizeBtn.addEventListener('click', () => {
          
          // Ensure minimize manager exists
          if (!globalMinimizeManager) {
            globalMinimizeManager = new OverlayMinimizeManager();
          }
          
          const overlayData: MinimizedOverlay = {
            id: `admin-lookup-${email}`,
            title: email,
            type: 'admin-user-lookup',
            data: { email, adminData: cachedAdminData }, // Include cached admin data
            originalOverlay: componentOptions,
            content: container
          };
          
          globalMinimizeManager.minimizeOverlay(overlayData);
          componentOptions.closeOverlay(); // Hide original overlay
        });
        
        // Add buttons to container
        buttonContainer.appendChild(minimizeBtn);
        buttonContainer.appendChild(closeBtn);
        
        header.appendChild(title);
        header.appendChild(buttonContainer);
        container.appendChild(header);
        container.appendChild(content);
        
        // Store admin data for minimize feature
        let cachedAdminData: any = preloadedAdminData;
        
        // Use preloaded data if available, otherwise fetch
        const adminDataPromise = preloadedAdminData 
          ? Promise.resolve(preloadedAdminData)
          : fetchAdminUserData(email);
          
        adminDataPromise.then(adminData => {
          // Store the data for minimize feature
          cachedAdminData = adminData;
          // Replace loading content with actual data
          content.innerHTML = '';
          
          if (adminData.success) {
            // Create collapsible sections based on actual admin data from profile.md and permission-overrides.md
            const sections = [];
            // Section creation logging removed - too verbose
            
            // Quick Status Section removed - useless information
            
            // Permissions Section (from profile.md fieldset)
            const permissions = [
              adminData.status && `<strong>Status:</strong> <span>${adminData.status}</span>`,
              adminData.role && `<strong>Role:</strong> <span>${adminData.role}</span>`,
              adminData.firstName && adminData.lastName && `<strong>Name:</strong> <span>${adminData.firstName} ${adminData.lastName}</span>`,
              adminData.emailAddress && `<strong>Email:</strong> <span>${adminData.emailAddress}</span>`
            ].filter(Boolean);
            
            if (permissions.length > 0) {
              sections.push(createCollapsibleSection('Permissions', permissions, createSVGIcon('key', 12), false, theme));
            }
            
            // Authentication Section (from profile.md Authentication fieldset)  
            const authentication = [
              adminData.twoFactor && `<strong>Two-Factor Authentication:</strong> <span>${adminData.twoFactor}</span>`,
              adminData.orgRequirement && `<strong>Organization requirement:</strong> <span>${adminData.orgRequirement}</span>`,
              adminData.authMethod && `<strong>Authentication method:</strong> <span>${adminData.authMethod}</span>`,
              adminData.phoneNumber && `<strong>Phone number:</strong> <span>${adminData.phoneNumber}</span>`,
              adminData.backupCodes && `<strong>Backup codes used:</strong> <span>${adminData.backupCodes}</span>`
            ].filter(Boolean);
            
            if (authentication.length > 0) {
              sections.push(createCollapsibleSection('Authentication', authentication, createSVGIcon('shield', 12), false, theme));
            }
            
            // Profile Section (from profile.md Profile fieldset)
            const profile = [
              adminData.organization && `<strong>Organization:</strong> <span>${adminData.organization}</span>`,
              adminData.package && `<strong>Package:</strong> <span>${adminData.package}</span>`,
              adminData.customerId && `<strong>Customer ID:</strong> <span>${adminData.customerId}</span>`,
              adminData.dateJoined && `<strong>Date Joined:</strong> <span>${adminData.dateJoined}</span>`,
              adminData.lastLogin && `<strong>Last Login:</strong> <span>${adminData.lastLogin}</span>`
            ].filter(Boolean);
            
            if (profile.length > 0) {
              sections.push(createCollapsibleSection('Profile', profile, createSVGIcon('user', 12), false, theme));
            }
            
            // Email Sending Section (from profile.md Email Sending fieldset)
            const emailSending = [
              adminData.resolvedAddresses && `<strong>Resolved Addresses:</strong> <span>${adminData.resolvedAddresses}</span>`,
              adminData.senderIdentities && `<strong>Sender Identities:</strong> <span>${adminData.senderIdentities}</span>`,
              adminData.externalAuth && `<strong>External Authorization:</strong> <span>${adminData.externalAuth}</span>`
            ].filter(Boolean);
            
            if (emailSending.length > 0) {
              sections.push(createCollapsibleSection('Email Sending', emailSending, createSVGIcon('mail', 12), false, theme));
            }
            
            // User Permission Overrides Section (from permission-overrides.md)
            const permissionOverrides = [];
            if (adminData.permissionOverrides && adminData.permissionOverrides.length > 0) {
              adminData.permissionOverrides.forEach(permission => {
                permissionOverrides.push(`<strong>Permission:</strong> <span>${permission}</span>`);
              });
            }
            
            if (permissionOverrides.length > 0) {
              sections.push(createCollapsibleSection('User Permission Overrides', permissionOverrides, createSVGIcon('settings', 12), false, theme));
            }
            
            // Sections summary logging removed - too verbose
            
            content.innerHTML = `
              <div style="display: grid; gap: 4px;">
                ${sections.join('')}
              </div>
            `;
            
            // Add click handlers for collapsible sections
            setupCollapsibleHandlers(content);
          } else {
            content.innerHTML = `
              <div style="text-align: center; padding: 12px;">
                <div style="color: #EF5350; margin-bottom: 6px;">${createSVGIcon('warning', 16)}</div>
                <p style="margin: 0 0 4px 0; font-weight: 500; color: ${theme.textPrimary}; font-size: 12px;">No admin data found</p>
                <p style="margin: 0; color: ${theme.textSecondary}; font-size: 11px;">${adminData.error || 'User may not exist'}</p>
              </div>
            `;
          }
        }).catch(error => {
          debug.error('🔥 Error fetching admin data:', error);
          content.innerHTML = `
            <div style="text-align: center; padding: 12px;">
              <div style="color: #EF5350; margin-bottom: 6px;">${createSVGIcon('error', 16)}</div>
              <p style="margin: 0 0 4px 0; font-weight: 500; color: ${theme.textPrimary}; font-size: 12px;">Load failed</p>
              <p style="margin: 0; color: ${theme.textSecondary}; font-size: 11px;">Network error</p>
            </div>
          `;
        });
        
        return { element: container, instance: { type: 'admin-user-lookup', email } };
      },
      {
        draggable: true,
        position: x && y ? { 
          top: y - 20,
          left: x + 5
        } : { 
          top: window.innerHeight / 2 - 160,
          left: window.innerWidth / 2 - 200
        },
        dismissOnOutsideClick: false, // Don't close when clicking outside while dragging
        dismissOnEscape: true,
      }
    );
    
    return overlayId;
    
  } catch (error) {
    debug.error('❌ Failed to create admin user lookup overlay:', error);
    return null;
  }
}

/**
 * Create admin user lookup overlay with optional cached data for instant restoration
 */
async function createAdminUserLookupOverlayWithCache(
  email: string,
  cachedAdminData: any = null,
  x?: number,
  y?: number
): Promise<string | null> {

  if (cachedAdminData && cachedAdminData.success) {
    // Use cached data for instant restoration
    return createAdminUserLookupOverlay(email, x, y, cachedAdminData);
  } else {
    // Fall back to normal creation (will check cache internally then fetch if needed)
    debug.log('⚠️ No cached data available, creating overlay normally');
    return createAdminUserLookupOverlay(email, x, y);
  }
}

// Export to window object for OverlayMinimizeManager to access during restore
(window as any).createAdminUserLookupOverlayWithCache = createAdminUserLookupOverlayWithCache;

/**
 * Fetch admin user data from Muck Rack admin system
 */
async function fetchAdminUserData(email: string): Promise<{
  success: boolean;
  // Personal Info
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  personAbilities?: string;
  // Permissions  
  status?: string;
  role?: string;
  // Important Dates
  lastLogin?: string;
  dateJoined?: string;
  // Authentication
  orgRequirement?: string;
  twoFactor?: string;
  backupCodes?: string;
  authMethod?: string;
  phoneNumber?: string;
  // Email Sending
  resolvedAddresses?: string;
  senderIdentities?: string;
  externalAuth?: string;
  // Profile
  organization?: string;
  package?: string;
  userPackage?: string;
  mrCustomerId?: string;
  // Changelog
  changelogEntries?: string[];
  error?: string;
}> {
  try {
    // CACHE CHECK: Try to get cached data first
    const cachedData = await AdminDataCacheManager.getCachedData(email);
    if (cachedData) {
      return cachedData;
    }
    // Admin data fetch logging removed - too verbose
    
    // STEP 1: Get search results to find the user ID
    const searchResponse = await chrome.runtime.sendMessage({
      action: 'fetch',
      url: `https://muckrack.com/mradmin/auth/user/?q=${encodeURIComponent(email)}`,
      options: {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }
    });
    
    if (!searchResponse || !searchResponse.data) {
      throw new Error('Failed to get search results');
    }
    
    
    // Extract user ID from the search results
    // Pattern: <a href="/mradmin/auth/user/2461508/change/...">
    const userIdMatch = searchResponse.data.match(/\/mradmin\/auth\/user\/(\d+)\/change\//);
    if (!userIdMatch) {
      debug.error('🔥 Could not find user ID in search results');
      return {
        success: false,
        error: 'User not found in admin system'
      };
    }
    
    const userId = userIdMatch[1];
    // User ID logging removed - too verbose
    
    // STEP 2: Fetch the detailed user page
    const detailUrl = `https://muckrack.com/mradmin/auth/user/${userId}/change/`;
    
    const detailResponse = await chrome.runtime.sendMessage({
      action: 'fetch',
      url: detailUrl,
      options: {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }
    });
    
    // Detail response status logging removed - too verbose
    
    if (detailResponse && detailResponse.data) {
      // Admin data success logging removed - too verbose
      
      // Parse the detailed HTML response to extract comprehensive user data
      const adminData = parseAdminUserHTML(detailResponse.data, email);
      
      const result = {
        success: true,
        ...adminData
      };
      
      // CACHE: Store the successful result for future use
      await AdminDataCacheManager.setCachedData(email, result);
      
      return result;
      
    } else if (detailResponse && detailResponse.error) {
      debug.error('🔥 Detail fetch failed:', detailResponse.error);
      return {
        success: false,
        error: detailResponse.errorType || 'Failed to fetch detailed user data'
      };
    } else {
      debug.error('🔥 Unexpected detail response format:', detailResponse);
      return {
        success: false,
        error: 'Unexpected response format from detailed page'
      };
    }
    
  } catch (error) {
    debug.error('🔥 Admin fetch error:', error);
    
    // Handle extension context invalidated error
    if (error.message && error.message.includes('Extension context invalidated')) {
      return {
        success: false,
        error: 'Extension was updated - please refresh the page to use admin lookup'
      };
    }
    
    return {
      success: false,
      error: `Network error: ${error.message}`
    };
  }
}

// Collapsible section utilities (createCollapsibleSection, setupCollapsibleHandlers) moved to src/overlay/utils/collapsible-section.ts

// parseAdminUserHTML function moved to src/overlay/utils/admin-html-parser.ts

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  debug.log('🎯 Overlay content integration loading...');
  
  // Set up message listener
  setupMessageListener();
  
  // Initialize email detection system
  initializeEmailDetection();
  
  // Make functions globally available for testing
  (window as any).initializeMainPageOverlays = initializeMainPageOverlays;
  (window as any).createMainPageTestOverlay = createMainPageTestOverlay;
  
  // Verify functions are available
  
  // Create a simple test function
  (window as any).testOverlaySystem = () => {
    const overlayId = createMainPageTestOverlay();
    return overlayId;
  };
  
  debug.log('✅ Overlay content integration ready');
}