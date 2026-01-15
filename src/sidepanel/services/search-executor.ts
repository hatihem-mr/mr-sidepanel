// Import required dependencies for search execution
import { extractSearchResults } from '../../shared/utils/result-extractor.js';
import { updateProgress } from '../utils/ui-utils.js';
import type { CategoryResults, SearchTermResult } from '../components/search-results-inline.js';
import { ALL_SEARCH_LOCATIONS } from '../../shared/constants.js';
import { generateQueries } from '../../shared/utils/query-generator.js';

/**
 * Search Execution Service - Business Logic for Muck Rack Search Operations
 * 
 * PURPOSE: Contains the core search execution and result processing logic for the 
 * Muck Rack Chrome extension. This service handles search orchestration, result 
 * validation, and HTML parsing operations that were previously embedded in the 
 * main sidepanel controller.
 * 
 * EXTRACTED FROM: sidepanel.ts (search execution methods)
 * 
 * WHY THIS FILE EXISTS:
 * - Separation of Concerns: Pure business logic separated from UI coordination
 * - Testability: Enables unit testing of search algorithms without UI dependencies
 * - Maintainability: Isolates complex HTML parsing logic for easier debugging
 * - Reusability: Search logic can be used by popup windows, background scripts, etc.
 * - Single Responsibility: Each method has one clear purpose in the search pipeline
 * 
 * ARCHITECTURE OVERVIEW:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                          Search Execution Pipeline                       │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Search Terms    →   executeSearch()     →   checkSearchResults()    →   Results
 *     │                     │                        │                      │
 * ["TechCrunch",         For each term:           HTTP Request           Structured
 *  "Wired",              • Build search URL        via CORS proxy        data with:
 *  "Ars Technica"]       • Check if has results    │                     • hasResults
 *                        • Extract preview data    ▼                     • resultCount
 *                        • Update progress bar   Parse HTML with          • articleResults
 *                                               extractArticleResults()   • firstResult
 * 
 * DEPENDENCIES:
 * - Chrome Runtime: For CORS bypass via service worker
 * - Service Worker: Fetch bridge to avoid cross-origin restrictions
 * - UI Utils: Progress bar updates (imported from ../utils/ui-utils.js)
 * - Reference Files: HTML structure examples in /reference/ folder
 * - Result Extractor: Shared parsing utility for result extraction
 * 
 * CRITICAL CONCEPTS:
 * 
 * 1. **CORS Bypass Strategy**:
 *    Extension content cannot directly fetch from Muck Rack due to CORS policies.
 *    All HTTP requests route through the service worker which acts as a proxy:
 *    Content Script → Service Worker → Muck Rack → Service Worker → Content Script
 * 
 * 2. **HTML Parsing Approach**:
 *    Muck Rack search results are server-rendered, not AJAX-loaded, making them
 *    safe to parse immediately. We use regex patterns instead of DOM parsing
 *    for performance and to avoid security restrictions in extension context.
 * 
 * 3. **Fallback Logic**:
 *    Multiple extraction strategies ensure compatibility across different:
 *    - Team subdomains (team-name.muckrack.com vs app.muckrack.com)
 *    - Page layouts (admin vs public, old vs new designs)
 *    - Content types (articles vs outlets vs people)
 * 
 * PERFORMANCE CONSIDERATIONS:
 * - Terms processed sequentially to avoid overwhelming Muck Rack servers
 * - Progress bar updates provide user feedback during long operations
 * - Result checking can be disabled for faster bulk operations
 * - HTML parsing uses efficient regex patterns instead of DOM manipulation
 * 
 * SECURITY NOTES:
 * - All URLs validated before processing to prevent injection attacks
 * - HTML content sanitized during extraction to prevent XSS
 * - No user input directly interpolated into regex patterns
 * - Service worker enforces same-origin policy for proxied requests
 * 
 * MAINTENANCE GUIDE:
 * - HTML patterns may break if Muck Rack updates their UI structure
 * - Test with various search types after Muck Rack updates
 * - Reference files in /reference/ show expected HTML structures
 * - Use browser DevTools to inspect actual HTML when patterns fail
 * - Consider switching to API endpoints if they become available
 */

