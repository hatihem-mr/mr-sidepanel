import { css } from 'lit';
import { commonAnimations } from './shared-styles.js';

/**
 * AI Tab Component Styles
 *
 * Comprehensive CSS styling for the AI analysis tab component.
 * Includes styles for:
 * - Layout and container structure
 * - API key configuration UI
 * - Analysis button with animated loading states
 * - Collapsible sections for results
 * - Ticket cards and article displays
 * - Animations (spin, fill, pulse, search motion)
 *
 * Uses shared styles:
 * - commonAnimations: spin animation for loading spinners
 */
const aiTabStylesCore = css`
  :host {
    display: block;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .ai-container {
    padding: 0;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
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
    gap: 12px;
  }

  .section-icon {
    width: 16px;
    height: 16px;
    color: var(--primary);
  }

  .intercom-status {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    border-radius: 6px;
    font-size: 13px;
    margin-bottom: var(--spacing-lg);
  }

  .status-active {
    background: rgb(16 185 129 / 0.1);
    color: var(--success);
    border: 1px solid rgb(16 185 129 / 0.2);
  }

  .status-inactive {
    background: rgb(239 68 68 / 0.1);
    color: var(--danger);
    border: 1px solid rgb(239 68 68 / 0.2);
  }

  .status-icon {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .analyze-section {
    text-align: center;
  }

  .analyze-btn {
    position: relative;
    width: 100%;
    padding: 16px 24px;
    background: var(--secondary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    transition: var(--transition-fast);
    margin-bottom: var(--spacing-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .analyze-btn:hover:not(:disabled) {
    background: var(--secondary-hover);
    box-shadow: var(--shadow-md);
  }

  .analyze-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .analyze-icon {
    width: 18px;
    height: 18px;
  }

  .analyze-description {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  /* API Key Input Section Styles */
  .api-key-section {
    padding: var(--spacing-sm);
  }

  .api-key-description {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-md);
    line-height: 1.5;
  }

  .api-key-input-group {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .api-key-input {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: monospace;
  }

  .api-key-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(77, 208, 225, 0.1);
  }

  .api-key-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .save-api-key-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
  }

  .save-api-key-btn:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .save-api-key-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .api-key-help {
    text-align: center;
  }

  .help-link {
    font-size: 12px;
    color: var(--primary);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .help-link:hover {
    text-decoration: underline;
  }

  .results-section {
    flex: 1;
  }

  .analysis-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
  }

  .analysis-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: var(--spacing-xs);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .label-icon {
    width: 14px;
    height: 14px;
    color: var(--primary);
  }

  .analysis-content {
    color: var(--text-primary);
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .troubleshooting-steps {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .troubleshooting-step {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .step-number {
    background: var(--mr-blue);
    color: black;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .step-text {
    flex: 1;
    font-size: 13px;
    line-height: 1.4;
    color: #1a1a1a;
  }

  .boolean-queries {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .boolean-query {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  .query-text {
    flex: 1;
    font-family: monospace;
    font-size: 12px;
    color: var(--text-primary);
  }

  .copy-btn {
    background: var(--mr-green);
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .copy-btn:hover {
    filter: brightness(110%);
  }

  .related-articles {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .article-card {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--spacing-md);
    transition: var(--transition-fast);
    box-shadow: var(--shadow-sm);
  }

  .article-card:hover {
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.1);
  }

  .article-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }

  .article-title {
    flex: 1;
    color: var(--primary);
    text-decoration: none;
    font-weight: 600;
    font-size: 13px;
    line-height: 1.4;
  }

  .article-title:hover {
    text-decoration: underline;
  }

  .relevance-score {
    background: var(--accent);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .article-summary {
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.4;
    margin-bottom: var(--spacing-sm);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .article-actions {
    display: flex;
    justify-content: flex-end;
  }

  .article-actions .copy-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    font-size: 10px;
  }

  .usage-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--bg-secondary);
    border-radius: 6px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .clear-cache-btn {
    background: var(--mr-blue);
    color: white;
    border: none;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-secondary);
    padding: var(--spacing-2xl);
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    color: var(--text-muted);
    margin-bottom: var(--spacing-lg);
  }

  .api-key-section {
    margin-bottom: var(--spacing-lg);
  }

  .api-key-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    border-radius: 6px;
    margin-bottom: var(--spacing-md);
    font-size: 13px;
  }

  .status-configured {
    background: rgb(16 185 129 / 0.1);
    color: var(--success);
    border: 1px solid rgb(16 185 129 / 0.2);
  }

  .status-missing {
    background: rgb(245 158 11 / 0.1);
    color: var(--warning);
    border: 1px solid rgb(245 158 11 / 0.2);
  }

  .status-invalid {
    background: rgb(239 68 68 / 0.1);
    color: var(--danger);
    border: 1px solid rgb(239 68 68 / 0.2);
  }

  .api-key-input-section {
    margin-top: var(--spacing-md);
  }

  .api-key-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: monospace;
    font-size: 13px;
    margin-bottom: var(--spacing-sm);
  }

  .api-key-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgb(37 99 235 / 0.1);
  }

  .api-key-actions {
    display: flex;
    gap: var(--spacing-sm);
  }

  .btn-small {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 12px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .btn-primary-small {
    background: var(--primary);
    color: white;
  }

  .btn-secondary-small {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }

  .btn-danger-small {
    background: var(--danger);
    color: white;
  }

  .api-key-help {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: var(--spacing-xs);
    line-height: 1.4;
  }

  .api-key-help a {
    color: var(--primary);
    text-decoration: none;
  }

  .api-key-help a:hover {
    text-decoration: underline;
  }

  .loading-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Collapsible Section Styles */
  .content-sections {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .collapsible-section {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    transition: var(--transition-fast);
  }

  .collapsible-section:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border-hover);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    background: var(--bg-secondary);
    cursor: pointer;
    user-select: none;
    transition: var(--transition-fast);
  }

  .section-header:hover {
    background: var(--bg-elevated);
  }

  .section-header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .section-header-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .section-badge {
    background: var(--primary);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    min-width: 16px;
    text-align: center;
  }

  .section-badge.empty {
    background: var(--text-muted);
  }

  .section-badge.loading {
    background: var(--warning);
  }

  .expand-icon {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
    color: var(--text-secondary);
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .section-content {
    padding: 2px var(--spacing-md) var(--spacing-md);
  }

  .section-content.collapsed {
    display: none;
  }

  .section-empty {
    text-align: center;
    color: var(--text-secondary);
    font-style: italic;
    padding: var(--spacing-lg);
  }

  .section-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-lg);
    color: var(--text-secondary);
  }

  .section-error {
    color: var(--danger);
    background: rgb(239 68 68 / 0.1);
    padding: var(--spacing-md);
    border-radius: 6px;
    font-size: 13px;
  }

  /* Button states for loading */
  .analyze-btn.analyzing,
  .analyze-btn.loading-tickets {
    background: var(--secondary-hover);
    opacity: 0.7;
  }

  .button-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 0%;
    /* Bright version of MR teal gradient for fill */
    background: linear-gradient(135deg, #4DD0E1 0%, #26C6DA 50%, #00BCD4 100%);
    transition: width 1.2s cubic-bezier(0.4, 0, 0.6, 1);
    z-index: 0;
    border-radius: 8px;
  }

  .button-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .analyze-btn.analyzing .button-fill {
    width: 0%;
    animation: fill-to-40 8s ease-out forwards, playful-pulse 3s ease-in-out infinite;
  }

  .analyze-btn.loading-tickets .button-fill {
    width: 0%;
    animation: fill-to-80 12s ease-out forwards, playful-pulse 3s ease-in-out infinite,
               milestone-glow 1s ease-out;
  }

  @keyframes fill-to-40 {
    0% { width: 0%; }
    100% { width: 40%; }
  }

  @keyframes fill-to-80 {
    0% { width: 0%; }
    50% { width: 40%; }
    100% { width: 80%; }
  }

  @keyframes playful-pulse {
    0% {
      opacity: 0.9;
      transform: scaleY(1);
    }
    50% {
      opacity: 1;
      transform: scaleY(1.02);
    }
    100% {
      opacity: 0.9;
      transform: scaleY(1);
    }
  }

  @keyframes milestone-glow {
    0% {
      box-shadow: inset 0 0 0 rgba(255, 255, 255, 0);
    }
    50% {
      box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.3);
    }
    100% {
      box-shadow: inset 0 0 0 rgba(255, 255, 255, 0);
    }
  }


  /* Magnifying Glass Animation */
  .analyze-btn.analyzing .analyze-icon,
  .analyze-btn.loading-tickets .analyze-icon {
    animation: search-motion 8s ease-in-out infinite;
  }

  @keyframes search-motion {
    0% { transform: translate(0, 0); }
    15% { transform: translate(-2px, -2px); }
    30% { transform: translate(2px, -1px); }
    45% { transform: translate(-1px, 2px); }
    60% { transform: translate(2px, 1px); }
    75% { transform: translate(-2px, 1px); }
    90% { transform: translate(1px, -2px); }
    100% { transform: translate(0, 0); }
  }

  /* Similar Tickets Styles */
  .similar-tickets {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .ticket-card {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: var(--spacing-md);
    transition: border-color 0.2s;
  }

  .ticket-card:hover {
    border-color: var(--primary);
  }

  .ticket-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xs);
  }

  .ticket-customer {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 13px;
  }

  .ticket-confidence {
    background: var(--success);
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
  }

  .ticket-summary {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
    line-height: 1.4;
  }

  .ticket-meta {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-sm);
  }

  .ticket-messages {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .ticket-keywords {
    font-size: 11px;
    color: var(--text-tertiary);
    font-style: italic;
  }

  .ticket-actions {
    display: flex;
    justify-content: flex-end;
  }

  .ticket-link {
    background: var(--primary);
    color: white;
    text-decoration: none;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .ticket-link:hover {
    background: var(--primary-dark);
  }
`;

/**
 * Export styles as array including shared animations
 */
export const aiTabStyles = [
  commonAnimations,
  aiTabStylesCore
];
