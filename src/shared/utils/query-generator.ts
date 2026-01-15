// ===================================================================
// QUERY GENERATOR - Smart Search Query Construction
// ===================================================================
// This utility converts user input into optimized Muck Rack search queries.
// It handles various input formats and applies intelligent transformations
// to improve search accuracy and recall.
//
// CORE FUNCTIONALITY:
// 1. Input validation and sanitization
// 2. Smart query expansion (TechCrunch → "TechCrunch" OR "techcrunch")
// 3. URL extraction and cleaning
// 4. CamelCase handling (TechCrunch → "Tech Crunch")
// 5. Coverage report query generation
// 6. Multi-term processing with deduplication
//
// QUERY OPTIMIZATION STRATEGIES:
//
// 1. URL Processing:
//    Input: "https://techcrunch.com/article"
//    Output: "techcrunch.com" OR "techcrunch"
//
// 2. CamelCase Expansion:
//    Input: "TechCrunch"  
//    Output: "TechCrunch" OR "Tech Crunch"
//
// 3. Multi-word Phrases:
//    Input: "The New York Times"
//    Output: "The New York Times" (quoted for exact match)
//
// 4. Simple Terms:
//    Input: "CNN"
//    Output: "CNN" (no expansion needed)
//
// WHY QUERY EXPANSION IS IMPORTANT:
// - Media outlets may be listed differently in Muck Rack
// - Some outlets use spacing variations (TechCrunch vs Tech Crunch)
// - URLs may not match stored outlet names exactly
// - Boolean OR queries improve search recall without precision loss
//
// TROUBLESHOOTING QUERY ISSUES:
// - Poor search results: Check if query expansion is too broad
// - Missing results: Verify input text extraction is correct
// - Duplicate results: Check deduplication logic in processing
// - Invalid queries: Verify input validation catches malformed data
// ===================================================================

import { REGEX_PATTERNS, LIMITS } from '../constants.js';
import { GeneratedQuery, QueryGenerationOptions } from '../types/index.js';

// ===================================================================
// INPUT VALIDATION & SANITIZATION
// ===================================================================

/**
 * Validates and sanitizes input text for query generation
 * 
 * VALIDATION CHECKS:
 * - Non-empty string validation
 * - Type checking (must be string)
 * - Length limits (prevent DoS attacks)
 * - Whitespace trimming
 * 
 * SECURITY CONSIDERATIONS:
 * - Prevents extremely long inputs that could cause performance issues
 * - Ensures consistent data types for downstream processing
 * - Removes leading/trailing whitespace that could affect matching
 * 
 * ERROR HANDLING:
 * - Throws descriptive error for oversized input
 * - Returns empty string for invalid input types
 * - Graceful degradation for edge cases
 */
function validateInput(text: string): string {
  if (!text || typeof text !== 'string') return '';
  if (text.length > LIMITS.MAX_INPUT_LENGTH) {
    throw new Error(`Input too long. Maximum ${LIMITS.MAX_INPUT_LENGTH} characters allowed.`);
  }
  return text.trim();
}

/**
 * Extracts first URL from text, with input validation
 */
export function extractUrlFromText(text: string): string {
  const validatedText = validateInput(text);
  if (!validatedText) return '';
  
  const match = validatedText.match(REGEX_PATTERNS.URL);
  return match ? match[0] : validatedText;
}

/**
 * Generates coverage report query with validation
 */
export function generateCoverageReportQuery(term: string): string {
  const trimmedTerm = validateInput(term);
  if (!trimmedTerm) return '';
  
  if (REGEX_PATTERNS.COVERAGE_REPORT.test(trimmedTerm)) {
    return extractUrlFromText(trimmedTerm);
  }
  return trimmedTerm;
}

/**
 * Generates admin search query with improved domain handling
 */
export function generateAdminQuery(term: string): string {
  const trimmedTerm = validateInput(term);
  if (!trimmedTerm) return '';
  
  // If it already has spaces, return as-is
  if (trimmedTerm.includes(' ')) {
    return trimmedTerm;
  }
  
  let coreName = trimmedTerm;
  
  // Check if it's a domain (with or without protocol)
  const domainMatch = trimmedTerm.match(REGEX_PATTERNS.DOMAIN);
  
  if (domainMatch) {
    // Extract just the domain name part (before the TLD)
    coreName = domainMatch[1];
  }
  
  // Apply CamelCase spacing
  const spacedQuery = coreName.replace(REGEX_PATTERNS.CAMEL_CASE, '$1 $2');
  
  return spacedQuery;
}