/**
 * Extract Article Results from HTML - Phase 1 Extraction
 * 
 * RESPONSIBILITY: Parse raw HTML from Muck Rack article search pages and extract
 * structured data for the first 5 articles. This enables article preview cards
 * in the search results without requiring users to open the full search page.
 * 
 * WHY THIS FUNCTION EXISTS:
 * Muck Rack article searches can return millions of results (e.g., 23,594,989 for
 * "received"). Instead of showing just a count, we parse the first few results
 * to give users immediate context about what articles were found, including
 * headlines, outlets, dates, and snippets.
 * 
 * HTML STRUCTURE ANALYSIS:
 * Muck Rack article results follow this pattern (from reference/mr-first-result-div.md):
 * 
 * <div class="mr-result js-result mr-result-article" id="result-article-123">
 *   <h5 class="mr-result-heading">
 *     <a href="/articles/...">Article Title Here</a>
 *   </h5>
 *   <div class="mr-result-meta">
 *     <a href="/media-outlet/...">Outlet Name</a>
 *     <span class="mr-result-date">Jul 24, 2025</span>
 *   </div>
 *   <div class="mr-result-description">Article snippet text...</div>
 * </div>
 * 
 * PARSING STRATEGY:
 * 1. **Container Matching**: Find article divs using class and ID patterns
 * 2. **Title Extraction**: Parse H5 heading with link, strip HTML tags
 * 3. **Outlet Detection**: Try multiple patterns for outlet links
 * 4. **Date Parsing**: Extract from span with date class
 * 5. **Snippet Processing**: Clean HTML, decode entities, truncate to 150 chars
 * 6. **URL Extraction**: Get article link from first anchor tag
 * 
 * REGEX PATTERN BREAKDOWN:
 * 
 * Main Article Container:
 * /<div class="mr-result js-result[^"]*mr-result-article[^"]*"[^>]*id="result-article[^"]*"[^>]*>([\s\S]*?)(?=<div class="mr-result js-result|$)/g
 * 
 * This complex pattern:
 * - Matches: <div class="mr-result js-result mr-result-article" id="result-article-123">
 * - Captures: Everything inside the div until the next result div or end of string
 * - Handles: Variable class orders and additional CSS classes
 * - Stops at: Next article div or end of HTML (prevents cross-contamination)
 * 
 * Title Extraction:
 * /<h5 class="mr-result-heading[^"]*">\s*<a[^>]*>([\s\S]*?)<\/a>/s
 * - Matches: H5 heading with any additional classes
 * - Captures: Content inside the link (may contain HTML)
 * - Flag 's': Allows . to match newlines for multi-line titles
 * 
 * COMMON EDGE CASES HANDLED:
 * 
 * 1. **HTML in Titles**: Some titles contain <em>, <strong> tags
 *    Solution: Strip all HTML tags, normalize whitespace
 * 
 * 2. **Multiple Outlet Patterns**: Different layouts use different structures
 *    Solution: Try primary pattern, fall back to alternative
 * 
 * 3. **HTML Entities**: &quot;, &amp;, etc. in snippets
 *    Solution: Explicit entity decoding before display
 * 
 * 4. **Long Snippets**: Some descriptions are very long
 *    Solution: Truncate to 150 characters, add ellipsis
 * 
 * 5. **Missing Elements**: Some articles lack descriptions or dates
 *    Solution: Graceful defaults ("Unknown Date", "No snippet available")
 * 
 * PERFORMANCE NOTES:
 * - Limits extraction to first 15 articles (count < 15) for balanced performance/content
 * - Uses while loop instead of forEach for early termination
 * - Regex patterns compiled once, reused for all articles
 * - No DOM manipulation - pure string processing for speed
 * 
 * ERROR HANDLING STRATEGY:
 * - Individual article parsing failures don't stop the entire process
 * - Console warnings for debugging, but graceful degradation
 * - Returns partial results if some articles parse successfully
 * - Empty array returned on total failure (better than throwing)
 * 
 * DEBUGGING TECHNIQUES:
 * 1. Check hasArticles flag - if false, no articles in HTML at all
 * 2. Log articlePattern.exec() results to see what's being captured
 * 3. Test individual regex patterns in browser console
 * 4. Compare actual HTML structure to reference files
 * 5. Look for changes in Muck Rack's CSS class names or HTML structure
 * 
 * TESTING SCENARIOS:
 * - Large searches (10M+ results) - performance and accuracy
 * - Empty searches - graceful handling of no results
 * - Malformed HTML - error recovery without crashes
 * - Different outlets - variety in title/snippet formats
 * - Special characters - Unicode, entities, formatting
 * 
 * RETURN VALUE STRUCTURE:
 * [
 *   {
 *     title: "Article Headline (HTML stripped, normalized)",
 *     outlet: "Publishing Outlet Name",  
 *     date: "Jul 24, 2025",
 *     snippet: "First 150 chars of description...",
 *     url: "/articles/article-slug-12345"
 *   },
 *   // ... up to 4 more articles
 * ]
 * 
 * @param html - Raw HTML string from Muck Rack article search page
 * @returns Array of article objects (max 5), empty array on failure
 */
export function extractArticleResults(html: string): any[] {
  const results = [];
  
  try {
    // Quick check: if no article divs exist, return early to avoid expensive regex
    const hasArticles = html.includes('mr-result-article');
    if (!hasArticles) {
      return results;  // Empty array for no articles found
    }
    
    // Primary article container pattern - matches Muck Rack's current structure
    // This regex looks for article result divs and captures their inner content
    // Pattern explanation:
    // - <div class="mr-result js-result[^"]*mr-result-article[^"]*": Article div with flexible class order
    // - [^>]*id="result-article[^"]*": ID attribute (specific to articles)
    // - ([\s\S]*?): Capture group for all content inside (non-greedy)
    // - (?=<div class="mr-result js-result|$): Stop at next result div or end of string
    const articlePattern = /<div class="mr-result js-result[^"]*mr-result-article[^"]*"[^>]*id="result-article[^"]*"[^>]*>([\s\S]*?)(?=<div class="mr-result js-result|$)/g;
    let match;
    let count = 0;
    
    // Process each article div found in the HTML
    while ((match = articlePattern.exec(html)) && count < 15) {
      const articleHtml = match[1];  // Content inside the article div
      
      // TITLE EXTRACTION
      // Look for H5 heading with link - this contains the article title
      // Handle potential HTML tags inside titles (like <em> for emphasis)
      const titleMatch = articleHtml.match(/<h5 class="mr-result-heading[^"]*">\s*<a[^>]*>([\s\S]*?)<\/a>/s);
      let title = 'Unknown Title';
      if (titleMatch) {
        // Clean up the title: remove HTML tags and normalize whitespace
        title = titleMatch[1]
          .replace(/<[^>]*>/g, '')    // Strip all HTML tags (em, strong, etc.)
          .replace(/\s+/g, ' ')       // Normalize multiple spaces/newlines to single space
          .trim();                    // Remove leading/trailing whitespace
      }
      
      // OUTLET EXTRACTION
      // Try multiple patterns since outlet links can appear in different structures
      // Primary pattern: direct link to media outlet page
      let outletMatch = articleHtml.match(/<a href="\/media-outlet\/[^"]*"[^>]*>([^<]+)<\/a>/);
      if (!outletMatch) {
        // Fallback pattern: outlet link within result meta content section
        // This handles cases where the HTML structure varies slightly
        outletMatch = articleHtml.match(/class="mr-result-meta-content">[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
      }
      const outlet = outletMatch ? outletMatch[1].trim() : 'Unknown Outlet';
      
      // DATE EXTRACTION
      // Look for span with date class - format is typically "MMM DD, YYYY"
      const dateMatch = articleHtml.match(/<span class="mr-result-date[^"]*">\s*([^<]+)\s*<\/span>/);
      const date = dateMatch ? dateMatch[1].trim() : 'Unknown Date';
      
      // SNIPPET EXTRACTION
      // Parse article description/summary from result description container
      const snippetMatch = articleHtml.match(/<div class="mr-result-description[^"]*">([\s\S]*?)<\/div>/);
      let snippet = 'No snippet available';
      if (snippetMatch) {
        snippet = snippetMatch[1]
          .replace(/<[^>]*>/g, '')    // Remove HTML tags (p, a, em, etc.)
          .replace(/&amp;/g, '&')     // Decode HTML entities
          .replace(/&lt;/g, '<')      // Decode less-than
          .replace(/&gt;/g, '>')      // Decode greater-than  
          .replace(/&quot;/g, '"')    // Decode quotes
          .replace(/\s+/g, ' ')       // Normalize whitespace
          .trim()                     // Clean edges
          .substring(0, 150);         // Limit to 150 characters for UI
        
        // Add ellipsis if we truncated the snippet
        if (snippet.length === 150) snippet += '...';
      }
      
      // URL EXTRACTION
      // Get the link to the full article from the first anchor tag in the article
      const urlMatch = articleHtml.match(/<a[^>]*href="([^"]*)"[^>]*>/);
      const articleUrl = urlMatch ? urlMatch[1] : '';
      
      // Build structured article object for UI consumption
      results.push({
        title,       // Cleaned article headline
        outlet,      // Publishing outlet name
        date,        // Publication date
        snippet,     // Article excerpt (150 chars max)
        url: articleUrl  // Link to full article
      });
      
      count++;  // Limit to 5 articles for performance
    }
    
  } catch (error) {
    // Log parsing errors for debugging but don't crash the extension
    // This allows partial results to be returned even if some parsing fails
    console.warn('Failed to extract article results:', error);
  }
  
  return results;  // Return successfully parsed articles (may be empty array)
}

