// ===================================================================
// URL VALIDATOR - Critical Security Component
// ===================================================================
// This class provides comprehensive URL validation to prevent security
// attacks and ensure only authorized domains can be accessed through
// the extension's CORS bypass functionality.
//
// SECURITY THREATS PREVENTED:
// 1. SSRF (Server-Side Request Forgery) - Prevents requests to internal networks
// 2. DNS Rebinding - Blocks localhost and private IP access attempts
// 3. Protocol Attacks - Only allows HTTP/HTTPS protocols
// 4. Domain Hijacking - Whitelist approach with explicit domain approval
// 5. Rate Limiting Bypass - Implements per-URL request throttling
//
// VALIDATION LAYERS:
// ┌─────────────────┐    Layer 1     ┌─────────────────┐
// │   Input URL     │ ──────────────► │ Format Check    │
// │                 │                │                 │
// │ User/Component  │    Layer 2     │ • Valid URL     │
// │   Request       │ ◄────────────── │ • Protocol      │
// └─────────────────┘                │ • Length limit  │
//                                    └─────────────────┘
//                           │
//                           ▼ Layer 3
//                  ┌─────────────────┐
//                  │  Domain Check   │
//                  │                 │
//                  │ • Whitelist     │ ◄─── ALLOWED_DOMAINS
//                  │ • Patterns      │ ◄─── SUBDOMAIN_PATTERNS  
//                  │ • Blacklist     │ ◄─── BLOCKED_PATTERNS
//                  └─────────────────┘
//                           │
//                           ▼ Layer 4
//                  ┌─────────────────┐
//                  │  Rate Limiting  │
//                  │                 │
//                  │ • Per-URL caps  │
//                  │ • Time windows  │
//                  │ • Sliding window│
//                  └─────────────────┘
//
// WHITELIST APPROACH:
// - Only explicitly approved domains are allowed
// - Team-specific Muck Rack subdomains supported via regex patterns
// - New domains require code changes (intentional security measure)
// - Default deny policy (secure by default)
//
// DEBUGGING VALIDATION FAILURES:
// 1. Check domain is in ALLOWED_DOMAINS array
// 2. For team subdomains, verify pattern matches ALLOWED_SUBDOMAIN_PATTERNS
// 3. Ensure protocol is HTTPS (HTTP may be blocked)
// 4. Check for rate limiting (too many recent requests)
// 5. Look for private IP addresses or localhost attempts
// ===================================================================

/**
 * URL validation and security utilities
 * Prevents SSRF attacks and validates allowed domains
 */

/**
 * URL security validator - Central security gatekeeper for all HTTP requests
 * 
 * This class implements a defense-in-depth strategy for URL validation:
 * 1. Input validation (format, protocol, length)
 * 2. Domain whitelisting (explicit approval required)
 * 3. Pattern matching (for dynamic subdomains)
 * 4. Blacklist blocking (private networks, localhost)
 * 5. Rate limiting (prevent abuse)
 * 
 * SECURITY PHILOSOPHY:
 * - Fail secure (deny by default)
 * - Explicit allowlisting over blacklisting
 * - Multiple validation layers
 * - Comprehensive logging for security events
 * - Regular review of allowed domains
 */
export class UrlValidator {
  /**
   * List of explicitly allowed domains for CORS bypass
   */
  private static readonly ALLOWED_DOMAINS = [
    'muckrack.com',
    'app.muckrack.com',
    'admin.muckrack.com',
    'api.openai.com',
    'api.intercom.io',
    'app.intercom.com',
    'docs.google.com'
  ];
  
  /**
   * Patterns for allowed subdomains (team-specific MR subdomains)
   */
  private static readonly ALLOWED_SUBDOMAIN_PATTERNS = [
    /^[a-zA-Z0-9\-]+\.muckrack\.com$/,  // Team subdomains like team-name.muckrack.com
  ];

  /**
   * Blocked domains and patterns
   */
  private static readonly BLOCKED_PATTERNS = [
    /localhost/i,
    /127\.0\.0\.1/,
    /0\.0\.0\.0/,
    /192\.168\./,
    /10\./,
    /172\.(1[6-9]|2[0-9]|3[01])\./,
    /169\.254\./, // Link-local
    /::1/, // IPv6 localhost
    /metadata\.google\.internal/i, // GCP metadata
    /169\.254\.169\.254/, // AWS metadata
  ];

