/**
 * Text preprocessing utilities for TF-IDF ticket matching
 *
 * These utilities prepare conversation text for similarity analysis by:
 * - Normalizing text (lowercase, removing HTML, trimming)
 * - Tokenizing into individual words
 * - Removing common stop words that don't add meaning
 *
 * USAGE:
 * const terms = TextProcessor.extractTerms("Customer had issue with coverage report");
 * // Returns: ["customer", "issue", "coverage", "report"]
 */

export class TextProcessor {
  /**
   * Common English stop words that don't contribute to meaning
   * These appear frequently but have low discriminative power
   */
  private static readonly STOP_WORDS = new Set([
    // Articles
    'a', 'an', 'the',

    // Prepositions
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'from', 'by', 'about',

    // Pronouns
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their',

    // Common verbs
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'having',
    'do', 'does', 'did', 'doing',
    'will', 'would', 'should', 'could', 'can', 'may', 'might',

    // Conjunctions
    'and', 'or', 'but', 'if', 'when', 'where', 'why', 'how',

    // Other common words
    'this', 'that', 'these', 'those',
    'not', 'no', 'yes',
    'so', 'than', 'then',
    'there', 'here',
    'what', 'which', 'who', 'whom', 'whose',

    // Support-specific common words (low discriminative value)
    'customer', 'user', 'issue', 'problem', 'help', 'need', 'needs',
    'please', 'thanks', 'thank', 'hello', 'hi'
  ]);

  /**
   * Normalize text for analysis
   *
   * Steps:
   * 1. Convert to lowercase
   * 2. Remove HTML tags
   * 3. Remove URLs
   * 4. Remove email addresses
   * 5. Remove extra whitespace
   *
   * @param text - Raw text to normalize
   * @returns Normalized text
   *
   * @example
   * normalize("<p>Hello World!</p>") // "hello world!"
   * normalize("Visit https://example.com") // "visit"
   */
  static normalize(text: string): string {
    if (!text || text.trim().length === 0) {
      return '';
    }

    let normalized = text;

    // Convert to lowercase
    normalized = normalized.toLowerCase();

    // Remove HTML tags (including attributes)
    normalized = normalized.replace(/<[^>]*>/g, ' ');

    // Remove URLs (http://, https://, www.)
    normalized = normalized.replace(/https?:\/\/[^\s]+/g, ' ');
    normalized = normalized.replace(/www\.[^\s]+/g, ' ');

    // Remove email addresses
    normalized = normalized.replace(/[\w.-]+@[\w.-]+\.\w+/g, ' ');

    // Remove special characters but keep spaces and apostrophes (for contractions)
    normalized = normalized.replace(/[^a-z0-9\s']/g, ' ');

    // Replace multiple spaces with single space
    normalized = normalized.replace(/\s+/g, ' ');

    // Trim whitespace
    normalized = normalized.trim();

    return normalized;
  }

  /**
   * Tokenize text into individual words
   *
   * Steps:
   * 1. Split on whitespace
   * 2. Remove empty tokens
   * 3. Remove very short tokens (< 2 characters)
   * 4. Remove number-only tokens
   *
   * @param text - Normalized text to tokenize
   * @returns Array of word tokens
   *
   * @example
   * tokenize("customer had issue") // ["customer", "had", "issue"]
   * tokenize("test 123 abc") // ["test", "abc"] (removes "123")
   */
  static tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Split on whitespace
    const tokens = text.split(/\s+/);

    // Filter tokens
    return tokens.filter(token => {
      // Remove empty tokens
      if (token.length === 0) {
        return false;
      }

      // Remove very short tokens (< 2 chars) - usually not meaningful
      if (token.length < 2) {
        return false;
      }

      // Remove number-only tokens (123, 45, etc.)
      if (/^\d+$/.test(token)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Remove stop words from token array
   *
   * Stop words are common words that don't contribute to meaning:
   * - Articles: "a", "an", "the"
   * - Prepositions: "in", "on", "at"
   * - Common verbs: "is", "are", "was"
   *
   * @param tokens - Array of word tokens
   * @returns Filtered array without stop words
   *
   * @example
   * removeStopWords(["the", "customer", "had", "an", "issue"])
   * // Returns: ["customer", "issue"]
   */
  static removeStopWords(tokens: string[]): string[] {
    return tokens.filter(token => !this.STOP_WORDS.has(token));
  }

  /**
   * Extract meaningful terms from text (combines all preprocessing steps)
   *
   * This is the main method to use - it combines:
   * 1. Normalization (lowercase, remove HTML/URLs)
   * 2. Tokenization (split into words)
   * 3. Stop words removal (filter common words)
   *
   * @param text - Raw text to process
   * @returns Array of meaningful terms for analysis
   *
   * @example
   * extractTerms("<p>The customer had an issue with the coverage report.</p>")
   * // Returns: ["coverage", "report"]
   *
   * @example
   * extractTerms("Can you help me with the dashboard export feature?")
   * // Returns: ["dashboard", "export", "feature"]
   */
  static extractTerms(text: string): string[] {
    // Step 1: Normalize
    const normalized = this.normalize(text);

    // Step 2: Tokenize
    const tokens = this.tokenize(normalized);

    // Step 3: Remove stop words
    const meaningful = this.removeStopWords(tokens);

    return meaningful;
  }

  /**
   * Extract terms and return with frequency counts
   * Useful for understanding term importance in a document
   *
   * @param text - Raw text to process
   * @returns Map of term -> frequency count
   *
   * @example
   * extractTermsWithFrequency("report export report coverage")
   * // Returns: Map { "report" => 2, "export" => 1, "coverage" => 1 }
   */
  static extractTermsWithFrequency(text: string): Map<string, number> {
    const terms = this.extractTerms(text);
    const frequency = new Map<string, number>();

    for (const term of terms) {
      frequency.set(term, (frequency.get(term) || 0) + 1);
    }

    return frequency;
  }

  /**
   * Get unique terms from text (no duplicates)
   *
   * @param text - Raw text to process
   * @returns Array of unique meaningful terms
   *
   * @example
   * extractUniqueTerms("report export report coverage")
   * // Returns: ["report", "export", "coverage"]
   */
  static extractUniqueTerms(text: string): string[] {
    const terms = this.extractTerms(text);
    return Array.from(new Set(terms));
  }
}