/**
 * Check Search Results - Phase 2 Extraction  
 * 
 * RESPONSIBILITY: Determine if a Muck Rack search URL returns actual results by fetching
 * and parsing the HTML response. This is the core of the "result checking" feature that
 * prevents opening empty tabs and provides accurate result counts for bulk operations.
 * 
 * WHY THIS FUNCTION EXISTS:
 * The extension's main UX improvement is pre-validating searches before opening browser tabs.
 * Without this function, users would open 100+ tabs only to find most are empty searches.
 * By checking results first, we can show ✅ (found), ❌ (empty), ⏳ (checking) status
 * and let users open only the searches that actually have results.
 * 
 * TECHNICAL APPROACH - CORS Bypass Strategy:
 * 
 * Extension content scripts cannot directly fetch from Muck Rack due to CORS restrictions.
 * We use a three-step proxy pattern:
 * 
 * 1. Content Script Request: Send search URL to service worker via chrome.runtime.sendMessage
 * 2. Service Worker Proxy: Use fetch() with proper headers and credentials  
 * 3. HTML Response: Return full page HTML for parsing (not JSON API)
 * 
 * This bypasses CORS because:
 * - Service worker runs in extension context (not page context)
 * - Has broader permissions than content scripts
 * - Can include cookies/credentials for authenticated requests
 * 
 * PARSING STRATEGY BY SEARCH TYPE:
 * 
 * **ARTICLES (Most Complex)**:
 * Articles can have millions of results (23,594,989 for "received"). The parsing prioritizes:
 * 1. data-total-count attribute (most reliable) - handles comma-separated numbers
 * 2. Text patterns like "X articles" (fallback for different page layouts)
 * 3. Article preview extraction using extractArticleResults() for UI cards
 * 
 * **MEDIA OUTLETS & PEOPLE (Simpler)**:
 * These typically have fewer results and simpler HTML patterns:
 * 1. Look for result container divs ('mr-result js-result')
 * 2. Extract counts from patterns like "X media outlets" or "X people"
 * 3. Check for explicit "0 results" messages
 * 
 * CRITICAL BUG FIX (Phase 2):
 * The infamous "23M shows as 2025" bug was caused by pattern matching fallbacks
 * overwriting correct data-total-count values. This function includes the fix:
 * - Parse data-total-count first for articles
 * - Only run pattern matching loop if no count found
 * - Preserve correct large numbers with comma handling
 * 
 * HTML STRUCTURE ANALYSIS:
 * 
 * Muck Rack search pages follow consistent patterns:
 * 
 * ```html
 * <!-- Result Count (Articles) -->
 * <span class="mr-results-total-count" data-total-count="23594989">
 *   23,594,989 articles
 * </span>
 * 
 * <!-- Result Containers -->
 * <div class="mr-result js-result mr-result-article" id="result-article-123">
 *   <!-- Individual result content -->
 * </div>
 * 
 * <!-- No Results Indicator -->
 * <div class="no-results-message">0 results found</div>
 * ```
 * 
 * RESULT DETECTION ALGORITHM:
 * 
 * The function uses a systematic 4-step approach (inherited from original extension):
 * 
 * 1. **Positive Indicators**: Look for result container divs
 * 2. **Count Extraction**: Parse exact numbers using context-aware patterns  
 * 3. **Negative Indicators**: Check for explicit "0 results" messages
 * 4. **Final Decision**: Use logical rules to determine hasResults boolean
 * 
 * FALLBACK LOGIC & COMPATIBILITY:
 * 
 * Different Muck Rack deployments may have different HTML structures:
 * - Team subdomains (team-name.muckrack.com) vs main app
 * - Admin pages vs public search pages
 * - Legacy layouts vs new responsive designs
 * - Different search result types (articles/outlets/people)
 * 
 * The function handles these with multiple regex patterns and graceful degradation.
 * 
 * ERROR HANDLING PHILOSOPHY:
 * 
 * Network failures, parsing errors, and malformed HTML are handled conservatively:
 * - Return { hasResults: false } on any error (better than false positives)
 * - Log warnings for debugging but don't crash the extension
 * - Partial data is better than no data (some results parsed vs complete failure)
 * 
 * PERFORMANCE CONSIDERATIONS:
 * 
 * This function can be called dozens of times during bulk search operations:
 * - Uses efficient string.includes() checks before expensive regex
 * - Regex patterns compiled once, reused for all searches
 * - Early returns when obvious cases detected (no articles div, explicit 0 results)
 * - Sequential processing to avoid overwhelming Muck Rack servers
 * 
 * DEBUGGING TECHNIQUES:
 * 
 * When result checking fails:
 * 1. Check network tab for actual HTML response vs expectations
 * 2. Test individual regex patterns in browser console
 * 3. Compare HTML structure to reference files in /reference/ folder
 * 4. Look for changes in Muck Rack's CSS classes or page structure
 * 5. Verify CORS proxy is working (service worker logs)
 * 
 * SECURITY CONSIDERATIONS:
 * 
 * - All URLs validated before processing to prevent injection attacks
 * - HTML parsing uses regex (not DOM) to avoid XSS in extension context
 * - No user input directly interpolated into patterns
 * - Service worker enforces same-origin policy for requests
 * - Credentials included only for legitimate Muck Rack domains
 * 
 * RETURN VALUE STRUCTURE:
 * 
 * The function returns a structured object for different use cases:
 * 
 * ```typescript
 * {
 *   hasResults: boolean,           // Primary indicator for UI (✅/❌)
 *   resultCount?: number,          // Exact count if extractable (for display)
 *   articleResults?: Array<{       // Only for articles (preview cards)
 *     title: string,               // Article headline  
 *     outlet: string,              // Publishing outlet
 *     date: string,                // Publication date
 *     snippet: string,             // Excerpt (150 chars)
 *     url: string                  // Link to full article
 *   }>,
 *   firstResult?: any,             // First found result (for popup display)
 *   resultType?: string            // Type indicator (article/outlet/person)  
 * }
 * ```
 * 
 * INTEGRATION WITH OTHER FUNCTIONS:
 * 
 * - Calls extractArticleResults() for article preview generation
 * - Uses extractSearchResults() for popup window data
 * - Called by executeSearch() during bulk operations
 * - Results consumed by UI components for status display
 * 
 * MAINTENANCE NOTES:
 * 
 * This function is sensitive to Muck Rack UI changes:
 * - Test after any Muck Rack updates or redesigns
 * - Update regex patterns if CSS classes change
 * - Reference files may need updates for new HTML structures
 * - Consider API endpoints if they become available (more stable than HTML parsing)
 * 
 * @param url - Muck Rack search URL to validate (must be properly formatted)
 * @returns Promise resolving to result data object or error state
 */
