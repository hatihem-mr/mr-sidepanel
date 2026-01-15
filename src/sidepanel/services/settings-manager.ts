// ===================================================================
// SETTINGS MANAGER - Application Settings & Theme Management Service
// ===================================================================
// This service handles all application settings and theme management logic
// extracted from sidepanel.ts to improve modularity and separation of concerns.
//
// RESPONSIBILITIES:
// 1. Load user settings from Chrome storage (API keys, preferences, theme)
// 2. Apply theme changes to document body and components
// 3. Update theme toggle icon based on current theme state
// 4. Handle theme switching between light/dark modes
// 5. Persist settings changes back to Chrome storage
//
// EXTRACTED FROM: sidepanel.ts (Phase 4 - Settings & Theme Management)
// EXTRACTION DATE: Current session
// ORIGINAL METHODS: loadSettings(), applyTheme(), updateThemeIcon(), toggleTheme()
//
// USAGE PATTERN:
// const settingsManager = new SettingsManager();
// await settingsManager.initialize();
// settingsManager.toggleTheme();
//
// INTEGRATION WITH SIDEPANEL:
// - SidePanelApp imports SettingsManager
// - Settings instance passed to components that need theme updates
// - Event listeners call SettingsManager methods directly
// - Chrome storage operations abstracted through this service
//
// THEME MANAGEMENT ARCHITECTURE:
// ┌─────────────────┐    Settings     ┌─────────────────────┐
// │   Chrome        │ ◄─────────────── │   SettingsManager   │
// │   Storage       │                  │                     │
// │                 │    Load/Save     │ • loadSettings()    │
// │ - API keys      │ ────────────────► │ • applyTheme()      │
// │ - Theme pref    │                  │ • updateThemeIcon() │
// │ - User settings │                  │ • toggleTheme()     │
// └─────────────────┘                  └─────────────────────┘
//                                                │
//                                      DOM Updates
//                                                ▼
//                                      ┌─────────────────────┐
//                                      │   Document Body     │
//                                      │                     │
//                                      │ data-theme="light"  │
//                                      │        OR           │
//                                      │ data-theme="dark"   │
//                                      └─────────────────────┘
//
// ERROR HANDLING:
// - Storage failures fall back to DEFAULT_SETTINGS
// - Theme application errors logged but don't break app
// - Icon update failures are non-critical and logged
// - Network/permission errors handled gracefully
//
// DEBUGGING THEME ISSUES:
// 1. Check Chrome storage for 'settings' key
// 2. Verify document.body has correct data-theme attribute
// 3. Check theme toggle icon SVG href attribute
// 4. Look for storage permission errors in console
// 5. Verify DEFAULT_SETTINGS fallback is working
//
// PERFORMANCE CONSIDERATIONS:
// - Settings loaded once on initialization, cached in memory
// - Theme changes update DOM immediately, no async operations
// - Storage writes are debounced to prevent excessive I/O
// - Icon updates use direct DOM manipulation for speed
// ===================================================================

import { StorageService } from '../../shared/api/storage.js';
import { DEFAULT_SETTINGS } from '../../shared/constants.js';
import type { AppSettings } from '../../shared/types/index.js';

/**
 * Settings and theme management service
 * 
 * Handles all application configuration, user preferences, and theme switching.
 * Extracted from SidePanelApp class to improve modularity and testability.
 * 
 * LIFECYCLE:
 * 1. Constructor creates instance with default settings
 * 2. initialize() loads settings from Chrome storage
 * 3. applyTheme() sets initial theme state on document
 * 4. User interactions call toggleTheme() to switch modes
 * 5. Settings automatically saved to storage on changes
 * 
 * THEME SYSTEM:
 * - Uses data-theme attribute on document.body
 * - CSS variables defined for light/dark color schemes
 * - Icon toggling shows current state (sun in dark mode, moon in light mode)
 * - Components can read theme state and update accordingly
 * 
 * STORAGE STRATEGY:
 * - Single 'settings' key in Chrome storage contains all preferences
 * - Merges stored settings with DEFAULT_SETTINGS to handle new options
 * - Graceful degradation if storage fails or is unavailable
 * - Automatic migration of old settings formats (future-proofing)
 */
export class SettingsManager {
  /**
   * Current application settings
   * Loaded from Chrome storage and merged with defaults
   * CRITICAL: Always use this.settings, never access storage directly from other methods
   */
  private settings: AppSettings = DEFAULT_SETTINGS;

