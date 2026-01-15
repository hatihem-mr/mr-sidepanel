/**
 * Result Extraction Service
 * 
 * Dedicated utility for parsing Muck Rack search result HTML and extracting
 * structured data about the first few results found. This enables the popup
 * to show actual result names instead of just search terms.
 * 
 * ARCHITECTURE:
 * - Pure utility functions with no UI dependencies
 * - Follows single responsibility principle
 * - Can be unit tested independently
 * - Used by checkSearchResults() to enhance result data
 * 
 * SUPPORTED SEARCH TYPES:
 * - Media Outlets: Extract outlet name, type, location
 * - People: Extract person name, title/role, location  
 * - Articles: Extract article title, outlet, date, snippet
 * 
 * HTML PARSING STRATEGY:
 * - Uses specific CSS class patterns from Muck Rack HTML
 * - Robust regex patterns with fallbacks
 * - Handles HTML entities and formatting inconsistencies
 * - Limits extraction to first 5 results for performance
 * 
 * ERROR HANDLING:
 * - Graceful degradation if HTML structure changes
 * - Console logging for debugging extraction issues
 * - Returns empty arrays rather than throwing errors
 * - Individual result failures don't break entire extraction
 */

export interface MediaOutletResult {
  name: string;
  type: string;
  location: string;
  description: string;
  icon?: string;
}

export interface PersonResult {
  name: string;
  title: string;
  location: string;
  bio: string;
  photo?: string;
}

export interface ArticleResult {
  title: string;
  outlet: string;
  date: string;
  snippet: string;
  url: string;
}

/**
 * Extract first 5 media outlet results from HTML
 * 
 * PARSING STRATEGY:
 * - Finds div containers with "mr-result-media-outlet" class
 * - Extracts outlet name from h5 heading link
 * - Gets outlet type from byline (Newspaper, Magazine, etc.)
 * - Extracts location from meta content section
 * 
 * EXAMPLE OUTPUT:
 * [
 *   { name: "The New York Times", type: "Newspaper", location: "New York, US" },
 *   { name: "CNN", type: "News Website", location: "Atlanta, US" }
 * ]
 * 
 * @param html - Raw HTML from Muck Rack media outlet search results
 * @returns Array of outlet result objects (max 5)
 */
export function extractMediaOutletResults(html: string): MediaOutletResult[] {
  const results: MediaOutletResult[] = [];
  
  try {
    // Parse media outlet results using the structure from outlet-first-result-div.md
    const outletPattern = /<div class="mr-result js-result[^"]*mr-result-media-outlet[^"]*"[^>]*id="result-media-outlet[^"]*"[^>]*>([\s\S]*?)(?=<div class="mr-result js-result|$)/g;
    let match;
    let count = 0;
    
    
    while ((match = outletPattern.exec(html)) && count < 15) {
      const outletHtml = match[1];
      
      // Extract outlet name from h5 heading with link - handle nested <b> tags
      const nameMatch = outletHtml.match(/<h5 class="mr-result-heading[^"]*">\s*<a[^>]*>([\s\S]*?)<\/a>/s);
      let name = 'Unknown Outlet';
      if (nameMatch) {
        // Clean up the name and handle <b> tags and other HTML
        name = nameMatch[1]
          .replace(/<[^>]*>/g, '') // Remove all HTML tags (including <b>, <i>, etc.)
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim();
      }
      
      // Extract outlet type from byline
      const typeMatch = outletHtml.match(/<div class="mr-byline mr-result-byline[^"]*">([^<]+)<\/div>/);
      const type = typeMatch ? typeMatch[1].trim() : '';
      
      // Extract location from meta content
      const locationMatch = outletHtml.match(/<div class="mr-result-meta-content">\s*([^<]+)\s*<\/div>/);
      const location = locationMatch ? locationMatch[1].trim() : '';
      
      // Extract description/snippet from the description div
      const descriptionMatch = outletHtml.match(/<div class="mr-result-description[^"]*">([\s\S]*?)<\/div>/);
      let description = '';
      if (descriptionMatch) {
        // Clean up description and truncate to reasonable length
        description = descriptionMatch[1]
          .replace(/<[^>]*>/g, '') // Remove all HTML tags
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim()
          .substring(0, 200) + '...'; // Truncate like articles
      }

      // Extract outlet icon/logo URL from mr-result-avatar
      const iconMatch = outletHtml.match(/<a class="mr-result-avatar"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
      const icon = iconMatch ? iconMatch[1].trim() : undefined;

      results.push({
        name,
        type,
        location,
        description,
        icon
      });
      
      count++;
    }

    return results;
    
  } catch (error) {
    console.error('[ResultExtractor] Failed to extract media outlet results:', error);
    return [];
  }
}