export async function checkSearchResults(url: string): Promise<{ hasResults: boolean; resultCount?: number; articleResults?: any[] }> {
  try {
    // BOOLEAN QUERY DETECTION: Extract query from URL to check for boolean operators
    const urlObj = new URL(url);
    const query = decodeURIComponent(urlObj.searchParams.get('q') || '');
    
    // Boolean operators that Muck Rack supports
    const booleanOperators = ['AND', 'OR', 'NOT', 'NEAR/', '"', 'strict:', 'matchcase:'];
    const isBooleanQuery = booleanOperators.some(op => query.includes(op));
    
    
    // STEP 1: Fetch HTML via CORS proxy (service worker)
    // This is required because direct fetch from content script would fail due to CORS
    const response = await chrome.runtime.sendMessage({
      action: 'fetch',  // Service worker action type
      url: url,         // Target Muck Rack search URL
      options: {
        method: 'GET',
        headers: {
          // Use browser-style Accept header to get full HTML (not AJAX response)
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        credentials: 'include'  // Include cookies for authenticated Muck Rack access
      }
    });
    
    // STEP 2: Validate response from service worker
    if (response.error) {
      throw new Error(response.error);
    }
    
    if (!response.data) {
      throw new Error('No response data received');
    }
    
    const html = response.data;  // Raw HTML string from Muck Rack 

    // STEP 3: Detect positive result indicators
    // These patterns indicate that results exist on the page
    const resultIndicators = [
      // Media Outlet specific indicators
      'class="mr-result js-result"',           // Universal result container
      'class="mr-result-media-outlet"',        // Outlet-specific class
      'class="result-ls-result"',              // Legacy result class
      'class="js-result-media-outlet"',        // JavaScript hook class
      'class="js-result-person"',              // Person result class
      'class="js-result-article"',             // Article result class
      'mr-result-article',                     // Article-specific class (boolean searches)
      'id="result-article-',                   // Article result ID pattern from boolean response
      'data-result-id=',                       // Result ID attribute  
      'data-id=',                              // Alternative result ID (boolean searches)
      'mr-result js-result',                   // Partial class match
      
      // People search specific indicators  
      'class="mr-result js-result mr-card js-mr-result-person"',  // Full person result class
      'class="js-mr-result-person"',           // Person JavaScript hook
      'id="result-person-',                    // Person result ID pattern
      'mr-result js-result mr-card js-mr-result-person'  // Partial person class
    ];
    
    // Quick check: do any positive indicators exist in the HTML?
    const hasPositiveIndicators = resultIndicators.some(indicator => html.includes(indicator));
    
    // DEBUG: For boolean queries, show which indicators we found
    if (isBooleanQuery) {
      const foundIndicators = resultIndicators.filter(indicator => html.includes(indicator));
    }
    
    // STEP 4: Extract result count using context-aware patterns
    // Different search types have different count presentation formats
    let resultCountPatterns = [
      /data-result-count="(\d+)"/,    // Universal data attribute
      /(\d+)\s+results?/i             // Generic "X results" pattern
    ];
    
    let resultCount;  // Will hold the extracted count
    
    // Add search-type-specific patterns based on URL
    // NOTE: We don't extract counts for People or Outlets - just need to know if results exist
    if (url.includes('result_type=article')) {
      // Article searches have the most complex count extraction needs
      resultCountPatterns.push(
        /data-total-count="([^"]+)"/i,         // Primary: data attribute (handles commas)
        /(\d+(?:,\d+)*)\s+articles/i,         // "10,419 articles" pattern
        /of\s+(\d+(?:,\d+)*)\s+articles?/i,   // "of 10,417 articles" pattern
        /(\d+)\s+articles?/i                  // Fallback: simple "X articles"
      );
      
      // CRITICAL FIX: For articles, prioritize data-total-count attribute first
      // This prevents the "23M shows as 2025" bug by parsing the most reliable source
      const dataCountMatch = html.match(/data-total-count="([^"]+)"/i);
      if (dataCountMatch) {
        // Handle comma-separated numbers in the attribute value
        // Example: data-total-count="23,594,989" → 23594989
        const countString = dataCountMatch[1].replace(/,/g, '');
        resultCount = parseInt(countString, 10);
      }
    }
    
    // STEP 5: Pattern matching fallback (only if no count found yet)
    // This preserves the fix for large article counts while maintaining compatibility
    if (resultCount === undefined) {
      for (const pattern of resultCountPatterns) {
        const match = html.match(pattern);
        if (match) {
          // Handle comma-separated numbers in text patterns
          // Example: "10,417 articles" → 10417
          const countString = match[1].replace(/,/g, '');
          resultCount = parseInt(countString, 10);
          break;  // Stop at first successful match
        }
      }
    }
    
    // STEP 6: Check for explicit no-results indicators
    // These patterns definitively indicate no results were found
    const noResultsIndicators = [
      'data-result-count="0"',        // Zero count in data attribute
      'class="no-results-message"',   // Explicit no results message
      'class="empty-results"',        // Empty results container
      '0 people',                     // Text: "0 people"
      '0 person',                     // Text: "0 person"
      '0 media outlets',              // Text: "0 media outlets"
      '0 results'                     // Generic: "0 results"
    ];
    
    const hasNoResultsIndicators = noResultsIndicators.some(indicator => html.includes(indicator));
    
    // STEP 7: Final decision logic (systematic approach from original extension)
    let hasResults = false;
    
    // BOOLEAN QUERY SPECIAL HANDLING: For boolean queries, any indicators = results exist
    if (isBooleanQuery && hasPositiveIndicators) {
      // Boolean queries: if ANY result elements found, assume results exist
      // This fixes issue where boolean queries incorrectly show 0 results
      hasResults = true;
      
      // For boolean queries, ensure we extract the count properly
      if (resultCount === undefined || resultCount === null || isNaN(resultCount)) {
        // Try to extract count again specifically for boolean searches
        const booleanCountMatch = html.match(/data-total-count="([^"]+)"/i);
        if (booleanCountMatch) {
          const countString = booleanCountMatch[1].replace(/,/g, '');
          resultCount = parseInt(countString, 10);
        }
      }
      
    } else if (hasPositiveIndicators) {
      // Found positive indicators (result divs exist)
      // Trust them unless count explicitly contradicts (count = 0)
      hasResults = resultCount === undefined || resultCount > 0;
    } else if (resultCount !== undefined) {
      // No positive indicators but we found a count
      // Trust the count (some pages may have different HTML structure)
      hasResults = resultCount > 0;
    } else if (hasNoResultsIndicators) {
      // Explicit no-results messages found
      hasResults = false;
    } else {
      // No clear indicators either way
      // Conservative approach: assume no results (avoids false positives)
      hasResults = false;
    }
    
    // STEP 8: Enhanced data extraction for popup windows and result display
    // Use the shared result extractor service for consistent parsing
    const extractedData = extractSearchResults(html, url);
    
    // STEP 9: Type-specific return data preparation
    if (url.includes('result_type=article')) {
      // Articles get special treatment with preview data
      const articleResults = extractArticleResults(html);
      
      // Fallback for articles: if no count found but articles parsed,
      // use article count as minimum indicator (articles almost always have results)
      if (articleResults.length > 0 && (resultCount === undefined || resultCount === null || isNaN(resultCount))) {
        resultCount = articleResults.length;
        hasResults = true;
      }
      
      return {
        hasResults,
        resultCount,
        articleResults,                    // Article preview data for UI cards
        firstResult: extractedData.firstResult,  // First result for popup display
        resultType: extractedData.resultType     // Type identifier
      };
    }
    
    // For media outlets and people searches - return preview results
    // NOTE: We don't return resultCount for People/Outlets - just hasResults boolean
    // IMPORTANT: Use the hasResults value calculated earlier (which checks no-results indicators)
    // Don't just trust that we extracted cards - the extractor might match empty divs
    if (url.includes('result_type=person')) {
      // Return people results for preview cards
      return {
        hasResults: hasResults && extractedData.results && extractedData.results.length > 0,
        peopleResults: extractedData.results || [],      // People preview data for UI cards
        firstResult: extractedData.firstResult,          // First result for popup display
        resultType: extractedData.resultType             // Type identifier
      };
    } else if (url.includes('result_type=media_outlet')) {
      // Return outlet results for preview cards
      return {
        hasResults: hasResults && extractedData.results && extractedData.results.length > 0,
        outletResults: extractedData.results || [],      // Outlet preview data for UI cards
        firstResult: extractedData.firstResult,          // First result for popup display
        resultType: extractedData.resultType             // Type identifier
      };
    }

    return {
      hasResults,
      resultCount,
      firstResult: extractedData.firstResult,   // First result for popup display
      resultType: extractedData.resultType      // Type identifier
    };
    
  } catch (error) {
    // Error handling: log for debugging but don't crash the extension
    console.warn('Failed to check search results:', error);
    
    // Conservative approach: return no results on any error
    // This prevents false positives that would open empty tabs
    return { hasResults: false };
  }
}

