// ===================================================================
// OVERLAY MINIMIZE MANAGER
// ===================================================================
// Manages minimized overlays shown as tabs in the top-right corner.
// Handles minimization, restoration, and UI state for overlay tabs.
// ===================================================================

import { createSVGIcon } from '../utils/svg-icons.js';

/**
 * Data structure for a minimized overlay
 */
export interface MinimizedOverlay {
  id: string;
  title: string;
  type: string;
  content: HTMLElement;
  originalOverlay: any;
  data: any;
}

/**
 * Manages minimized overlays displayed as tabs in the top-right corner
 * of the page. Provides minimize/restore functionality for overlays.
 */
export class OverlayMinimizeManager {
  private minimizedOverlays: Map<string, MinimizedOverlay> = new Map();
  private minimizeContainer: HTMLElement | null = null;

  constructor() {
    this.createMinimizeContainer();
  }

  /**
   * Creates the container element that holds minimized overlay tabs
   * in the top-right corner of the page
   */
  private createMinimizeContainer() {
    if (this.minimizeContainer) return;

    this.minimizeContainer = document.createElement('div');
    this.minimizeContainer.id = 'overlay-minimize-container';
    this.minimizeContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483640;
      display: flex;
      flex-direction: column;
      gap: 4px;
      pointer-events: none;
    `;
    document.body.appendChild(this.minimizeContainer);
  }

  /**
   * Minimizes an overlay and displays it as a tab in the minimize container
   * @param overlayData - Data about the overlay to minimize
   */
  minimizeOverlay(overlayData: MinimizedOverlay) {
    if (!this.minimizeContainer) this.createMinimizeContainer();

    const minimizedItem = document.createElement('div');
    minimizedItem.className = 'minimized-overlay-item';
    minimizedItem.style.cssText = `
      background: #2C5282;
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: auto;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    minimizedItem.innerHTML = `${createSVGIcon('user', 12)} ${overlayData.title}`;

    // Click to restore
    minimizedItem.addEventListener('click', () => {
      this.restoreOverlay(overlayData.id);
    });

    // Hover effects
    minimizedItem.addEventListener('mouseenter', () => {
      minimizedItem.style.background = '#3182CE';
      minimizedItem.style.transform = 'scale(1.02)';
    });
    minimizedItem.addEventListener('mouseleave', () => {
      minimizedItem.style.background = '#2C5282';
      minimizedItem.style.transform = 'scale(1)';
    });

    this.minimizeContainer.appendChild(minimizedItem);
    this.minimizedOverlays.set(overlayData.id, { ...overlayData, content: minimizedItem });

    // Minimize logging removed - too verbose
  }

  /**
   * Restores a minimized overlay back to its full view
   * @param overlayId - ID of the overlay to restore
   */
  restoreOverlay(overlayId: string) {
    const minimizedData = this.minimizedOverlays.get(overlayId);
    if (!minimizedData) return;

    // Remove from minimized container
    if (minimizedData.content.parentNode) {
      minimizedData.content.remove();
    }

    // Restore the original overlay
    if (minimizedData.originalOverlay && typeof minimizedData.originalOverlay.restore === 'function') {
      minimizedData.originalOverlay.restore();
    } else {
      // Recreate overlay if needed
      this.recreateOverlay(minimizedData);
    }

    this.minimizedOverlays.delete(overlayId);
    // Restore logging removed - too verbose
  }

  /**
   * Recreates an overlay when it cannot be restored from its original reference.
   * This is called when the overlay object doesn't have a restore method.
   * @param minimizedData - The minimized overlay data
   */
  private recreateOverlay(minimizedData: MinimizedOverlay) {
    // Calculate restore position near minimize container (top-right)
    const restorePosition = {
      x: window.innerWidth - 350, // 350px from right edge (overlay width + margin)
      y: 50 // 50px from top (below minimize container)
    };

    // This will recreate overlays when restored - specific to overlay type
    // Note: createAdminUserLookupOverlayWithCache is exported to window object in content-integration.ts
    if (minimizedData.type === 'admin-user-lookup' && minimizedData.data.email) {
      // Create overlay with cached admin data for instant restoration
      const createAdminUserLookupOverlayWithCache = (window as any).createAdminUserLookupOverlayWithCache;
      if (typeof createAdminUserLookupOverlayWithCache === 'function') {
        createAdminUserLookupOverlayWithCache(
          minimizedData.data.email,
          minimizedData.data.adminData, // Pass cached admin data
          restorePosition.x,
          restorePosition.y
        );
      }
    }
  }
}
