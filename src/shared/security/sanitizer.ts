/**
 * Input sanitization utilities to prevent XSS and injection attacks
 */

/**
 * HTML sanitization utility
 */
export class Sanitizer {
  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(html: string): string {
    if (typeof html !== 'string') {
      return '';
    }

    // Create a temporary DOM element to parse HTML safely
    const temp = document.createElement('div');
    temp.textContent = html; // This escapes all HTML
    return temp.innerHTML;
  }

  /**
   * Safe innerHTML replacement that sanitizes content
   */
  static safeSetInnerHTML(element: Element, content: string): void {
    // Clear existing content
    element.innerHTML = '';
    
    // For simple text, use textContent
    if (!content.includes('<')) {
      element.textContent = content;
      return;
    }

    // For HTML content, sanitize it
    const sanitized = this.sanitizeHtml(content);
    element.innerHTML = sanitized;
  }

  /**
   * Create safe DOM elements with text content
   */
  static createSafeElement(tagName: string, textContent: string, className?: string): HTMLElement {
    const element = document.createElement(tagName);
    element.textContent = textContent; // Safe text assignment
    
    if (className) {
      element.className = className;
    }
    
    return element;
  }

  /**
   * Sanitize URL to prevent XSS via javascript: protocol
   */
  static sanitizeUrl(url: string): string {
    if (typeof url !== 'string') {
      return '';
    }

    // Remove dangerous protocols
    const sanitized = url
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/on\w+=/gi, ''); // Remove event handlers

    // Validate URL format
    try {
      const parsed = new URL(sanitized);
      if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return parsed.toString();
      }
    } catch {
      // If URL parsing fails, return empty string
      return '';
    }

    return '';
  }

  /**
   * Sanitize text input for search queries
   */
  static sanitizeSearchInput(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Sanitize filename for safe processing
   */
  static sanitizeFilename(filename: string): string {
    if (typeof filename !== 'string') {
      return '';
    }

    return filename
      .replace(/[<>:"\/\\|?*]/g, '') // Remove dangerous file chars
      .replace(/\.\./g, '') // Remove directory traversal
      .trim()
      .substring(0, 255); // Limit length
  }

  /**
   * Escape text for safe display in HTML attributes
   */
  static escapeHtmlAttribute(text: string): string {
    if (typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Validate and sanitize JSON input
   */
  static sanitizeJsonInput(input: string): any {
    if (typeof input !== 'string') {
      return null;
    }

    try {
      // Parse JSON
      const parsed = JSON.parse(input);
      
      // Recursively sanitize string values
      return this.sanitizeJsonObject(parsed);
    } catch {
      return null;
    }
  }

  /**
   * Recursively sanitize JSON object
   */
  private static sanitizeJsonObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.sanitizeSearchInput(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeJsonObject(item));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeSearchInput(key);
        sanitized[sanitizedKey] = this.sanitizeJsonObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Create safe text nodes for DOM manipulation
   */
  static createTextNode(text: string): Text {
    return document.createTextNode(text || '');
  }

  /**
   * Safely append multiple text and element nodes
   */
  static safeAppendChildren(parent: Element, ...children: (string | Element)[]): void {
    for (const child of children) {
      if (typeof child === 'string') {
        parent.appendChild(this.createTextNode(child));
      } else if (child instanceof Element) {
        parent.appendChild(child);
      }
    }
  }

  /**
   * Validate and sanitize CSS class names
   */
  static sanitizeClassName(className: string): string {
    if (typeof className !== 'string') {
      return '';
    }

    return className
      .replace(/[^a-zA-Z0-9\-_]/g, '') // Only allow alphanumeric, hyphens, underscores
      .trim();
  }

  /**
   * Remove all HTML tags and return plain text
   */
  static stripHtml(html: string): string {
    if (typeof html !== 'string') {
      return '';
    }

    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  /**
   * Validate message content for inter-component communication
   */
  static sanitizeMessage(message: any): any {
    if (typeof message !== 'object' || message === null) {
      return {};
    }

    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(message)) {
      const sanitizedKey = this.sanitizeSearchInput(key);
      
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeSearchInput(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map(item => 
          typeof item === 'string' ? this.sanitizeSearchInput(item) : item
        );
      } else if (value && typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeMessage(value);
      }
    }
    
    return sanitized;
  }
}