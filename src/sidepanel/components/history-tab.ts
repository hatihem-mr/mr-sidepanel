import { LitElement, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { StorageService } from '../../shared/api/storage.js';
import { STORAGE_KEYS, LIMITS } from '../../shared/constants.js';
import type { AppSettings, SearchHistory } from '../../shared/types/index.js';
import { historyTabStyles } from './history-tab.styles.js';

export class HistoryTabComponent extends LitElement {
  @property({ type: Object })
  settings: AppSettings | null = null;

  @state()
  private recentSearches: SearchHistory[] = [];

  @state()
  private favorites: SearchHistory[] = [];

  @state()
  private currentView: 'recent' | 'favorites' = 'recent';

  @state()
  private isLoading = false;

  @state()
  private cacheMode: Record<string, boolean> = {}; // Track toggle state per search ID (true = cached, false = fresh)

  static styles = historyTabStyles;

  connectedCallback() {
    super.connectedCallback();
    this.loadHistory();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  private async loadHistory() {
    this.isLoading = true;
    
    try {
      await Promise.all([
        this.loadRecentSearches(),
        this.loadFavorites()
      ]);
    } catch (error) {
      console.error('Failed to load history:', error);
      this.showNotification('Failed to load search history', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private async loadRecentSearches() {
    try {
      const recent = await StorageService.get<SearchHistory[]>(STORAGE_KEYS.RECENT_SEARCHES) || [];
      // Clean up old searches (older than 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      this.recentSearches = recent.filter(search => search.timestamp > sevenDaysAgo);
      
      // Save cleaned list back to storage
      if (recent.length !== this.recentSearches.length) {
        await StorageService.set(STORAGE_KEYS.RECENT_SEARCHES, this.recentSearches);
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
      this.recentSearches = [];
    }
  }

  private async loadFavorites() {
    try {
      this.favorites = await StorageService.get<SearchHistory[]>(STORAGE_KEYS.FAVORITES) || [];
    } catch (error) {
      console.error('Failed to load favorites:', error);
      this.favorites = [];
    }
  }


  private switchView(view: 'recent' | 'favorites') {
    this.currentView = view;
  }

  private isSearchFavorited(search: SearchHistory): boolean {
    return this.favorites.some(fav => 
      fav.displayName === search.displayName && fav.location === search.location
    );
  }

  private async loadSearch(search: SearchHistory) {
    try {
      // Dispatch event to load search into search tab
      this.dispatchEvent(new CustomEvent('load-search', {
        detail: { search },
        bubbles: true
      }));
      
      // Switch to search tab
      this.dispatchEvent(new CustomEvent('switch-tab', {
        detail: { tab: 'search' },
        bubbles: true
      }));
      
      this.showNotification(`Loaded: ${search.displayName}`, 'success');
    } catch (error) {
      console.error('Failed to load search:', error);
      this.showNotification('Failed to load search', 'danger');
    }
  }

  private async toggleFavorite(search: SearchHistory, index: number) {
    try {
      const isFavorited = this.isSearchFavorited(search);
      
      if (!isFavorited) {
        // Add to favorites
        const favoriteSearch = { ...search, isFavorite: true, favoriteDate: Date.now() };
        
        // Add to favorites
        this.favorites.unshift(favoriteSearch);
        
        // Limit favorites
        if (this.favorites.length > LIMITS.MAX_FAVORITES) {
          this.favorites = this.favorites.slice(0, LIMITS.MAX_FAVORITES);
        }
        
        await StorageService.set(STORAGE_KEYS.FAVORITES, this.favorites);
        this.showNotification('Added to favorites', 'success');
        
      } else {
        // Remove from favorites - find and remove the favorited item
        const favoriteIndex = this.favorites.findIndex(fav => 
          fav.displayName === search.displayName && fav.location === search.location
        );
        
        if (favoriteIndex !== -1) {
          this.favorites.splice(favoriteIndex, 1);
          await StorageService.set(STORAGE_KEYS.FAVORITES, this.favorites);
          this.showNotification('Removed from favorites', 'success');
        }
      }
      
      this.requestUpdate();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      this.showNotification('Failed to update favorites', 'danger');
    }
  }

  private async removeSearch(index: number) {
    try {
      if (this.currentView === 'recent') {
        this.recentSearches.splice(index, 1);
        await StorageService.set(STORAGE_KEYS.RECENT_SEARCHES, this.recentSearches);
        this.showNotification('Removed from recent searches', 'success');
      } else {
        this.favorites.splice(index, 1);
        await StorageService.set(STORAGE_KEYS.FAVORITES, this.favorites);
        this.showNotification('Removed from favorites', 'success');
      }
      
      this.requestUpdate();
    } catch (error) {
      console.error('Failed to remove search:', error);
      this.showNotification('Failed to remove search', 'danger');
    }
  }

  private async clearAll() {
    const type = this.currentView === 'recent' ? 'recent searches' : 'favorites';
    
    if (!confirm(`Clear all ${type}?`)) {
      return;
    }
    
    try {
      if (this.currentView === 'recent') {
        this.recentSearches = [];
        await StorageService.set(STORAGE_KEYS.RECENT_SEARCHES, []);
      } else {
        this.favorites = [];
        await StorageService.set(STORAGE_KEYS.FAVORITES, []);
      }
      
      this.showNotification(`Cleared all ${type}`, 'success');
      this.requestUpdate();
    } catch (error) {
      console.error('Failed to clear history:', error);
      this.showNotification(`Failed to clear ${type}`, 'danger');
    }
  }

  private getTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  private showNotification(message: string, type: 'success' | 'danger' | 'warning' | 'info') {
    // Toast notifications disabled - users can see what's happening in the UI directly
    return;
  }

  /**
   * Toggle cache mode for a specific search (cached vs fresh)
   */
  private toggleCacheMode(searchId: string, event: Event) {
    event.stopPropagation(); // Prevent card click

    // Get the current effective mode (accounting for undefined default)
    const currentMode = this.cacheMode[searchId] !== undefined ? this.cacheMode[searchId] : true;

    // Toggle to opposite of current mode
    this.cacheMode[searchId] = !currentMode;
    this.requestUpdate();
  }

  /**
   * Check if search has cached results available
   */
  private hasCachedResults(search: SearchHistory): boolean {
    return !!search.cacheId && (search.categories?.some(cat => cat === 'people' || cat === 'media_outlets') || false);
  }

  /**
   * Get cache mode for a search (defaults to true if cache available)
   */
  private getCacheMode(search: SearchHistory): boolean {
    if (!this.hasCachedResults(search)) {
      return false; // No cache available, must be fresh
    }
    // Default to cached mode (true) if not explicitly set
    return this.cacheMode[search.id] !== undefined ? this.cacheMode[search.id] : true;
  }

  /**
   * Load search based on current toggle state
   */
  private async loadSearchWithMode(search: SearchHistory) {
    const isCachedMode = this.getCacheMode(search);
    const hasCached = this.hasCachedResults(search);

    if (isCachedMode && hasCached) {
      // Load cached results
      const searchTab = document.querySelector('search-tab-component') as any;

      if (searchTab && searchTab.loadSearchWithCachedResults) {
        await searchTab.loadSearchWithCachedResults(search);

        // Switch to search tab to show results
        this.dispatchEvent(new CustomEvent('switch-tab', {
          detail: { tab: 'search' },
          bubbles: true
        }));
      } else {
        console.error('[HISTORY-TAB] Search tab element or method not found!', {
          hasElement: !!searchTab,
          hasMethod: searchTab?.loadSearchWithCachedResults
        });
      }
    } else {
      // Load fresh (terms only) - switches to search tab
      this.loadSearch(search);
    }
  }

  public updateSettings(settings: AppSettings) {
    this.settings = settings;
  }

  public onTabActivated() {
    // Refresh history when tab becomes active
    this.loadHistory();
  }

  render() {
    if (this.isLoading) {
      return html`
        <div class="loading-state">
          <div class="loading-spinner"></div>
        </div>
      `;
    }

    const currentList = this.currentView === 'recent' ? this.recentSearches : this.favorites;
    const isEmpty = currentList.length === 0;

    return html`
      <div class="history-container">
        <!-- View Toggle -->
        <div class="view-toggle">
          <button
            class="toggle-btn ${this.currentView === 'recent' ? 'active' : ''}"
            @click=${() => this.switchView('recent')}
          >
            <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12,6 12,12 16,14"/>
            </svg>
            Recent (${this.recentSearches.length})
          </button>
          <button
            class="toggle-btn ${this.currentView === 'favorites' ? 'active' : ''}"
            @click=${() => this.switchView('favorites')}
          >
            <svg class="toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Favorites (${this.favorites.length})
          </button>
        </div>

        <!-- Section Header -->
        <div class="section-header">
          <div class="section-title">
            <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${this.currentView === 'recent' ? html`
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              ` : html`
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              `}
            </svg>
            ${this.currentView === 'recent' ? 'Recent Searches' : 'Favorite Searches'}
          </div>
          ${!isEmpty ? html`
            <button class="clear-btn" @click=${this.clearAll}>
              Clear All
            </button>
          ` : ''}
        </div>

        <!-- History List -->
        <div class="history-list">
          ${isEmpty ? html`
            <div class="empty-state">
              <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${this.currentView === 'recent' ? html`
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                ` : html`
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                `}
              </svg>
              <div class="empty-title">
                No ${this.currentView === 'recent' ? 'Recent Searches' : 'Favorites'}
              </div>
              <div class="empty-subtitle">
                ${this.currentView === 'recent' 
                  ? 'Your recent searches will appear here'
                  : 'Star searches to add them to your favorites'
                }
              </div>
            </div>
          ` : html`
            ${currentList.map((search, index) => {
              const hasCachedResults = this.hasCachedResults(search);
              const isCachedMode = this.getCacheMode(search);
              const modeClass = !hasCachedResults ? 'no-cache' : (isCachedMode ? 'cached-mode' : 'fresh-mode');

              return html`
                <div class="history-item ${modeClass}" @click=${() => this.loadSearchWithMode(search)}>
                  <div class="item-header">
                    <div class="item-title">${search.displayName}</div>
                    <div class="item-actions-row">
                      ${hasCachedResults ? html`
                        <div class="mode-toggle" @click=${(e: Event) => this.toggleCacheMode(search.id, e)}>
                          <svg class="toggle-icon cache-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z"/>
                          </svg>
                          <div class="toggle-switch ${isCachedMode ? 'active' : ''}">
                            <div class="toggle-knob"></div>
                          </div>
                          <svg class="toggle-icon refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                          </svg>
                        </div>
                      ` : ''}
                      <div class="item-actions">
                        <button
                          class="action-btn star-btn ${this.isSearchFavorited(search) ? 'favorited' : ''}"
                          @click=${(e: Event) => { e.stopPropagation(); this.toggleFavorite(search, index); }}
                          title=${this.isSearchFavorited(search) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg viewBox="0 0 24 24" fill=${this.isSearchFavorited(search) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        </button>
                        <button
                          class="action-btn remove-btn"
                          @click=${(e: Event) => { e.stopPropagation(); this.removeSearch(index); }}
                          title="Remove"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="item-meta">
                    ${search.categories && search.categories.length > 0 ? html`
                      ${search.categories.map(cat => {
                        const categoryNames: Record<string, string> = {
                          'people': 'People',
                          'articles': 'Articles',
                          'media_outlets': 'Outlets',
                          'broadcast': 'Broadcast'
                        };
                        return html`<span class="category-chip">${categoryNames[cat] || cat}</span>`;
                      })}
                    ` : html`
                      <span>${search.locationName}</span>
                    `}
                    ${hasCachedResults ? html`
                      <span class="cache-badge">⚡ Cached</span>
                    ` : ''}
                    ${this.currentView === 'recent' ? html`
                      <span class="meta-separator">•</span>
                      <span>${this.getTimeAgo(search.timestamp)}</span>
                    ` : ''}
                  </div>
                  <div class="load-hint">
                    ${!hasCachedResults ? html`
                      <svg class="hint-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                      </svg>
                    ` : (isCachedMode ? html`
                      <svg class="hint-icon" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    ` : html`
                      <svg class="hint-icon" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    `)}
                    ${!hasCachedResults ?
                      'Click to load terms and search (articles not cached)' :
                      (isCachedMode ?
                        'Click to load cached results instantly' :
                        'Click to load fresh search')
                    }
                  </div>
                </div>
              `;
            })}
          `}
        </div>
      </div>
    `;
  }
}