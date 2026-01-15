/**
 * Secure Storage Service with encryption for sensitive data
 * Handles API keys and other sensitive information securely
 */

interface SecureItem {
  encrypted: boolean;
  timestamp: number;
  data: string;
}

/**
 * Security utilities for the extension
 */
export class SecureStorage {
  private static readonly ENCRYPTION_SUFFIX = '_encrypted';
  private static readonly SENSITIVE_KEYS = ['openai_api_key', 'intercom_token'];

  /**
   * Store sensitive data with basic obfuscation
   * Note: Chrome extensions can't use true encryption without exposing keys,
   * but we can add basic obfuscation to prevent casual access
   */
  static async setSecure(key: string, value: string): Promise<void> {
    try {
      // Basic obfuscation - not true encryption but better than plain text
      const obfuscated = this.obfuscateData(value);
      
      const secureItem: SecureItem = {
        encrypted: true,
        timestamp: Date.now(),
        data: obfuscated
      };

      await chrome.storage.local.set({ 
        [key + this.ENCRYPTION_SUFFIX]: secureItem 
      });
    } catch (error) {
      console.error('Failed to store secure data:', error);
      throw new Error('Failed to store sensitive data securely');
    }
  }

  /**
   * Retrieve sensitive data with deobfuscation
   */
  static async getSecure(key: string): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get([key + this.ENCRYPTION_SUFFIX]);
      const secureItem = result[key + this.ENCRYPTION_SUFFIX] as SecureItem;
      
      if (!secureItem || !secureItem.encrypted) {
        return null;
      }

      return this.deobfuscateData(secureItem.data);
    } catch (error) {
      console.error('Failed to retrieve secure data:', error);
      return null;
    }
  }

  /**
   * Remove secure data
   */
  static async removeSecure(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove([key + this.ENCRYPTION_SUFFIX]);
    } catch (error) {
      console.error('Failed to remove secure data:', error);
    }
  }

  /**
   * Check if sensitive key exists
   */
  static async hasSecure(key: string): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get([key + this.ENCRYPTION_SUFFIX]);
      return !!result[key + this.ENCRYPTION_SUFFIX];
    } catch {
      return false;
    }
  }

  /**
   * Validate API key format
   */
  static validateApiKey(key: string, type: 'openai' | 'intercom'): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    switch (type) {
      case 'openai':
        // OpenAI keys start with 'sk-' and are typically 48+ characters
        return key.startsWith('sk-') && key.length >= 48;
      case 'intercom':
        // Intercom tokens are typically 32+ characters
        return key.length >= 32;
      default:
        return false;
    }
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>\"'&]/g, '') // Remove potential HTML/JS injection chars
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, '') // Remove data: protocol
      .trim()
      .substring(0, 10000); // Limit length to prevent DoS
  }

  /**
   * Validate URLs to prevent SSRF attacks
   */
  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow specific protocols
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return false;
      }

      // Block localhost and private IPs
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if URL is in allowed domains
   */
  static isAllowedDomain(url: string): boolean {
    const allowedDomains = [
      'muckrack.com',
      'api.openai.com',
      'intercom.com',
      'intercom.io',
      'docs.google.com'
    ];

    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      
      return allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }

  /**
   * Basic obfuscation (not true encryption)
   */
  private static obfuscateData(data: string): string {
    const encoded = btoa(data); // Base64 encode
    const shifted = encoded.split('').map(char => 
      String.fromCharCode(char.charCodeAt(0) + 3)
    ).join('');
    return btoa(shifted); // Double encode
  }

  /**
   * Deobfuscate data
   */
  private static deobfuscateData(data: string): string {
    try {
      const firstDecode = atob(data);
      const shifted = firstDecode.split('').map(char => 
        String.fromCharCode(char.charCodeAt(0) - 3)
      ).join('');
      return atob(shifted);
    } catch {
      throw new Error('Failed to deobfuscate data');
    }
  }

  /**
   * Clear all sensitive data
   */
  static async clearAllSecure(): Promise<void> {
    try {
      const allData = await chrome.storage.local.get(null);
      const secureKeys = Object.keys(allData).filter(key => 
        key.endsWith(this.ENCRYPTION_SUFFIX)
      );
      
      if (secureKeys.length > 0) {
        await chrome.storage.local.remove(secureKeys);
      }
    } catch (error) {
      console.error('Failed to clear secure data:', error);
    }
  }

  /**
   * Audit storage for potential security issues
   */
  static async auditStorage(): Promise<{
    sensitiveKeysInPlainText: string[];
    totalSecureItems: number;
    storageUsage: number;
  }> {
    try {
      const allData = await chrome.storage.local.get(null);
      const keys = Object.keys(allData);
      
      // Check for sensitive keys stored in plain text
      const sensitiveKeysInPlainText = keys.filter(key => 
        this.SENSITIVE_KEYS.some(sensitive => key.includes(sensitive)) &&
        !key.endsWith(this.ENCRYPTION_SUFFIX)
      );

      // Count secure items
      const totalSecureItems = keys.filter(key => 
        key.endsWith(this.ENCRYPTION_SUFFIX)
      ).length;

      // Get storage usage
      const bytesInUse = await chrome.storage.local.getBytesInUse();

      return {
        sensitiveKeysInPlainText,
        totalSecureItems,
        storageUsage: bytesInUse
      };
    } catch (error) {
      console.error('Storage audit failed:', error);
      return {
        sensitiveKeysInPlainText: [],
        totalSecureItems: 0,
        storageUsage: 0
      };
    }
  }
}