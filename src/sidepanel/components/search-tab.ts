// ===================================================================
// SEARCH TAB COMPONENT - Primary User Interface
// ===================================================================
// This is the main search interface component built with Lit Element.
// It handles user input, file uploads, search configuration, and
// initiates the search process.
//
// LIT ELEMENT ARCHITECTURE:
// ┌─────────────────────────┐
// │   SearchTabComponent    │
// │                         │
// │ • Reactive properties   │ ← @property (from parent)
// │ • Internal state        │ ← @state (component internal)
// │ • Template rendering    │ ← render() method
// │ • Event handling        │ ← Event listeners
// │ • Lifecycle methods     │ ← connectedCallback, etc.
// └─────────────────────────┘
//            │
//            ▼ Custom DOM Events
// ┌─────────────────────────┐
// │     SidePanelApp        │
// │  (Main Controller)      │
// │                         │
// │ • search-initiated      │ ← When user starts search
// │ • switch-tab            │ ← Request tab changes
// │ • component-error       │ ← Error reporting
// └─────────────────────────┘
//
// COMPONENT RESPONSIBILITIES:
// 1. Search Input Management: Text area, dropdowns, checkboxes
// 2. File Upload Processing: CSV, TXT files, Google Sheets URLs
// 3. Search Configuration: Location selection, result checking options
// 4. Data Validation: Input sanitization, file format validation
// 5. Query Generation: Convert user input to Muck Rack search URLs
// 6. Event Dispatching: Communicate with parent controller
// 7. State Persistence: Remember user preferences across sessions
//
// KEY FEATURES:
// - Smart query generation (TechCrunch → "TechCrunch" OR "techcrunch")
// - Bulk search support (upload lists of terms)
// - Google Sheets integration (public sheet URL parsing)
// - Real-time character/term counting with limits
// - Drag & drop file upload with visual feedback
// - Auto-population from selected text on pages
// - Search history integration
//
// DEBUGGING COMPONENT ISSUES:
// - Use browser DevTools on side panel (right-click → Inspect)
// - Check render() method for template errors
// - Verify @property and @state updates trigger re-renders
// - Monitor custom events in parent's event listeners
// - Check CSS styles in Shadow DOM (component level)
// ===================================================================

import { LitElement, html, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ALL_SEARCH_LOCATIONS, LIMITS, STORAGE_KEYS } from '../../shared/constants.js';
import { generateQuery, generateQueries, extractBooleanOperators } from '../../shared/utils/query-generator.js';
import { parseText } from '../../shared/utils/text-parser.js';
import { cleanUrls } from '../../shared/utils/url-utils.js';
import { getCurrentContactName } from '../../shared/utils/intercom-utils.js';
import { CSVParser } from '../../shared/api/csv-parser.js';
import { StorageService } from '../../shared/api/storage.js';
import { SelectionUpdateService } from '../../shared/services/selection-update.js';
import { IS_DEV } from '../../shared/utils/debug.js';
import type { SearchLocation, AppSettings, SearchTerm, UploadedFile, SearchHistory, SearchResultsCache } from '../../shared/types/index.js';
import type { CategoryResults } from './search-results-inline.js';
import './search-results-inline.js';
import { executeMultiCategorySearch } from '../services/search-executor.js';
import { searchTabStyles } from './search-tab.styles.js';

// Material Design 3 Web Components
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/icon/icon.js';
import '@material/web/elevation/elevation.js';

/**
 * Search Tab Component - Primary search interface using Lit Element
 * 
 * LIT ELEMENT REACTIVE SYSTEM:
 * - @property: Properties passed from parent component (e.g., settings)
 * - @state: Internal component state that triggers re-renders
 * - render(): Template method called when properties/state change
 * - Shadow DOM: Encapsulated styling and DOM structure
 * 
 * PROPERTY vs STATE:
 * - Properties: Data flow DOWN from parent (SidePanelApp → SearchTabComponent)
 * - State: Internal component data, changes trigger re-renders
 * - Events: Communication UP to parent (SearchTabComponent → SidePanelApp)
 * 
 * COMMUNICATION PATTERNS:
 * Parent → Component: Properties and method calls
 * Component → Parent: Custom DOM events with detail data
 * Component → Storage: Direct StorageService calls for persistence
 * Component → Services: Utility services for processing
 */
export class SearchTabComponent extends LitElement {
  // ===================================================================
  // REACTIVE PROPERTIES & STATE - Lit Element Data Management
  // ===================================================================
  
  /**
   * Settings passed from parent SidePanelApp
   * Contains theme preferences, API keys, and user configuration
   * 
   * REACTIVE BEHAVIOR: When parent updates settings, component re-renders
   * USAGE: Used for theme application and feature availability
   * TYPE: @property means this comes from parent component
   */
  @property({ type: Object })
  settings: AppSettings | null = null;

  // ===================================================================
  // INTERNAL COMPONENT STATE - Triggers Re-renders When Changed
  // ===================================================================

  /**
   * Current search input text from textarea
   * REACTIVE: Changes trigger re-render of character count, term preview
   * SOURCE: User typing, file uploads, text selection auto-population
   */
  @state()
  private searchText = '';

  /**
   * Selected search location (media_outlet, person, article, etc.)
   * REACTIVE: Changes affect UI options and search URL generation
   * PERSISTENCE: Saved to Chrome storage for user preference
   */
  @state()
  private selectedLocation = '';

  /**
   * Whether to pre-check search results before opening tabs
   * REACTIVE: Affects search button text and loading behavior
   * FEATURE: Enables "smart" search that avoids empty result tabs
   */
  @state()
  private checkResults = false;

  /**
   * Loading state during search execution
   * REACTIVE: Shows/hides spinner, disables search button
   * TRIGGER: Set true during query generation and result checking
   */
  @state()
  private isLoading = false;

