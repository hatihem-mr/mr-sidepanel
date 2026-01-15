/**
 * Security configuration and settings for the extension
 */

export interface SecurityConfig {
  // API Security
  maxApiKeyLength: number;
  apiKeyValidationEnabled: boolean;
  
  // Rate Limiting
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  
  // Input Validation
  maxInputLength: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  
  // URL Security
  corsProxyEnabled: boolean;
  urlValidationStrict: boolean;
  maxUrlLength: number;
  
  // Content Security
  htmlSanitizationEnabled: boolean;
  logSensitiveData: boolean;
  
  // Storage Security
  encryptSensitiveData: boolean;
  storageQuotaWarningThreshold: number;
  
  // Feature Flags
  debugMode: boolean;
  securityAuditMode: boolean;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  // API Security
  maxApiKeyLength: 512,
  apiKeyValidationEnabled: true,
  
  // Rate Limiting
  maxRequestsPerMinute: 60,
  maxRequestsPerHour: 1000,
  
  // Input Validation
  maxInputLength: 10000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['.csv', '.txt'],
  
  // URL Security
  corsProxyEnabled: true,
  urlValidationStrict: true,
  maxUrlLength: 2048,
  
  // Content Security
  htmlSanitizationEnabled: true,
  logSensitiveData: false,
  
  // Storage Security
  encryptSensitiveData: true,
  storageQuotaWarningThreshold: 0.8, // 80% of quota
  
  // Feature Flags
  debugMode: false,
  securityAuditMode: false
};

/**
 * Security event types for logging and monitoring
 */
export enum SecurityEventType {
  INVALID_API_KEY = 'invalid_api_key',
  BLOCKED_URL_REQUEST = 'blocked_url_request',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  XSS_ATTEMPT_BLOCKED = 'xss_attempt_blocked',
  INVALID_FILE_UPLOAD = 'invalid_file_upload',
  STORAGE_QUOTA_WARNING = 'storage_quota_warning',
  SECURITY_AUDIT_ISSUE = 'security_audit_issue'
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  details: {
    message: string;
    data?: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  source: string;
}

/**
 * Security manager for the extension
 */
export class SecurityManager {
  private static config: SecurityConfig = DEFAULT_SECURITY_CONFIG;
  private static events: SecurityEvent[] = [];
  private static readonly MAX_EVENTS = 100;

  /**
   * Initialize security manager with custom config
   */
  static initialize(customConfig?: Partial<SecurityConfig>): void {
    if (customConfig) {
      this.config = { ...DEFAULT_SECURITY_CONFIG, ...customConfig };
    }
  }

  /**
   * Get current security configuration
   */
  static getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update security configuration
   */
  static updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Log security event
   */
  static logSecurityEvent(
    type: SecurityEventType,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    data?: any,
    source?: string
  ): void {
    const event: SecurityEvent = {
      type,
      timestamp: Date.now(),
      details: { message, data, severity },
      source: source || 'unknown'
    };

    this.events.unshift(event);
    
    // Keep only recent events
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(0, this.MAX_EVENTS);
    }

    // Log critical events to console
    if (severity === 'critical') {
      console.error('🚨 SECURITY EVENT:', message, data);
    } else if (severity === 'high') {
      console.warn('⚠️ SECURITY EVENT:', message, data);
    }
  }

  /**
   * Get recent security events
   */
  static getSecurityEvents(limit?: number): SecurityEvent[] {
    return limit ? this.events.slice(0, limit) : [...this.events];
  }

  /**
   * Clear security events
   */
  static clearSecurityEvents(): void {
    this.events = [];
  }

  /**
   * Check if feature is enabled based on security config
   */
  static isFeatureEnabled(feature: keyof SecurityConfig): boolean {
    return !!this.config[feature];
  }

  /**
   * Validate operation against security limits
   */
  static validateOperation(operation: {
    type: 'api_call' | 'file_upload' | 'url_request' | 'input_processing';
    data: any;
  }): { allowed: boolean; reason?: string } {
    switch (operation.type) {
      case 'api_call':
        if (operation.data?.key && operation.data.key.length > this.config.maxApiKeyLength) {
          return { allowed: false, reason: 'API key too long' };
        }
        break;
        
      case 'file_upload':
        if (operation.data?.size > this.config.maxFileSize) {
          return { allowed: false, reason: 'File too large' };
        }
        break;
        
      case 'url_request':
        if (operation.data?.url?.length > this.config.maxUrlLength) {
          return { allowed: false, reason: 'URL too long' };
        }
        break;
        
      case 'input_processing':
        if (operation.data?.input?.length > this.config.maxInputLength) {
          return { allowed: false, reason: 'Input too long' };
        }
        break;
    }
    
    return { allowed: true };
  }

  /**
   * Generate security report
   */
  static generateSecurityReport(): {
    config: SecurityConfig;
    recentEvents: SecurityEvent[];
    eventSummary: { [key: string]: number };
    securityScore: number;
  } {
    const eventSummary: { [key: string]: number } = {};
    
    // Count events by type
    this.events.forEach(event => {
      eventSummary[event.type] = (eventSummary[event.type] || 0) + 1;
    });

    // Calculate security score (0-100)
    let securityScore = 100;
    
    // Deduct points for security events
    this.events.forEach(event => {
      switch (event.details.severity) {
        case 'critical':
          securityScore -= 20;
          break;
        case 'high':
          securityScore -= 10;
          break;
        case 'medium':
          securityScore -= 5;
          break;
        case 'low':
          securityScore -= 1;
          break;
      }
    });

    securityScore = Math.max(0, securityScore);

    return {
      config: this.getConfig(),
      recentEvents: this.getSecurityEvents(10),
      eventSummary,
      securityScore
    };
  }

  /**
   * Enable security audit mode
   */
  static enableAuditMode(): void {
    this.config.securityAuditMode = true;
    this.config.debugMode = true;
    
    this.logSecurityEvent(
      SecurityEventType.SECURITY_AUDIT_ISSUE,
      'Security audit mode enabled',
      'medium',
      null,
      'SecurityManager'
    );
  }

  /**
   * Disable security audit mode
   */
  static disableAuditMode(): void {
    this.config.securityAuditMode = false;
    this.config.debugMode = false;
    
    this.logSecurityEvent(
      SecurityEventType.SECURITY_AUDIT_ISSUE,
      'Security audit mode disabled',
      'low',
      null,
      'SecurityManager'
    );
  }
}