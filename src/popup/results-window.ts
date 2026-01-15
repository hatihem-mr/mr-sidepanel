/**
 * Results Window Controller
 * Handles the detailed results popup window functionality
 */

interface SearchResult {
  original: string;
  processed: string;
  url: string;
  hasResults: boolean;
  status: string;
  error?: string;
  // NEW: First result data for better display
  firstResult?: any;
  resultType?: string;
}

interface SearchSummary {
  total: number;
  found: number;
  empty: number;
  errors?: number;
}

class ResultsWindowController {
  private results: SearchResult[] = [];
  private summary: SearchSummary = { total: 0, found: 0, empty: 0 };
  private searchType: string = 'Media Outlets';
  private itemType: string = 'outlet';

  constructor() {
    this.initializeWindow();
  }

  private initializeWindow(): void {
    // Get data key from URL hash
    const dataKey = window.location.hash.substring(1);
    
    
    if (dataKey) {
      try {
        // Try to get data from opener's sessionStorage
        const opener = window.opener;
        if (opener) {
          const dataString = opener.sessionStorage.getItem(dataKey);
          
          if (dataString) {
            const data = JSON.parse(dataString);
            
            this.results = data.results || [];
            this.summary = data.summary || { total: 0, found: 0, empty: 0 };
            
            // SIMPLE IF/ELSE APPROACH - Determine type from actual search results
            this.determineSearchTypeFromResults();
            
            
            // Clean up sessionStorage - remove current key and any old ones
            opener.sessionStorage.removeItem(dataKey);
            this.cleanupOldSessionData(opener);
          } else {
            console.error('No data found in sessionStorage for key:', dataKey);
          }
        } else {
          console.error('No opener window available');
        }
      } catch (error) {
        console.error('Failed to parse results data:', error);
      }
    } else {
      console.error('No data key found in URL hash');
    }

    this.setupEventListeners();
    this.renderResults();
  }