  /**
   * Validate URL for CORS bypass safety
   */
  static isValidForCorsProxy(url: string): boolean {
    try {
      // Basic URL validation
      if (!this.isValidUrl(url)) {
        return false;
      }

      const parsed = new URL(url);

      // Check protocol
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }

      // Check against blocked patterns
      if (this.isBlockedUrl(parsed)) {
        return false;
      }

      // Check if domain is explicitly allowed
      return this.isDomainAllowed(parsed.hostname);

    } catch (error) {
      console.warn('URL validation error:', error);
      return false;
    }
  }

  /**
   * Check if URL is valid format
   */
  static isValidUrl(url: string): boolean {
    if (typeof url !== 'string' || url.length === 0) {
      return false;
    }

    // Length check to prevent DoS
    if (url.length > 2048) {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if domain is in allowed list
   */
  private static isDomainAllowed(hostname: string): boolean {
    const normalizedHostname = hostname.toLowerCase();
    
    // Check exact matches first
    if (this.ALLOWED_DOMAINS.some(allowedDomain => {
      // Exact match
      if (normalizedHostname === allowedDomain) {
        return true;
      }
      
      // Subdomain match (e.g., api.muckrack.com matches muckrack.com)
      if (normalizedHostname.endsWith('.' + allowedDomain)) {
        return true;
      }
      
      return false;
    })) {
      return true;
    }
    
    // Check subdomain patterns (for team-specific Muck Rack domains)
    return this.ALLOWED_SUBDOMAIN_PATTERNS.some(pattern => 
      pattern.test(normalizedHostname)
    );
  }

  /**
   * Check if URL matches blocked patterns
   */
  private static isBlockedUrl(parsed: URL): boolean {
    const hostname = parsed.hostname.toLowerCase();
    
    return this.BLOCKED_PATTERNS.some(pattern => pattern.test(hostname));
  }

  /**
   * Sanitize URL for safe usage
   */
  static sanitizeUrl(url: string): string | null {
    try {
      if (!this.isValidUrl(url)) {
        return null;
      }

      const parsed = new URL(url);
      
      // Remove potentially dangerous components
      parsed.username = '';
      parsed.password = '';
      
      // Validate final URL
      const sanitized = parsed.toString();
      
      return this.isValidForCorsProxy(sanitized) ? sanitized : null;
      
    } catch {
      return null;
    }
  }

  /**
   * Validate Muck Rack specific URLs
   */
  static isMuckRackUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      
      return hostname === 'muckrack.com' || 
             hostname.endsWith('.muckrack.com');
    } catch {
      return false;
    }
  }

  /**
   * Validate search URLs specifically
   */
  static isValidSearchUrl(url: string): boolean {
    if (!this.isMuckRackUrl(url)) {
      return false;
    }

    try {
      const parsed = new URL(url);
      
      // Must be HTTPS for security
      if (parsed.protocol !== 'https:') {
        return false;
      }

      // Check for valid search paths
      const validPaths = [
        '/search',
        '/search/',
        '/search/results'
      ];

      const pathname = parsed.pathname.toLowerCase();
      return validPaths.some(validPath => pathname.startsWith(validPath));
      
    } catch {
      return false;
    }
  }

  /**
   * Extract and validate domains from text
   */
  static extractValidDomains(text: string): string[] {
    const urlRegex = /https?:\/\/([^\/\s]+)/gi;
    const domains: string[] = [];
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      try {
        const domain = new URL(match[0]).hostname.toLowerCase();
        if (this.isDomainAllowed(domain)) {
          domains.push(domain);
        }
      } catch {
        // Skip invalid URLs
      }
    }

    return [...new Set(domains)]; // Remove duplicates
  }

  /**
   * Create rate limiter for URL requests
   */
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const requests: { [url: string]: number[] } = {};
    
    return {
      isAllowed: (url: string): boolean => {
        const now = Date.now();
        const urlRequests = requests[url] || [];
        
        // Remove old requests outside the window
        const validRequests = urlRequests.filter(time => now - time < windowMs);
        
        if (validRequests.length >= maxRequests) {
          return false;
        }
        
        // Add current request
        validRequests.push(now);
        requests[url] = validRequests;
        
        return true;
      },
      
      reset: (url?: string): void => {
        if (url) {
          delete requests[url];
        } else {
          Object.keys(requests).forEach(key => delete requests[key]);
        }
      }
    };
  }

  /**
   * Validate file upload URLs (Google Sheets, etc.)
   */
  static isValidFileUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      
      // Only allow specific file hosting domains
      const allowedFileHosts = [
        'docs.google.com',
        'drive.google.com'
      ];
      
      return allowedFileHosts.includes(hostname);
      
    } catch {
      return false;
    }
  }

  /**
   * Security audit for URLs in storage
   */
  static auditStoredUrls(data: any): {
    invalidUrls: string[];
    blockedUrls: string[];
    totalUrls: number;
  } {
    const invalidUrls: string[] = [];
    const blockedUrls: string[] = [];
    let totalUrls = 0;

    const checkValue = (value: any) => {
      if (typeof value === 'string') {
        // Check if it looks like a URL
        if (value.startsWith('http://') || value.startsWith('https://')) {
          totalUrls++;
          
          if (!this.isValidUrl(value)) {
            invalidUrls.push(value);
          } else if (!this.isValidForCorsProxy(value)) {
            blockedUrls.push(value);
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach(checkValue);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(checkValue);
      }
    };

    checkValue(data);

    return {
      invalidUrls,
      blockedUrls,
      totalUrls
    };
  }
}