/**
 * Extract first 5 person results from HTML
 * 
 * PARSING STRATEGY:
 * - Finds div containers with "mr-result-person" class
 * - Extracts person name from h5 heading with "js-person-name" class
 * - Gets title/role from byline (handles complex formats with links)
 * - Extracts location from meta content section
 * 
 * EXAMPLE OUTPUT:
 * [
 *   { name: "Kyle Kulinski", title: "Host, YouTuber", location: "New York" },
 *   { name: "Jane Doe", title: "Reporter", location: "Washington DC" }
 * ]
 * 
 * @param html - Raw HTML from Muck Rack people search results
 * @returns Array of person result objects (max 5)
 */
export function extractPersonResults(html: string): PersonResult[] {
  const results: PersonResult[] = [];
  
  try {
    // Parse person results using the structure from people-first-result-div.md
    const personPattern = /<div class="mr-result js-result[^"]*mr-result-person[^"]*"[^>]*id="result-person[^"]*"[^>]*>([\s\S]*?)(?=<div class="mr-result js-result|$)/g;
    let match;
    let count = 0;
    
    
    while ((match = personPattern.exec(html)) && count < 15) {
      const personHtml = match[1];
      
      // Extract person name from h5 heading with js-person-name class - handle nested HTML
      const nameMatch = personHtml.match(/<h5 class="mr-result-heading[^"]*">\s*<a[^>]*class="[^"]*js-person-name[^"]*"[^>]*>([\s\S]*?)<\/a>/s);
      let name = 'Unknown Person';
      if (nameMatch) {
        // Clean up the name and handle all HTML tags
        name = nameMatch[1]
          .replace(/<[^>]*>/g, '') // Remove all HTML tags (including <b>, <i>, etc.)
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim();
      }
      
      // Extract title/role from byline (handles complex formats with links)
      const titleMatch = personHtml.match(/<div class="mr-byline mr-result-byline[^"]*">([\s\S]*?)<\/div>/);
      let title = '';
      if (titleMatch) {
        // Handle complex bylines with links like "Host, YouTuber, Freelance, Krystal Kyle and Friends"
        title = titleMatch[1]
          .replace(/<[^>]*>/g, '') // Remove ALL HTML tags (spans, links, etc.)
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim();
      }
      
      // Extract location from meta content
      const locationMatch = personHtml.match(/<div class="mr-result-meta-content">\s*([^<]+)\s*<\/div>/);
      const location = locationMatch ? locationMatch[1].trim() : '';

      // Extract bio/description from the description div
      const bioMatch = personHtml.match(/<div class="mr-result-description[^"]*">([\s\S]*?)<\/div>/);
      let bio = '';
      if (bioMatch) {
        bio = bioMatch[1]
          .replace(/<[^>]*>/g, '') // Remove all HTML tags
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim();
      }

      // Extract profile photo URL
      const photoMatch = personHtml.match(/<img[^>]*class="[^"]*js-person-image[^"]*"[^>]*src="([^"]+)"/);
      const photo = photoMatch ? photoMatch[1] : undefined;

      results.push({
        name,
        title,
        location,
        bio,
        photo
      });
      
      count++;
    }

    return results;
    
  } catch (error) {
    console.error('[ResultExtractor] Failed to extract person results:', error);
    return [];
  }
}

