import { KNOWN_MULTI_WORD_OUTLETS, LIMITS } from '../constants.js';
import type { TextParseResult } from '../types/index.js';

/**
 * Parse outlet text with smart detection of multiple formats
 * Enhanced version of the original smart-parser.js
 */
export function parseOutletText(inputText: string): string[] {
  if (!inputText || !inputText.trim()) {
    return [];
  }

  // Step 1: If it's already separated by newlines, keep as-is
  const lines = inputText.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length > 1) {
    return lines.slice(0, LIMITS.MAX_SEARCH_TERMS);
  }

  const singleLine = inputText.trim();
  
  // Step 2: Check for common delimiters
  const delimiters = [',', ';', '|', ' - ', ' -- ', ' / '];
  for (const delimiter of delimiters) {
    if (singleLine.includes(delimiter)) {
      const parts = singleLine.split(delimiter)
        .map(part => part.trim())
        .filter(part => part);
      if (parts.length > 1) {
        return parts.slice(0, LIMITS.MAX_SEARCH_TERMS);
      }
    }
  }
  
  // Step 3: Extract URLs first (they're unambiguous)
  const urlRegex = /https?:\/\/[^\s,;|]+/g;
  const urls = singleLine.match(urlRegex) || [];
  let remainingText = singleLine;
  
  // Remove URLs from remaining text for processing
  urls.forEach(url => {
    remainingText = remainingText.replace(url, ' URL_PLACEHOLDER ');
  });
  
  // Step 4: Look for known multi-word outlets
  const foundOutlets: string[] = [];
  let textToProcess = remainingText;
  
  // Sort by length (longest first) to avoid partial matches
  const sortedOutlets = [...KNOWN_MULTI_WORD_OUTLETS].sort((a, b) => b.length - a.length);
  
  for (const outlet of sortedOutlets) {
    const regex = new RegExp(`\\b${outlet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (textToProcess.match(regex)) {
      foundOutlets.push(outlet);
      textToProcess = textToProcess.replace(regex, ' OUTLET_PLACEHOLDER ');
    }
  }
  
  // Step 5: Process remaining text - split on multiple spaces or common separators
  const remainingTerms = textToProcess
    .split(/\s{2,}|URL_PLACEHOLDER|OUTLET_PLACEHOLDER/) // Split on 2+ spaces or placeholders
    .map(term => term.trim())
    .filter(term => term && term.length > 1) // Filter out empty and single characters
    .filter(term => !term.includes('PLACEHOLDER')); // Clean up any remaining placeholders
  
  // Step 6: Combine results in a logical order
  const results: string[] = [];
  results.push(...urls);
  results.push(...foundOutlets);
  results.push(...remainingTerms);
  
  // Remove duplicates while preserving order
  return [...new Set(results)].slice(0, LIMITS.MAX_SEARCH_TERMS);
}

/**
 * Parse text with confidence scoring and suggestions
 */
export function parseText(inputText: string): TextParseResult {
  const parsed = parseOutletText(inputText);
  const suggestions: string[] = [];
  let confidence = 1.0;
  
  // Check if parsing might be ambiguous
  if (parsed.length === 1 && inputText.includes(' ') && !inputText.includes(',') && !inputText.includes(';')) {
    suggestions.push("Warning: This might be a single multi-word outlet. If it's multiple outlets, try separating them with commas.");
    confidence -= 0.3;
  }
  
  // Check for unknown multi-word terms
  const unknownMultiWord = parsed.filter(term => 
    term.includes(' ') && 
    !term.match(/https?:\/\//) &&
    !KNOWN_MULTI_WORD_OUTLETS.some(known => 
      known.toLowerCase() === term.toLowerCase()
    )
  );
  
  if (unknownMultiWord.length > 0) {
    suggestions.push(`Unknown multi-word terms: ${unknownMultiWord.join(', ')}. Please verify these are correct.`);
    confidence -= (unknownMultiWord.length * 0.2);
  }
  
  // Count URLs and outlets
  const urlCount = parsed.filter(term => term.match(/https?:\/\//)).length;
  const outletCount = parsed.filter(term => 
    KNOWN_MULTI_WORD_OUTLETS.some(known => 
      known.toLowerCase() === term.toLowerCase()
    )
  ).length;
  
  // Boost confidence for clear indicators
  if (inputText.includes(',') || inputText.includes(';')) confidence += 0.2;
  confidence += (urlCount * 0.1);
  confidence += (outletCount * 0.1);
  
  // Ensure confidence stays within bounds
  confidence = Math.max(0, Math.min(1, confidence));
  
  return {
    parsed,
    suggestions,
    confidence,
    unknownTerms: unknownMultiWord,
    urlCount,
    outletCount
  };
}

/**
 * Format text for better readability
 */
export function formatText(inputText: string): string {
  const parseResult = parseText(inputText);
  return parseResult.parsed.join('\n');
}

/**
 * Validate text input
 */
export function validateTextInput(text: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!text || !text.trim()) {
    errors.push('Text cannot be empty');
    return { isValid: false, errors };
  }
  
  if (text.length > LIMITS.MAX_INPUT_LENGTH) {
    errors.push(`Text too long. Maximum ${LIMITS.MAX_INPUT_LENGTH} characters allowed.`);
  }
  
  const parsed = parseOutletText(text);
  if (parsed.length === 0) {
    errors.push('No valid terms found in text');
  }
  
  if (parsed.length > LIMITS.MAX_SEARCH_TERMS) {
    errors.push(`Too many terms. Maximum ${LIMITS.MAX_SEARCH_TERMS} allowed.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract contact information from text (for Intercom integration)
 */
export function extractContactInfo(text: string): { name?: string; email?: string; company?: string } {
  const result: { name?: string; email?: string; company?: string } = {};
  
  // Extract email
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  if (emailMatch) {
    result.email = emailMatch[0];
  }
  
  // Extract potential names (capitalized words)
  const nameMatches = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g);
  if (nameMatches) {
    result.name = nameMatches[0];
  }
  
  // Extract company (after "from" or "at")
  const companyMatch = text.match(/(?:from|at|@)\s+([A-Z][a-zA-Z\s&]+)/i);
  if (companyMatch) {
    result.company = companyMatch[1].trim();
  }
  
  return result;
}