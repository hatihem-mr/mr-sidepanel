/**
 * Safe DOM manipulation utilities to prevent XSS attacks
 * Replace all innerHTML usage with these safe methods
 */

import { Sanitizer } from '../security/sanitizer.js';

/**
 * Safe DOM manipulation utility class
 */
export class SafeDOM {
  /**
   * Safely set text content (no HTML processing)
   */
  static setText(element: Element, text: string): void {
    if (!element) return;
    element.textContent = text || '';
  }

  /**
   * Safely set HTML content with sanitization
   */
  static setHTML(element: Element, html: string): void {
    if (!element || !html) {
      element.textContent = '';
      return;
    }
    
    Sanitizer.safeSetInnerHTML(element, html);
  }

  /**
   * Create element with safe text content
   */
  static createElement(
    tagName: string, 
    textContent?: string, 
    className?: string,
    attributes?: { [key: string]: string }
  ): HTMLElement {
    const element = document.createElement(tagName);
    
    if (textContent) {
      element.textContent = textContent;
    }
    
    if (className) {
      element.className = Sanitizer.sanitizeClassName(className);
    }
    
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        const sanitizedKey = Sanitizer.sanitizeSearchInput(key);
        const sanitizedValue = Sanitizer.escapeHtmlAttribute(value);
        element.setAttribute(sanitizedKey, sanitizedValue);
      }
    }
    
    return element;
  }

  /**
   * Create safe HTML structure from template
   */
  static createFromTemplate(template: {
    tag: string;
    text?: string;
    className?: string;
    attributes?: { [key: string]: string };
    children?: any[];
  }): HTMLElement {
    const element = this.createElement(
      template.tag,
      template.text,
      template.className,
      template.attributes
    );
    
    if (template.children) {
      for (const child of template.children) {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child && typeof child === 'object') {
          element.appendChild(this.createFromTemplate(child));
        }
      }
    }
    
    return element;
  }

  /**
   * Safe replacement for innerHTML with common patterns
   */
  static setContent(element: Element, content: {
    type: 'text' | 'html' | 'template';
    data: string | any;
  }): void {
    if (!element) return;
    
    // Clear existing content
    element.innerHTML = '';
    
    switch (content.type) {
      case 'text':
        element.textContent = content.data || '';
        break;
        
      case 'html':
        this.setHTML(element, content.data);
        break;
        
      case 'template':
        if (content.data) {
          element.appendChild(this.createFromTemplate(content.data));
        }
        break;
    }
  }

  /**
   * Create safe notification/toast element
   */
  static createNotification(
    message: string, 
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    iconPath?: string
  ): HTMLElement {
    const notification = this.createElement('div', '', `toast toast-${type}`);
    
    // Add icon if provided
    if (iconPath) {
      const icon = this.createElement('svg', '', 'toast-icon');
      icon.setAttribute('width', '16');
      icon.setAttribute('height', '16');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      
      const path = this.createElement('path');
      path.setAttribute('d', iconPath);
      icon.appendChild(path);
      
      notification.appendChild(icon);
    }
    
    // Add message
    const messageDiv = this.createElement('div', message, 'toast-content');
    notification.appendChild(messageDiv);
    
    // Add close button
    const closeBtn = this.createElement('button', '', 'toast-close');
    closeBtn.setAttribute('aria-label', 'Close');
    
    const closeIcon = this.createElement('svg', '', '');
    closeIcon.setAttribute('width', '16');
    closeIcon.setAttribute('height', '16');
    closeIcon.setAttribute('viewBox', '0 0 24 24');
    closeIcon.setAttribute('fill', 'none');
    closeIcon.setAttribute('stroke', 'currentColor');
    closeIcon.setAttribute('stroke-width', '2');
    
    const line1 = this.createElement('line');
    line1.setAttribute('x1', '18');
    line1.setAttribute('y1', '6');
    line1.setAttribute('x2', '6');
    line1.setAttribute('y2', '18');
    
    const line2 = this.createElement('line');
    line2.setAttribute('x1', '6');
    line2.setAttribute('y1', '6');
    line2.setAttribute('x2', '18');
    line2.setAttribute('y2', '18');
    
    closeIcon.appendChild(line1);
    closeIcon.appendChild(line2);
    closeBtn.appendChild(closeIcon);
    notification.appendChild(closeBtn);
    
    return notification;
  }

  /**
   * Create safe button with icon and text
   */
  static createButton(
    text: string,
    iconPath?: string,
    className?: string,
    onClick?: () => void
  ): HTMLButtonElement {
    const button = this.createElement('button', '', className) as HTMLButtonElement;
    
    if (iconPath) {
      const icon = this.createElement('svg', '', 'button-icon');
      icon.setAttribute('width', '16');
      icon.setAttribute('height', '16');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      
      const path = this.createElement('path');
      path.setAttribute('d', iconPath);
      icon.appendChild(path);
      
      button.appendChild(icon);
    }
    
    if (text) {
      const textNode = document.createTextNode(text);
      button.appendChild(textNode);
    }
    
    if (onClick) {
      button.addEventListener('click', onClick);
    }
    
    return button;
  }

  /**
   * Safe list creation
   */
  static createList(
    items: Array<{ text: string; className?: string; data?: any }>,
    listType: 'ul' | 'ol' = 'ul',
    listClassName?: string
  ): HTMLElement {
    const list = this.createElement(listType, '', listClassName);
    
    for (const item of items) {
      const li = this.createElement('li', item.text, item.className);
      
      if (item.data) {
        // Store data safely as data attributes
        for (const [key, value] of Object.entries(item.data)) {
          const sanitizedKey = `data-${Sanitizer.sanitizeSearchInput(key)}`;
          const sanitizedValue = Sanitizer.escapeHtmlAttribute(String(value));
          li.setAttribute(sanitizedKey, sanitizedValue);
        }
      }
      
      list.appendChild(li);
    }
    
    return list;
  }

  /**
   * Create safe table from data
   */
  static createTable(
    headers: string[],
    rows: string[][],
    className?: string
  ): HTMLTableElement {
    const table = this.createElement('table', '', className) as HTMLTableElement;
    
    // Create header
    if (headers.length > 0) {
      const thead = this.createElement('thead');
      const headerRow = this.createElement('tr');
      
      for (const header of headers) {
        const th = this.createElement('th', header);
        headerRow.appendChild(th);
      }
      
      thead.appendChild(headerRow);
      table.appendChild(thead);
    }
    
    // Create body
    if (rows.length > 0) {
      const tbody = this.createElement('tbody');
      
      for (const row of rows) {
        const tr = this.createElement('tr');
        
        for (const cell of row) {
          const td = this.createElement('td', cell);
          tr.appendChild(td);
        }
        
        tbody.appendChild(tr);
      }
      
      table.appendChild(tbody);
    }
    
    return table;
  }

  /**
   * Safe replacement for common innerHTML patterns
   */
  static replaceInnerHTML(element: Element, htmlString: string): void {
    if (!element || !htmlString) {
      element.textContent = '';
      return;
    }
    
    // Parse common patterns and convert to safe DOM operations
    if (htmlString.includes('<')) {
      // This is HTML content - sanitize it
      this.setHTML(element, htmlString);
    } else {
      // Plain text
      element.textContent = htmlString;
    }
  }

  /**
   * Batch update multiple elements safely
   */
  static batchUpdate(updates: Array<{
    element: Element;
    content: { type: 'text' | 'html' | 'template'; data: any };
  }>): void {
    for (const update of updates) {
      this.setContent(update.element, update.content);
    }
  }

  /**
   * Clear element safely
   */
  static clear(element: Element): void {
    if (element) {
      element.innerHTML = '';
    }
  }
}