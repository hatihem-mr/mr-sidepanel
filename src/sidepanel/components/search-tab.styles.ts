// ===================================================================
// SEARCH TAB STYLES - Extracted CSS for Maintainability
// ===================================================================
// This file contains all styles for the SearchTabComponent.
// Extracted from search-tab.ts to reduce file size and improve
// maintainability following the same pattern as ai-tab.styles.ts.
//
// STYLE ORGANIZATION:
// 1. Host & Container Styles
// 2. Section Styles (cards/panels)
// 3. Text Input & Boolean Highlighting
// 4. File Upload Section
// 5. Search Options & Categories
// 6. Action Buttons
// 7. Status Messages & Animations
//
// WHY SEPARATE FILE:
// - Reduces search-tab.ts from ~1800 lines to ~1300 lines
// - Easier to maintain CSS independently
// - Follows established pattern from ai-tab.ts refactoring
// - Improves code organization and readability
// ===================================================================

import { css } from 'lit';
import { commonLayout, commonAnimations } from './shared-styles.js';

export const searchTabStyles = [
  // Import common patterns
  commonLayout,
  commonAnimations,

  // Component-specific styles
  css`
  /* Override host to keep search-tab specific overflow behavior */
  :host {
    display: block;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  * {
    box-sizing: border-box;
  }

  .search-container {
    padding: 0;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .section {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    box-shadow: var(--shadow-sm);
    transition: var(--transition-fast);
  }

  .section:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border-hover);
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
    background: var(--bg-primary);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-secondary);
  }

  .refresh-btn:hover {
    border-color: var(--mr-blue);
    color: var(--mr-blue);
    background: var(--bg-elevated);
  }

  .section-icon {
    width: 16px;
    height: 16px;
    color: var(--primary);
  }

  /* Text input section - Material Design style with monospace */
  .text-input {
    width: 100%;
    min-height: 60px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: 'Courier New', 'Courier', monospace;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0;
    word-spacing: 0;
    tab-size: 4;
    -moz-tab-size: 4;
    font-variant: normal;
    font-feature-settings: normal;
    text-rendering: geometricPrecision;
    resize: none;
    overflow: hidden;
    transition: var(--transition-fast);
    box-sizing: border-box;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 1px var(--primary);
  }

  .text-input::placeholder {
    color: var(--text-muted);
  }

  /* Boolean operator highlighting - matching Muck Rack's magenta/purple */
  .search-input-container {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  /* Boolean operator chips - show detected operators with colors */
  .boolean-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  .boolean-chips span {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    font-family: 'Courier New', monospace;
  }

  .boolean-highlight-pink {
    color: #da4f95;
    background: rgba(218, 79, 149, 0.1);
    border: 1px solid rgba(218, 79, 149, 0.3);
  }

  .boolean-highlight-purple {
    color: #752ade;
    background: rgba(117, 42, 222, 0.1);
    border: 1px solid rgba(117, 42, 222, 0.3);
  }

  /* Boolean operator text highlighting overlay */
  .search-input-wrapper {
    position: relative;
    width: 100%;
  }

  /* pre and code reset for overlay */
  .search-input-wrapper pre {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 16px;
    border: 1px solid transparent;
    border-radius: 8px;
    pointer-events: none !important;
    z-index: 1;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    tab-size: 4;
    -moz-tab-size: 4;
  }

  .highlight-overlay {
    font-family: 'Courier New', 'Courier', monospace;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0;
    word-spacing: 0;
    tab-size: 4;
    -moz-tab-size: 4;
    font-variant: normal;
    font-feature-settings: normal;
    text-rendering: geometricPrecision;
    white-space: pre-wrap;
    word-wrap: break-word;
    word-break: normal;
    color: var(--text-primary);
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    display: block;
  }

  .search-input-with-highlighting {
    background: transparent !important;
    color: transparent !important; /* Hide textarea text when highlighting overlay is active */
    caret-color: var(--text-primary) !important; /* Keep cursor visible */
    position: relative;
    z-index: 2;
  }

  .search-input-with-highlighting::placeholder {
    color: var(--text-muted) !important; /* Keep placeholder visible */
  }

  /* File upload section */
  .upload-zone {
    border: 2px dashed var(--border);
    border-radius: 8px;
    padding: var(--spacing-lg);
    text-align: center;
    cursor: pointer;
    transition: var(--transition-fast);
    background: var(--bg-secondary);
    position: relative;
  }

  .upload-zone:hover,
  .upload-zone.drag-over {
    border-color: var(--primary);
    background: var(--bg-tertiary);
  }

  .upload-icon {
    width: 32px;
    height: 32px;
    color: var(--text-muted);
    margin: 0 auto var(--spacing-sm);
  }

  .upload-text {
    color: var(--text-secondary);
    font-size: 13px;
    margin-bottom: var(--spacing-sm);
  }

  .upload-text strong {
    color: var(--primary);
  }

  .file-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .sheets-input {
    margin-top: var(--spacing-sm);
  }

  .sheets-url {
    width: 100%;
    padding: var(--spacing-sm);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    box-sizing: border-box;
  }

  /* Search options */
  .search-options {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .option-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .option-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .location-select {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 13px;
    box-sizing: border-box;
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs);
    border-radius: 6px;
    cursor: pointer;
    transition: var(--transition-fast);
  }

  .checkbox-option:hover {
    background: var(--bg-secondary);
  }

  .checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--primary);
  }

  .checkbox-label {
    font-size: 13px;
    color: var(--text-primary);
  }

  .checkbox-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  /* Multi-category checkbox grid - Phase 1 */
  .category-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 12px;
  }

  .category-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 8px;
    border: 2px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: var(--transition-fast);
    background: var(--bg-primary);
    min-width: 0; /* Allow text to shrink */
  }

  .category-checkbox:hover {
    border-color: var(--primary);
    background: var(--bg-secondary);
  }

  .category-checkbox:focus-within {
    outline: none;
    box-shadow: 0 0 0 3px rgba(22, 160, 133, 0.15);
    border-color: #16A085;
  }

  .category-checkbox.selected {
    border-color: #16A085;
    background: rgba(22, 160, 133, 0.08);
  }

  .category-checkbox.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .category-icon {
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .category-checkbox.selected .category-icon {
    color: #16A085;
  }

  .category-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Override Material Design checkbox color to match AI button green */
  md-checkbox {
    --md-checkbox-selected-container-color: #16A085;
    --md-checkbox-selected-icon-color: white;
    --md-checkbox-selected-pressed-container-color: #138f75;
    --md-checkbox-selected-hover-container-color: #1ab899;
    --md-checkbox-selected-focus-container-color: #16A085;
    --md-checkbox-selected-pressed-icon-color: white;
    --md-checkbox-selected-hover-icon-color: white;
    --md-checkbox-selected-focus-icon-color: white;
    /* Override the ripple/state layer colors */
    --md-checkbox-selected-hover-state-layer-color: #16A085;
    --md-checkbox-selected-pressed-state-layer-color: #16A085;
    --md-checkbox-selected-focus-state-layer-color: #16A085;
  }

  /* Override Material Design button color to match AI button green */
  md-filled-button {
    --md-filled-button-container-color: #16A085;
    --md-filled-button-label-text-color: white;
    --md-filled-button-hover-container-color: #1ab899;
    --md-filled-button-pressed-container-color: #138f75;
  }

  /* Action buttons */
  .action-buttons {
    display: flex;
    gap: var(--spacing-sm);
    width: 100%;
    max-width: 100%;
  }

  .search-btn {
    flex: 1.6;
    background: var(--mr-blue);
    color: white;
    border: none;
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    transition: var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .search-btn:hover:not(:disabled) {
    background: var(--mr-blue-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .search-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .format-btn {
    flex: 1;
    background: var(--mr-green);
    color: white;
    border: none;
    padding: var(--spacing-md);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    transition: var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .format-btn:hover:not(:disabled) {
    filter: brightness(110%);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .search-icon,
  .format-icon {
    width: 16px;
    height: 16px;
  }

  /* Status messages */
  .status-message {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: 6px;
    font-size: 12px;
    margin-top: var(--spacing-sm);
  }

  .status-success {
    background: rgb(16 185 129 / 0.1);
    color: var(--success);
    border: 1px solid rgb(16 185 129 / 0.2);
  }

  .status-error {
    background: rgb(239 68 68 / 0.1);
    color: var(--danger);
    border: 1px solid rgb(239 68 68 / 0.2);
  }

  .status-info {
    background: rgb(59 130 246 / 0.1);
    color: var(--primary);
    border: 1px solid rgb(59 130 246 / 0.2);
  }

  /* Loading spinner - uses spin animation from shared-styles */
  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  `
];
