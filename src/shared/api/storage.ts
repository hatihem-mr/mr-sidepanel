import type { StorageOptions, StorageResult } from '../types/index.js';

/**
 * Chrome Storage Service with enhanced error handling and retry logic
 */
export class StorageService {
  /**
   * Default storage options
   */
  private static readonly DEFAULT_OPTIONS: StorageOptions = {
    maxRetries: 3,
    retryDelay: 100,
    timeout: 5000
  };

  /**
   * Get data from Chrome storage
   */
  static async get<T>(key: string, options?: StorageOptions): Promise<T | null> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        const result = await Promise.race([
          chrome.storage.local.get([key]),
          this.createTimeoutPromise(opts.timeout!)
        ]);
        
        return result[key] !== undefined ? result[key] : null;
      } catch (error) {
        console.warn(`Storage get attempt ${attempt + 1} failed for key "${key}":`, error);
        
        if (attempt === opts.maxRetries) {
          throw new Error(`Failed to retrieve ${key} after ${opts.maxRetries! + 1} attempts: ${error.message}`);
        }
        
        if (opts.retryDelay! > 0) {
          await this.delay(opts.retryDelay!);
        }
      }
    }
    
    return null;
  }

  /**
   * Set data in Chrome storage
   */
  static async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        await Promise.race([
          chrome.storage.local.set({ [key]: value }),
          this.createTimeoutPromise(opts.timeout!)
        ]);
        
        return;
      } catch (error) {
        console.warn(`Storage set attempt ${attempt + 1} failed for key "${key}":`, error);
        
        if (attempt === opts.maxRetries) {
          throw new Error(`Failed to store ${key} after ${opts.maxRetries! + 1} attempts: ${error.message}`);
        }
        
        if (opts.retryDelay! > 0) {
          await this.delay(opts.retryDelay!);
        }
      }
    }
  }

  /**
   * Remove data from Chrome storage
   */
  static async remove(key: string, options?: StorageOptions): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        await Promise.race([
          chrome.storage.local.remove([key]),
          this.createTimeoutPromise(opts.timeout!)
        ]);
        
        return;
      } catch (error) {
        console.warn(`Storage remove attempt ${attempt + 1} failed for key "${key}":`, error);
        
        if (attempt === opts.maxRetries) {
          throw new Error(`Failed to remove ${key} after ${opts.maxRetries! + 1} attempts: ${error.message}`);
        }
        
        if (opts.retryDelay! > 0) {
          await this.delay(opts.retryDelay!);
        }
      }
    }
  }

  /**
   * Clear all storage data
   */
  static async clear(options?: StorageOptions): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        await Promise.race([
          chrome.storage.local.clear(),
          this.createTimeoutPromise(opts.timeout!)
        ]);
        
        return;
      } catch (error) {
        console.warn(`Storage clear attempt ${attempt + 1} failed:`, error);
        
        if (attempt === opts.maxRetries) {
          throw new Error(`Failed to clear storage after ${opts.maxRetries! + 1} attempts: ${error.message}`);
        }
        
        if (opts.retryDelay! > 0) {
          await this.delay(opts.retryDelay!);
        }
      }
    }
  }

  /**
   * Get multiple keys at once
   */
  static async getMultiple<T extends Record<string, any>>(keys: string[], options?: StorageOptions): Promise<Partial<T>> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        const result = await Promise.race([
          chrome.storage.local.get(keys),
          this.createTimeoutPromise(opts.timeout!)
        ]);
        
        return result as Partial<T>;
      } catch (error) {
        console.warn(`Storage getMultiple attempt ${attempt + 1} failed:`, error);
        
        if (attempt === opts.maxRetries) {
          throw new Error(`Failed to retrieve multiple keys after ${opts.maxRetries! + 1} attempts: ${error.message}`);
        }
        
        if (opts.retryDelay! > 0) {
          await this.delay(opts.retryDelay!);
        }
      }
    }
    
    return {};
  }

  /**
   * Set multiple key-value pairs at once
   */
  static async setMultiple<T extends Record<string, any>>(data: T, options?: StorageOptions): Promise<void> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        await Promise.race([
          chrome.storage.local.set(data),
          this.createTimeoutPromise(opts.timeout!)
        ]);
        
        return;
      } catch (error) {
        console.warn(`Storage setMultiple attempt ${attempt + 1} failed:`, error);
        
        if (attempt === opts.maxRetries) {
          throw new Error(`Failed to store multiple keys after ${opts.maxRetries! + 1} attempts: ${error.message}`);
        }
        
        if (opts.retryDelay! > 0) {
          await this.delay(opts.retryDelay!);
        }
      }
    }
  }

  /**
   * Get all stored data
   */
  static async getAll<T extends Record<string, any>>(options?: StorageOptions): Promise<T> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
      try {
        const result = await Promise.race([
          chrome.storage.local.get(null),
          this.createTimeoutPromise(opts.timeout!)
        ]);
        
        return result as T;
      } catch (error) {
        console.warn(`Storage getAll attempt ${attempt + 1} failed:`, error);
        
        if (attempt === opts.maxRetries) {
          throw new Error(`Failed to retrieve all data after ${opts.maxRetries! + 1} attempts: ${error.message}`);
        }
        
        if (opts.retryDelay! > 0) {
          await this.delay(opts.retryDelay!);
        }
      }
    }
    
    return {} as T;
  }

  /**
   * Check if a key exists
   */
  static async has(key: string, options?: StorageOptions): Promise<boolean> {
    try {
      const result = await this.get(key, options);
      return result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get storage usage information
   */
  static async getUsage(): Promise<{ bytesInUse: number; quota: number }> {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES;
      
      return { bytesInUse, quota };
    } catch (error) {
      console.warn('Failed to get storage usage:', error);
      return { bytesInUse: 0, quota: 0 };
    }
  }

  /**
   * Safe storage operations with error handling
   */
  static async safeGet<T>(key: string, defaultValue: T, options?: StorageOptions): Promise<T> {
    try {
      const result = await this.get<T>(key, options);
      return result !== null ? result : defaultValue;
    } catch (error) {
      console.warn(`Failed to get ${key}, using default:`, error);
      return defaultValue;
    }
  }

  /**
   * Safe set operation that doesn't throw
   */
  static async safeSet<T>(key: string, value: T, options?: StorageOptions): Promise<boolean> {
    try {
      await this.set(key, value, options);
      return true;
    } catch (error) {
      console.warn(`Failed to set ${key}:`, error);
      return false;
    }
  }

  /**
   * Update existing data with new properties
   */
  static async update<T extends Record<string, any>>(key: string, updates: Partial<T>, options?: StorageOptions): Promise<T> {
    const existing = await this.get<T>(key, options) || {} as T;
    const updated = { ...existing, ...updates };
    await this.set(key, updated, options);
    return updated;
  }

  /**
   * Add item to array in storage
   */
  static async pushToArray<T>(key: string, item: T, maxLength?: number, options?: StorageOptions): Promise<T[]> {
    const existing = await this.get<T[]>(key, options) || [];
    existing.unshift(item); // Add to beginning
    
    if (maxLength && existing.length > maxLength) {
      existing.splice(maxLength);
    }
    
    await this.set(key, existing, options);
    return existing;
  }

  /**
   * Remove item from array in storage
   */
  static async removeFromArray<T>(key: string, predicate: (item: T, index: number) => boolean, options?: StorageOptions): Promise<T[]> {
    const existing = await this.get<T[]>(key, options) || [];
    const filtered = existing.filter((item, index) => !predicate(item, index));
    await this.set(key, filtered, options);
    return filtered;
  }

  /**
   * Create a timeout promise
   */
  private static createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Storage operation timed out after ${timeout}ms`)), timeout);
    });
  }

  /**
   * Delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Listen for storage changes
   */
  static addChangeListener(callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void): void {
    chrome.storage.onChanged.addListener(callback);
  }

  /**
   * Remove storage change listener
   */
  static removeChangeListener(callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void): void {
    chrome.storage.onChanged.removeListener(callback);
  }
}