/**
 * Extract first 5 article results from HTML (moved from sidepanel.ts)
 * 
 * PARSING STRATEGY:
 * - Finds div containers with "mr-result-article" class
 * - Extracts article title from h5 heading link
 * - Gets media outlet from outlet link
 * - Extracts publish date from date span
 * - Gets article snippet from description
 * 
 * EXAMPLE OUTPUT:
 * [
 *   { 
 *     title: "Breaking News Story", 
 *     outlet: "CNN", 
 *     date: "2025-01-24", 
 *     snippet: "Article preview text...",
 *     url: "https://cnn.com/article"
 *   }
 * ]
 * 
 * @param html - Raw HTML from Muck Rack article search results
 * @returns Array of article result objects (max 5)
 */
export function extractArticleResults(html: string): ArticleResult[] {
  const results: ArticleResult[] = [];
  
  try {
    // First, let's check if we have article divs at all
    const hasArticles = html.includes('mr-result-article');
    
    // Parse article results using the structure from mr-first-result-div.md
    // Updated pattern to be more flexible with the closing divs
    const articlePattern = /<div class="mr-result js-result[^"]*mr-result-article[^"]*"[^>]*id="result-article[^"]*"[^>]*>([\s\S]*?)(?=<div class="mr-result js-result|$)/g;
    let match;
    let count = 0;
    
    
    while ((match = articlePattern.exec(html)) && count < 15) {
      const articleHtml = match[1];
      
      // Extract title from the h5 heading with link - handle HTML tags inside title
      const titleMatch = articleHtml.match(/<h5 class="mr-result-heading[^"]*">\s*<a[^>]*>([\s\S]*?)<\/a>/s);
      let title = 'Unknown Title';
      if (titleMatch) {
        // Remove HTML tags from title and clean up whitespace
        title = titleMatch[1]
          .replace(/<[^>]*>/g, '') // Remove all HTML tags
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim();
      }
      
      // Extract media outlet - try multiple patterns
      let outletMatch = articleHtml.match(/<a href="\/media-outlet\/[^"]*"[^>]*>([^<]+)<\/a>/);
      if (!outletMatch) {
        // Try alternative pattern - outlet might be in different structure
        outletMatch = articleHtml.match(/class="mr-result-meta-content">[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
      }
      const outlet = outletMatch ? outletMatch[1].trim() : 'Unknown Outlet';
      
      // Extract date from span with mr-result-date class
      const dateMatch = articleHtml.match(/<span class="mr-result-date[^"]*">([^<]+)<\/span>/);
      const date = dateMatch ? dateMatch[1].trim() : '';
      
      // Extract snippet from description div
      const snippetMatch = articleHtml.match(/<div class="mr-result-description[^"]*">([^<]+)/);
      const snippet = snippetMatch ? snippetMatch[1].trim().substring(0, 150) + '...' : '';
      
      // Try to extract article URL
      const urlMatch = titleMatch ? titleMatch[0].match(/href="([^"]+)"/) : null;
      const url = urlMatch ? urlMatch[1] : '';

      results.push({
        title,
        outlet, 
        date,
        snippet,
        url
      });
      
      count++;
    }

    return results;
    
  } catch (error) {
    console.error('[ResultExtractor] Failed to extract article results:', error);
    return [];
  }
}

/**
 * Extract results based on search type
 * 
 * Convenience function that routes to the appropriate extraction method
 * based on the search URL type. Used by checkSearchResults() to get
 * the right data structure.
 * 
 * @param html - Raw HTML from Muck Rack search results
 * @param searchUrl - The search URL to determine result type
 * @returns Object with results array and first result data
 */
export function extractSearchResults(html: string, searchUrl: string): {
  results: any[];
  firstResult: any;
  resultType: string;
} {
  let results: any[] = [];
  let resultType = 'unknown';
  
  if (searchUrl.includes('result_type=media_outlet')) {
    results = extractMediaOutletResults(html);
    resultType = 'media_outlet';
  } else if (searchUrl.includes('result_type=person')) {
    results = extractPersonResults(html);
    resultType = 'person';
  } else if (searchUrl.includes('result_type=article')) {
    results = extractArticleResults(html);
    resultType = 'article';
  }
  
  const firstResult = results.length > 0 ? results[0] : null;

  return {
    results,
    firstResult,
    resultType
  };
}