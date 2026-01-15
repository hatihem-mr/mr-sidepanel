/**
 * Collapsible Section UI Utilities
 *
 * Creates expandable/collapsible sections for admin overlay panels.
 * Used to organize admin data into categorized, toggleable groups.
 */

import { ThemeColors, getThemeColors } from './theme-manager.js';

/**
 * Create a collapsible section with header and items
 *
 * @param title - Section title text
 * @param items - Array of HTML strings to display as items
 * @param icon - SVG icon HTML string
 * @param expanded - Whether section starts expanded (default: false)
 * @param theme - Optional theme colors (defaults to current theme)
 * @returns HTML string for the collapsible section
 */
export function createCollapsibleSection(title: string, items: string[], icon: string, expanded: boolean = false, theme?: ThemeColors): string {
  if (!theme) theme = getThemeColors();
  const sectionId = `section-${Math.random().toString(36).substring(2, 15)}`;
  const expandedClass = expanded ? 'expanded' : 'collapsed';

  return `
    <div class="admin-section ${expandedClass}" data-section-id="${sectionId}">
      <div class="admin-section-header" style="
        background: ${theme.bgSecondary};
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid ${theme.border};
        font-size: 12px;
        font-weight: 500;
        color: ${theme.textPrimary};
      ">
        <span>${icon} ${title}</span>
        <span class="toggle-icon" style="font-size: 10px; transition: transform 0.2s;">${expanded ? '▼' : '▶'}</span>
      </div>
      <div class="admin-section-content" style="
        display: ${expanded ? 'block' : 'none'};
        background: ${theme.bgElevated};
        border: 1px solid ${theme.border};
        border-top: none;
        border-radius: 0 0 6px 6px;
        padding: ${expanded ? '4px 8px' : '0'};
      ">
        <div style="display: grid; gap: 2px;">
          ${items.map(item => `
            <div style="font-size: 12px; padding: 2px 0; color: ${theme.textPrimary}; word-break: break-word; line-height: 1.4;">
              ${item}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Setup click handlers for collapsible sections
 *
 * Attaches event listeners to section headers to enable expand/collapse functionality.
 *
 * @param container - DOM element containing collapsible sections
 */
export function setupCollapsibleHandlers(container: HTMLElement): void {
  const headers = container.querySelectorAll('.admin-section-header');

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      const content = section?.querySelector('.admin-section-content');
      const toggleIcon = header.querySelector('.toggle-icon');

      if (!section || !content || !toggleIcon) return;

      const isExpanded = section.classList.contains('expanded');

      if (isExpanded) {
        // Collapse
        section.classList.remove('expanded');
        section.classList.add('collapsed');
        (content as HTMLElement).style.display = 'none';
        (content as HTMLElement).style.padding = '0';
        toggleIcon.textContent = '▶';
      } else {
        // Expand
        section.classList.remove('collapsed');
        section.classList.add('expanded');
        (content as HTMLElement).style.display = 'block';
        (content as HTMLElement).style.padding = '8px';
        toggleIcon.textContent = '▼';
      }
    });
  });
}
