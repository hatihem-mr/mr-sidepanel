import { css } from 'lit';
import { commonAnimations, commonStates } from './shared-styles.js';

/**
 * Search Results Inline Component Styles
 *
 * Comprehensive CSS styling for the inline search results accordion component.
 * Includes styles for:
 * - Multi-category accordion sections (People, Articles, Outlets, Broadcast)
 * - Collapsible sections with expand/collapse animations
 * - Result cards (person, article, outlet) with hover states
 * - Sub-accordions for term-specific results
 * - Checkmark copy feedback animation for articles
 * - Status badges and icons
 * - 3D flip card animations
 *
 * Uses shared styles:
 * - commonAnimations: spin animation for loading spinners
 * - commonStates: empty state and loading spinner patterns
 */
const searchResultsInlineStylesCore = css`
  :host {
    display: block;
    width: 100%;
  }

  .results-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Category accordion section */
  .category-section {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    transition: var(--transition-fast);
  }

  .category-section:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-sm);
  }

  /* Category header (clickable) */
  .category-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    cursor: pointer;
    user-select: none;
    background: var(--bg-elevated);
    transition: var(--transition-fast);
  }

  .category-header:hover {
    background: var(--bg-secondary);
  }

  .category-header:active {
    background: var(--bg-tertiary);
  }

  /* Category icon */
  .category-icon {
    width: 24px;
    height: 24px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  /* Category name */
  .category-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    flex: 1;
  }

  /* Result badge */
  .result-badge {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .result-badge.found {
    background: rgba(22, 160, 133, 0.1);
    color: #16A085;
    border: 1px solid rgba(22, 160, 133, 0.3);
  }

  .result-badge.not-found {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  /* Expand/collapse arrow */
  .expand-arrow {
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
    transition: transform 0.2s;
    flex-shrink: 0;
  }

  .expand-arrow.expanded {
    transform: rotate(180deg);
  }

  /* Category content (collapsible) */
  .category-content {
    border-top: 1px solid var(--border);
    padding: 12px 16px;
    background: var(--bg-primary);
  }

  .category-content.collapsed {
    display: none;
  }

  /* Term list */
  .term-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .term-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--bg-elevated);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  /* Status icon */
  .status-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .status-icon.found {
    color: #16A085;
  }

  .status-icon.not-found {
    color: #ef4444;
  }

  /* Term text */
  .term-text {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
    word-break: break-word;
  }

  /* Term count */
  .term-count {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  /* Open results button */
  .open-results-btn {
    width: 100%;
    padding: 12px;
    background: rgba(22, 160, 133, 0.08);
    color: #16A085;
    border: 1px solid rgba(22, 160, 133, 0.3);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .open-results-btn:hover {
    background: rgba(22, 160, 133, 0.15);
    border-color: rgba(22, 160, 133, 0.5);
  }

  .open-results-btn:active {
    background: rgba(22, 160, 133, 0.2);
  }

  .open-results-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-icon {
    width: 16px;
    height: 16px;
  }

  /* Sub-accordion for term results preview */
  .term-results-preview {
    margin-top: 8px;
    padding: 12px;
    background: var(--bg-secondary);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .term-results-preview.collapsed {
    display: none;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }

  .preview-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .preview-count {
    font-size: 11px;
    color: var(--text-muted);
  }

  /* Result cards */
  .result-cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Person card - Updated to match mockup */
  .person-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: white;
    transition: all 0.2s;
  }

  .person-card:hover {
    background: #f9f9f9;
    border-color: #16A085;
    box-shadow: 0 2px 4px rgba(22,160,133,0.1);
  }

  .person-photo {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #2C5282, #16A085);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 18px;
    flex-shrink: 0;
  }

  .person-info {
    flex: 1;
    min-width: 0;
  }

  .person-name {
    font-weight: 600;
    font-size: 15px;
    color: #2C5282;
    margin-bottom: 2px;
  }

  .person-title {
    font-size: 13px;
    color: #666;
    margin-bottom: 2px;
  }

  .person-outlet {
    font-size: 13px;
    color: #16A085;
    font-weight: 500;
  }

  /* Article card - Updated to match mockup */
  .article-card {
    padding: 12px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: white;
    transition: all 0.2s;
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }

  .article-card:hover {
    background: #f9f9f9;
    border-color: #16A085;
    box-shadow: 0 2px 4px rgba(22,160,133,0.1);
  }

  .article-title {
    font-weight: 600;
    font-size: 14px;
    color: #2C5282;
    margin-bottom: 6px;
    line-height: 1.3;
    cursor: pointer;
    transition: color 0.2s;
  }

  .article-title:hover {
    color: #16A085;
    text-decoration: underline;
  }

  .article-snippet {
    font-size: 13px;
    color: #666;
    line-height: 1.4;
    margin-bottom: 6px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .article-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #888;
  }

  .article-source {
    color: #16A085;
    font-weight: 500;
  }

  .article-date {
    color: #888;
  }

  /* Checkmark copy feedback animation */
  .checkmark-container {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%) scale(0);
    opacity: 0;
  }

  .checkmark-container.show {
    animation: checkmark-flash 0.8s ease-out;
  }

  @keyframes checkmark-flash {
    0% {
      transform: translateY(-50%) scale(0);
      opacity: 0;
    }
    30% {
      transform: translateY(-50%) scale(1.2);
      opacity: 1;
    }
    70% {
      transform: translateY(-50%) scale(1);
      opacity: 1;
    }
    100% {
      transform: translateY(-50%) scale(0);
      opacity: 0;
    }
  }

  .checkmark {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #16A085;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .checkmark svg {
    width: 16px;
    height: 16px;
    stroke: white;
    stroke-width: 3;
    fill: none;
  }

  /* Outlet card - Updated to match mockup */
  .outlet-card {
    padding: 12px;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: white;
    transition: all 0.2s;
  }

  .outlet-card:hover {
    background: #f9f9f9;
    border-color: #2C5282;
    box-shadow: 0 2px 4px rgba(44,82,130,0.1);
  }

  .outlet-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .outlet-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: linear-gradient(135deg, #2C5282, #3182CE);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .outlet-icon svg {
    width: 18px;
    height: 18px;
    stroke: white;
    fill: none;
  }

  .outlet-name {
    font-weight: 600;
    font-size: 15px;
    color: #2C5282;
    flex: 1;
  }

  .outlet-type {
    font-size: 12px;
    color: #666;
    background: #f0f0f0;
    padding: 3px 8px;
    border-radius: 4px;
  }

  .outlet-description {
    font-size: 13px;
    color: #666;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* View more button */
  .view-more-btn {
    margin-top: 8px;
    width: 100%;
    padding: 8px;
    background: var(--bg-primary);
    border: 1px dashed var(--border);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: var(--transition-fast);
    text-align: center;
  }

  .view-more-btn:hover {
    border-color: #16A085;
    color: #16A085;
    background: rgba(22, 160, 133, 0.05);
  }

  /* === Option 1 Split Sections Design === */

  /* Status Section */
  .status-section {
    margin-bottom: 20px;
  }

  .status-section:last-child {
    margin-bottom: 0;
  }

  .status-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    justify-content: space-between;
  }

  .status-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-title.found {
    color: #16A085;
  }

  .status-title.missing {
    color: #ef4444;
  }

  .status-count {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
  }

  .quick-action {
    font-size: 10px;
    color: #16A085;
    background: rgba(22, 160, 133, 0.1);
    padding: 3px 8px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid rgba(22, 160, 133, 0.2);
  }

  .quick-action:hover {
    background: rgba(22, 160, 133, 0.2);
    border-color: rgba(22, 160, 133, 0.3);
  }

  .quick-action.secondary {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .quick-action.secondary:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
  }

  /* Person Card Container - 3D Flip */
  .card-wrapper {
    perspective: 1000px;
    margin-bottom: 5px;
    position: relative;
    height: 110px;
  }

  .card-wrapper:last-child {
    margin-bottom: 0;
  }

  .card-wrapper .person-card {
    position: absolute;
    top: 0;
    left: 0;
    width: 92%;
    height: 70%;
    cursor: pointer;
    transform-style: preserve-3d;
    transition: transform 0.6s;
  }

  .card-wrapper .person-card.flipped {
    transform: rotateX(180deg);
  }

  /* Missing cards (no flip animation) */
  .person-card.missing {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 5px;
    transition: border-color 0.2s;
    width: 92%;
    max-width: 92%;
  }

  .person-card.missing:last-child {
    margin-bottom: 0;
  }

  /* Card Faces */
  .card-face {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .card-face.card-front {
    z-index: 2;
  }

  .card-face.card-back {
    transform: rotateX(180deg);
  }

  .person-card:hover .card-face {
    border-color: rgba(22, 160, 133, 0.4);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Missing Card Hover */
  .person-card.missing:hover {
    border-color: rgba(239, 68, 68, 0.3);
    opacity: 0.9;
  }

  .card-content {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 100%;
  }

  .person-avatar {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: linear-gradient(135deg, #16A085 0%, #1abc9c 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    color: white;
    flex-shrink: 0;
  }

  .person-card.missing .person-avatar {
    background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  }

  .person-info {
    flex: 1;
    min-width: 0;
  }

  .person-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 4px;
    display: block;
    text-transform: capitalize;
  }

  .person-card.missing .person-name {
    color: var(--text-secondary);
  }

  .person-title-front {
    font-size: 11px;
    color: #666;
    margin-bottom: 6px;
    font-weight: 400;
    line-height: 1.4;
  }

  .person-query {
    font-size: 10px;
    color: #888;
    font-family: 'Monaco', 'Courier New', monospace;
  }

  .person-status {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .person-status.found {
    background: rgba(22, 160, 133, 0.2);
    color: #16A085;
  }

  .person-status.missing {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .person-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-left: auto;
    align-self: center;
  }

  .card-btn {
    width: 32px;
    height: 32px;
    padding: 7px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .card-btn svg {
    width: 14px;
    height: 14px;
  }

  .card-btn:hover {
    background: rgba(22, 160, 133, 0.1);
    border-color: rgba(22, 160, 133, 0.4);
    color: #16A085;
  }

  /* Snippet Back Card Styles */
  .snippet-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    overflow: hidden;
  }

  .snippet-text {
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-secondary);
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .snippet-title {
    font-weight: 600;
    margin-bottom: 4px;
    display: block;
    flex-shrink: 0;
  }

  .snippet-bio {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
  }

  .snippet-bio::-webkit-scrollbar {
    width: 0;
    background: transparent;
  }

  .snippet-stats {
    display: flex;
    gap: 16px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    margin-top: auto;
  }

  .stat-item {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .stat-value {
    font-weight: 600;
    color: var(--text-primary);
  }

  /* Term Sub-Accordion (for outlets per search term) */
  .term-sub-accordion {
    margin-bottom: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .term-sub-accordion:not(:first-child) {
    margin-top: 12px;
  }

  .term-sub-accordion:last-child {
    margin-bottom: 0;
  }

  .term-sub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .term-sub-header:hover {
    background-color: var(--bg-secondary);
  }

  /* Remove border when collapsed */
  .term-sub-accordion:has(.term-sub-content.collapsed) .term-sub-header {
    border-bottom: none;
  }

  .term-sub-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: 'Monaco', 'Courier New', monospace;
  }

  .term-sub-count {
    font-size: 11px;
    color: var(--text-secondary);
    background: rgba(22, 160, 133, 0.1);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .term-sub-content {
    padding: 8px 12px 12px 12px;
    transition: all 0.2s ease;
  }

  /* Reduce spacing between cards inside sub-accordions */
  .term-sub-content .card-wrapper {
    margin-bottom: 5px;
  }

  .term-sub-content .card-wrapper:last-child {
    margin-bottom: 0;
  }

  .term-sub-content.collapsed {
    display: none;
  }

  /* Section Action Button */
  .section-action-btn {
    margin-top: 12px;
    width: 100%;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .section-action-btn svg {
    width: 16px;
    height: 16px;
  }

  .section-action-btn.primary {
    background: rgba(22, 160, 133, 0.15);
    border-color: rgba(22, 160, 133, 0.3);
    color: #16A085;
  }

  .section-action-btn.primary:hover {
    background: rgba(22, 160, 133, 0.25);
    border-color: rgba(22, 160, 133, 0.5);
  }

  .section-action-btn.secondary {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .section-action-btn.secondary:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }
`;

/**
 * Export styles as array including shared animations and states
 */
export const searchResultsInlineStyles = [
  commonAnimations,
  commonStates,
  searchResultsInlineStylesCore
];
