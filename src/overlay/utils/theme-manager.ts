/**
 * Theme Management Utility
 *
 * Manages light/dark theme colors for overlay UI components.
 * - Reads theme preference from Chrome storage
 * - Falls back to system preference
 * - Caches colors to avoid async calls during overlay creation
 */

/**
 * Theme color palette interface
 */
export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  shadow: string;
}

// Theme cache to avoid async calls during overlay creation
let cachedTheme: ThemeColors | null = null;

/**
 * Initialize theme cache by reading from extension storage
 */
export async function initializeThemeCache(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings;

    let isDark = false;
    if (settings && typeof settings.darkMode === 'boolean') {
      isDark = settings.darkMode;
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    cachedTheme = isDark ? {
      bgPrimary: '#0f172a',
      bgSecondary: '#1e293b',
      bgElevated: '#1e293b',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      border: '#374151',
      shadow: 'rgba(0, 0, 0, 0.25)'
    } : {
      bgPrimary: '#ffffff',
      bgSecondary: '#f8fafc',
      bgElevated: '#ffffff',
      textPrimary: '#1e293b',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      shadow: 'rgba(0, 0, 0, 0.1)'
    };
  } catch (error) {
    // Fallback to light theme on error
    cachedTheme = {
      bgPrimary: '#ffffff',
      bgSecondary: '#f8fafc',
      bgElevated: '#ffffff',
      textPrimary: '#1e293b',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      shadow: 'rgba(0, 0, 0, 0.1)'
    };
  }
}

/**
 * Get current theme colors (synchronous, uses cache)
 */
export function getThemeColors(): ThemeColors {
  // Initialize with system preference if cache not ready
  if (!cachedTheme) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    cachedTheme = isDark ? {
      bgPrimary: '#0f172a',
      bgSecondary: '#1e293b',
      bgElevated: '#1e293b',
      textPrimary: '#f1f5f9',
      textSecondary: '#94a3b8',
      border: '#374151',
      shadow: 'rgba(0, 0, 0, 0.25)'
    } : {
      bgPrimary: '#ffffff',
      bgSecondary: '#f8fafc',
      bgElevated: '#ffffff',
      textPrimary: '#1e293b',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      shadow: 'rgba(0, 0, 0, 0.1)'
    };
  }

  return cachedTheme;
}
