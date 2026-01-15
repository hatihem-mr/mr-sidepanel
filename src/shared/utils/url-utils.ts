import { REGEX_PATTERNS, LIMITS } from '../constants.js';
import type { URLInfo } from '../types/index.js';

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Clean and validate a single URL
 */
export function cleanUrl(url: string): URLInfo {
  const original = url.trim();
  let cleaned = original;
  const errors: string[] = [];
  let needsProtocol = false;
  let needsWWW = false;

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  // Handle common malformed patterns
  if (cleaned.startsWith('ww.')) {
    cleaned = 'www.' + cleaned.substring(3);
    needsWWW = true;
  }

  // Add protocol if missing
  if (!cleaned.match(/^https?:\/\//)) {
    cleaned = 'https://' + cleaned;
    needsProtocol = true;
  }

  // Add www if it's a simple domain
  if (!cleaned.includes('www.') && !cleaned.includes('://www.')) {
    try {
      const urlObj = new URL(cleaned);
      const parts = urlObj.hostname.split('.');
      if (parts.length === 2) { // Simple domain like "example.com"
        urlObj.hostname = 'www.' + urlObj.hostname;
        cleaned = urlObj.toString();
        needsWWW = true;
      }
    } catch (e) {
      errors.push('Invalid URL format');
    }
  }

  // Extract domain for validation
  let domain = '';
  try {
    const urlObj = new URL(cleaned);
    domain = urlObj.hostname;
  } catch (e) {
    errors.push('Could not parse URL');
  }

  // Validate final URL
  const isValid = isValidUrl(cleaned) && errors.length === 0;

  return {
    original,
    cleaned,
    domain,
    isValid,
    needsProtocol,
    needsWWW,
    errors
  };
}

/**
 * Extract and clean URLs from a text block
 * Enhanced version of the original function
 */
export function cleanUrls(textBlock: string): string {
  if (!textBlock || !textBlock.trim()) {
    return '';
  }

  if (textBlock.length > LIMITS.MAX_INPUT_LENGTH) {
    throw new Error(`Input too long. Maximum ${LIMITS.MAX_INPUT_LENGTH} characters allowed.`);
  }

  const foundUrls: string[] = [];
  
  // Split into words to find all potential URLs
  const words = textBlock.split(/\s+/);
  
  words.forEach(word => {
    const trimmedWord = word.trim();
    if (!trimmedWord) return;
    
    // Check if it's already a full URL
    if (REGEX_PATTERNS.URL.test(trimmedWord)) {
      const cleaned = cleanUrl(trimmedWord);
      if (cleaned.isValid) {
        foundUrls.push(cleaned.cleaned);
      }
      return;
    }
    
    // Check if it looks like a domain
    if (REGEX_PATTERNS.SIMPLE_DOMAIN.test(trimmedWord)) {
      const cleaned = cleanUrl(trimmedWord);
      if (cleaned.isValid) {
        foundUrls.push(cleaned.cleaned);
      }
    }
  });
  
  // Remove duplicates and limit
  const uniqueUrls = [...new Set(foundUrls)];
  
  if (uniqueUrls.length > LIMITS.MAX_SEARCH_TERMS) {
    throw new Error(`Too many URLs. Maximum ${LIMITS.MAX_SEARCH_TERMS} allowed.`);
  }
  
  return uniqueUrls.join('\n');
}

/**
 * Extract domain name from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Extract root domain name (without TLD)
 */
export function extractRootDomain(url: string): string {
  const domain = extractDomain(url);
  return domain.split('.')[0];
}

/**
 * Check if URL is a Muck Rack URL
 */
export function isMuckRackUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.endsWith('muckrack.com');
  } catch {
    return false;
  }
}

/**
 * Convert Google Sheets URL to CSV export URL
 */
export function convertSheetsUrlToCSV(url: string): string | null {
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

/**
 * Validate Google Sheets URL
 */
export function isGoogleSheetsUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'docs.google.com' && url.includes('/spreadsheets/');
  } catch {
    return false;
  }
}

/**
 * Clean and format URL list for bulk operations
 */
export function formatUrlList(urls: string[]): string[] {
  return urls
    .map(url => cleanUrl(url))
    .filter(urlInfo => urlInfo.isValid)
    .map(urlInfo => urlInfo.cleaned);
}

/**
 * Extract URLs from mixed text content
 */
export function extractUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  
  // Find explicit URLs
  const explicitUrls = text.match(REGEX_PATTERNS.URL_GLOBAL) || [];
  urls.push(...explicitUrls);
  
  // Find domain-like patterns
  const words = text.split(/\s+/);
  words.forEach(word => {
    const trimmed = word.trim();
    if (REGEX_PATTERNS.SIMPLE_DOMAIN.test(trimmed) && !urls.includes(trimmed)) {
      urls.push(trimmed);
    }
  });
  
  return urls;
}

/**
 * Normalize URL for comparison (remove protocol, www, trailing slash)
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
    let normalized = urlObj.hostname.replace(/^www\./, '');
    if (urlObj.pathname !== '/') {
      normalized += urlObj.pathname;
    }
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Check if two URLs are essentially the same
 */
export function urlsMatch(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Get URL preview info for display
 */
export function getUrlPreview(url: string): { display: string; domain: string; isSecure: boolean } {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const display = domain + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    const isSecure = urlObj.protocol === 'https:';
    
    return { display, domain, isSecure };
  } catch {
    return { display: url, domain: url, isSecure: false };
  }
}