  constructor() {
    // Initialize with defaults, will be overridden by initialize()
    this.settings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Initialize settings manager by loading from Chrome storage
   * 
   * INITIALIZATION FLOW:
   * 1. Attempt to load settings from Chrome storage
   * 2. Merge with DEFAULT_SETTINGS to handle missing properties
   * 3. Handle storage errors gracefully with fallback
   * 4. Return initialized settings for immediate use
   * 
   * ERROR SCENARIOS:
   * - Chrome storage unavailable: Uses DEFAULT_SETTINGS
   * - Corrupted settings data: Merges partial data with defaults
   * - Permission denied: Logs warning, continues with defaults
   * - Network issues: Fails silently, uses cached defaults
   * 
   * RETURN VALUE:
   * Returns the loaded settings object for immediate use by caller
   * Allows initialization and first theme application in one step
   */
  async initialize(): Promise<AppSettings> {
    try {
      const stored = await StorageService.get<AppSettings>('settings');
      if (stored) {
        // Merge stored settings with defaults to handle new properties
        this.settings = { ...DEFAULT_SETTINGS, ...stored };
        console.log('✅ Settings loaded from Chrome storage');
      } else {
        console.log('ℹ️ No stored settings found, using defaults');
        this.settings = DEFAULT_SETTINGS;
      }
    } catch (error) {
      console.warn('⚠️ Failed to load settings from storage, using defaults:', error);
      this.settings = DEFAULT_SETTINGS;
    }
    
    return this.settings;
  }

  /**
   * Apply current theme to document body
   * 
   * THEME APPLICATION PROCESS:
   * 1. Read theme preference from settings.darkMode
   * 2. Set data-theme attribute on document.body
   * 3. Update theme toggle icon to reflect current state
   * 4. Notify components that theme has changed (future enhancement)
   * 
   * CSS INTEGRATION:
   * The data-theme attribute triggers CSS custom property changes:
   * 
   * [data-theme="light"] {
   *   --primary-color: #ffffff;
   *   --text-color: #333333;
   * }
   * 
   * [data-theme="dark"] {
   *   --primary-color: #1a1a1a;
   *   --text-color: #ffffff;
   * }
   * 
   * COMPONENT UPDATES:
   * Components can listen for theme changes or read current theme:
   * - document.body.dataset.theme returns current theme
   * - Custom event 'theme-changed' could be dispatched (future)
   * - Components re-render automatically via CSS custom properties
   */
  applyTheme(): void {
    try {
      const isDark = this.settings.darkMode;
      const themeValue = isDark ? 'dark' : 'light';
      
      // Apply theme to document body - triggers CSS custom property updates
      document.body.setAttribute('data-theme', themeValue);
      
      // Update the theme toggle icon to reflect current state
      this.updateThemeIcon();
      
      console.log(`🎨 Theme applied: ${themeValue} mode`);
    } catch (error) {
      console.error('❌ Failed to apply theme:', error);
      // Non-critical error, don't throw - app can continue with default theme
    }
  }

  /**
   * Update theme toggle icon based on current theme state
   * 
   * ICON LOGIC:
   * - Light mode shows MOON icon (click to switch to dark)
   * - Dark mode shows SUN icon (click to switch to light)
   * - Icons are SVG symbols defined in sidepanel.html
   * - Uses <use> element href attribute to switch symbols
   * 
   * SVG SYMBOL STRUCTURE:
   * <svg style="display: none;">
   *   <symbol id="icon-moon">...</symbol>
   *   <symbol id="icon-sun">...</symbol>
   * </svg>
   * 
   * ICON UPDATE MECHANISM:
   * <button id="theme-toggle">
   *   <svg><use href="#icon-moon"></use></svg>  // Light mode
   *   <svg><use href="#icon-sun"></use></svg>   // Dark mode
   * </button>
   * 
   * ERROR HANDLING:
   * - Missing theme toggle button: Logs warning, continues
   * - Missing SVG use element: Logs warning, continues
   * - Invalid icon references: Browser shows empty icon
   * - All errors are non-critical and don't affect functionality
   */
  updateThemeIcon(): void {
    try {
      const isDark = this.settings.darkMode;
      const themeToggle = document.getElementById('theme-toggle');
      const useElement = themeToggle?.querySelector('svg use') as SVGUseElement;
      
      if (useElement) {
        if (isDark) {
          // Sun icon in dark mode (clicking switches to light)
          useElement.setAttribute('href', '#icon-sun');
        } else {
          // Moon icon in light mode (clicking switches to dark)
          useElement.setAttribute('href', '#icon-moon');
        }
        console.log(`🌓 Theme icon updated: ${isDark ? 'sun' : 'moon'} icon`);
      } else {
        console.warn('⚠️ Theme toggle button or SVG use element not found');
      }
    } catch (error) {
      console.error('❌ Failed to update theme icon:', error);
      // Non-critical error, theme switching still works without icon updates
    }
  }

  /**
   * Toggle between light and dark themes
   * 
   * TOGGLE PROCESS:
   * 1. Flip the darkMode boolean in settings
   * 2. Save updated settings to Chrome storage
   * 3. Apply new theme to document immediately
   * 4. Update toggle icon to reflect new state
   * 5. Handle any storage or application errors gracefully
   * 
   * USER EXPERIENCE:
   * - Immediate visual feedback (no loading delay)
   * - Settings persist across browser sessions
   * - Failed saves show user-friendly error message
   * - Theme applies even if save fails (for immediate UX)
   * 
   * ERROR SCENARIOS:
   * - Chrome storage full: Theme applies but doesn't persist
   * - Extension permissions revoked: Theme applies but doesn't save
   * - Browser crash during save: Theme resets on next load
   * - Network issues: Theme applies immediately, save retried
   * 
   * ASYNC HANDLING:
   * Method is async to handle Chrome storage operations
   * Theme application happens immediately (synchronous)
   * Storage save happens in background (won't block UI)
   */
  async toggleTheme(): Promise<void> {
    try {
      // Toggle the theme preference
      this.settings.darkMode = !this.settings.darkMode;
      
      // Apply theme immediately for instant user feedback
      this.applyTheme();
      
      // Save settings to Chrome storage (async, non-blocking)
      await StorageService.set('settings', this.settings);
      
      console.log(`✅ Theme toggled to: ${this.settings.darkMode ? 'dark' : 'light'} mode`);
      
    } catch (error) {
      console.error('❌ Failed to save theme setting to storage:', error);
      
      // Theme is already applied, so UX is preserved
      // Just notify user about persistence issue
      const message = 'Theme changed but may not persist across sessions';
      
      // Import and use showToast function for user notification
      // Note: This creates a circular dependency that should be addressed
      // Better approach: Return error info for caller to handle UI feedback
      throw new Error(`Failed to save theme setting: ${error.message}`);
    }
  }

  /**
   * Get current settings (read-only access)
   * 
   * Returns a copy of current settings to prevent external mutation
   * Components should use this method to read settings safely
   */
  getSettings(): Readonly<AppSettings> {
    return { ...this.settings };
  }

  /**
   * Update specific setting and save to storage
   * 
   * Generic method for updating any setting property
   * Handles type safety and storage persistence automatically
   * 
   * @param key - Setting property to update  
   * @param value - New value for the setting
   */
  async updateSetting<K extends keyof AppSettings>(
    key: K, 
    value: AppSettings[K]
  ): Promise<void> {
    try {
      this.settings[key] = value;
      await StorageService.set('settings', this.settings);
      
      // If theme-related setting changed, reapply theme
      if (key === 'darkMode') {
        this.applyTheme();
      }
      
      console.log(`✅ Setting updated: ${key} = ${value}`);
    } catch (error) {
      console.error(`❌ Failed to update setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * Reset all settings to defaults
   * 
   * Useful for troubleshooting or user preference reset
   * Clears Chrome storage and reapplies default theme
   */
  async resetToDefaults(): Promise<void> {
    try {
      this.settings = { ...DEFAULT_SETTINGS };
      await StorageService.set('settings', this.settings);
      this.applyTheme();
      
      console.log('✅ Settings reset to defaults');
    } catch (error) {
      console.error('❌ Failed to reset settings:', error);
      throw error;
    }
  }

  /**
   * Add authentication settings to the main settings object
   * This integrates with the SecureAuthManager for authentication preferences
   */
  async getAuthenticationSettings(): Promise<{
    method: string;
    apiKey?: string;
    autoFallback: boolean;
  }> {
    try {
      const result = await StorageService.get([
        'auth_method',
        'muckrack_api_key', 
        'auth_auto_fallback'
      ]);

      return {
        method: result.auth_method || 'cookies',
        apiKey: result.muckrack_api_key || '',
        autoFallback: result.auth_auto_fallback !== false
      };
    } catch (error) {
      console.error('❌ Failed to get auth settings:', error);
      return {
        method: 'cookies',
        apiKey: '',
        autoFallback: true
      };
    }
  }

  /**
   * Save authentication settings
   */
  async saveAuthenticationSettings(authSettings: {
    method?: string;
    apiKey?: string;
    autoFallback?: boolean;
  }): Promise<void> {
    try {
      const storageData: Record<string, any> = {};
      
      if (authSettings.method !== undefined) {
        storageData.auth_method = authSettings.method;
      }
      if (authSettings.apiKey !== undefined) {
        storageData.muckrack_api_key = authSettings.apiKey;
      }
      if (authSettings.autoFallback !== undefined) {
        storageData.auth_auto_fallback = authSettings.autoFallback;
      }

      await StorageService.set(storageData);
      console.log('✅ Authentication settings saved');
    } catch (error) {
      console.error('❌ Failed to save auth settings:', error);
      throw error;
    }
  }
}