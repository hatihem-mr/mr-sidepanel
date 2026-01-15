// ===================================================================
// MULTI-PANEL CONTENT LOADER - PHASE 2 REAL DATA INTEGRATION
// ===================================================================
// Modular service for loading real content into multi-panel cards
// Integrates with existing Muck Rack search and admin APIs
// Replaces Phase 1 mock data system with dynamic content loading
// ===================================================================

import { Card, PanelType, PANEL_COLORS } from './types.js';
import { CONTEXT_MENU_STRUCTURE } from '../../shared/constants.js';
import { debug } from '../../shared/utils/debug.js';

/**
 * Content loading service for multi-panel overlay system
 * Handles real data integration with existing Muck Rack APIs
 */
export class ContentLoader {

  /**
   * Map admin URL to proper card title using context menu structure
   */
  private getCardTitleFromUrl(url: string): string {
    // Extract the admin path from the URL
    const urlMatch = url.match(/\/mradmin\/([^?]+)/);
    if (!urlMatch) return 'Admin Data';
    
    const adminPath = urlMatch[1];
    
    // Find matching item in context menu structure
    for (const group of CONTEXT_MENU_STRUCTURE) {
      for (const item of group.children) {
        if (item.url.includes(adminPath)) {
          return item.name;
        }
      }
    }
    
    // Fallback: extract from path
    const pathParts = adminPath.split('/');
    const lastPart = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  
  /**
   * Load user information from admin API (replaces createMockUserCard)
   */
  async loadUserData(email: string): Promise<Card> {
    try {
      // Use existing admin API integration from content-integration.ts
      const adminData = await this.fetchAdminUserData(email);
      
      return {
        id: `user-${Date.now()}`,
        type: PanelType.USER,
        title: `User: ${adminData?.name || email}`,
        icon: '👤',
        color: PANEL_COLORS[PanelType.USER],
        timestamp: Date.now(),
        content: this.renderUserContent(adminData, email)
      };
    } catch (error) {
      return this.createErrorCard(PanelType.USER, `Failed to load user data for ${email}`, error);
    }
  }

  /**
   * Load media pitches data for an outlet
   */
  async loadPitchData(outlet: string): Promise<Card> {
    try {
      // Future: Integrate with pitch/outreach data
      const pitchData = await this.fetchPitchData(outlet);
      
      return {
        id: `pitches-${Date.now()}`,
        type: PanelType.PITCHES,
        title: `Pitches: ${outlet}`,
        icon: '📧',
        color: PANEL_COLORS[PanelType.PITCHES],
        timestamp: Date.now(),
        content: this.renderPitchContent(pitchData, outlet)
      };
    } catch (error) {
      return this.createErrorCard(PanelType.PITCHES, `Failed to load pitches for ${outlet}`, error);
    }
  }

  /**
   * Load article search results
   */
  async loadArticleData(query: string): Promise<Card> {
    try {
      // Use existing search execution service
      const searchResults = await this.fetchArticleResults(query);
      
      return {
        id: `articles-${Date.now()}`,
        type: PanelType.ARTICLES,
        title: `Articles: ${query}`,
        icon: '📰',
        color: PANEL_COLORS[PanelType.ARTICLES],
        timestamp: Date.now(),
        content: this.renderArticleContent(searchResults, query)
      };
    } catch (error) {
      return this.createErrorCard(PanelType.ARTICLES, `Failed to load articles for ${query}`, error);
    }
  }

  /**
   * Load media outlet information
   */
  async loadOutletData(domain: string): Promise<Card> {
    try {
      // Use existing admin API for outlet data
      const outletData = await this.fetchOutletData(domain);
      
      return {
        id: `outlet-${Date.now()}`,
        type: PanelType.OUTLET,
        title: `Outlet: ${domain}`,
        icon: '🏢',
        color: PANEL_COLORS[PanelType.OUTLET],
        timestamp: Date.now(),
        content: this.renderOutletContent(outletData, domain)
      };
    } catch (error) {
      return this.createErrorCard(PanelType.OUTLET, `Failed to load outlet data for ${domain}`, error);
    }
  }

  // =================================================================
  // DEBUG METHODS - EXTRACT DATA FROM CURRENT PAGE
  // =================================================================

  /**
   * Debug method to extract data from the current page
   * ONLY creates cards for emails found on page - fetches real Muck Rack admin data
   */
  async createCardsFromCurrentPage(): Promise<Card[]> {
    const cards: Card[] = [];
    
    try {
      debug.log('🔍 [DEBUG] Analyzing current page for email addresses...');
      const pageData = this.extractPageData();
      
      // ONLY create cards for emails - pull from Muck Rack admin
      if (pageData.emails.length > 0) {
        debug.log(`📧 Found ${pageData.emails.length} emails on page`);
        for (const email of pageData.emails.slice(0, 3)) { // Limit to 3
          debug.log(`🔄 [DEBUG] Processing email: ${email}`);
          const card = await this.createUserCardFromEmail(email);
          debug.log(`✅ [DEBUG] Created card for ${email}:`, card);
          cards.push(card);
        }
      } else {
        // No emails found - create info card
        const infoCard = this.createPageInfoCard(pageData);
        cards.push(infoCard);
      }
      
      debug.log(`✅ [DEBUG] Created ${cards.length} cards from current page data`);
      return cards;
      
    } catch (error) {
      debug.error('❌ [DEBUG] Failed to extract page data:', error);
      return [this.createDebugErrorCard(error)];
    }
  }

  /**
   * Extract structured data from the current page
   */
  private extractPageData(): any {
    const pageData = {
      title: document.title,
      url: window.location.href,
      emails: this.extractEmails(),
      domains: this.extractDomains(), 
      keywords: this.extractKeywords(),
      pageType: this.detectPageType(),
      content: this.extractMainContent()
    };
    
    debug.log('📊 [DEBUG] Page data extracted:', pageData);
    return pageData;
  }

  /**
   * Extract email addresses from page
   */
  private extractEmails(): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const pageText = document.body.innerText;
    const emails = Array.from(new Set(pageText.match(emailRegex) || []));
    return emails.slice(0, 5); // Limit results
  }

