/**
 * Shared CSS Styles for Side Panel Components
 *
 * This file contains common CSS patterns used across multiple components
 * to reduce duplication and maintain consistency.
 *
 * Usage:
 * ```typescript
 * import { commonLayout, commonCards, ... } from './shared-styles.js';
 *
 * static styles = [
 *   commonLayout,
 *   commonCards,
 *   css`
 *     // Component-specific styles
 *   `
 * ];
 * ```
 */

import { css } from 'lit';

/**
 * Common Layout Patterns
 * Standard host element and container setups
 */
export const commonLayout = css`
  :host {
    display: block;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .container {
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    box-sizing: border-box;
  }
`;

/**
 * Common Card Styles
 * Elevated card components with consistent styling
 */
export const commonCards = css`
  .card {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: var(--spacing-lg);
    transition: var(--transition-fast);
  }

  .card:hover {
    box-shadow: var(--shadow-sm);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm);
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .card-body {
    color: var(--text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }
`;

/**
 * Common Button Styles
 * Reusable button patterns for actions
 */
export const commonButtons = css`
  .action-btn {
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    transition: var(--transition-fast);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
  }

  .action-btn:hover {
    background: var(--bg-secondary);
  }

  .action-btn:active {
    transform: scale(0.98);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 50%;
    border: none;
    background: transparent;
    cursor: pointer;
    transition: var(--transition-fast);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn:hover {
    background: var(--bg-secondary);
  }

  .icon-btn:active {
    transform: scale(0.95);
  }
`;

/**
 * Common State Styles
 * Empty states, loading spinners, etc.
 */
export const commonStates = css`
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--spacing-2xl);
    color: var(--text-secondary);
  }

  .empty-state-icon {
    width: 48px;
    height: 48px;
    margin-bottom: var(--spacing-md);
    opacity: 0.5;
  }

  .empty-state-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
  }

  .empty-state-description {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border);
    border-top: 2px solid var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-2xl);
  }
`;

/**
 * Common Badge/Chip Styles
 * Small labels and category indicators
 */
export const commonBadges = css`
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-primary {
    background: var(--primary-bg);
    color: var(--primary);
  }

  .badge-secondary {
    background: var(--bg-secondary);
    color: var(--text-secondary);
  }

  .badge-success {
    background: rgba(34, 197, 94, 0.1);
    color: rgb(34, 197, 94);
  }

  .badge-warning {
    background: rgba(251, 191, 36, 0.1);
    color: rgb(251, 191, 36);
  }

  .badge-error {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
  }
`;

/**
 * Common Icon Sizes
 * Standardized icon dimensions
 */
export const commonIcons = css`
  .icon-xs {
    width: 12px;
    height: 12px;
  }

  .icon-sm {
    width: 14px;
    height: 14px;
  }

  .icon-md {
    width: 20px;
    height: 20px;
  }

  .icon-lg {
    width: 48px;
    height: 48px;
  }

  .icon-xl {
    width: 64px;
    height: 64px;
  }
`;

/**
 * Common Animations
 * Reusable keyframe animations
 */
export const commonAnimations = css`
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .fade-in {
    animation: fadeIn 0.2s ease-in-out;
  }

  .slide-down {
    animation: slideDown 0.2s ease-out;
  }

  .slide-up {
    animation: slideUp 0.2s ease-out;
  }
`;

/**
 * Common Utility Classes
 * Flexbox, spacing, and other utilities
 */
export const commonUtilities = css`
  /* Flexbox utilities */
  .flex {
    display: flex;
  }

  .flex-col {
    display: flex;
    flex-direction: column;
  }

  .flex-center {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .items-center {
    align-items: center;
  }

  .justify-between {
    justify-content: space-between;
  }

  .gap-xs {
    gap: var(--spacing-xs);
  }

  .gap-sm {
    gap: var(--spacing-sm);
  }

  .gap-md {
    gap: var(--spacing-md);
  }

  .gap-lg {
    gap: var(--spacing-lg);
  }

  /* Text utilities */
  .text-primary {
    color: var(--text-primary);
  }

  .text-secondary {
    color: var(--text-secondary);
  }

  .text-xs {
    font-size: 11px;
  }

  .text-sm {
    font-size: 13px;
  }

  .text-md {
    font-size: 14px;
  }

  .text-lg {
    font-size: 16px;
  }

  .font-medium {
    font-weight: 500;
  }

  .font-semibold {
    font-weight: 600;
  }

  .font-bold {
    font-weight: 700;
  }

  /* Truncate text */
  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Scrollbar styling */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }
`;