/**
 * Detects if a query contains Muck Rack boolean operators
 * 
 * ENHANCED BOOLEAN OPERATOR DETECTION RULES:
 * 1. Logical operators: AND/OR/NOT (uppercase, word boundaries)
 * 2. Symbol operators: ( ) (symbols)
 * 3. Quote operators: "exact phrases" (quoted text)
 * 4. Special operators: strict:, matchcase:, headline:, body:, link: (with colons)
 * 5. Proximity operators: NEAR/1, near/5 (with slash and optional numbers)
 * 6. Frequency operators: {5,10}, {3,} (curly brace patterns)
 * 
 * EXAMPLES:
 * ✅ Boolean: "runescape AND WOW", "Apple OR Samsung", "matchcase:iPhone", "NEAR/5", ("tech" OR startups)
 * ❌ Not Boolean: "Barnes and Noble", "Anderson Cooper", "Near Water"
 * 
 * This prevents outlet names from being treated as boolean while detecting all MR operators.
 * Quotes are detected as boolean when user-entered, but preserved when extension-generated.
 */
function detectBooleanQuery(query: string): boolean {
  // Enhanced regex pattern matching Muck Rack's boolean operators exactly
  // Including single quotes to detect boolean as soon as " is typed
  const booleanPattern = /\b(AND|OR|NOT)\b|[()]|"|"[^"]*"|(?:strict|matchcase|headline|body|link):|(?:NEAR|near)\/\d*|\{\d*,?\d*\}/;
  return booleanPattern.test(query);
}

/**
 * Extracts all boolean operators from a query for highlighting
 * Returns array of {text, start, end} objects for each operator
 */
export function extractBooleanOperators(query: string): Array<{text: string, start: number, end: number}> {
  const operators = [];
  // Updated pattern to match individual quotes separately
  const booleanPattern = /\b(AND|OR|NOT)\b|[()]|"|(?:strict|matchcase|headline|body|link):|(?:NEAR|near)\/\d*|\{\d*,?\d*\}/g;
  let match;
  
  while ((match = booleanPattern.exec(query)) !== null) {
    operators.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  return operators;
}

/**
 * Generates smart search query with comprehensive logic
 * This is the main query generation function from the original extension
 */
export function generateSmartQuery(term: string, options?: Partial<QueryGenerationOptions>): GeneratedQuery {
  const trimmedTerm = validateInput(term);
  if (!trimmedTerm) {
    return {
      original: term,
      processed: '',
      explanation: 'Empty term',
      confidence: 0,
      alternatives: []
    };
  }

  const opts: QueryGenerationOptions = {
    searchType: 'public',
    enableQuotes: true,
    enableOR: true,
    caseSensitive: false,
    ...options
  };

  let processed = trimmedTerm;
  let explanation = 'Direct search';
  let confidence = 1.0;
  const alternatives: string[] = [];

  // Handle full URLs
  const fullUrlMatch = trimmedTerm.match(REGEX_PATTERNS.URL);
  if (fullUrlMatch) {
    try {
      const url = new URL(fullUrlMatch[0]);
      const hostname = url.hostname.replace(/^www\./, '');
      const coreName = hostname.split('.')[0];
      const isAllLowercase = (hostname === hostname.toLowerCase());
      const quote = (isAllLowercase || !opts.enableQuotes) ? '' : '"';
      
      if (coreName && coreName.toLowerCase() !== hostname.toLowerCase()) {
        processed = `${quote}${hostname}${quote} OR ${quote}${coreName}${quote}`;
        explanation = 'URL with domain and root name alternatives';
      } else {
        processed = `${quote}${hostname}${quote}`;
        explanation = 'URL domain extraction';
      }
      confidence = 0.9;
      alternatives.push(hostname, coreName);
    } catch (e) {
      // Invalid URL, fall through to other logic
      confidence *= 0.8;
    }
  }
  // Handle simple domains
  else if (REGEX_PATTERNS.SIMPLE_DOMAIN.test(trimmedTerm)) {
    const cleanDomain = trimmedTerm.replace(/^www\./, '');
    const domainName = cleanDomain.split('.')[0];
    const spacedVersion = domainName.replace(REGEX_PATTERNS.CAMEL_CASE, '$1 $2');
    
    const domainHasMixedCase = cleanDomain !== cleanDomain.toLowerCase();
    const spacedNeedsQuotes = spacedVersion.includes(' ');
    
    if (spacedVersion !== domainName && opts.enableOR) {
      // Domain has capitals that create spaced version
      const domainPart = (domainHasMixedCase && opts.enableQuotes) ? `"${cleanDomain}"` : cleanDomain;
      const spacedPart = (spacedNeedsQuotes && opts.enableQuotes) ? `"${spacedVersion}"` : spacedVersion;
      processed = `${domainPart} OR ${spacedPart}`;
      explanation = 'Domain with CamelCase expansion';
      alternatives.push(cleanDomain, spacedVersion);
    } else {
      // Simple domain
      const domainPart = (domainHasMixedCase && opts.enableQuotes) ? `"${cleanDomain}"` : cleanDomain;
      const namePart = domainName;
      if (opts.enableOR) {
        processed = `${domainPart} OR ${namePart}`;
        explanation = 'Domain with root name alternative';
        alternatives.push(cleanDomain, namePart);
      } else {
        processed = domainPart;
        explanation = 'Domain name';
      }
    }
    confidence = 0.85;
  }
  // Handle boolean queries (must come before multi-word phrase handling)
  else if (detectBooleanQuery(trimmedTerm)) {
    processed = trimmedTerm;
    explanation = 'Boolean query with operators (no quotes applied)';
    confidence = 0.95;
  }
  // Handle multi-word terms
  else if (trimmedTerm.includes(' ')) {
    const cleanedText = trimmedTerm.replace(/^\d+[.)]\s*/, '');
    if (opts.enableQuotes) {
      processed = `"${cleanedText}"`;
      explanation = 'Multi-word phrase with quotes';
    } else {
      processed = cleanedText;
      explanation = 'Multi-word phrase';
    }
    confidence = 0.95;
  }
  // Handle CamelCase single terms
  else {
    const spacedVersion = trimmedTerm.replace(REGEX_PATTERNS.CAMEL_CASE, '$1 $2');
    if (spacedVersion.includes(' ') && opts.enableOR) {
      const quotedSpaced = opts.enableQuotes ? `"${spacedVersion}"` : spacedVersion;
      processed = `${trimmedTerm} OR ${quotedSpaced}`;
      explanation = 'CamelCase with spaced alternative';
      alternatives.push(trimmedTerm, spacedVersion);
      confidence = 0.8;
    } else {
      processed = trimmedTerm;
      explanation = 'Single term';
      confidence = 0.9;
    }
  }

  return {
    original: trimmedTerm,
    processed,
    explanation,
    confidence,
    alternatives
  };
}

/**
 * Generates people search query - wraps names in quotes and joins with OR
 */
export function generatePeopleQuery(term: string): string {
  const validatedTerm = validateInput(term);
  if (!validatedTerm) return '';

  // If it's a boolean query, return as-is (don't add quotes)
  if (detectBooleanQuery(validatedTerm)) {
    return validatedTerm;
  }

  // Split by commas, semicolons, or newlines to handle multiple names
  const names = validatedTerm.split(/[,;\n]+/)
    .map(name => name.trim())
    .filter(name => name.length > 0);

  if (names.length === 0) return '';

  // Wrap each name in quotes for exact matching (avoid double-quoting if already quoted)
  const quotedNames = names.map(name => {
    const trimmed = name.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed; // Already quoted
    }
    return `"${trimmed}"`; // Add quotes for exact name matching
  });

  // Join with OR operator
  return quotedNames.join(' OR ');
}