  private setupEventListeners(): void {
    // Search functionality
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e));
    }
  }

  private handleSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    const searchTerm = target.value.toLowerCase();
    const items = document.querySelectorAll('.result-item');
    
    items.forEach(item => {
      const itemElement = item as HTMLElement;
      const itemTerm = itemElement.getAttribute('data-search-term') || '';
      if (itemTerm.includes(searchTerm)) {
        itemElement.classList.remove('hidden');
      } else {
        itemElement.classList.add('hidden');
      }
    });
  }

  private renderResults(): void {
    this.renderTitle();
    this.renderSummary();
    this.renderResultsList();
  }

  private renderTitle(): void {
    const titleElement = document.getElementById('resultTitle');
    if (titleElement) {
      titleElement.textContent = `Bulk Search Results for "${this.searchType}"`;
    }
  }

  private renderSummary(): void {
    const summaryElement = document.getElementById('resultSummary');
    if (!summaryElement) return;

    const noResults = this.results.filter(r => !r.hasResults);
    
    summaryElement.innerHTML = `
      <div class="summary-item summary-total">
        <strong>Total: ${this.summary.total}</strong>
      </div>
      <div class="summary-item summary-found">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right: 4px;">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        <strong>Has results: ${this.summary.found}</strong>
      </div>
      <div class="summary-item summary-empty">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right: 4px;">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
        <strong>No results: ${this.summary.empty}</strong>
      </div>
      <button class="copy-button" ${this.summary.empty === 0 ? 'disabled' : ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy Missing ${this.getItemLabel(this.summary.empty)} (${this.summary.empty})
      </button>
    `;

    // Add copy button functionality
    const copyButton = summaryElement.querySelector('.copy-button') as HTMLButtonElement;
    if (copyButton && !copyButton.disabled) {
      copyButton.addEventListener('click', () => this.copyMissingItems(noResults));
    }
  }

  private renderResultsList(): void {
    const resultsListElement = document.getElementById('resultsList');
    if (!resultsListElement) return;

    const resultsHTML = this.results.map((result, index) => {
      const displayName = this.getDisplayName(result);
      const context = this.getResultContext(result);
      const description = this.getResultDescription(result);
      
      return `
        <div class="result-item" data-search-term="${result.original.toLowerCase()}">
          <div class="result-header" data-index="${index}">
            <div class="result-name" data-url="${result.url}" data-index="${index}">
              <div class="result-main-info">
                <span class="primary-name">${this.escapeHtml(displayName)}</span>
                ${context ? `<span class="context-info">${this.escapeHtml(context)}</span>` : ''}
              </div>
              ${description ? `<div class="result-description">${this.escapeHtml(description)}</div>` : ''}
            </div>
            <div class="result-actions">
              <div class="status-indicator ${result.hasResults ? 'status-found' : 'status-empty'}">
                ${result.hasResults ? 
                  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : 
                  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>'}
              </div>
              <button class="open-link-btn" data-url="${result.url}" title="Open in new tab">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
              <button class="expand-btn" id="expandBtn${index}" data-index="${index}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="result-details" id="details${index}">
            ${result.firstResult ? `
              <div class="detail-row">
                <div class="detail-label">First Result:</div>
                <div class="detail-value">${this.escapeHtml(displayName)}${this.escapeHtml(context)}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">Query Used:</div>
                <div class="detail-value">${this.escapeHtml(result.processed)}</div>
              </div>
            ` : `
              <div class="detail-row">
                <div class="detail-label">Query Used:</div>
                <div class="detail-value">${this.escapeHtml(result.processed)}</div>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');

    resultsListElement.innerHTML = resultsHTML;

    // Add event listeners after rendering
    
    // Click on result name to open link
    resultsListElement.querySelectorAll('.result-name').forEach((nameEl) => {
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (e.currentTarget as HTMLElement).getAttribute('data-url');
        if (url) {
          window.open(url, '_blank');
        }
      });
    });

    // Click on open link button
    resultsListElement.querySelectorAll('.open-link-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (e.currentTarget as HTMLElement).getAttribute('data-url');
        if (url) {
          window.open(url, '_blank');
        }
      });
    });


    // Click on expand button to toggle details
    resultsListElement.querySelectorAll('.expand-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '0');
        this.toggleDetails(index);
      });
    });
  }

  private toggleDetails(index: number): void {
    const details = document.getElementById(`details${index}`);
    if (details) {
      const isExpanded = details.classList.contains('expanded');
      if (isExpanded) {
        details.classList.remove('expanded');
      } else {
        details.classList.add('expanded');
      }
    }
  }

  private copyMissingItems(noResults: SearchResult[]): void {
    const missingItems = noResults.map(r => r.original);
    const isPlural = missingItems.length > 1;
    const itemLabel = this.getItemLabel(missingItems.length);
    const pronoun = isPlural ? 'these' : 'this';
    
    const message = `Hey Editorial - I am passing off this customer to you to add ${pronoun} ${itemLabel} to the db\n\n${missingItems.join('\n')}\n\nAction after research complete: RESPOND`;
    
    navigator.clipboard.writeText(message).then(() => {
      const btn = document.querySelector('.copy-button') as HTMLButtonElement;
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right: 4px; vertical-align: text-bottom;"><path d="M20 6L9 17l-5-5"/></svg> Copied!';
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.background = '#f59e0b';
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard');
    });
  }

  private determineSearchTypeFromResults(): void {
    // Look at the first result URL to determine search type
    if (this.results.length > 0) {
      const firstResultUrl = this.results[0].url;
      
      if (firstResultUrl.includes('result_type=person')) {
        this.searchType = 'People';
        this.itemType = 'person';
      } else if (firstResultUrl.includes('result_type=media_outlet')) {
        this.searchType = 'Media Outlets';
        this.itemType = 'outlet';
      } else if (firstResultUrl.includes('result_type=article')) {
        this.searchType = 'Articles';
        this.itemType = 'article';
      } else if (firstResultUrl.includes('result_type=broadcast')) {
        this.searchType = 'Broadcast';
        this.itemType = 'broadcast';
      } else {
        // Fallback to default
        this.searchType = 'Media Outlets';
        this.itemType = 'outlet';
      }
    } else {
      // No results, fallback to default
      this.searchType = 'Media Outlets';
      this.itemType = 'outlet';
    }
  }

  private getItemLabel(count: number): string {
    const isPlural = count !== 1;
    
    if (this.itemType === 'person') {
      return isPlural ? 'people' : 'person';
    } else if (this.itemType === 'outlet') {
      return isPlural ? 'outlets' : 'outlet';
    } else {
      return isPlural ? 'items' : 'item';
    }
  }

  private cleanupOldSessionData(opener: Window): void {
    // Remove old results_* keys from sessionStorage to prevent stale data
    const keys = Object.keys(opener.sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('results_')) {
        const timestamp = parseInt(key.split('_')[1]);
        const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
        if (timestamp < fifteenMinutesAgo) {
          opener.sessionStorage.removeItem(key);
        }
      }
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get the display name for a search result
   * Shows the actual first result found instead of the original search term
   * 
   * @param result - The search result object
   * @returns The name to display (first result name or fallback to original)
   */
  private getDisplayName(result: SearchResult): string {
    if (result.hasResults && result.firstResult) {
      // For different result types, get the appropriate name field
      if (result.resultType === 'media_outlet' && result.firstResult.name) {
        return result.firstResult.name;
      } else if (result.resultType === 'person' && result.firstResult.name) {
        return result.firstResult.name;
      } else if (result.resultType === 'article' && result.firstResult.title) {
        return result.firstResult.title;
      }
    }
    
    // Fallback to original search term if no first result data
    return result.original;
  }

  /**
   * Get additional context info for the dropdown display
   * Shows type, location, etc. for the first result
   * 
   * @param result - The search result object
   * @returns Context string or empty string
   */
  private getResultContext(result: SearchResult): string {
    if (result.hasResults && result.firstResult) {
      if (result.resultType === 'media_outlet') {
        const parts = [];
        if (result.firstResult.type) parts.push(result.firstResult.type);
        if (result.firstResult.location) parts.push(result.firstResult.location);
        return parts.length > 0 ? ` (${parts.join(', ')})` : '';
      } else if (result.resultType === 'person') {
        const parts = [];
        if (result.firstResult.title) parts.push(result.firstResult.title);
        if (result.firstResult.location) parts.push(result.firstResult.location);
        return parts.length > 0 ? ` (${parts.join(', ')})` : '';
      } else if (result.resultType === 'article') {
        const parts = [];
        if (result.firstResult.outlet) parts.push(result.firstResult.outlet);
        if (result.firstResult.date) parts.push(result.firstResult.date);
        return parts.length > 0 ? ` (${parts.join(', ')})` : '';
      }
    }
    
    return '';
  }

  /**
   * Get description/snippet for card-style display
   * Returns truncated description for outlets, articles, etc.
   * 
   * @param result - The search result object
   * @returns Description text or empty string
   */
  private getResultDescription(result: SearchResult): string {
    if (result.hasResults && result.firstResult) {
      if (result.resultType === 'media_outlet' && result.firstResult.description) {
        return result.firstResult.description;
      } else if (result.resultType === 'article' && result.firstResult.snippet) {
        return result.firstResult.snippet;
      }
    }
    
    return '';
  }
}


// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ResultsWindowController());
} else {
  new ResultsWindowController();
}