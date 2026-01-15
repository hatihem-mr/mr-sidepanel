/**
 * SVG Icon Generator Utility
 *
 * Generates inline SVG icons for overlay components.
 * This is a pure utility function with no dependencies.
 *
 * @param type - The icon type (user, key, shield, mail, settings, loading, warning, error, minimize)
 * @param size - The icon size in pixels (default: 12)
 * @returns HTML string containing the SVG icon
 */
export function createSVGIcon(type: string, size: number = 12): string {
  const icons = {
    user: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">
      <circle cx="12" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M20 21a8 8 0 0 0-16 0" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    key: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">
      <circle cx="8" cy="15" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M10.85 12.15L19 4a2 2 0 0 1 3 3l-7.85 7.85" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    shield: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">
      <path d="M12 2L2 7v8c0 5.5 3.8 10.5 9 11 5.2-0.5 9-5.5 9-11V7l-10-5z" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    mail: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">
      <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="m22 7l-10 5L2 7" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    settings: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    loading: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle; animation: spin 1s linear infinite;">
      <path d="M21 12a9 9 0 1 1-6.2-8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    warning: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    error: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/>
      <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>
    </svg>`,
    minimize: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2"/>
    </svg>`
  };

  return icons[type] || icons.settings;
}