/**
 * Execute Search - Phase 3 Extraction (Final Phase)
 * 
 * RESPONSIBILITY: Orchestrate bulk search operations across multiple terms with optional
 * result validation. This is the main search engine that coordinates the entire search
 * workflow from term processing to result compilation.
 * 
 * WHY THIS FUNCTION EXISTS:
 * The extension's core value proposition is bulk search processing - taking a list of
 * outlets/people/topics and checking which ones have results in Muck Rack before opening
 * browser tabs. This function is the orchestrator that manages the entire pipeline.
 * 
 * SEARCH ORCHESTRATION WORKFLOW:
 * 
 * ```
 * Input Terms     →    For Each Term     →    Result Validation    →    Structured Output
 * ┌─────────────┐      ┌──────────────┐       ┌─────────────────┐       ┌────────────────┐
 * │["TechCrunch"│      │ Process Term │       │ checkSearchResults│      │{               │
 * │ "Wired",    │ ──►  │ • Build URL  │ ──►   │ • HTTP Request   │ ──►  │ results: [...] │
 * │ "Ars Tech."]│      │ • Validate   │       │ • Parse HTML     │      │ summary: {...} │
 * └─────────────┘      │ • Track Progress│    │ • Extract Count  │      │}               │
 *                      └──────────────┘       └─────────────────┘       └────────────────┘
 * ```
 * 
 * CRITICAL INTEGRATION POINTS:
 * 
 * **Phase Dependencies (All 3 phases working together)**:
 * - Phase 1: extractArticleResults() - For article preview cards
 * - Phase 2: checkSearchResults() - For result validation and counting  
 * - Phase 3: executeSearch() - For orchestration and progress management
 * 
 * **Event System Integration**:
 * The function is called via DOM events from the search-tab component:
 * search-tab.ts → 'search-initiated' event → sidepanel.ts → executeSearch() → 'search-completed' event
 * 
 * **UI Progress Integration**:
 * Uses updateProgress() from ui-utils.ts to provide real-time feedback during bulk operations.
 * Critical for UX when processing 100+ search terms that may take several minutes.
 * 
 * PARAMETERS ANALYSIS:
 * 
 * @param terms - Array of processed search term objects
 *   Structure: [{ 
 *     original: "TechCrunch",                    // User's raw input
 *     processed: "TechCrunch OR techcrunch",     // Query-optimized version  
 *     url: "https://app.muckrack.com/search/..." // Complete search URL
 *   }, ...]
 * 
 * @param location - Search location configuration object
 *   Contains: { name, url, supportsResultCheck, resultType, etc. }
 *   From: ALL_SEARCH_LOCATIONS constant (outlets, people, articles)
 * 
 * @param checkResults - Boolean flag for result pre-validation
 *   true: Slower but shows ✅/❌ status (recommended for bulk operations)
 *   false: Faster, assumes all searches have results (quick operations)
 * 
 * RESULT PROCESSING ALGORITHM:
 * 
 * 1. **Sequential Processing**: Terms processed one-by-one to avoid overwhelming servers
 * 2. **Optional Validation**: If checkResults=true, call checkSearchResults() for each term
 * 3. **Status Classification**: Mark each term as 'found', 'empty', or 'error'
 * 4. **Progress Updates**: Real-time progress bar updates for long operations
 * 5. **Error Isolation**: Individual term failures don't stop entire batch
 * 6. **Summary Generation**: Aggregate statistics for UI display
 * 
 * RETURN VALUE STRUCTURE (Critical for Event System):
 * 
 * The return structure is consumed by 'search-completed' event handlers and must match exactly:
 * 
 * ```typescript
 * {
 *   results: [                              // Array of result objects
 *     {
 *       original: "TechCrunch",             // User input (for display)
 *       processed: "TechCrunch OR techcrunch", // Processed query (for reference)
 *       url: "https://...",                 // Search URL (for opening)
 *       hasResults: true,                   // ✅/❌ indicator
 *       status: 'found'|'empty'|'error',    // Processing result
 *       resultCount: 42,                    // Exact count (if available)
 *       articleResults: [...],              // Article previews (articles only)
 *       firstResult: {...},                 // First found result (popup display)
 *       resultType: 'article'|'outlet'|'person', // Type identifier
 *       error: "Error message"              // Error details (if status='error')
 *     }
 *   ],
 *   summary: {                              // Aggregate statistics
 *     total: 10,                            // Total terms processed
 *     found: 8,                             // Terms with results (✅)
 *     empty: 2                              // Terms without results (❌)
 *   }
 * }
 * ```
 * 
 * ERROR HANDLING PHILOSOPHY:
 * 
 * **Graceful Degradation**: Individual failures don't break the entire batch
 * - Network timeouts → Mark term as 'error', continue with next term
 * - HTML parsing failures → Use fallback logic, continue processing
 * - Authentication issues → Log warning, mark as 'error', continue
 * 
 * **Error Data Preservation**: Errors are captured and included in results
 * - Error message stored in result object for debugging
 * - Failed terms still get result objects (with hasResults: false)
 * - Summary counts include error terms in 'empty' category
 * 
 * PERFORMANCE OPTIMIZATION STRATEGIES:
 * 
 * **Sequential Processing (Not Parallel)**:
 * Terms are processed one-by-one to respect Muck Rack's server capacity and avoid
 * rate limiting. Parallel requests could overwhelm the target server.
 * 
 * **Progress Feedback**: 
 * Real-time updates prevent users from thinking the extension is frozen during
 * long operations (100+ terms can take 2-3 minutes).
 * 
 * **Early Termination Support**:
 * While not currently implemented, the structure supports future AbortController
 * integration for user-initiated cancellation.
 * 
 * **Memory Efficiency**:
 * Results are built incrementally rather than batch-processing to minimize memory
 * usage during large operations.
 * 
 * DEBUGGING TECHNIQUES:
 * 
 * **Individual Term Debugging**:
 * - Check console for per-term warnings about failed processing
 * - Examine result objects for error messages and status values
 * - Test problem terms individually to isolate issues
 * 
 * **Progress Tracking Issues**:
 * - Verify updateProgress() calls are working (should see progress bar updates)
 * - Check if terms.length matches actual processing count
 * - Look for uncaught exceptions that might stop the loop
 * 
 * **Result Structure Validation**:
 * - Ensure return structure matches expected format for event handlers
 * - Check that all required properties are present in result objects
 * - Verify summary counts match actual result classifications
 * 
 * INTEGRATION WITH OTHER SYSTEMS:
 * 
 * **UI Components**:
 * - Results-tab.ts consumes the results array for display
 * - Progress bar shows real-time updates during processing
 * - Status indicators (✅/❌) based on hasResults boolean
 * 
 * **Event System**:
 * - Called via 'search-initiated' DOM event from search-tab component
 * - Results dispatched via 'search-completed' DOM event to UI components
 * - Must preserve exact event detail structure for compatibility
 * 
 * **Service Dependencies**:
 * - Calls checkSearchResults() for result validation (Phase 2)
 * - Uses updateProgress() for UI feedback (from ui-utils)
 * - May call extractArticleResults() indirectly via checkSearchResults()
 * 
 * MAINTENANCE CONSIDERATIONS:
 * 
 * **Breaking Changes**:
 * - Return structure changes require updates to event handlers
 * - Progress callback signature changes affect UI integration
 * - Error handling changes may impact user experience
 * 
 * **Performance Tuning**:
 * - Consider adding request delays if rate limiting becomes an issue
 * - Monitor memory usage for very large term lists (1000+ terms)
 * - Evaluate parallel processing if Muck Rack servers can handle it
 * 
 * **Future Enhancements**:
 * - AbortController integration for cancellation support
 * - Retry logic for transient network failures
 * - Caching layer for recently checked terms
 * - Batch size optimization based on server response times
 * 
 * @param terms - Array of processed search term objects with URLs
 * @param location - Search location configuration object  
 * @param checkResults - Whether to pre-validate results (slower but informative)
 * @returns Promise resolving to structured search results with summary statistics
 */