  /**
   * Extract domain names from page
   */
  private extractDomains(): string[] {
    const domains = new Set<string>();
    
    // From links
    document.querySelectorAll('a[href]').forEach(link => {
      const href = (link as HTMLAnchorElement).href;
      try {
        const url = new URL(href);
        if (url.hostname && url.hostname !== window.location.hostname) {
          domains.add(url.hostname.replace('www.', ''));
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });
    
    return Array.from(domains).slice(0, 5);
  }

  /**
   * Extract meaningful keywords from page
   */
  private extractKeywords(): string[] {
    const text = document.body.innerText.toLowerCase();
    const words = text.match(/\b[a-z]{4,}\b/g) || [];
    
    // Count word frequency
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      // Skip common words
      const commonWords = ['that', 'this', 'with', 'from', 'they', 'been', 'have', 'their', 'said', 'each', 'which', 'what', 'there', 'will', 'would', 'could', 'should', 'about', 'after', 'before', 'through'];
      if (!commonWords.includes(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    
    // Get top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Detect what type of page this is
   */
  private detectPageType(): string {
    const url = window.location.href;
    const title = document.title.toLowerCase();
    
    if (url.includes('muckrack.com')) {
      if (url.includes('/admin') || url.includes('/mradmin')) return 'muckrack-admin';
      if (url.includes('/search')) return 'muckrack-search';
      return 'muckrack';
    }
    
    if (url.includes('intercom.com') || url.includes('intercom.io')) {
      return 'intercom';
    }
    
    if (title.includes('google')) return 'google';
    
    return 'unknown';
  }

  /**
   * Extract main content from page
   */
  private extractMainContent(): string {
    // Try to find main content area
    const mainSelectors = ['main', '[role="main"]', '.content', '#content', '.main-content'];
    
    for (const selector of mainSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent?.slice(0, 500) + '...' || '';
      }
    }
    
    // Fallback to body text
    return document.body.innerText.slice(0, 500) + '...';
  }

  /**
   * Create user card from extracted email
   */
   private async createUserCardFromEmail(email: string): Promise<Card> {
    // Fetch actual data from Muck Rack admin for this email
    try {
      const adminUrl = `https://muckrack.com/mradmin/auth/user/?q=${encodeURIComponent(email)}`;
      const adminData = await this.fetchAdminUserData(email);
      
      return {
        id: `admin-user-${Date.now()}-${Math.random()}`,
        type: PanelType.USER,
        title: this.getCardTitleFromUrl(adminUrl), // Will return "Users"
        icon: '👤', 
        color: this.getRandomColor(),
        timestamp: Date.now(),
        content: this.renderUserContent(adminData, email)
      };
    } catch (error) {
      // Fallback if admin lookup fails
      return {
        id: `email-${Date.now()}-${Math.random()}`, 
        type: PanelType.USER,
        title: 'Email Found on Page',
        icon: '📧',
        color: this.getRandomColor(),
        timestamp: Date.now(),
        content: `
          <div class="content-section">
            <div class="content-label">Email Search</div>
            <div class="content-card">
              <div class="content-value"><strong>${email}</strong></div>
              <div class="content-value">⚠️ Admin lookup failed</div>
            </div>
          </div>
        `
      };
    }
  }

  /**
   * Create outlet card from extracted domain
   */
  private async createOutletCardFromDomain(domain: string): Promise<Card> {
    return {
      id: `debug-outlet-${Date.now()}-${Math.random()}`,
      type: PanelType.OUTLET,
      title: `Outlet: ${domain}`,
      icon: '🏢',
      color: PANEL_COLORS[PanelType.OUTLET],
      timestamp: Date.now(),
      content: `
        <div class="content-section">
          <div class="content-label">Debug: Extracted from Page</div>
          <div class="content-card">
            <div class="content-value"><strong>${domain}</strong></div>
            <div class="content-value">Source: Page links</div>
            <div class="content-value">🔍 Would fetch outlet data in production</div>
          </div>
        </div>
      `
    };
  }

  /**
   * Create article card from extracted keywords
   */
  private async createArticleCardFromQuery(query: string): Promise<Card> {
    return {
      id: `debug-articles-${Date.now()}-${Math.random()}`,
      type: PanelType.ARTICLES,
      title: `Articles: ${query.slice(0, 30)}...`,
      icon: '📰',
      color: PANEL_COLORS[PanelType.ARTICLES],
      timestamp: Date.now(),
      content: `
        <div class="content-section">
          <div class="content-label">Debug: Extracted Keywords</div>
          <div class="content-card">
            <div class="content-value"><strong>Query:</strong> ${query}</div>
            <div class="content-value">Source: Page text analysis</div>
            <div class="content-value">🔍 Would search articles in production</div>
          </div>
        </div>
      `
    };
  }

  /**
   * Create page info card with debug data
   */
  private createPageInfoCard(pageData: any): Card {
    return {
      id: `debug-page-${Date.now()}`,
      type: PanelType.USER,
      title: 'Page Debug Info',
      icon: '🔍',
      color: PANEL_COLORS[PanelType.USER],
      timestamp: Date.now(),
      content: `
        <div class="content-section">
          <div class="content-label">Page Analysis</div>
          <div class="content-card">
            <div class="content-value"><strong>${pageData.title}</strong></div>
            <div class="content-value">Type: ${pageData.pageType}</div>
            <div class="content-value">URL: ${pageData.url.slice(0, 50)}...</div>
          </div>
        </div>
        
        <div class="content-section">
          <div class="content-label">Extracted Data</div>
          <div class="content-card">
            <div class="content-value">📧 ${pageData.emails.length} emails found</div>
            <div class="content-value">🌐 ${pageData.domains.length} domains found</div>
            <div class="content-value">🔤 ${pageData.keywords.length} keywords found</div>
          </div>
        </div>
        
        <div class="content-section">
          <div class="content-label">Content Preview</div>
          <div class="content-card">
            <div class="content-value">${pageData.content.slice(0, 200)}...</div>
          </div>
        </div>
      `
    };
  }

  /**
   * Create error card for debug failures
   */
  private createDebugErrorCard(error: any): Card {
    return {
      id: `debug-error-${Date.now()}`,
      type: PanelType.USER,
      title: 'Debug Error',
      icon: '❌',
      color: PANEL_COLORS[PanelType.USER],
      timestamp: Date.now(),
      content: `
        <div class="content-section">
          <div class="content-label">Debug Error</div>
          <div class="content-card">
            <div class="content-value">Failed to extract page data</div>
            <div class="content-value">Error: ${error?.message || 'Unknown error'}</div>
          </div>
        </div>
      `
    };
  }

  // =================================================================
  // PRIVATE METHODS - DATA FETCHING
  // =================================================================

  /**
   * Fetch admin user data using the WORKING method from content-integration.ts
   */
  private async fetchAdminUserData(email: string): Promise<any> {
    try {
      // STEP 1: Get search results to find the user ID
      const searchResponse = await chrome.runtime.sendMessage({
        action: 'fetch',
        url: `https://muckrack.com/mradmin/auth/user/?q=${encodeURIComponent(email)}`,
        options: {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        }
      });
      
      if (!searchResponse || !searchResponse.data) {
        throw new Error('Failed to get search results');
      }
      
      // Extract user ID from the search results
      const userIdMatch = searchResponse.data.match(/\/mradmin\/auth\/user\/(\d+)\/change\//);
      if (!userIdMatch) {
        return {
          success: false,
          error: 'User not found in admin system'
        };
      }
      
      const userId = userIdMatch[1];
      
      // STEP 2: Fetch the detailed user page
      const detailUrl = `https://muckrack.com/mradmin/auth/user/${userId}/change/`;
      
      const detailResponse = await chrome.runtime.sendMessage({
        action: 'fetch',
        url: detailUrl,
        options: {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        }
      });
      
      if (detailResponse && detailResponse.data) {
        // Parse the detailed HTML response
        const adminData = this.parseAdminUserHTML(detailResponse.data);
        
        return {
          success: true,
          ...adminData
        };
      } else {
        return {
          success: false,
          error: 'Failed to fetch detailed user data'
        };
      }
      
    } catch (error) {
      debug.error('Failed to fetch admin user data:', error);
      throw error;
    }
  }

  /**
   * Fetch pitch/outreach data (placeholder for future implementation)
   */
  private async fetchPitchData(outlet: string): Promise<any> {
    // TODO: Implement pitch data integration
    // This could integrate with CRM or outreach tracking systems
    return {
      outlet,
      recentPitches: [],
      contacts: [],
      successRate: 0
    };
  }

  /**
   * Fetch article search results using existing search service
   */
  private async fetchArticleResults(query: string): Promise<any> {
    try {
      // Use pattern from SearchExecutionService
      const response = await chrome.runtime.sendMessage({
        action: 'fetch', 
        url: `https://muckrack.com/search/articles?q=${encodeURIComponent(query)}`,
        options: {
          method: 'GET',
          credentials: 'include'
        }
      });

      if (!response || response.error) {
        throw new Error(response?.error || 'Article search failed');
      }

      // Parse article results (use existing result-extractor patterns)
      return this.parseArticleHTML(response.data);
    } catch (error) {
      debug.error('Failed to fetch article results:', error);
      throw error;
    }
  }

  /**
   * Fetch media outlet data from admin API
   */
  private async fetchOutletData(domain: string): Promise<any> {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'fetch',
        url: `https://muckrack.com/mradmin/directory/mediaoutlet/?q=${encodeURIComponent(domain)}`,
        options: {
          method: 'GET', 
          credentials: 'include'
        }
      });

      if (!response || response.error) {
        throw new Error(response?.error || 'Outlet search failed');
      }

      return this.parseOutletHTML(response.data);
    } catch (error) {
      debug.error('Failed to fetch outlet data:', error);
      throw error;
    }
  }

  // =================================================================
  // PRIVATE METHODS - HTML PARSING
  // =================================================================

  /**
   * Parse admin user HTML using the WORKING method from content-integration.ts
   */
  private parseAdminUserHTML(html: string): any {
    const data: any = {};
    
    try {
      // Check if this is a detailed user page or search results
      if (html.includes('Change user')) {
        // Extract basic user info from detailed page
        const usernameMatch = html.match(/<input[^>]*name="username"[^>]*value="([^"]+)"/);
        if (usernameMatch) {
          data.emailAddress = usernameMatch[1];
        }
        
        // Extract first/last name from breadcrumbs or page title
        const breadcrumbMatch = html.match(/Change user[\s\S]*?<h1[^>]*>([^<]+)</);
        if (breadcrumbMatch) {
          const fullName = breadcrumbMatch[1].trim();
          const nameParts = fullName.split(' ');
          if (nameParts.length >= 2) {
            data.firstName = nameParts[0];
            data.lastName = nameParts.slice(1).join(' ');
          }
        }
        
        // Extract status and role from Permissions fieldset
        const permissionsFieldsetMatch = html.match(/<fieldset[^>]*>[\s\S]*?<h2>Permissions<\/h2>[\s\S]*?<\/fieldset>/);
        if (permissionsFieldsetMatch) {
          const permHtml = permissionsFieldsetMatch[0];
          
          // Active status
          const activeMatch = permHtml.match(/<input[^>]*name="is_active"[^>]*checked/);
          data.status = activeMatch ? 'active' : 'inactive';
          
          // Role
          const roleMatch = permHtml.match(/<label>Role:<\/label>[\s\S]*?<div class="readonly">([^<]+)<\/div>/);
          if (roleMatch) {
            data.role = roleMatch[1].trim();
          }
        }
        
        // Profile fieldset - get organization
        const profileFieldsetMatch = html.match(/<fieldset[^>]*>[\s\S]*?<h2>Profile<\/h2>[\s\S]*?<\/fieldset>/);
        if (profileFieldsetMatch) {
          const profileHtml = profileFieldsetMatch[0];
          
          // Organization
          const orgMatch = profileHtml.match(/<strong><a[^>]*>([^<]+)<\/a><\/strong>/);
          if (orgMatch) {
            data.organization = orgMatch[1].trim();
          }
          
          // Package
          const packageMatch = profileHtml.match(/<label>Package:<\/label>[\s\S]*?<div class="readonly">([^<]+)<\/div>/);
          if (packageMatch) {
            data.package = packageMatch[1].trim();
          }
        }
        
      } else if (html.includes('Select user to change')) {
        // This is a search results page - extract from table
        const tableRowPattern = /<tr[^>]*>.*?<th class="field-email">.*?<\/th>.*?<td class="field-first_name">.*?<\/tr>/s;
        const tableRowMatch = html.match(tableRowPattern);
        
        if (tableRowMatch) {
          const rowHTML = tableRowMatch[0];
          
          // Extract email
          const emailMatch = rowHTML.match(/<th class="field-email"[^>]*>.*?>([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})<\/a><\/th>/);
          if (emailMatch) {
            data.emailAddress = emailMatch[1];
          }
          
          // Extract first name
          const firstNameMatch = rowHTML.match(/<td class="field-first_name"[^>]*>([^<]+)<\/td>/);
          if (firstNameMatch) {
            data.firstName = firstNameMatch[1].trim();
          }
          
          // Extract last name
          const lastNameMatch = rowHTML.match(/<td class="field-last_name"[^>]*>([^<]+)<\/td>/);
          if (lastNameMatch) {
            data.lastName = lastNameMatch[1].trim();
          }
          
          // Extract organization
          const organizationMatch = rowHTML.match(/<td class="field-organization"[^>]*><a[^>]*>([^<]+)<\/a><\/td>/);
          if (organizationMatch) {
            data.organization = organizationMatch[1].trim();
          }
          
          // Extract package
          const packageMatch = rowHTML.match(/<td class="field-package"[^>]*>([^<]+)<\/td>/);
          if (packageMatch) {
            data.package = packageMatch[1].trim();
          }
        }
      }
    } catch (error) {
      debug.error('Error parsing admin user HTML:', error);
    }
    
    return data;
  }

  /**
   * Parse article search results HTML
   */
  private parseArticleHTML(html: string): any {
    // TODO: Use existing result extraction logic from result-extractor.ts
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const articles = Array.from(doc.querySelectorAll('.article-result')).slice(0, 5);
    return {
      resultCount: articles.length,
      articles: articles.map(article => ({
        title: article.querySelector('.title')?.textContent || 'No title',
        outlet: article.querySelector('.outlet')?.textContent || 'Unknown outlet',
        author: article.querySelector('.author')?.textContent || 'Unknown author',
        date: article.querySelector('.date')?.textContent || 'No date'
      }))
    };
  }

  /**
   * Parse media outlet HTML
   */
  private parseOutletHTML(html: string): any {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    return {
      name: doc.querySelector('.outlet-name')?.textContent || 'Unknown outlet',
      domain: doc.querySelector('.outlet-domain')?.textContent || '',
      type: doc.querySelector('.outlet-type')?.textContent || 'Unknown',
      reach: doc.querySelector('.outlet-reach')?.textContent || 'N/A'
    };
  }

  // =================================================================
  // PRIVATE METHODS - CONTENT RENDERING
  // =================================================================

  /**
   * Render user content card
   */
  private renderUserContent(userData: any, email: string): string {
    if (!userData) {
      return `
        <div class="content-section">
          <div class="content-label">User Information</div>
          <div class="content-card">
            <div class="content-value">Email: ${email}</div>
            <div class="content-value">Status: Not found in admin</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="content-section">
        <div class="content-label">User Details</div>
        <div class="content-card">
          <div class="content-value"><strong>${userData.name || 'N/A'}</strong></div>
          <div class="content-value">${userData.role || 'N/A'}</div>
          <div class="content-value">${userData.email || email}</div>
          <div class="content-value">${userData.organization || 'N/A'}</div>
        </div>
      </div>
      
      <div class="content-section">
        <div class="content-label">Account Status</div>
        <div class="content-card">
          <div class="content-value">Status: ${userData.status || 'Unknown'}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render pitch content card
   */
  private renderPitchContent(pitchData: any, outlet: string): string {
    return `
      <div class="content-section">
        <div class="content-label">Pitch Information</div>
        <div class="content-card">
          <div class="content-value">Outlet: ${outlet}</div>
          <div class="content-value">Recent Pitches: ${pitchData?.recentPitches?.length || 0}</div>
          <div class="content-value">Success Rate: ${pitchData?.successRate || 0}%</div>
        </div>
      </div>
      
      <div class="content-section">
        <div class="content-label">Status</div>
        <div class="content-card">
          <div class="content-value">⚠️ Pitch data integration pending</div>
          <div class="content-value">🔮 Future: CRM integration</div>
        </div>
      </div>
    `;
  }

  /**
   * Render article content card  
   */
  private renderArticleContent(articleData: any, query: string): string {
    if (!articleData?.articles?.length) {
      return `
        <div class="content-section">
          <div class="content-label">Article Search Results</div>
          <div class="content-card">
            <div class="content-value">Query: ${query}</div>
            <div class="content-value">No articles found</div>
          </div>
        </div>
      `;
    }

    const articlesHTML = articleData.articles.map((article: any) => `
      <div class="content-card">
        <div class="content-value"><strong>${article.title}</strong></div>
        <div class="content-value">📰 ${article.outlet}</div>
        <div class="content-value">✍️ ${article.author}</div>
        <div class="content-value">📅 ${article.date}</div>
      </div>
    `).join('');

    return `
      <div class="content-section">
        <div class="content-label">Articles (${articleData.resultCount} results)</div>
        ${articlesHTML}
      </div>
    `;
  }

  /**
   * Render outlet content card
   */
  private renderOutletContent(outletData: any, domain: string): string {
    return `
      <div class="content-section">
        <div class="content-label">Media Outlet Information</div>
        <div class="content-card">
          <div class="content-value"><strong>${outletData?.name || domain}</strong></div>
          <div class="content-value">Domain: ${outletData?.domain || domain}</div>
          <div class="content-value">Type: ${outletData?.type || 'N/A'}</div>
          <div class="content-value">Reach: ${outletData?.reach || 'N/A'}</div>
        </div>
      </div>
    `;
  }

  /**
   * Get a random color from a predefined set
   */
  private getRandomColor(): string {
    const colors = [
      '#0071eb', '#28a745', '#fd7e14', '#dc3545', 
      '#0056b3', '#6f42c1', '#20c997', '#6c757d'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Create error card for failed data loading
   */
  private createErrorCard(type: PanelType, message: string, error: any): Card {
    return {
      id: `error-${Date.now()}`,
      type,
      title: `Error: ${type}`,
      icon: '❌',
      color: this.getRandomColor(),
      timestamp: Date.now(),
      content: `
        <div class="content-section">
          <div class="content-label">Error Loading Content</div>
          <div class="content-card">
            <div class="content-value">${message}</div>
            <div class="content-value">Details: ${error?.message || 'Unknown error'}</div>
          </div>
        </div>
      `
    };
  }
}