  /**
   * Drag & drop visual feedback state
   * REACTIVE: Changes file upload area styling during drag operations
   * UX: Provides clear visual cues for file drop zones
   */
  @state()
  private dragOver = false;

  /**
   * File upload processing status message
   * REACTIVE: Shows upload progress, errors, success messages
   * DISPLAY: Appears below file upload area with color-coded styling
   */
  @state()
  private fileUploadStatus = '';

  /**
   * Available search locations configuration
   * REACTIVE: Changes affect dropdown options and search capabilities
   * SOURCE: Loaded from constants, potentially customizable per user
   */
  @state()
  private searchLocations: Record<string, SearchLocation[]> = ALL_SEARCH_LOCATIONS;

  /**
   * Boolean operators detected in current search text
   * REACTIVE: Updates highlighting in real-time as user types
   * DISPLAY: Used to highlight boolean operators in magenta/purple
   */
  @state()
  private detectedBooleanOperators: Array<{text: string, start: number, end: number}> = [];

  /**
   * Selected categories for multi-category search (Phase 1)
   * REACTIVE: Changes affect button text and search behavior
   * ARRAY: Can contain 'people', 'articles', 'media_outlets', 'broadcast'
   */
  @state()
  private selectedCategories: string[] = [];


  /**
   * Show old dropdown for debugging (Phase 1-2)
   * Set to true to show dropdown alongside checkboxes for testing
   * Will be removed in Phase 5
   */
  private showOldDropdown = false;

  /**
   * Show inline results test component (Phase 2)
   * Set to true to preview the accordion with mock data
   * For testing only - will be wired to real data in Phase 4
   *
   * PHASE 4 UPDATE: Set to false, using real search results now
   */
  private showInlineResultsTest = false;

  /**
   * Real search results from multi-category search (Phase 4)
   * REACTIVE: Updated when executeMultiCategorySearch() completes
   * Replaces mockResults when actual search is performed
   */
  @state()
  private searchResults: CategoryResults[] = [];

  /**
   * Whether to show real search results vs mock test data
   * Set to true after successful multi-category search
   */
  @state()
  private hasSearchResults = false;

  /**
   * Mock results for testing inline component (Phase 2)
   *
   * ⚠️ FAKE DATA - DEPRECATED IN PHASE 4 - No longer used, kept for reference only
   * Real search results now come from executeMultiCategorySearch()
   */
  /*
  @state()
  private mockResults: CategoryResults[] = [
    {
      category: 'people',
      categoryName: 'People',
      expanded: true,
      terms: [
        {
          term: 'John Smith',
          found: true,
          count: 18,
          expanded: false,
          // ⚠️ FAKE DATA - Sample people results
          peopleResults: [
            { name: 'John Smith', title: 'Senior Reporter', outlet: 'TechCrunch' },
            { name: 'John A. Smith', title: 'Technology Editor', outlet: 'Forbes' },
            { name: 'John M. Smith', title: 'Contributor', outlet: 'Wired' },
            { name: 'John R. Smith', title: 'Staff Writer', outlet: 'The Verge' },
            { name: 'John T. Smith', title: 'Freelance Writer', outlet: 'Various' }
          ]
        },
        {
          term: 'Jane Doe',
          found: true,
          count: 3,
          expanded: false,
          // ⚠️ FAKE DATA - Sample people results
          peopleResults: [
            { name: 'Jane Doe', title: 'Business Correspondent', outlet: 'Bloomberg' },
            { name: 'Jane M. Doe', title: 'Reporter', outlet: 'Reuters' }
          ]
        },
        {
          term: 'Bob Jones',
          found: false
        }
      ]
    },
    {
      category: 'articles',
      categoryName: 'Articles',
      expanded: true,
      terms: [
        {
          term: 'Old School RuneScape',
          found: true,
          count: 156,
          expanded: false,
          // ⚠️ FAKE DATA - Sample article results
          articleResults: [
            {
              title: 'MMO Week in Review: Ghosts of Tomorrow',
              snippet: 'This is not actually all that unusual; I think about it a fair bit, if... By next week, Old School RuneScape will have added five dozen new servers to h...',
              source: 'Massively Overpowered',
              date: 'Aug 10, 2025'
            },
            {
              title: 'Steam has a sale celebrating small developers',
              snippet: 'Maybe get him into Old School Runescape, something else to focus his energy on. Do you like Chinese food? Yes, and I like it best of all when it\'s fro...',
              source: 'Birthday Cake For Breakfast',
              date: 'Aug 10, 2025'
            },
            {
              title: 'The Best MMORPGs to Play Right Now',
              snippet: 'Old School RuneScape remains one of the most popular MMORPGs, with a dedicated community and regular content updates...',
              source: 'PC Gamer',
              date: 'Aug 9, 2025'
            },
            {
              title: 'Why Players Keep Coming Back to OSRS',
              snippet: 'The nostalgia factor combined with modern quality-of-life improvements makes Old School RuneScape a timeless classic...',
              source: 'Kotaku',
              date: 'Aug 8, 2025'
            }
          ]
        }
      ]
    },
    {
      category: 'media_outlets',
      categoryName: 'Media Outlets',
      expanded: true,
      terms: [
        {
          term: 'TechCrunch',
          found: true,
          count: 1,
          expanded: false,
          // ⚠️ FAKE DATA - Sample outlet results
          outletResults: [
            {
              name: 'TechCrunch',
              type: 'Online Publication',
              description: 'American online newspaper focusing on high tech and startup companies'
            }
          ]
        },
        {
          term: 'Forbes',
          found: true,
          count: 1,
          expanded: false,
          // ⚠️ FAKE DATA - Sample outlet results
          outletResults: [
            {
              name: 'Forbes',
              type: 'Business Magazine',
              description: 'American business magazine covering finance, industry, investing, and marketing topics'
            }
          ]
        },
        {
          term: 'Random Tech Blog',
          found: false
        }
      ]
    }
  ];
  */