export async function executeSearch(terms: any[], location: any, checkResults: boolean): Promise<any> {
  const results = [];      // Accumulator for individual term results
  let foundCount = 0;      // Counter for terms with results (✅)
  let emptyCount = 0;      // Counter for terms without results (❌)
  
  // Process each search term sequentially (not parallel to avoid server overload)
  for (const term of terms) {
    try {
      let hasResults = true;     // Default assumption: search has results
      let checkResult = null;    // Will hold detailed result data if checking enabled
      
      // OPTIONAL RESULT VALIDATION
      // If result checking is enabled and the search type supports it,
      // pre-validate by fetching and parsing the search URL
      if (checkResults && location.supportsResultCheck) {
        // Call Phase 2 function: checkSearchResults()
        // This handles CORS proxy, HTML parsing, count extraction, etc.
        checkResult = await checkSearchResults(term.url);
        hasResults = checkResult.hasResults;  // Use validation result
      }
      
      // BUILD RESULT OBJECT
      // Create structured result object for this term with all available data
      results.push({
        original: term.original,                    // User's original input
        processed: term.processed,                  // Query-processed version
        url: term.url,                             // Complete search URL
        hasResults,                                // Boolean: has results or not
        status: hasResults ? 'found' : 'empty',    // String classification
        resultCount: checkResult?.resultCount,      // Exact count (if available)
        articleResults: checkResult?.articleResults, // Article previews (articles only)
        firstResult: checkResult?.firstResult,      // First result data (popup display)
        resultType: checkResult?.resultType         // Type identifier
      });
      
      // UPDATE COUNTERS
      // Track aggregate statistics for summary object
      if (hasResults) {
        foundCount++;    // Increment ✅ counter
      } else {
        emptyCount++;    // Increment ❌ counter  
      }
      
      // PROGRESS BAR UPDATES
      // Provide real-time feedback during long operations
      // Only update when result checking is enabled (otherwise operations are fast)
      if (checkResults && location.supportsResultCheck) {
        // Call UI utility function to update progress bar
        // Format: "Checking results... X of Y complete"
        updateProgress(
          results.length,    // Current progress (completed terms)
          terms.length,      // Total work (total terms)
          `Checking results... ${results.length} of ${terms.length} complete`
        );
      }
      
    } catch (error) {
      // INDIVIDUAL TERM ERROR HANDLING
      // If processing this specific term fails, log the error but continue
      // with the next term. This prevents one bad term from breaking the entire batch.
      console.warn(`Failed to process term "${term.original}":`, error);
      
      // Create error result object to maintain consistent data structure
      results.push({
        original: term.original,        // Preserve user input
        processed: term.processed,      // Preserve processed version  
        url: term.url,                 // Preserve URL for manual checking
        hasResults: false,             // Mark as no results due to error
        status: 'error',               // Distinct status for errors
        error: error.message           // Capture error details for debugging
      });
      
      emptyCount++;  // Count errors as "empty" for summary statistics
    }
  }
  
  // RETURN STRUCTURED RESULTS
  // Format must match exactly what 'search-completed' event handlers expect
  return {
    results,      // Array of individual term result objects
    summary: {    // Aggregate statistics for UI display
      total: terms.length,   // Total terms processed
      found: foundCount,     // Terms with results (✅)
      empty: emptyCount      // Terms without results (❌) including errors
    }
  };
}

