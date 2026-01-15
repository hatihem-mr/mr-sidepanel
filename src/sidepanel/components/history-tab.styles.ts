/**
 * History Tab Styles
 *
 * Component-specific styles for the search history tab.
 * Uses shared-styles.ts for common patterns like layout, empty states, and animations.
 */

import { css } from 'lit';
import { commonLayout, commonStates, commonAnimations } from './shared-styles.js';

export const historyTabStyles = [
  // Import common patterns
  commonLayout,
  commonStates,
  commonAnimations,

  // Component-specific styles
  css`
    .history-container {
      padding: 0;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;
    }

    .view-toggle {
      display: flex;
      background: var(--bg-secondary);
      border-radius: 10px;
      padding: 6px;
      border: 1px solid var(--border);
    }

    .toggle-btn {
      flex: 1;
      padding: 12px 16px;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .toggle-btn.active {
      background: var(--bg-elevated);
      color: var(--primary);
      box-shadow: var(--shadow-sm);
    }

    .toggle-icon {
      width: 14px;
      height: 14px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 2px solid var(--accent); /* Muck Rack light blue */
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--primary); /* Muck Rack blue */
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      letter-spacing: -0.02em;
    }

    .section-icon {
      width: 20px;
      height: 20px;
      color: var(--accent); /* Muck Rack light blue */
    }

    .clear-btn {
      background: var(--danger);
      color: white;
      border: none;
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .clear-btn:hover {
      filter: brightness(110%);
    }

    .history-list {
      flex: 1;
      overflow-y: auto;
      margin-top: var(--spacing-xs);
    }

    /* Hybrid UI - History Item with Toggle */
    .history-item {
      background: var(--bg-elevated);
      border: 2px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      transition: var(--transition-fast);
      cursor: pointer;
      position: relative;
    }

    .history-item:hover {
      box-shadow: var(--shadow-sm);
    }

    .history-item:last-child {
      margin-bottom: 0;
    }

    /* Cached mode - BLUE accent (instant results) */
    .history-item.cached-mode {
      border-color: rgba(59, 130, 246, 0.3);
    }

    .history-item.cached-mode:hover {
      border-color: var(--primary);
      background: rgba(59, 130, 246, 0.02);
    }

    /* Fresh mode - GREEN accent (new search) */
    .history-item.fresh-mode {
      border-color: rgba(22, 160, 133, 0.3);
    }

    .history-item.fresh-mode:hover {
      border-color: #16A085; /* Muck Rack green */
      background: rgba(22, 160, 133, 0.02);
    }

    /* No cache available */
    .history-item.no-cache {
      border-color: var(--border);
    }

    .history-item.no-cache:hover {
      border-color: var(--primary); /* Muck Rack blue */
      background: rgba(44, 82, 130, 0.02);
    }

    .item-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 8px;
      gap: 8px;
    }

    .item-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      flex: 1;
    }

    .item-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      margin-bottom: 10px;
    }

    /* Toggle Switch - Top Right Corner */
    .mode-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      flex-shrink: 0;
    }

    .toggle-icon {
      width: 12px;
      height: 12px;
      color: var(--text-secondary);
      transition: var(--transition-fast);
    }

    /* Lightning bolt turns BLUE when cached mode is ON */
    .cached-mode .toggle-icon.cache-icon {
      color: var(--primary) !important; /* Blue when cached mode active */
    }

    /* Circular arrow turns GREEN when fresh mode is ON (cached toggle is OFF) */
    .fresh-mode .toggle-icon.refresh-icon {
      color: #16A085 !important; /* Muck Rack green when fresh mode active */
    }

    .toggle-switch {
      position: relative;
      width: 32px;
      height: 18px;
      background: var(--border);
      border-radius: 9px;
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .toggle-switch.active {
      background: var(--primary); /* Blue when ON (cached mode) */
    }

    .toggle-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      background: white;
      border-radius: 50%;
      transition: var(--transition-fast);
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    .toggle-switch.active .toggle-knob {
      left: 16px;
    }

    /* Cache Badge */
    .cache-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      background: rgba(59, 130, 246, 0.1);
      color: var(--primary);
      border: 1px solid rgba(59, 130, 246, 0.2);
    }

    /* Load Hint */
    .load-hint {
      font-size: 11px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px;
      background: var(--bg-secondary);
      border-radius: 6px;
      line-height: 1.4;
    }

    .cached-mode .load-hint {
      background: rgba(59, 130, 246, 0.05); /* Blue background for cached */
      color: var(--primary); /* Blue text for cached */
    }

    .fresh-mode .load-hint {
      background: rgba(22, 160, 133, 0.05); /* Green background for fresh */
      color: #16A085; /* Muck Rack green text for fresh */
    }

    .no-cache .load-hint {
      background: rgba(44, 82, 130, 0.05);
      color: var(--primary);
    }

    .hint-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .item-actions {
      display: flex;
      gap: var(--spacing-xs);
      flex-shrink: 0;
    }

    .item-actions-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .action-btn {
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition-fast);
    }

    .action-btn:hover {
      background: var(--bg-secondary);
      color: var(--text-primary);
    }

    .action-btn svg {
      width: 14px;
      height: 14px;
    }

    .star-btn.favorited {
      color: var(--warning);
    }

    .remove-btn:hover {
      color: var(--danger);
    }

    /* Category chips for multi-category searches */
    .category-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      background: rgba(22, 160, 133, 0.1);
      color: #16A085; /* Muck Rack green */
      border: 1px solid rgba(22, 160, 133, 0.2);
    }

    .meta-separator {
      color: var(--text-muted);
      font-size: 11px;
      margin: 0 4px; /* Add space around the dot separator */
    }
  `
];
