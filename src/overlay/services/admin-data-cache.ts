import { debug } from '../../shared/utils/debug.js';
/**
 * Admin Data Cache Manager
 *
 * Manages caching of admin API responses in Chrome storage with LRU eviction.
 * - 1-hour cache expiration
 * - Max 10 entries (most recent kept)
 * - Chrome storage based for persistence
 */

/**
 * Structure of the entire cache in Chrome storage
 */
export interface AdminDataCache {
  [email: string]: {
    data: any;           // The full admin response
    timestamp: number;   // When cached
    expiresAt: number;   // Cache expiration
  }
}

/**
 * Structure of a single cached entry
 */
export interface CachedAdminData {
  data: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * Manages Chrome storage caching for admin API responses
 */
export class AdminDataCacheManager {
  private static readonly CACHE_KEY = 'admin_data_cache';
  private static readonly MAX_CACHE_ENTRIES = 10; // Limit to 10 most recent entries
  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  /**
   * Get cached admin data for an email
   */
  static async getCachedData(email: string): Promise<any | null> {
    try {
      const result = await chrome.storage.local.get(this.CACHE_KEY);
      const cache: AdminDataCache = result[this.CACHE_KEY] || {};

      const cachedEntry = cache[email];
      if (cachedEntry && Date.now() < cachedEntry.expiresAt) {
        return cachedEntry.data;
      } else if (cachedEntry) {
        debug.log('⚠️ Cache EXPIRED for', email, '- will fetch fresh data');
        // Clean up expired entry
        delete cache[email];
        await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
      } else {
        debug.log('❌ Cache MISS for', email, '- will fetch fresh data');
      }

      return null;
    } catch (error) {
      debug.error('❌ Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Cache admin data for an email with LRU eviction
   */
  static async setCachedData(email: string, data: any): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.CACHE_KEY);
      const cache: AdminDataCache = result[this.CACHE_KEY] || {};

      // Add new entry
      const now = Date.now();
      cache[email] = {
        data: data,
        timestamp: now,
        expiresAt: now + this.CACHE_DURATION
      };

      // Implement LRU eviction - keep only the most recent MAX_CACHE_ENTRIES
      const entries = Object.entries(cache)
        .sort(([,a], [,b]) => b.timestamp - a.timestamp) // Sort by timestamp descending (newest first)
        .slice(0, this.MAX_CACHE_ENTRIES); // Keep only the most recent entries

      const prunedCache: AdminDataCache = {};
      entries.forEach(([key, value]) => {
        prunedCache[key] = value;
      });

      await chrome.storage.local.set({ [this.CACHE_KEY]: prunedCache });

    } catch (error) {
      debug.error('❌ Error writing to cache:', error);
    }
  }

  /**
   * Clear all cached admin data
   */
  static async clearCache(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.CACHE_KEY);
      debug.log('🧹 Admin data cache cleared');
    } catch (error) {
      debug.error('❌ Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  static async getCacheStats(): Promise<{ size: number; entries: string[] }> {
    try {
      const result = await chrome.storage.local.get(this.CACHE_KEY);
      const cache: AdminDataCache = result[this.CACHE_KEY] || {};
      const entries = Object.keys(cache);
      return { size: entries.length, entries };
    } catch (error) {
      debug.error('❌ Error getting cache stats:', error);
      return { size: 0, entries: [] };
    }
  }
}
