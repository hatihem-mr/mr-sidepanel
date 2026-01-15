// ===================================================================
// SEARCH RESULTS INLINE COMPONENT - Multi-Category Accordion Results
// ===================================================================
// This component displays search results inline in the Search Tab
// using an accordion layout with expandable categories.
//
// PHASE 2: Built as separate component, not yet wired to search logic
// PHASE 4: Will be integrated into Search Tab
//
// FEATURES:
// - Accordion sections per category (People, Articles, Outlets, Broadcast)
// - Expand/collapse functionality with arrow indicators
// - Result badges showing "X found" or "0 no results"
// - Term list with status icons (✓ found, ✗ not found)
// - "Open All Results" button per category
// - Loading state during search execution
// - Empty state when no search performed
//
// DESIGN:
// - Matches mockup design from reference/screenshots/mockup.png
// - Green badges for results found
// - Red badges for no results
// - Material Design 3 styling
// ===================================================================

import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { searchResultsInlineStyles } from './search-results-inline.styles.js';
import { generateQuery } from '../../shared/utils/query-generator.js';

/**
 * Interface for a person result card (from Muck Rack)
 */
export interface PersonResult {
  name: string;
  title: string;
  location: string;
  bio: string;
  photo?: string;
}

/**
 * Interface for an article result card (from Muck Rack)
 *
 * Matches the structure returned by extractArticleResults() in search-executor.ts
 */
export interface ArticleResult {
  title: string;
  snippet: string;
  outlet: string;  // Changed from 'source' to match real data structure
  date: string;
  url?: string;    // Optional article URL
}

/**
 * Interface for an outlet result card (from Muck Rack)
 *
 * ⚠️ FAKE DATA STRUCTURE - Will be replaced with real Muck Rack data in Phase 4
 */
export interface OutletResult {
  name: string;
  description: string;
  type?: string;
}

/**
 * Interface for a single search term result
 */
export interface SearchTermResult {
  term: string;           // Original search term
  found: boolean;         // Whether results were found
  count?: number;         // Number of results found (optional)
  expanded?: boolean;     // Whether result preview is expanded (for sub-accordion)

  // ⚠️ FAKE DATA - Preview results from Muck Rack (will be real data in Phase 4)
  peopleResults?: PersonResult[];      // For People searches
  articleResults?: ArticleResult[];    // For Articles searches
  outletResults?: OutletResult[];      // For Outlets searches
}

/**
 * Interface for a category section in the accordion
 */
export interface CategoryResults {
  category: string;        // Category ID ('people', 'articles', 'media_outlets', 'broadcast')
  categoryName: string;    // Display name ('People', 'Articles', 'Media Outlets', 'Broadcast')
  terms: SearchTermResult[]; // Array of term results for this category
  expanded: boolean;       // Whether this section is expanded
}

/**
 * Search Results Inline Component
 *
 * Displays multi-category search results in an accordion layout
 * directly within the Search Tab (not a separate tab).
 */
@customElement('search-results-inline')
export class SearchResultsInline extends LitElement {
  /**
   * Array of category results to display
   */
  @property({ type: Array })
  results: CategoryResults[] = [];

  /**
   * Whether search is currently in progress
   */
  @property({ type: Boolean })
  isLoading = false;

  /**
   * Callback fired when user clicks "Open Results" button
   */
  @property({ type: Object })
  onOpenResults?: (category: string) => void;

  /**
   * Set of flipped card IDs (format: "category-termName")
   */
  @state()
  private flippedCards: Set<string> = new Set();

  /**
   * Whether articles are expanded (show 3 preview or 10 max)
   */
  @state()
  private articlesExpanded = false;

  /**
   * Set of expanded term sub-accordions (format: "category-termName")
   */
  @state()
  private expandedTerms: Set<string> = new Set();

  /**
   * Whether "Not Found" section is expanded
   */
  @state()
  private notFoundExpanded = false;

  /**
   * Toggle card flip state
   */
  private toggleCardFlip(category: string, termName: string, event: Event) {
    event.stopPropagation();
    const cardId = `${category}-${termName}`;
    const newFlipped = new Set(this.flippedCards);

    if (newFlipped.has(cardId)) {
      newFlipped.delete(cardId);
    } else {
      newFlipped.add(cardId);
    }

    this.flippedCards = newFlipped;
  }

  /**
   * Check if a card is flipped
   */
  private isCardFlipped(category: string, termName: string): boolean {
    return this.flippedCards.has(`${category}-${termName}`);
  }