/**
 * Generate query based on search type
 * 
 * BOOLEAN QUERY HANDLING:
 * Boolean queries are detected first, regardless of search type.
 * This ensures boolean operators work consistently across all search types
 * (articles, people, media outlets, broadcast, etc.)
 */
export function generateQuery(term: string, queryType?: string): string {
  // Check for boolean operators first, regardless of query type
  // This ensures boolean search works consistently across all search types
  if (detectBooleanQuery(term)) {
    return term; // Return unquoted for any boolean query
  }
  
  // For non-boolean queries, proceed with type-specific processing
  switch (queryType) {
    case 'admin_search':
      return generateAdminQuery(term);
    case 'exact_url':
      return extractUrlFromText(term);
    case 'coverage_report_search':
      return generateCoverageReportQuery(term);
    case 'person_search':
      return generatePeopleQuery(term);
    default:
      return generateSmartQuery(term).processed;
  }
}

/**
 * Batch generate queries for multiple terms
 */
export function generateQueries(terms: string[], queryType?: string): GeneratedQuery[] {
  if (terms.length > LIMITS.MAX_SEARCH_TERMS) {
    throw new Error(`Too many terms. Maximum ${LIMITS.MAX_SEARCH_TERMS} allowed.`);
  }

  return terms.map(term => {
    // Check for boolean operators first, regardless of query type
    // This ensures boolean queries are never quoted in any search type
    if (detectBooleanQuery(term)) {
      return {
        original: term,
        processed: term, // Return unquoted for any boolean query
        explanation: 'Boolean query with operators (no quotes applied)',
        confidence: 0.95,
        alternatives: []
      };
    }
    
    // For non-boolean queries, proceed with type-specific processing
    if (queryType === 'admin_search') {
      const processed = generateAdminQuery(term);
      return {
        original: term,
        processed,
        explanation: 'Admin search optimization',
        confidence: 0.9,
        alternatives: []
      };
    } else if (queryType === 'exact_url') {
      const processed = extractUrlFromText(term);
      return {
        original: term,
        processed,
        explanation: 'URL extraction',
        confidence: 1.0,
        alternatives: []
      };
    } else if (queryType === 'coverage_report_search') {
      const processed = generateCoverageReportQuery(term);
      return {
        original: term,
        processed,
        explanation: 'Coverage report search',
        confidence: 0.95,
        alternatives: []
      };
    } else if (queryType === 'person_search') {
      const processed = generatePeopleQuery(term);
      return {
        original: term,
        processed,
        explanation: 'People search with quoted names and OR operator',
        confidence: 0.95,
        alternatives: []
      };
    } else {
      return generateSmartQuery(term);
    }
  });
}