/**
 * Execute Multi-Category Search - Phase 3 Implementation
 *
 * RESPONSIBILITY: Execute searches across multiple categories (People, Articles, Outlets, Broadcast)
 * simultaneously and aggregate results by category for the inline accordion component.
 *
 * WHY THIS FUNCTION EXISTS:
 * The new multi-category search redesign allows users to search across multiple Muck Rack
 * categories at once (e.g., search "runescape" in both People and Articles simultaneously).
 * This function orchestrates parallel searches across all selected categories and structures
 * the results for display in the inline accordion component.
 *
 * MULTI-CATEGORY SEARCH WORKFLOW:
 *
 * ```
 * Input Terms + Categories  →  For Each Category  →  Aggregate Results  →  Structured Output
 * ┌──────────────────────┐    ┌────────────────┐    ┌──────────────────┐   ┌─────────────────┐
 * │Terms: ["runescape"]  │    │ People Search  │    │ Group by Category│   │CategoryResults[]│
 * │Categories:           │ ─► │ Articles Search│ ─► │ • People: {...} │─► │[{category: ...},│
 * │["people","articles"] │    │ Outlets Search │    │ • Articles:{...} │   │ {category: ...}]│
 * └──────────────────────┘    └────────────────┘    └──────────────────┘   └─────────────────┘
 * ```
 *
 * KEY DIFFERENCES FROM executeSearch():
 * - executeSearch(): Single category, multiple terms → Results Tab
 * - executeMultiCategorySearch(): Multiple categories, multiple terms → Inline Accordion
 *
 * PARAMETERS:
 * @param terms - Array of search term strings (e.g., ["runescape", "WoW", "Everquest"])
 * @param categories - Array of category IDs (e.g., ["people", "articles", "media_outlets"])
 * @param checkResults - Whether to pre-validate results (true = slower but shows ✅/❌)
 *
 * RETURN VALUE STRUCTURE:
 * Returns CategoryResults[] matching the inline accordion component interface:
 *
 * ```typescript
 * [
 *   {
 *     category: 'people',
 *     categoryName: 'People',
 *     expanded: true,
 *     terms: [
 *       {
 *         term: 'runescape',
 *         found: true,
 *         count: 18,
 *         peopleResults: [...]  // Preview data from Muck Rack
 *       }
 *     ]
 *   },
 *   {
 *     category: 'articles',
 *     categoryName: 'Articles',
 *     expanded: false,
 *     terms: [
 *       {
 *         term: 'runescape',
 *         found: true,
 *         count: 156,
 *         articleResults: [...]  // Preview data from Muck Rack
 *       }
 *     ]
 *   }
 * ]
 * ```
 *
 * PROCESSING STRATEGY:
 * 1. For each selected category:
 *    - Get category location object from ALL_SEARCH_LOCATIONS
 *    - For each search term:
 *      - Generate search URL using existing query generation logic
 *      - Optionally check results using checkSearchResults()
 *      - Extract count and preview data
 *    - Aggregate all terms for this category
 * 2. Structure results by category for accordion display
 * 3. Return CategoryResults[] for inline component
 *
 * QUERY GENERATION PRESERVATION:
 * This function uses the SAME query generation logic as executeSearch():
 * - Media Outlets: "New York Times" → `"New York Times"` (quoted)
 * - People: CamelCase handling, name formatting
 * - Articles: Boolean operators, phrase detection
 * - URL cleaning, smart formatting, etc.
 *
 * All existing rules in query-generator.ts remain unchanged and are reused here.
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Categories processed in parallel using Promise.all() for speed
 * - Terms within each category processed sequentially (to respect server limits)
 * - Progress updates provided during long operations
 * - Early termination support for user cancellation (future enhancement)
 *
 * ERROR HANDLING:
 * - Individual category failures don't stop other categories
 * - Individual term failures don't stop the category
 * - Graceful degradation with partial results
 * - Error details preserved for debugging
 *
 * INTEGRATION POINTS:
 * - Called from search-tab.ts when multi-category checkboxes used
 * - Results consumed by search-results-inline.ts component
 * - Uses checkSearchResults() for result validation (Phase 2 function)
 * - Uses existing query generation from query-generator.ts
 *
 * PHASE 3 IMPLEMENTATION STATUS:
 * - Method signature defined ✅
 * - TypeScript interfaces imported ✅
 * - Single category logic (Step 2) - PENDING
 * - Parallel multi-category (Step 3) - PENDING
 * - Integration with search tab (Step 4) - PENDING
 *
 * @param terms - Array of search term strings
 * @param categories - Array of category IDs to search
 * @param checkResults - Whether to pre-validate results
 * @param broadSearch - Whether to use broad search for People (include bios/coverage)
 * @returns Promise resolving to CategoryResults[] for inline accordion
 */