  /**
   * Extract snippet/bio from peopleResults or outletResults
   */
  private getSnippetData(term: SearchTermResult, category: CategoryResults) {
    // For people, try to get bio/description from first result
    if (category.category === 'people' && term.peopleResults && term.peopleResults.length > 0) {
      const person = term.peopleResults[0];
      return {
        title: person.title || '',
        snippet: person.bio || 'No bio available',
        articleCount: term.count || 0,
        outletCount: 0
      };
    }

    // For outlets, try to get description from first result
    if (category.category === 'media_outlets' && term.outletResults && term.outletResults.length > 0) {
      const outlet = term.outletResults[0];
      return {
        title: outlet.type || '',
        snippet: outlet.description || 'No description available',
        articleCount: term.count || 0,
        outletCount: 0
      };
    }

    // Default fallback
    return {
      title: '',
      snippet: 'Profile information will be displayed here once available from Muck Rack search results.',
      articleCount: term.count || 0,
      outletCount: 0
    };
  }

  // Import styles from separate file for better maintainability
  static styles = searchResultsInlineStyles;

  /**
   * Toggle category expansion
   */
  private toggleCategory(category: string) {
    this.results = this.results.map(result =>
      result.category === category
        ? { ...result, expanded: !result.expanded }
        : result
    );
  }

  /**
   * Toggle term result preview expansion (sub-accordion)
   */
  private toggleTermResults(category: string, termIndex: number) {
    this.results = this.results.map(result => {
      if (result.category === category) {
        const newTerms = [...result.terms];
        newTerms[termIndex] = {
          ...newTerms[termIndex],
          expanded: !newTerms[termIndex].expanded
        };
        return { ...result, terms: newTerms };
      }
      return result;
    });
  }

  /**
   * Handle "Open Results" button click
   */
  private handleOpenResults(category: string) {
    if (this.onOpenResults) {
      this.onOpenResults(category);
    }
    // Also dispatch custom event for parent component
    this.dispatchEvent(new CustomEvent('open-results', {
      detail: { category },
      bubbles: true
    }));
  }

  /**
   * Handle copy single link button click
   */
  private async handleCopyLink(term: SearchTermResult, category: CategoryResults) {
    try {
      // Build Muck Rack URL for this person/outlet
      const baseUrl = 'https://muckrack.com/search/results';
      // Use query generator to handle boolean queries correctly
      const queryType = category.category === 'people' ? 'person_search' : undefined;
      const processedQuery = generateQuery(term.term, queryType);
      const params = new URLSearchParams({
        result_type: category.category === 'people' ? 'person' : 'media_outlet',
        q: processedQuery
      });

      // Add must_appear_in_people=names filter for People searches
      // TODO: Disable this filter when Broad Search is enabled
      if (category.category === 'people') {
        params.set('must_appear_in_people', 'names');
      }

      const url = `${baseUrl}?${params.toString()}`;

      // Get the display name (from Muck Rack if available, otherwise search term)
      const displayName = term.peopleResults?.[0]?.name || term.outletResults?.[0]?.name || term.term;

      // Copy as HTML hyperlink for rich text editors (Intercom)
      const html = `<a href="${url}">${displayName}</a>`;
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([url], { type: 'text/plain' })
      });

      await navigator.clipboard.write([clipboardItem]);

