import { debug } from '../../shared/utils/debug.js';
// ===================================================================
// MAIN PAGE OVERLAY SERVICE
// ===================================================================
// Service for creating overlays directly on main pages via script injection
// Bypasses iframe sandboxing issues by injecting overlay creation code
// directly into the target page's DOM context.
// ===================================================================

/**
 * Service for creating overlays on main pages via script injection
 */
export class MainPageOverlayService {
  
  /**
   * Make service globally accessible for console debugging
   */
  static initializeConsoleDebugging() {
    (window as any).MROverlay = {
      create: () => MainPageOverlayService.createTestOverlay(),
      directInject: () => MainPageOverlayService.directInjectTest(),
      debug: true
    };
  }
  
  /**
   * Direct script injection test - bypasses all chrome APIs
   */
  static async directInjectTest() {
    
    try {
      // Create overlay directly in current page
      const overlay = document.createElement('div');
      overlay.id = 'direct-test-overlay-' + Date.now();
      overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        background: #FF0000;
        color: white;
        padding: 20px;
        border-radius: 8px;
        font-family: monospace;
        min-width: 300px;
      `;
      
      overlay.innerHTML = `
        <h3>🔥 DIRECT INJECT TEST</h3>
        <p>This bypasses chrome.scripting entirely</p>
        <p>URL: ${window.location.href}</p>
        <button onclick="this.parentElement.remove()" style="
          background: white;
          color: black;
          border: none;
          padding: 5px 10px;
          margin-top: 10px;
          cursor: pointer;
        ">Close</button>
      `;
      
      document.body.appendChild(overlay);
      
      return { success: true, overlayId: overlay.id };
      
    } catch (error) {
      debug.error('🔥 ❌ Direct inject failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a test overlay with fallback strategy for extension updates
   * 1. Try content script message first (fast, if available)
   * 2. Fall back to script injection if content script unavailable
   */
  static async createTestOverlay(): Promise<{ success: boolean; overlayId?: string; error?: string }> {
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        debug.error('🔥 ❌ No active tab found!');
        return { success: false, error: 'No active tab found' };
      }

      
      try {
        // PRIMARY: Try content script message first (fastest if available)
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'CREATE_MAIN_PAGE_OVERLAY'
        });

        
        if (response?.success) {
          return { success: true, overlayId: response.overlayId };
        }
      } catch (contentScriptError) {
      }

      // FALLBACK: Script injection for when content script isn't available
      
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: MainPageOverlayService.createOverlayInPage
        });

        const result = results[0]?.result;
        
        if (result?.success) {
          return { success: true, overlayId: result.overlayId };
        } else {
          debug.error('🔥 ❌ Script injection failed:', result?.error);
          return { success: false, error: result?.error || 'Script injection failed' };
        }
      } catch (injectionError) {
        debug.error('🔥 ❌ Script injection threw error:', injectionError.message);
        return { 
          success: false, 
          error: 'Extension updated - please refresh the page to use overlays' 
        };
      }
      
    } catch (error) {
      debug.error('🔥 ❌ Exception in createTestOverlay:', error);
      debug.error('🔥 Error stack:', error instanceof Error ? error.stack : 'No stack');
      return { 
        success: false, 
        error: `Exception: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Function that gets injected into the main page to create overlay
   * This runs in the main page context, not the extension context
   */
  private static createOverlayInPage(): { success: boolean; overlayId?: string; error?: string } {
    
    try {
      
      // Create overlay directly in main page DOM
      const overlay = document.createElement('div');
      overlay.id = 'main-page-test-overlay-' + Date.now();
      
      
      overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 2147483647;
        background: white;
        border: 3px solid #FF5722;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        min-width: 350px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        pointer-events: auto;
      `;
      
      
      const header = document.createElement('div');
      header.style.cssText = `
        background: linear-gradient(135deg, #FF5722 0%, #E64A19 100%);
        color: white;
        padding: 16px 20px;
        cursor: grab;
        user-select: none;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 8px 8px 0 0;
      `;
      
      const title = document.createElement('h3');
      title.textContent = '🌐 MAIN PAGE OVERLAY SUCCESS!';
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
      closeBtn.onclick = () => {
        overlay.remove();
      };
      
      const content = document.createElement('div');
      content.style.cssText = 'padding: 20px;';
      content.innerHTML = `
        <p><strong>🎉 SUCCESS! This overlay is on the MAIN PAGE!</strong></p>
        <p>✅ Not constrained to extension</p>
        <p>✅ Perfect for Intercom usage</p>
        <p>✅ Maximum z-index (${2147483647})</p>
        <p>✅ URL: ${window.location.href}</p>
        <p><small>Click × to close</small></p>
      `;
      
      
      header.appendChild(title);
      header.appendChild(closeBtn);
      overlay.appendChild(header);
      overlay.appendChild(content);
      
      
      // Add drag functionality - inline to avoid method call issues
      let isDragging = false;
      let dragOffset = { x: 0, y: 0 };
      
      header.onmousedown = (e) => {
        isDragging = true;
        dragOffset.x = e.clientX - overlay.offsetLeft;
        dragOffset.y = e.clientY - overlay.offsetTop;
        header.style.cursor = 'grabbing';
      };
      
      document.onmousemove = (e) => {
        if (isDragging) {
          overlay.style.left = (e.clientX - dragOffset.x) + 'px';
          overlay.style.top = (e.clientY - dragOffset.y) + 'px';
          overlay.style.transform = 'none';
        }
      };
      
      document.onmouseup = () => {
        if (isDragging) {
        }
        isDragging = false;
        header.style.cursor = 'grab';
      };
      
      document.body.appendChild(overlay);
      
      
      return {
        success: true,
        overlayId: overlay.id
      };
      
    } catch (error) {
      debug.error('🔥 ❌ Exception in createOverlayInPage:', error);
      debug.error('🔥 Error stack:', error instanceof Error ? error.stack : 'No stack');
      return {
        success: false,
        error: `Page injection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Add drag functionality to overlay
   * Extracted to separate method for clarity
   */
  private static addDragFunctionality(overlay: HTMLElement, header: HTMLElement): void {
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    
    header.onmousedown = (e) => {
      isDragging = true;
      dragOffset.x = e.clientX - overlay.offsetLeft;
      dragOffset.y = e.clientY - overlay.offsetTop;
      header.style.cursor = 'grabbing';
    };
    
    document.onmousemove = (e) => {
      if (isDragging) {
        overlay.style.left = (e.clientX - dragOffset.x) + 'px';
        overlay.style.top = (e.clientY - dragOffset.y) + 'px';
        overlay.style.transform = 'none';
      }
    };
    
    document.onmouseup = () => {
      isDragging = false;
      header.style.cursor = 'grab';
    };
  }
}