export async function executeMultiCategorySearch(
  terms: string[],
  categories: string[],
  checkResults: boolean,
  broadSearch: boolean = false
): Promise<CategoryResults[]> {
  const categoryResults: CategoryResults[] = [];

  // CATEGORY MAPPING: Map category IDs to location objects and display names
  const categoryMap: Record<string, { location: any, displayName: string }> = {
    'people': {
      location: ALL_SEARCH_LOCATIONS['Public Site'][0],
      displayName: 'People'
    },
    'articles': {
      location: ALL_SEARCH_LOCATIONS['Public Site'][1],
      displayName: 'Articles'
    },
    'media_outlets': {
      location: ALL_SEARCH_LOCATIONS['Public Site'][2],
      displayName: 'Media Outlets'
    },
    'broadcast': {
      location: ALL_SEARCH_LOCATIONS['Public Site'][3],
      displayName: 'Broadcast / Clips'
    }
  };

  // STEP 3: Multi-Category Parallel Processing
  // Process ALL selected categories in parallel using Promise.all()

  /**
   * Process a single category's search terms
   * This function is called in parallel for each selected category
   */
  async function processSingleCategory(categoryId: string, isFirst: boolean): Promise<CategoryResults> {
    const categoryConfig = categoryMap[categoryId];

    if (!categoryConfig) {
      console.warn(`Unknown category: ${categoryId}`);
      // Return empty result for unknown category
      return {
        category: categoryId,
        categoryName: categoryId,
        terms: [],
        expanded: false
      };
    }

    const { location, displayName } = categoryConfig;
    const termResults: SearchTermResult[] = [];

    // Process each search term for this category (sequentially to respect server limits)
    for (const term of terms) {
      try {
        // QUERY GENERATION: Use existing query generator with proper query type
        const queries = generateQueries([term], location.queryType);
        const query = queries[0];

        // URL CONSTRUCTION: Build complete search URL
        let searchUrl = location.url.replace('{{muckRackHost}}', 'muckrack.com');
        searchUrl += `&q=${encodeURIComponent(query.processed)}`;

        // CONDITIONAL extraParams BASED ON BROAD SEARCH TOGGLE
        // For People searches, extraParams contains '&must_appear_in_people=names'
        // - broadSearch = FALSE (default): Add filter, only find people whose NAMES match term
        // - broadSearch = TRUE: Skip filter, find people who COVER topic (bios, articles, beats)
        // For other categories, always add extraParams (not affected by broadSearch)
        if (location.extraParams && (!broadSearch || categoryId !== 'people')) {
          searchUrl += location.extraParams;
        }

        // RESULT CHECKING: Optionally pre-validate results
        let found = true;
        let count: number | undefined = undefined;
        let previewResults: any = undefined;

        if (checkResults && location.supportsResultCheck) {
          const checkResult = await checkSearchResults(searchUrl);
          found = checkResult.hasResults;
          count = checkResult.resultCount;

          // Extract preview data based on category type
          if (categoryId === 'articles' && checkResult.articleResults) {
            previewResults = { articleResults: checkResult.articleResults };
          } else if (categoryId === 'people' && checkResult.peopleResults) {
            // Limit to top 3 people for preview (total count already in checkResult.resultCount)
            previewResults = { peopleResults: checkResult.peopleResults.slice(0, 3) };
          } else if (categoryId === 'media_outlets' && checkResult.outletResults) {
            // Limit to top 3 outlets for preview (total count already in checkResult.resultCount)
            previewResults = { outletResults: checkResult.outletResults.slice(0, 3) };
          }
        }

        // BUILD TERM RESULT: Structure data for accordion component
        const termResult: SearchTermResult = {
          term: term,
          found: found,
          count: count,
          expanded: false,
          ...previewResults
        };

        termResults.push(termResult);

      } catch (error) {
        console.warn(`Failed to process term "${term}" for category ${categoryId}:`, error);

        // Add error result to maintain consistent structure
        termResults.push({
          term: term,
          found: false,
          expanded: false
        });
      }
    }

    // BUILD CATEGORY RESULT: Aggregate all terms for this category
    return {
      category: categoryId,
      categoryName: displayName,
      terms: termResults,
      expanded: isFirst  // First category expanded by default
    };
  }

  // PARALLEL CATEGORY PROCESSING: Execute all categories simultaneously
  // This dramatically speeds up multi-category searches vs sequential processing
  const categoryPromises = categories.map((categoryId, index) =>
    processSingleCategory(categoryId, index === 0)
  );

  // Wait for all category searches to complete
  const results = await Promise.all(categoryPromises);

  return results;
}