      // Show visual feedback (you can enhance this with a toast notification)
      console.log(`✓ Copied hyperlink for ${displayName}`);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  }

  /**
   * Handle view profile button click
   */
  private handleViewProfile(event: Event | null, term: SearchTermResult, category: CategoryResults) {
    if (event) {
      event.preventDefault();
    }

    // Build Muck Rack URL
    const baseUrl = 'https://muckrack.com/search/results';
    // Use query generator to handle boolean queries correctly
    const queryType = category.category === 'people' ? 'person_search' : undefined;
    const processedQuery = generateQuery(term.term, queryType);
    const params = new URLSearchParams({
      result_type: category.category === 'people' ? 'person' : 'media_outlet',
      q: processedQuery
    });

    // Add must_appear_in_people=names filter for People searches
    // TODO: Disable this filter when Broad Search is enabled
    if (category.category === 'people') {
      params.set('must_appear_in_people', 'names');
    }

    const url = `${baseUrl}?${params.toString()}`;

    // Open in new tab
    window.open(url, '_blank');
  }

  /**
   * Handle copy all links button click
   */
  private async handleCopyAllLinks(category: CategoryResults, foundTerms: SearchTermResult[]) {
    try {
      const links = foundTerms.map(term => {
        const baseUrl = 'https://muckrack.com/search/results';
        // Use query generator to handle boolean queries correctly
        const queryType = category.category === 'people' ? 'person_search' : undefined;
        const processedQuery = generateQuery(term.term, queryType);
        const params = new URLSearchParams({
          result_type: category.category === 'people' ? 'person' : 'media_outlet',
          q: processedQuery
        });

        // Add must_appear_in_people=names filter for People searches
        // TODO: Disable this filter when Broad Search is enabled
        if (category.category === 'people') {
          params.set('must_appear_in_people', 'names');
        }

        return `${term.term}: ${baseUrl}?${params.toString()}`;
      }).join('\n');

      await navigator.clipboard.writeText(links);

      // Show visual feedback
      console.log(`✓ Copied ${foundTerms.length} links to clipboard`);
    } catch (error) {
      console.error('Failed to copy all links:', error);
    }
  }

  /**
   * Handle send to editorial team button click
   * Uses same format as results-tab.ts generateEditorialMessage()
   */
  private async handleSendToEditorial(category: CategoryResults, missingTerms: SearchTermResult[]) {
    try {
      const itemType = category.category === 'people' ? 'person' : 'media outlet';
      const isPlural = missingTerms.length > 1;
      const itemLabel = isPlural ? `${itemType}s` : itemType;
      const pronoun = isPlural ? 'these' : 'this';

      const message = `Hey Editorial - I am passing off this customer to you to add ${pronoun} ${itemLabel} to the db

${missingTerms.map(term => term.term).join('\n')}

Action after research complete: RESPOND`;

      await navigator.clipboard.writeText(message);

      // Show visual feedback
      console.log(`✓ Copied editorial message for ${missingTerms.length} missing ${itemLabel}`);
    } catch (error) {
      console.error('Failed to copy editorial message:', error);
    }
  }

  /**
   * Export articles to CSV file
   */
  private handleExportCSV(category: CategoryResults) {
    try {
      // Collect all article results
      const allArticles: ArticleResult[] = [];
      category.terms.forEach(term => {
        if (term.articleResults) {
          allArticles.push(...term.articleResults);
        }
      });

      if (allArticles.length === 0) {
        console.log('No articles to export');
        return;
      }

      // Create CSV content
      const headers = ['Title', 'Snippet', 'Outlet', 'Date', 'URL'];
      const rows = allArticles.map(article => [
        this.escapeCSV(article.title),
        this.escapeCSV(article.snippet),
        this.escapeCSV(article.outlet),
        this.escapeCSV(article.date),
        this.escapeCSV(article.url || '')
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `muckrack_articles_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      console.log(`✓ Exported ${allArticles.length} articles to CSV`);
    } catch (error) {
      console.error('Failed to export CSV:', error);
    }
  }

  /**
   * Copy article URLs to clipboard
   */
  private async handleCopyURLs(category: CategoryResults) {
    try {
      // Collect all article URLs
      const allArticles: ArticleResult[] = [];
      category.terms.forEach(term => {
        if (term.articleResults) {
          allArticles.push(...term.articleResults);
        }
      });

      const urls = allArticles
        .filter(article => article.url)
        .map(article => article.url)
        .join('\n');

      if (!urls) {
        console.log('No article URLs to copy');
        return;
      }

      await navigator.clipboard.writeText(urls);
      console.log(`✓ Copied ${allArticles.length} article URLs to clipboard`);
    } catch (error) {
      console.error('Failed to copy URLs:', error);
    }
  }

  /**
   * Escape CSV field (handle commas, quotes, newlines)
   */
  private escapeCSV(field: string): string {
    if (!field) return '""';

    // Convert to string and escape quotes
    const str = String(field).replace(/"/g, '""');

    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str}"`;
    }

    return str;
  }

  /**
   * Get total count of results found across all terms
   *
   * CRITICAL: Sum ALL counts from Muck Rack, don't count terms!
   *
   * Example with Broad Search OFF (must_appear_in_people=names):
   *   Kyle Kulinski: 1 person + Krystal Ball: 1 person + Ana Kasparian: 1 person = 3 total
   *
   * Example with Broad Search ON (no filter):
   *   Kyle Kulinski: 256 people + Krystal Ball: 150 people + Ana Kasparian: 89 people = 495 total
   */
  private getFoundCount(terms: SearchTermResult[], category?: string): number {
    // Sum all the individual counts from Muck Rack (works for all categories)
    return terms.reduce((sum, term) => sum + (term.count || 0), 0);
  }

  /**
   * Get count of terms without results
   */
  private getNotFoundCount(terms: SearchTermResult[]): number {
    return terms.filter(t => !t.found).length;
  }

  /**
   * Render person result card
   *
   * ⚠️ USES FAKE DATA - Will be replaced with real Muck Rack person data in Phase 4
   */
  private renderPersonCard(person: PersonResult) {
    // Get initials for placeholder photo
    const initials = person.name.split(' ').map(n => n[0]).join('').toUpperCase();

    return html`
      <div class="person-card">
        <div class="person-photo">${initials}</div>
        <div class="person-info">
          <div class="person-name">${person.name}</div>
          <div class="person-title">${person.title}</div>
          <div class="person-outlet">${person.outlet}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render article result card
   *
   * Interactions:
   * - Click title: Open article in new tab
   * - Click card: Copy article link to clipboard (shows checkmark animation)
   */
  private renderArticleCard(article: ArticleResult) {
    return html`
      <div class="article-card" @click=${(e: Event) => {
        // Don't copy if clicking on the title link
        if ((e.target as HTMLElement).closest('.article-title')) {
          return;
        }
        e.stopPropagation();

        // Copy article link to clipboard
        if (article.url) {
          const html = `<a href="${article.url}">${article.title}</a>`;
          const clipboardItem = new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([article.url], { type: 'text/plain' })
          });
          navigator.clipboard.write([clipboardItem]);

          // Trigger checkmark animation
          const card = e.currentTarget as HTMLElement;
          const checkmark = card.querySelector('.checkmark-container');
          if (checkmark) {
            checkmark.classList.add('show');
            setTimeout(() => checkmark.classList.remove('show'), 800);
          }
        }
      }}>
        <div class="checkmark-container">
          <div class="checkmark">
            <svg viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
        </div>

        <div class="article-title" @click=${(e: Event) => {
          e.stopPropagation();
          if (article.url) {
            window.open(article.url, '_blank');
          }
        }} style="cursor: pointer; text-decoration: none;">
          ${article.title}
        </div>
        <div class="article-snippet">${article.snippet}</div>
        <div class="article-meta">
          <div class="article-source">${article.outlet}</div>
          <div class="article-date">${article.date}</div>
        </div>
      </div>
    `;
  }

  /**
   * Render outlet result card with icon and header
   *
   * Updated to match mockup design from reference/result-card-mockup.html
   */
  private renderOutletCard(outlet: OutletResult) {
    return html`
      <div class="outlet-card">
        <div class="outlet-header">
          <div class="outlet-icon">
            <svg viewBox="0 0 24 24" stroke-width="2">
              <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15"></path>
            </svg>
          </div>
          <div class="outlet-name">${outlet.name}</div>
          ${outlet.type ? html`<div class="outlet-type">${outlet.type}</div>` : ''}
        </div>
        <div class="outlet-description">${outlet.description}</div>
      </div>
    `;
  }

  /**
   * Render cards for a single search term based on category type
   * Shows top 3 results for the given term
   */
  private renderTermCards(term: SearchTermResult, category: string) {
    if (!term) return html``;

    // People cards
    if (category === 'people' && term.peopleResults) {
      return term.peopleResults.slice(0, 3).map(person => this.renderPersonCard(person));
    }

    // Article cards
    if (category === 'articles' && term.articleResults) {
      return term.articleResults.slice(0, 3).map(article => this.renderArticleCard(article));
    }

    // Outlet cards
    if (category === 'media_outlets' && term.outletResults) {
      return term.outletResults.slice(0, 3).map(outlet => this.renderOutletCard(outlet));
    }

    return html``;
  }

  /**
   * Render all terms with their results for a category - Option 1 Split Sections Design
   * Splits into Found and Missing sections with appropriate actions
   *
   * SPECIAL CASE: Articles always have results (no "missing"), so just show article list directly
   */
  private renderAllTermResults(category: CategoryResults) {
    // ARTICLES: Just show article results directly (no Found/Missing sections)
    if (category.category === 'articles') {
      const allArticles: any[] = [];
      category.terms.forEach(term => {
        if (term.articleResults) {
          allArticles.push(...term.articleResults);
        }
      });

      const PREVIEW_COUNT = 3;
      const MAX_COUNT = 10;
      const displayCount = this.articlesExpanded ? MAX_COUNT : PREVIEW_COUNT;
      const displayedArticles = allArticles.slice(0, displayCount);
      const hasMore = allArticles.length > displayCount;
      const showingAll = displayedArticles.length >= allArticles.length;

      return html`
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${displayedArticles.map(article => this.renderArticleCard(article))}

          ${hasMore || this.articlesExpanded ? html`
            <button
              @click=${() => { this.articlesExpanded = !this.articlesExpanded; }}
              style="padding: 10px; background: var(--bg-elevated); color: var(--primary); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; transition: var(--transition-fast);"
              @mouseover=${(e: MouseEvent) => {
                (e.target as HTMLElement).style.background = 'var(--bg-secondary)';
                (e.target as HTMLElement).style.borderColor = 'var(--primary)';
              }}
              @mouseout=${(e: MouseEvent) => {
                (e.target as HTMLElement).style.background = 'var(--bg-elevated)';
                (e.target as HTMLElement).style.borderColor = 'var(--border)';
              }}>
              ${this.articlesExpanded ? 'Show Less' : `Show More (${Math.min(allArticles.length, MAX_COUNT) - PREVIEW_COUNT} more)`}
              <svg style="width: 14px; height: 14px; transform: ${this.articlesExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          ` : ''}
        </div>
      `;
    }

    // MEDIA OUTLETS: Sub-dropdowns per search term with top 3 results
    if (category.category === 'media_outlets') {
      const foundTerms = category.terms.filter(term => term.found);
      const missingTerms = category.terms.filter(term => !term.found);

      return html`
        <!-- Found Outlets - Sub-dropdowns per search term -->
        ${foundTerms.length > 0 ? html`
          <div class="status-section">
            ${foundTerms.map(term => {
              const topOutlets = term.outletResults?.slice(0, 3) || [];
              const termId = `${category.category}-${term.term}`;
              const isExpanded = this.expandedTerms.has(termId);

              return html`
                <div class="term-sub-accordion">
                  <div class="term-sub-header" @click=${() => {
                    const newExpanded = new Set(this.expandedTerms);
                    if (newExpanded.has(termId)) {
                      newExpanded.delete(termId);
                    } else {
                      newExpanded.add(termId);
                    }
                    this.expandedTerms = newExpanded;
                  }}>
                    <span class="term-sub-name">${term.term}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="term-sub-count">${topOutlets.length} results</span>
                      <svg
                        style="width: 16px; height: 16px; transition: transform 0.2s; transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </div>

                  <!-- Top 3 outlet cards -->
                  <div class="term-sub-content ${isExpanded ? '' : 'collapsed'}">
                  ${topOutlets.map(outlet => {
                    const outletCardId = `${category.category}-${outlet.name}`;
                    const isFlipped = this.flippedCards.has(outletCardId);

                    return html`
                      <div class="card-wrapper">
                        <div
                          class="person-card ${isFlipped ? 'flipped' : ''}"
                          @click=${(e: Event) => {
                            e.stopPropagation();
                            const newFlipped = new Set(this.flippedCards);
                            if (newFlipped.has(outletCardId)) {
                              newFlipped.delete(outletCardId);
                            } else {
                              newFlipped.add(outletCardId);
                            }
                            this.flippedCards = newFlipped;
                          }}>

                          <!-- Front Face -->
                          <div class="card-face card-front">
                            ${this.renderOutletCardFront(outlet, term.term)}
                          </div>

                          <!-- Back Face -->
                          <div class="card-face card-back">
                            <div class="snippet-container">
                              <div class="snippet-text">
                                <div class="snippet-bio">${outlet.description || 'No description available'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  })}
                  </div>
                </div>
              `;
            })}
          </div>
        ` : ''}

        <!-- Missing Section -->
        ${missingTerms.length > 0 ? html`
          <div class="status-section">
            <div class="term-sub-accordion">
              <div class="term-sub-header" @click=${() => {
                this.notFoundExpanded = !this.notFoundExpanded;
              }}>
                <span class="term-sub-name">Not Found</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="term-sub-count">${missingTerms.length} missing</span>
                  <svg
                    style="width: 16px; height: 16px; transition: transform 0.2s; transform: ${this.notFoundExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              <div class="term-sub-content ${this.notFoundExpanded ? '' : 'collapsed'}">
                ${missingTerms.map(term => html`
                  <div class="person-card missing">
                    ${this.renderPersonCardContent(term, category, true)}
                  </div>
                `)}

                <button
                  class="section-action-btn secondary"
                  @click=${() => this.handleSendToEditorial(category, missingTerms)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy All Missing (${missingTerms.length})
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      `;
    }

    // PEOPLE: Use Found/Missing split sections
    const foundTerms = category.terms.filter(term => term.found);
    const missingTerms = category.terms.filter(term => !term.found);

    return html`
      <!-- FOUND SECTION -->
      ${foundTerms.length > 0 ? html`
        <div class="status-section">
          <!-- Found Terms Cards -->
          ${foundTerms.map(term => {
            const isFlipped = this.isCardFlipped(category.category, term.term);
            const snippetData = this.getSnippetData(term, category);

            return html`
              <div class="card-wrapper">
                <div
                  class="person-card ${isFlipped ? 'flipped' : ''}"
                  @click=${(e: Event) => this.toggleCardFlip(category.category, term.term, e)}>

                  <!-- Front Face -->
                  <div class="card-face card-front">
                    ${this.renderPersonCardContent(term, category)}
                  </div>

                  <!-- Back Face -->
                  <div class="card-face card-back">
                    <div class="snippet-container">
                      <div class="snippet-text">
                        <div class="snippet-bio">${snippetData.snippet}</div>
                      </div>
                      ${snippetData.articleCount > 0 || snippetData.outletCount > 0 ? html`
                        <div class="snippet-stats">
                          ${snippetData.articleCount > 0 ? html`
                            <div class="stat-item">
                              <span class="stat-value">${snippetData.articleCount}</span> Articles
                            </div>
                          ` : ''}
                          ${snippetData.outletCount > 0 ? html`
                            <div class="stat-item">
                              <span class="stat-value">${snippetData.outletCount}</span> Outlets
                            </div>
                          ` : ''}
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              </div>
            `;
          })}
        </div>
      ` : ''}

      <!-- MISSING SECTION -->
      ${missingTerms.length > 0 ? html`
        <div class="status-section">
          <!-- Missing Terms Cards -->
          ${missingTerms.map(term => html`
            <div class="person-card missing">
              ${this.renderPersonCardContent(term, category, true)}
            </div>
          `)}

          <!-- Copy All Missing Button -->
          <button
            class="section-action-btn secondary"
            @click=${() => this.handleSendToEditorial(category, missingTerms)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy All Missing (${missingTerms.length})
          </button>
        </div>
      ` : ''}
    `;
  }

  /**
   * Render outlet card front - shows actual outlet name and type
   */
  private renderOutletCardFront(outlet: OutletResult, searchTerm: string) {
    const getInitials = (name: string) => {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    const initials = getInitials(outlet.name);
    const displayQuery = `"${searchTerm}"`;

    return html`
      <div class="card-content">
        <div class="person-avatar">
          ${outlet.icon ? html`
            <img src="${outlet.icon}" alt="${outlet.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" />
          ` : initials}
        </div>
        <div class="person-info">
          <div class="person-name">${outlet.name}</div>
          ${outlet.type ? html`
            <div class="person-title-front">${outlet.type}</div>
          ` : html`
            <div style="height: 8px;"></div>
          `}
          <div class="person-query">${displayQuery}</div>
        </div>

        <div class="person-actions">
          <button class="card-btn" @click=${(e: Event) => {
            e.stopPropagation();
            // Copy link functionality for outlets
            const baseUrl = 'https://muckrack.com/search/results';
            const processedQuery = generateQuery(searchTerm);
            const params = new URLSearchParams({
              result_type: 'media_outlet',
              q: processedQuery
            });
            const url = `${baseUrl}?${params.toString()}`;
            const html = `<a href="${url}">${outlet.name}</a>`;
            const clipboardItem = new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([url], { type: 'text/plain' })
            });
            navigator.clipboard.write([clipboardItem]);
          }} title="Copy Link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </button>
          <button class="card-btn" @click=${(e: Event) => {
            e.stopPropagation();
            const baseUrl = 'https://muckrack.com/search/results';
            const processedQuery = generateQuery(searchTerm);
            const params = new URLSearchParams({
              result_type: 'media_outlet',
              q: processedQuery
            });
            const url = `${baseUrl}?${params.toString()}`;
            window.open(url, '_blank');
          }} title="View Profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15,3 21,3 21,9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render person card content for Option 1 design
   * Shows avatar, name, query, and action buttons
   */
  private renderPersonCardContent(term: SearchTermResult, category: CategoryResults, isMissing: boolean = false) {
    // Generate initials from term name
    const getInitials = (name: string) => {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    const initials = getInitials(term.term);
    const displayQuery = `"${term.term}"`; // Show query with quotes

    // Get photo and title from first result if available
    const photo = term.peopleResults?.[0]?.photo || term.outletResults?.[0]?.photo;
    const title = term.peopleResults?.[0]?.title || term.outletResults?.[0]?.type || '';

    return html`
      <div class="card-content">
        <div class="person-avatar">
          ${photo ? html`
            <img src="${photo}" alt="${term.term}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" />
          ` : initials}
        </div>
        <div class="person-info">
          <div class="person-name">${term.term}</div>
          ${!isMissing && title ? html`
            <div class="person-title-front">${title}</div>
          ` : html`
            <div style="height: 8px;"></div>
          `}
          <div class="person-query">${displayQuery}</div>
          ${isMissing ? html`
            <div class="person-status missing" style="margin-top: 4px;">✗ Not Found</div>
          ` : ''}
        </div>

        ${!isMissing ? html`
          <div class="person-actions">
            <button class="card-btn" @click=${(e: Event) => { e.stopPropagation(); this.handleCopyLink(term, category); }} title="Copy Link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </button>
            <button class="card-btn" @click=${(e: Event) => { e.stopPropagation(); this.handleViewProfile(null, term, category); }} title="View Profile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render "+X more results" text based on term count
   */
  private renderMoreResultsText(term: SearchTermResult, categoryName: string) {
    if (!term || !term.count || term.count <= 3) return html``;

    const remaining = term.count - 3;
    const displayName = categoryName.toLowerCase();

    return html`
      <div class="view-more-btn">
        + ${remaining} more ${displayName}
      </div>
    `;
  }

  /**
   * Render result preview cards based on category type
   * Shows top 3 results with "View more" if more exist
   *
   * ⚠️ DEPRECATED - Use renderCategoryCards() instead (no sub-accordion)
   */
  private renderResultPreview(category: string, term: SearchTermResult) {
    const MAX_PREVIEW = 3; // Show max 3 results inline

    // People results
    if (term.peopleResults && term.peopleResults.length > 0) {
      const previewResults = term.peopleResults.slice(0, MAX_PREVIEW);
      const remaining = term.peopleResults.length - MAX_PREVIEW;

      return html`
        <div class="result-cards">
          ${previewResults.map(person => this.renderPersonCard(person))}
          ${remaining > 0 ? html`
            <div class="view-more-btn">
              + ${remaining} more people (click "Open Results" to see all)
            </div>
          ` : ''}
        </div>
      `;
    }

    // Article results
    if (term.articleResults && term.articleResults.length > 0) {
      const previewResults = term.articleResults.slice(0, MAX_PREVIEW);
      const remaining = term.articleResults.length - MAX_PREVIEW;

      return html`
        <div class="result-cards">
          ${previewResults.map(article => this.renderArticleCard(article))}
          ${remaining > 0 ? html`
            <div class="view-more-btn">
              + ${remaining} more articles (click "Open Results" to see all)
            </div>
          ` : ''}
        </div>
      `;
    }

    // Outlet results
    if (term.outletResults && term.outletResults.length > 0) {
      const previewResults = term.outletResults.slice(0, MAX_PREVIEW);
      const remaining = term.outletResults.length - MAX_PREVIEW;

      return html`
        <div class="result-cards">
          ${previewResults.map(outlet => this.renderOutletCard(outlet))}
          ${remaining > 0 ? html`
            <div class="view-more-btn">
              + ${remaining} more outlets (click "Open Results" to see all)
            </div>
          ` : ''}
        </div>
      `;
    }

    return html``;
  }

  /**
   * Render icon for category
   */
  private renderCategoryIcon(category: string) {
    switch (category) {
      case 'people':
        return html`
          <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        `;
      case 'articles':
        return html`
          <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
        `;
      case 'media_outlets':
        return html`
          <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
        `;
      case 'broadcast':
        return html`
          <svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="2"/>
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
          </svg>
        `;
      default:
        return html``;
    }
  }

  render() {
    // Loading state
    if (this.isLoading) {
      return html`
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <div style="color: var(--text-secondary); font-size: 14px;">
            Checking search results...
          </div>
        </div>
      `;
    }

    // Empty state
    if (!this.results || this.results.length === 0) {
      return html`
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <div style="font-size: 14px; color: var(--text-secondary);">
            Select categories and click Search to see results
          </div>
        </div>
      `;
    }

    // Results accordion
    return html`
      <div class="results-container">
        ${this.results.map(category => {
          const foundCount = this.getFoundCount(category.terms, category.category);
          const notFoundCount = this.getNotFoundCount(category.terms);

          return html`
            <div class="category-section">
              <!-- Category Header -->
              <div
                class="category-header"
                @click=${() => this.toggleCategory(category.category)}>
                ${this.renderCategoryIcon(category.category)}
                <div class="category-name">${category.categoryName}</div>

                ${foundCount > 0 || category.terms.some(t => t.found) ? html`
                  <div class="result-badge found">
                    ${category.category === 'articles' && foundCount > 0
                      ? `${foundCount} found`
                      : `${category.terms.filter(t => t.found).length}/${category.terms.length} Found`}
                  </div>
                ` : ''}

                ${notFoundCount > 0 && category.terms.filter(t => t.found).length === 0 ? html`
                  <div class="result-badge not-found">
                    No results
                  </div>
                ` : ''}

                <svg
                  class="expand-arrow ${category.expanded ? 'expanded' : ''}"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2">
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </div>

              <!-- Category Content (collapsible) -->
              <div class="category-content ${category.expanded ? '' : 'collapsed'}">
                <!-- Export/Copy/Open buttons (Articles only) -->
                ${category.category === 'articles' ? html`
                  <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                    <button
                      style="flex: 1; padding: 10px 16px; background: var(--bg-elevated); color: #16A085; border: 1px solid rgba(22, 160, 133, 0.3); border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: var(--transition-fast);"
                      @click=${() => this.handleExportCSV(category)}
                      @mouseover=${(e: MouseEvent) => {
                        (e.target as HTMLElement).style.background = 'rgba(22, 160, 133, 0.1)';
                        (e.target as HTMLElement).style.borderColor = 'rgba(22, 160, 133, 0.5)';
                      }}
                      @mouseout=${(e: MouseEvent) => {
                        (e.target as HTMLElement).style.background = 'var(--bg-elevated)';
                        (e.target as HTMLElement).style.borderColor = 'rgba(22, 160, 133, 0.3)';
                      }}>
                      <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Export CSV
                    </button>
                    <button
                      style="flex: 1; padding: 10px 16px; background: var(--bg-elevated); color: #16A085; border: 1px solid rgba(22, 160, 133, 0.3); border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: var(--transition-fast);"
                      @click=${() => this.handleCopyURLs(category)}
                      @mouseover=${(e: MouseEvent) => {
                        (e.target as HTMLElement).style.background = 'rgba(22, 160, 133, 0.1)';
                        (e.target as HTMLElement).style.borderColor = 'rgba(22, 160, 133, 0.5)';
                      }}
                      @mouseout=${(e: MouseEvent) => {
                        (e.target as HTMLElement).style.background = 'var(--bg-elevated)';
                        (e.target as HTMLElement).style.borderColor = 'rgba(22, 160, 133, 0.3)';
                      }}>
                      <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copy URLs
                    </button>
                    <button
                      style="flex: 1; padding: 10px 16px; background: var(--bg-elevated); color: #16A085; border: 1px solid rgba(22, 160, 133, 0.3); border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: var(--transition-fast);"
                      @click=${() => this.handleOpenResults(category.category)}
                      @mouseover=${(e: MouseEvent) => {
                        (e.target as HTMLElement).style.background = 'rgba(22, 160, 133, 0.1)';
                        (e.target as HTMLElement).style.borderColor = 'rgba(22, 160, 133, 0.5)';
                      }}
                      @mouseout=${(e: MouseEvent) => {
                        (e.target as HTMLElement).style.background = 'var(--bg-elevated)';
                        (e.target as HTMLElement).style.borderColor = 'rgba(22, 160, 133, 0.3)';
                      }}>
                      <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15,3 21,3 21,9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      Open Results
                    </button>
                  </div>
                ` : ''}

                <!-- All term results (loops through each search term) -->
                ${this.renderAllTermResults(category)}

                <!-- Open Results Button (People/Outlets only - Articles has it at top) -->
                ${foundCount > 0 && category.category !== 'articles' ? html`
                  <button
                    class="open-results-btn"
                    @click=${() => this.handleOpenResults(category.category)}>
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15,3 21,3 21,9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    OPEN ALL ${category.categoryName.toUpperCase()} RESULTS (${foundCount})
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'search-results-inline': SearchResultsInline;
  }
}