  static styles = searchTabStyles;

  connectedCallback() {
    super.connectedCallback();
    this.loadLastLocation();
    this.setupDragAndDrop();
    
    // Listen for load-search events from history tab
    document.addEventListener('load-search', this.handleLoadSearchEvent.bind(this));
    
    // Register this component with SelectionUpdateService for auto-text updates
    const selectionService = SelectionUpdateService.getInstance();
    selectionService.setSearchComponent(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('load-search', this.handleLoadSearchEvent.bind(this));
  }

  private handleLoadSearchEvent(event: CustomEvent) {
    const { search } = event.detail;
    if (search) {
      this.loadSearchFromHistory(search);
    }
  }

  protected updated(changedProperties: PropertyValues) {
    if (changedProperties.has('settings') && this.settings) {
      this.checkResults = this.settings.checkResultsEnabled;
      this.selectedLocation = this.settings.lastSearchLocation || this.getDefaultLocation();
    }
  }

  private async loadLastLocation() {
    try {
      const lastLocation = await StorageService.get<string>('lastSearchLocation');
      if (lastLocation) {
        this.selectedLocation = lastLocation;
      } else {
        this.selectedLocation = this.getDefaultLocation();
      }
    } catch (error) {
      console.warn('Could not load last location:', error);
      this.selectedLocation = this.getDefaultLocation();
    }
  }

  private getDefaultLocation(): string {
    // Default to Media Outlets search
    return ALL_SEARCH_LOCATIONS["Public Site"]?.[2]?.url || '';
  }

  private getPlaceholderText(): string {
    const location = this.findLocationConfig(this.selectedLocation);
    
    if (location?.queryType === 'person_search') {
      return 'Enter names (one per line) or paste comma-separated list...\n\nExamples:\nJohn Smith\nJane Doe, Bob Jones\nSarah Wilson';
    }
    
    return 'Enter search terms (one per line) or paste comma-separated list...\n\nExamples:\nTechCrunch\nThe New York Times\nwired.com';
  }

  private setupDragAndDrop() {
    this.addEventListener('dragover', this.handleDragOver.bind(this));
    this.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.addEventListener('drop', this.handleDrop.bind(this));
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragOver = true;
  }

  private handleDragLeave(e: DragEvent) {
    e.preventDefault();
    this.dragOver = false;
  }

  private async handleDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver = false;

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      await this.handleFileUpload(files[0]);
    }
  }

  private async handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (files.length > 0) {
      await this.handleFileUpload(files[0]);
    }
    input.value = ''; // Reset input
  }

  private async handleFileUpload(file: File) {
    if (file.size > LIMITS.MAX_FILE_SIZE) {
      this.fileUploadStatus = 'error';
      this.showStatus(`File too large. Maximum size is ${LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`, 'error');
      return;
    }

    try {
      this.fileUploadStatus = 'loading';
      this.showStatus('Processing file...', 'info');

      const text = await file.text();
      
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const parsed = await CSVParser.parseCSV(text);
        const extractedText = this.extractTextFromCSV(parsed.data);
        this.searchText = extractedText;
        this.fileUploadStatus = 'success';
        this.showStatus(`Loaded ${parsed.rowCount} rows from CSV`, 'success');
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        this.searchText = text;
        this.fileUploadStatus = 'success';
        this.showStatus('Text file loaded successfully', 'success');
      } else {
        throw new Error('Unsupported file type. Please use CSV or TXT files.');
      }

    } catch (error) {
      this.fileUploadStatus = 'error';
      this.showStatus(`Failed to process file: ${error.message}`, 'error');
    }
  }

  private extractTextFromCSV(data: string[][]): string {
    // Extract text from first column that looks like outlets/contacts/URLs
    const results: string[] = [];
    
    data.forEach((row, index) => {
      if (index === 0) return; // Skip header
      
      row.forEach(cell => {
        const cleaned = cell.trim();
        if (cleaned && cleaned.length > 2) {
          results.push(cleaned);
        }
      });
    });

    return results.join('\n');
  }

  private async handleGoogleSheets(e: Event) {
    const input = e.target as HTMLInputElement;
    const url = input.value.trim();
    
    if (!url) return;

    try {
      this.showStatus('Loading Google Sheets...', 'info');
      
      // Convert to CSV export URL
      const csvUrl = this.convertSheetsUrl(url);
      if (!csvUrl) {
        throw new Error('Invalid Google Sheets URL');
      }

      const response = await fetch(csvUrl);
      if (!response.ok) {
        if (response.status === 403) {
          // Permission required - open in new tab
          window.open(url, '_blank');
          this.showStatus('Sheet requires permission. Opened in new tab.', 'info');
          return;
        }
        throw new Error(`Failed to fetch sheet: ${response.status}`);
      }

      const csvText = await response.text();
      const parsed = await CSVParser.parseCSV(csvText);
      const extractedText = this.extractTextFromCSV(parsed.data);
      
      this.searchText = extractedText;
      this.showStatus(`Loaded ${parsed.rowCount} rows from Google Sheets`, 'success');
      input.value = ''; // Clear input
      
    } catch (error) {
      this.showStatus(`Failed to load Google Sheets: ${error.message}`, 'error');
      // Fallback: open in new tab
      if (url.includes('google.com/spreadsheets')) {
        window.open(url, '_blank');
        this.showStatus('Opened sheet in new tab as fallback', 'info');
      }
    }
  }

  private convertSheetsUrl(url: string): string | null {
    try {
      // Extract sheet ID and GID from various Google Sheets URL formats
      const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!sheetIdMatch) return null;
      
      const sheetId = sheetIdMatch[1];
      const gidMatch = url.match(/[#&]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    } catch {
      return null;
    }
  }

  private async handleFormat() {
    if (!this.searchText.trim()) {
      this.showStatus('Please enter text to format', 'error');
      return;
    }

    try {
      const formatted = parseText(this.searchText);
      if (formatted.parsed.length === 0) {
        this.showStatus('No valid terms found to format', 'error');
        return;
      }

      this.searchText = formatted.parsed.join('\n');
      this.showStatus(`Formatted ${formatted.parsed.length} items`, 'success');
      
      if (formatted.confidence < 0.8 && formatted.suggestions.length > 0) {
        // Show suggestions for low confidence
        const suggestions = formatted.suggestions.join(' ');
        this.showStatus(`Formatted with suggestions: ${suggestions}`, 'info');
      }
    } catch (error) {
      this.showStatus(`Format error: ${error.message}`, 'error');
    }
  }

  private async handleSearch() {
    if (!this.searchText.trim()) {
      this.showStatus('Please enter search terms', 'error');
      return;
    }

    // STEP 4: Multi-Category Search Logic (NEW)
    // Check if user selected categories via checkboxes (multi-category mode)
    if (this.selectedCategories.length > 0) {
      try {
        this.isLoading = true;
        // NOTE: Results persist until explicitly cleared by user (no auto-clear on new search)
        this.showStatus('Preparing multi-category search...', 'info');

        // Parse terms
        const terms = this.searchText.split('\n')
          .map(term => term.trim())
          .filter(term => term !== '')
          .slice(0, LIMITS.MAX_SEARCH_TERMS);

        if (terms.length === 0) {
          throw new Error('No valid search terms found');
        }

        // Execute multi-category search
        // NOTE: checkResults hardcoded to true - always pre-validate results
        // TODO: Make this configurable via Settings page in future
        this.showStatus(`Searching ${terms.length} term(s) across ${this.selectedCategories.length} categories...`, 'info');
        const results = await executeMultiCategorySearch(terms, this.selectedCategories, true, false);

        // Store results and display inline accordion
        this.searchResults = results;
        this.hasSearchResults = true;

        // Count total found/not found
        let totalFound = 0;
        let totalNotFound = 0;
        results.forEach(category => {
          category.terms.forEach(term => {
            if (term.found) totalFound++;
            else totalNotFound++;
          });
        });

        // Save multi-category search to history (includes caching People + Outlets)
        await this.saveMultiCategorySearchToHistory(terms, this.selectedCategories, results);

        this.showStatus(`Search complete! ${totalFound} found, ${totalNotFound} not found`, 'success');

      } catch (error) {
        this.showStatus(`Multi-category search error: ${error.message}`, 'error');
        console.error('Multi-category search failed:', error);
      } finally {
        this.isLoading = false;
      }
      return; // Exit early, don't run old single-category logic
    }

    // ORIGINAL SINGLE-CATEGORY LOGIC (Backward Compatibility)
    // Falls through to here if no categories selected (using old dropdown)
    if (!this.selectedLocation) {
      this.showStatus('Please select a search location', 'error');
      return;
    }

    try {
      this.isLoading = true;
      this.showStatus('Preparing search...', 'info');

      // Parse terms
      const terms = this.searchText.split('\n')
        .map(term => term.trim())
        .filter(term => term !== '')
        .slice(0, LIMITS.MAX_SEARCH_TERMS);

      if (terms.length === 0) {
        throw new Error('No valid search terms found');
      }

      // Find selected location config
      const location = this.findLocationConfig(this.selectedLocation);
      if (!location) {
        throw new Error('Invalid search location selected');
      }

      // Generate queries
      const queries = generateQueries(terms, location.queryType);

      // Create search terms with URLs
      const searchTerms: SearchTerm[] = queries.map(query => {
        const encodedQuery = encodeURIComponent(query.processed);
        const baseUrl = location.url.replace('{{muckRackHost}}', this.getMuckRackHost());
        const separator = baseUrl.includes('?') ? '&' : '?';
        let finalUrl = `${baseUrl}${separator}q=${encodedQuery}`;

        // BOOLEAN FILTER HANDLING: Skip extraParams (like must_appear_in_people=names) for boolean queries
        // This allows boolean searches to work properly without name-only filtering
        const isBooleanQuery = extractBooleanOperators(query.original).length > 0;
        if (location.extraParams && !isBooleanQuery) {
          finalUrl += location.extraParams;
        }


        return {
          original: query.original,
          processed: query.processed,
          url: finalUrl
        };
      });

      // Save search to history
      await this.saveSearchToHistory(terms, location);

      // Save last location
      await StorageService.set('lastSearchLocation', this.selectedLocation);

      // Dispatch search event
      this.dispatchEvent(new CustomEvent('search-initiated', {
        detail: {
          terms: searchTerms,
          location,
          checkResults: this.checkResults
        },
        bubbles: true
      }));

      this.showStatus(`Starting search for ${searchTerms.length} terms...`, 'success');

    } catch (error) {
      this.showStatus(`Search error: ${error.message}`, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  private findLocationConfig(url: string): SearchLocation | null {
    for (const group of Object.values(this.searchLocations)) {
      const found = group.find(loc => loc.url === url);
      if (found) return found;
    }
    return null;
  }

  private getMuckRackHost(): string {
    // Default to app.muckrack.com, but could be enhanced to detect current host
    return 'app.muckrack.com';
  }

  private async saveSearchToHistory(terms: string[], location: SearchLocation) {
    try {
      // Get contact name from current Intercom tab if available
      const contactName = await getCurrentContactName();
      
      // Create display name
      let displayName: string;
      if (contactName) {
        displayName = `Search for ${contactName}`;
      } else {
        // Fallback to showing first few terms
        if (terms.length === 1) {
          displayName = terms[0];
        } else if (terms.length <= 3) {
          displayName = terms.join(', ');
        } else {
          displayName = `${terms.slice(0, 2).join(', ')} and ${terms.length - 2} more`;
        }
      }
      
      // Create history entry
      const historyEntry: SearchHistory = {
        id: this.generateId(),
        terms: terms,
        displayName: displayName,
        contactName: contactName || undefined,
        searchType: location.resultType || 'unknown',
        location: location.url,
        locationName: location.name,
        timestamp: Date.now(),
        isFavorite: false
      };

      // Get existing recent searches
      const recentSearches = await StorageService.get<SearchHistory[]>(STORAGE_KEYS.RECENT_SEARCHES) || [];
      
      // Remove if already exists (prevent duplicates)
      const filtered = recentSearches.filter(search => 
        !(search.contactName === historyEntry.contactName && search.location === historyEntry.location)
      );
      
      // Add to beginning
      filtered.unshift(historyEntry);
      
      // Limit to max recent searches
      const limited = filtered.slice(0, LIMITS.MAX_RECENT_SEARCHES);
      
      // Save back to storage
      await StorageService.set(STORAGE_KEYS.RECENT_SEARCHES, limited);
      
    } catch (error) {
      console.warn('Failed to save search to history:', error);
    }
  }

  private async saveMultiCategorySearchToHistory(terms: string[], categories: string[], results: CategoryResults[]) {
    try {
      // Get contact name from current Intercom tab if available
      const contactName = await getCurrentContactName();

      // Create display name
      let displayName: string;
      if (contactName) {
        displayName = `Search for ${contactName}`;
      } else {
        // Fallback to showing first few terms
        if (terms.length === 1) {
          displayName = terms[0];
        } else if (terms.length <= 3) {
          displayName = terms.join(', ');
        } else {
          displayName = `${terms.slice(0, 2).join(', ')} and ${terms.length - 2} more`;
        }
      }

      // Create human-readable category names
      const categoryNames = categories.map(cat => {
        switch (cat) {
          case 'people': return 'People';
          case 'articles': return 'Articles';
          case 'media_outlets': return 'Outlets';
          case 'broadcast': return 'Broadcast';
          default: return cat;
        }
      }).join(', ');

      // Generate unique ID for this search
      const searchId = this.generateId();

      // Cache results for People + Outlets (NOT Articles)
      const cacheId = await this.saveSearchResultsCache(searchId, results, categories);

      // Create history entry for multi-category search
      const historyEntry: SearchHistory = {
        id: searchId,
        terms: terms,
        displayName: displayName,
        contactName: contactName || undefined,
        searchType: 'multi-category',
        location: 'multi-category', // Special marker for multi-category searches
        locationName: `Multi-Category: ${categoryNames}`,
        timestamp: Date.now(),
        isFavorite: false,
        categories: categories, // Store selected categories for restore
        cacheId: cacheId // Link to cached results (if any)
      };

      // Get existing recent searches
      const recentSearches = await StorageService.get<SearchHistory[]>(STORAGE_KEYS.RECENT_SEARCHES) || [];

      // Remove if already exists (prevent duplicates based on contactName and categories)
      const filtered = recentSearches.filter(search =>
        !(search.contactName === historyEntry.contactName &&
          search.location === 'multi-category' &&
          JSON.stringify(search.categories?.sort()) === JSON.stringify(categories.sort()))
      );

      // Add to beginning
      filtered.unshift(historyEntry);

      // Limit to max recent searches
      const limited = filtered.slice(0, LIMITS.MAX_RECENT_SEARCHES);

      // Save back to storage
      await StorageService.set(STORAGE_KEYS.RECENT_SEARCHES, limited);

    } catch (error) {
      console.warn('Failed to save multi-category search to history:', error);
    }
  }

  /**
   * Save search results to cache (People + Outlets only, NOT Articles)
   * Returns cacheId if results were cached, undefined otherwise
   */
  private async saveSearchResultsCache(searchId: string, results: CategoryResults[], categories: string[]): Promise<string | undefined> {
    try {
      // Filter results to only include People and Outlets (NOT Articles)
      const cacheableCategories = ['people', 'media_outlets'];
      const cacheableResults = results.filter(category =>
        cacheableCategories.includes(category.category)
      );

      // Only cache if we have cacheable results
      if (cacheableResults.length === 0) {
        return undefined;
      }

      // Create cache entry
      const now = Date.now();
      const cacheEntry: SearchResultsCache = {
        searchId: searchId,
        results: cacheableResults,
        timestamp: now,
        expiresAt: now + LIMITS.CACHE_EXPIRATION_MS,
        categories: cacheableResults.map(r => r.category)
      };

      // Get existing cache
      const cache = await StorageService.get<Record<string, SearchResultsCache>>(STORAGE_KEYS.SEARCH_RESULTS_CACHE) || {};

      // Clean up expired cache entries
      const nowTimestamp = Date.now();
      Object.keys(cache).forEach(key => {
        if (cache[key].expiresAt < nowTimestamp) {
          delete cache[key];
        }
      });

      // Add new cache entry
      cache[searchId] = cacheEntry;

      // Save updated cache
      await StorageService.set(STORAGE_KEYS.SEARCH_RESULTS_CACHE, cache);

      return searchId;
    } catch (error) {
      console.warn('Failed to cache search results:', error);
      return undefined;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Load search from history (terms only, no cached results)
   * This is the "fresh" mode - user can then click search to get new results
   */
  public loadSearchFromHistory(search: SearchHistory) {
    try {
      // Load the search terms
      this.searchText = search.terms.join('\n');

      // Update boolean highlighting for loaded search text
      this.updateBooleanHighlighting();

      // Load search configuration based on search type
      if (search.location === 'multi-category' && search.categories) {
        // Multi-category search - restore selected categories
        this.selectedCategories = [...search.categories];
        this.selectedLocation = ''; // Clear old dropdown selection
      } else {
        // Single-category search - restore dropdown selection
        this.selectedLocation = search.location;
        this.selectedCategories = []; // Clear category checkboxes
      }

      // Clear any existing results
      this.searchResults = [];
      this.hasSearchResults = false;

      // Force update to reflect changes
      this.requestUpdate();

    } catch (error) {
      console.error('Failed to load search from history:', error);
    }
  }

  /**
   * Load search from history WITH cached results (instant load)
   * This is the "cached" mode - loads terms and displays cached results immediately
   */
  public async loadSearchWithCachedResults(search: SearchHistory) {
    try {
      // Load search configuration WITHOUT clearing results
      // (unlike loadSearchFromHistory which clears results)
      this.searchText = search.terms.join('\n');
      this.updateBooleanHighlighting();

      // Load search configuration based on search type
      if (search.location === 'multi-category' && search.categories) {
        // Multi-category search - restore selected categories
        this.selectedCategories = [...search.categories];
        this.selectedLocation = ''; // Clear old dropdown selection
      } else {
        // Single-category search - restore dropdown selection
        this.selectedLocation = search.location;
        this.selectedCategories = []; // Clear category checkboxes
      }

      // Try to load cached results if available
      if (search.cacheId) {
        const cachedResults = await this.loadCachedResults(search.cacheId);

        if (cachedResults) {
          // Display cached results (DON'T clear first - that's the bug!)
          this.searchResults = cachedResults;
          this.hasSearchResults = true;

          // Count results
          let totalFound = 0;
          let totalNotFound = 0;
          cachedResults.forEach(category => {
            category.terms.forEach(term => {
              if (term.found) totalFound++;
              else totalNotFound++;
            });
          });

          this.showStatus(`Loaded cached results: ${totalFound} found, ${totalNotFound} not found`, 'success');
          this.requestUpdate();
        } else {
          // Cache expired or missing
          console.warn('[SEARCH-TAB] Cache expired or missing');
          this.searchResults = [];
          this.hasSearchResults = false;
          this.showStatus('Cached results expired. Please run a fresh search.', 'info');
        }
      } else {
        console.warn('[SEARCH-TAB] No cacheId provided');
        this.searchResults = [];
        this.hasSearchResults = false;
        this.showStatus('No cached results available', 'info');
      }

    } catch (error) {
      console.error('[SEARCH-TAB] Failed to load cached results:', error);
      this.showStatus('Failed to load cached results', 'error');
    }
  }

  /**
   * Load cached results from storage
   * Returns undefined if cache is expired or missing
   */
  private async loadCachedResults(cacheId: string): Promise<CategoryResults[] | undefined> {
    try {
      // Get cache from storage
      const cache = await StorageService.get<Record<string, SearchResultsCache>>(STORAGE_KEYS.SEARCH_RESULTS_CACHE) || {};
      const cacheEntry = cache[cacheId];

      if (!cacheEntry) {
        console.warn('[SEARCH-TAB] No cache entry found for cacheId:', cacheId);
        return undefined;
      }

      // Check if cache is expired
      const now = Date.now();

      if (cacheEntry.expiresAt < now) {
        // Clean up expired entry
        console.warn('[SEARCH-TAB] Cache expired, cleaning up...');
        delete cache[cacheId];
        await StorageService.set(STORAGE_KEYS.SEARCH_RESULTS_CACHE, cache);
        return undefined;
      }

      // Return cached results (already filtered to People + Outlets only)
      return cacheEntry.results as CategoryResults[];
    } catch (error) {
      console.error('[SEARCH-TAB] Failed to load cached results:', error);
      return undefined;
    }
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info') {
    this.dispatchEvent(new CustomEvent('status-update', {
      detail: { message, type },
      bubbles: true
    }));

    // Also update local status for immediate feedback
    this.requestUpdate();
  }

  public updateSettings(settings: AppSettings) {
    this.settings = settings;
  }

  public onTabActivated() {
    // Called when this tab becomes active
    // Could be used to refresh data or reset states
  }

  public populateSearchText(text: string) {
    // Populate the search textarea with provided text
    this.searchText = text;
    this.updateBooleanHighlighting();
    this.requestUpdate();
  }

  /**
   * Updates boolean operator highlighting in real-time
   * Called whenever search text changes to detect and highlight boolean operators
   */
  private updateBooleanHighlighting() {
    this.detectedBooleanOperators = extractBooleanOperators(this.searchText);
  }

  /**
   * Renders search text with boolean operators highlighted in Muck Rack colors
   * Pink (#da4f95): AND OR NOT () ""
   * Purple (#752ade): strict: matchcase: headline: body: link: NEAR/ {n,m}
   */
  private renderHighlightedText() {
    if (this.detectedBooleanOperators.length === 0) {
      return this.searchText;
    }

    let highlightedText = '';
    let lastIndex = 0;

    // Sort operators by position to process them in order
    const sortedOperators = [...this.detectedBooleanOperators].sort((a, b) => a.start - b.start);

    for (const operator of sortedOperators) {
      // Add text before the operator
      highlightedText += this.escapeHtml(this.searchText.slice(lastIndex, operator.start));
      
      // Determine which color class to use based on operator type
      const colorClass = this.getBooleanOperatorColorClass(operator.text);
      
      // Add highlighted operator with appropriate color
      highlightedText += `<span class="${colorClass}">${this.escapeHtml(operator.text)}</span>`;
      
      lastIndex = operator.end;
    }

    // Add remaining text after last operator
    highlightedText += this.escapeHtml(this.searchText.slice(lastIndex));

    return highlightedText;
  }

  /**
   * Determines the color class for a boolean operator
   * Pink: AND OR NOT () " (individual quotes)
   * Purple: strict: matchcase: headline: body: link: NEAR/ {n,m} + -
   */
  private getBooleanOperatorColorClass(operatorText: string): string {
    // Pink operators: AND OR NOT () and individual quotes
    const pinkOperators = /^(AND|OR|NOT|[()"])$/;
    
    if (pinkOperators.test(operatorText)) {
      return 'boolean-highlight-pink';
    }
    
    // Everything else gets purple (strict:, matchcase:, NEAR/, +, -, etc.)
    return 'boolean-highlight-purple';
  }

  /**
   * Escapes HTML characters for safe rendering
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Refresh selected text from current page
   */
  private refreshSelectedText(): void {
    // Dispatch event to main sidepanel to trigger refresh
    window.dispatchEvent(new CustomEvent('refresh-selected-text'));
  }

  /**
   * Toggle category selection for multi-category search (Phase 1)
   * @param category - Category ID ('people', 'articles', 'media_outlets', 'broadcast')
   * @param event - Click event (used to blur element after click)
   */
  private toggleCategory(category: string, event?: Event): void {
    const index = this.selectedCategories.indexOf(category);
    if (index > -1) {
      // Remove if already selected
      this.selectedCategories = this.selectedCategories.filter(c => c !== category);
    } else {
      // Add if not selected
      this.selectedCategories = [...this.selectedCategories, category];
    }

    // Remove focus to hide the glow effect immediately after clicking
    if (event) {
      (event.currentTarget as HTMLElement).blur();
    }
  }

  /**
   * Check if a category is currently selected (Phase 1)
   * @param category - Category ID to check
   */
  private isCategorySelected(category: string): boolean {
    return this.selectedCategories.includes(category);
  }

  /**
   * Get button text based on selected categories count (Phase 1)
   * @returns Button text like "SEARCH IN 2 CATEGORIES" or "SELECT CATEGORIES"
   */
  private getSearchButtonText(): string {
    const count = this.selectedCategories.length;
    if (count === 0) {
      return 'Select Categories';
    } else if (count === 1) {
      return `Search in 1 Category`;
    } else {
      return `Search in ${count} Categories`;
    }
  }

  /**
   * Handle "Open Results" button click from search results component
   * Opens all search results for a category in Muck Rack
   */
  private handleOpenResults(category: string) {
    const terms = this.searchText.split('\n')
      .map(term => term.trim())
      .filter(term => term !== '');

    if (terms.length === 0) {
      return;
    }

    // Determine result type and query type based on category
    let resultType = 'person';
    let queryType = 'person_search';
    if (category === 'articles') {
      resultType = 'article';
      queryType = undefined; // Use default smart query
    } else if (category === 'media_outlets') {
      resultType = 'media_outlet';
      queryType = undefined; // Use default smart query
    } else if (category === 'broadcast') {
      resultType = 'broadcast';
      queryType = undefined; // Use default smart query
    }

    // Open Muck Rack results for each term
    terms.forEach(term => {
      const baseUrl = 'https://muckrack.com/search/results';
      // Use query generator to handle boolean queries correctly
      const processedQuery = generateQuery(term, queryType);
      const params = new URLSearchParams({
        result_type: resultType,
        q: processedQuery
      });

      // Add must_appear_in_people=names filter for People searches
      if (category === 'people') {
        params.set('must_appear_in_people', 'names');
      }

      const url = `${baseUrl}?${params.toString()}`;
      window.open(url, '_blank');
    });
  }

  /**
   * Render icon for a specific category (Phase 1)
   * @param category - Category ID
   * @returns SVG icon HTML
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
    return html`
      <div class="search-container">
        <!-- Text Input Section -->
        <div class="section">
          <div class="section-title">
            <div class="section-title-left">
              <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              Search Terms
            </div>
            ${IS_DEV ? html`
              <button id="refresh-selection-btn" class="refresh-btn" title="Refresh selected text (Dev only)" @click=${this.refreshSelectedText}>
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <polyline points="23 4 23 10 17 10" fill="none" stroke="currentColor" stroke-width="2"/>
                  <polyline points="1 20 1 14 7 14" fill="none" stroke="currentColor" stroke-width="2"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            ` : ''}
          </div>
          <div class="search-input-wrapper">
            <textarea
              class="text-input search-input-with-highlighting"
              .value=${this.searchText}
              @input=${(e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                this.searchText = target.value;
                this.updateBooleanHighlighting();
                const selectionService = SelectionUpdateService.getInstance();
                selectionService.notifyUserTyping();
                // Auto-resize textarea
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
              @scroll=${(e: Event) => {
                const textarea = e.target as HTMLTextAreaElement;
                const overlay = textarea.parentElement?.querySelector('.highlight-overlay') as HTMLElement;
                if (overlay) {
                  overlay.scrollTop = textarea.scrollTop;
                }
              }}
              placeholder=${this.getPlaceholderText()}
              spellcheck="false"
            ></textarea>
            <pre><code class="highlight-overlay" .innerHTML=${this.renderHighlightedText()}></code></pre>
          </div>
        </div>

        <!-- Search Options -->
        <div class="section">
          <div class="section-title">
            <div class="section-title-left">
              <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="4" y1="21" x2="4" y2="14"/>
                <line x1="4" y1="10" x2="4" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12" y2="3"/>
                <line x1="20" y1="21" x2="20" y2="16"/>
                <line x1="20" y1="12" x2="20" y2="3"/>
                <line x1="1" y1="14" x2="7" y2="14"/>
                <line x1="9" y1="8" x2="15" y2="8"/>
                <line x1="17" y1="16" x2="23" y2="16"/>
              </svg>
              Search Options
            </div>
          </div>

          <div class="search-options">
            <!-- Multi-Category Selection (Phase 1) -->
            <div class="option-group">
              <div class="option-label">Select categories to search:</div>
              <div class="category-grid">
                <!-- People -->
                <div
                  class="category-checkbox ${this.isCategorySelected('people') ? 'selected' : ''}"
                  @click=${(e: Event) => this.toggleCategory('people', e)}
                  tabindex="0"
                  role="button"
                  aria-pressed="${this.isCategorySelected('people')}">
                  ${this.renderCategoryIcon('people')}
                  <span class="category-label">People</span>
                </div>

                <!-- Articles -->
                <div
                  class="category-checkbox ${this.isCategorySelected('articles') ? 'selected' : ''}"
                  @click=${(e: Event) => this.toggleCategory('articles', e)}
                  tabindex="0"
                  role="button"
                  aria-pressed="${this.isCategorySelected('articles')}">
                  ${this.renderCategoryIcon('articles')}
                  <span class="category-label">Articles</span>
                </div>

                <!-- Media Outlets -->
                <div
                  class="category-checkbox ${this.isCategorySelected('media_outlets') ? 'selected' : ''}"
                  @click=${(e: Event) => this.toggleCategory('media_outlets', e)}
                  tabindex="0"
                  role="button"
                  aria-pressed="${this.isCategorySelected('media_outlets')}">
                  ${this.renderCategoryIcon('media_outlets')}
                  <span class="category-label">Outlets</span>
                </div>

                <!-- Broadcast (Disabled in production - not ready yet) -->
                ${IS_DEV ? html`
                  <div
                    class="category-checkbox ${this.isCategorySelected('broadcast') ? 'selected' : ''}"
                    @click=${(e: Event) => this.toggleCategory('broadcast', e)}
                    tabindex="0"
                    role="button"
                    aria-pressed="${this.isCategorySelected('broadcast')}"
                    title="Broadcast (Dev only)">
                    ${this.renderCategoryIcon('broadcast')}
                    <span class="category-label">Broadcast</span>
                  </div>
                ` : html`
                  <div
                    class="category-checkbox disabled"
                    role="button"
                    aria-disabled="true"
                    title="Broadcast search coming soon">
                    ${this.renderCategoryIcon('broadcast')}
                    <span class="category-label">Broadcast</span>
                  </div>
                `}
              </div>
            </div>

            <!-- Old dropdown - kept for backward compatibility until Phase 3 -->
            ${this.showOldDropdown ? html`
              <div class="option-group">
                <div style="width: 100%; display: block;">
                  <md-outlined-select
                    label="Search Location (Old)"
                    .value=${this.selectedLocation}
                    @change=${(e: Event) => this.selectedLocation = (e.target as any).value}
                    style="width: 100%;">
                    ${Object.entries(this.searchLocations).map(([groupName, locations]) =>
                      locations.filter(loc => loc.isSearchable).map(location => html`
                        <md-select-option value="${location.url}">
                          <div slot="headline">${location.name}</div>
                          <div slot="supporting-text">${groupName}</div>
                        </md-select-option>
                      `)
                    )}
                  </md-outlined-select>
                </div>
              </div>
            ` : ''}

            <!-- Check Results Toggle - DISABLED (hardcoded to true for now)
                 TODO: Move to Settings page in future - users can toggle result checking globally
            <label class="checkbox-option" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
              <md-checkbox
                .checked=${this.checkResults}
                @change=${(e: Event) => this.checkResults = (e.target as any).checked}>
              </md-checkbox>
              <div>
                <div class="checkbox-label">Check Results</div>
                <div class="checkbox-desc">Pre-verify searches return results (slower, Media Outlets & People only)</div>
              </div>
            </label>
            -->
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 12px; width: 100%;">
          <div style="flex: 2; min-width: 0;">
            <md-filled-button
              ?disabled=${this.isLoading || !this.searchText.trim() || this.selectedCategories.length === 0}
              @click=${this.handleSearch}
              style="width: 100%;">
              ${this.isLoading ? 'Searching...' : this.getSearchButtonText()}
            </md-filled-button>
          </div>

          <div style="flex: 1; min-width: 0;">
            <md-outlined-button
              ?disabled=${!this.searchText.trim()}
              @click=${this.handleFormat}
              style="width: 100%;">
              Sort
            </md-outlined-button>
          </div>
        </div>

        <!-- Inline Results (Phase 4 - Real Search Results) -->
        ${this.hasSearchResults ? html`
          <search-results-inline
            .results=${this.searchResults}
            .isLoading=${this.isLoading}
            .onOpenResults=${(category: string) => this.handleOpenResults(category)}>
          </search-results-inline>
        ` : ''}

        <!-- File Upload Section -->
        <div class="section">
          <div class="section-title">
            <div class="section-title-left">
              <svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              File Upload
            </div>
          </div>
          <div class="upload-zone ${this.dragOver ? 'drag-over' : ''}">
            <input
              type="file"
              class="file-input"
              accept=".csv,.txt"
              @change=${this.handleFileSelect}
            />
            <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17,8 12,3 7,8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div class="upload-text">
              <strong>Click to upload</strong> or drag files here<br>
              Supports CSV and TXT files
            </div>
          </div>
          
          <div class="sheets-input">
            <input
              type="url"
              class="sheets-url"
              placeholder="Or paste Google Sheets URL here..."
              @change=${this.handleGoogleSheets}
            />
          </div>
        </div>
      </div>
    `;
  }
}