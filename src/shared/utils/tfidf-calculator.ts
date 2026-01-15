import { TextProcessor } from './text-processor.js';

/**
 * TF-IDF (Term Frequency-Inverse Document Frequency) Calculator
 *
 * Used to measure text similarity between conversations by:
 * - Calculating how important each term is to a document (TF-IDF score)
 * - Comparing documents using cosine similarity
 *
 * USAGE:
 * const similarity = TFIDFCalculator.calculateTextSimilarity(
 *   "Customer has coverage report issue",
 *   "User cannot find coverage in dashboard",
 *   allConversationTexts
 * );
 * // Returns: 0.65 (65% similar)
 */

export class TFIDFCalculator {
  /**
   * Calculate Term Frequency (TF) for a term in a document
   *
   * TF = (Number of times term appears) / (Total terms in document)
   *
   * @param term - The word to calculate frequency for
   * @param document - Array of terms in the document
   * @returns TF score (0.0 to 1.0)
   *
   * @example
   * calculateTF("coverage", ["coverage", "report", "coverage", "issue"])
   * // Returns: 0.5 (appears 2 times out of 4 total terms)
   */
  static calculateTF(term: string, document: string[]): number {
    if (document.length === 0) {
      return 0;
    }

    const termCount = document.filter(t => t === term).length;
    return termCount / document.length;
  }

  /**
   * Calculate Inverse Document Frequency (IDF) for a term across a corpus
   *
   * IDF = log(Total documents / Documents containing term)
   *
   * High IDF = rare term (more distinctive)
   * Low IDF = common term (less distinctive)
   *
   * @param term - The word to calculate IDF for
   * @param corpus - Array of documents (each document is array of terms)
   * @returns IDF score (higher = more rare/distinctive)
   *
   * @example
   * // "backfill" appears in 2 out of 100 conversations
   * calculateIDF("backfill", corpus)
   * // Returns: 3.91 (log(100/2) = log(50) ≈ 3.91)
   *
   * // "customer" appears in 95 out of 100 conversations
   * calculateIDF("customer", corpus)
   * // Returns: 0.05 (log(100/95) ≈ 0.05)
   */
  static calculateIDF(term: string, corpus: string[][]): number {
    if (corpus.length === 0) {
      return 0;
    }

    const documentsWithTerm = corpus.filter(doc =>
      doc.includes(term)
    ).length;

    if (documentsWithTerm === 0) {
      return 0;
    }

    return Math.log(corpus.length / documentsWithTerm);
  }

  /**
   * Calculate TF-IDF score for a term in a document
   *
   * TF-IDF = TF * IDF
   *
   * High score = term is frequent in this document but rare overall (very distinctive)
   * Low score = term is either rare in this document or common everywhere (not distinctive)
   *
   * @param term - The word to score
   * @param document - Array of terms in current document
   * @param corpus - Array of all documents for IDF calculation
   * @returns TF-IDF score
   *
   * @example
   * // "backfill" appears 3 times in 10-word document, and in 2 of 100 total conversations
   * calculateTFIDF("backfill", currentDoc, corpus)
   * // Returns: 0.3 * 3.91 = 1.17 (high score - very distinctive)
   */
  static calculateTFIDF(term: string, document: string[], corpus: string[][]): number {
    const tf = this.calculateTF(term, document);
    const idf = this.calculateIDF(term, corpus);
    return tf * idf;
  }

  /**
   * Build TF-IDF vector for a document
   *
   * Creates a map of term -> TF-IDF score for all unique terms in the document
   *
   * @param document - Array of terms in the document
   * @param corpus - Array of all documents for IDF calculation
   * @returns Map of term to TF-IDF score
   *
   * @example
   * buildVector(["coverage", "report", "issue"], corpus)
   * // Returns: Map {
   * //   "coverage" => 0.85,
   * //   "report" => 0.72,
   * //   "issue" => 0.45
   * // }
   */
  static buildVector(document: string[], corpus: string[][]): Map<string, number> {
    const vector = new Map<string, number>();
    const uniqueTerms = new Set(document);

    for (const term of uniqueTerms) {
      const tfidf = this.calculateTFIDF(term, document, corpus);
      if (tfidf > 0) {
        vector.set(term, tfidf);
      }
    }

    return vector;
  }

  /**
   * Calculate cosine similarity between two TF-IDF vectors
   *
   * Cosine similarity measures the angle between two vectors:
   * - 1.0 = identical direction (very similar)
   * - 0.0 = perpendicular (no similarity)
   *
   * Formula: similarity = (A · B) / (||A|| * ||B||)
   * Where:
   * - A · B = dot product (sum of elementwise products)
   * - ||A|| = magnitude of vector A
   * - ||B|| = magnitude of vector B
   *
   * @param vectorA - First TF-IDF vector
   * @param vectorB - Second TF-IDF vector
   * @returns Similarity score (0.0 to 1.0)
   *
   * @example
   * const vecA = Map { "coverage" => 0.8, "report" => 0.6 };
   * const vecB = Map { "coverage" => 0.7, "dashboard" => 0.5 };
   * cosineSimilarity(vecA, vecB)
   * // Returns: ~0.65 (some overlap on "coverage", different other terms)
   */
  static cosineSimilarity(vectorA: Map<string, number>, vectorB: Map<string, number>): number {
    if (vectorA.size === 0 || vectorB.size === 0) {
      return 0;
    }

    // Calculate dot product (A · B)
    let dotProduct = 0;
    for (const [term, scoreA] of vectorA) {
      const scoreB = vectorB.get(term);
      if (scoreB !== undefined) {
        dotProduct += scoreA * scoreB;
      }
    }

    // Calculate magnitude of vector A (||A||)
    let magnitudeA = 0;
    for (const score of vectorA.values()) {
      magnitudeA += score * score;
    }
    magnitudeA = Math.sqrt(magnitudeA);

    // Calculate magnitude of vector B (||B||)
    let magnitudeB = 0;
    for (const score of vectorB.values()) {
      magnitudeB += score * score;
    }
    magnitudeB = Math.sqrt(magnitudeB);

    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Calculate text similarity between two conversation texts
   *
   * High-level function that combines all TF-IDF steps:
   * 1. Preprocess both texts (normalize, tokenize, remove stop words)
   * 2. Build TF-IDF vectors for both texts
   * 3. Calculate cosine similarity
   *
   * @param text1 - First conversation text
   * @param text2 - Second conversation text
   * @param corpusTexts - Array of all conversation texts for IDF calculation
   * @returns Similarity score (0.0 = completely different, 1.0 = identical)
   *
   * @example
   * calculateTextSimilarity(
   *   "Customer has issue with coverage report not loading",
   *   "User cannot see coverage data in analytics dashboard",
   *   allConversationTexts
   * )
   * // Returns: 0.68 (68% similar - both about coverage/data display issues)
   */
  static calculateTextSimilarity(
    text1: string,
    text2: string,
    corpusTexts: string[]
  ): number {
    // Preprocess texts
    const terms1 = TextProcessor.extractTerms(text1);
    const terms2 = TextProcessor.extractTerms(text2);

    // If either text has no meaningful terms, they can't be similar
    if (terms1.length === 0 || terms2.length === 0) {
      return 0;
    }

    // Preprocess corpus
    const corpus = corpusTexts.map(text => TextProcessor.extractTerms(text));

    // Build TF-IDF vectors
    const vector1 = this.buildVector(terms1, corpus);
    const vector2 = this.buildVector(terms2, corpus);

    // Calculate cosine similarity
    return this.cosineSimilarity(vector1, vector2);
  }

  /**
   * Find most similar conversation from a list
   *
   * Helper function to find which conversation is most similar to a query
   *
   * @param queryText - The conversation to compare against
   * @param candidateTexts - Array of candidate conversation texts
   * @returns Object with index and similarity score of best match
   *
   * @example
   * const result = findMostSimilar(
   *   "Customer needs help with backfill feature",
   *   ["Issue with export", "Backfill not working", "Login problem"]
   * );
   * // Returns: { index: 1, similarity: 0.82 }
   * // ("Backfill not working" is most similar)
   */
  static findMostSimilar(
    queryText: string,
    candidateTexts: string[]
  ): { index: number; similarity: number } | null {
    if (candidateTexts.length === 0) {
      return null;
    }

    let bestIndex = 0;
    let bestSimilarity = 0;

    for (let i = 0; i < candidateTexts.length; i++) {
      const similarity = this.calculateTextSimilarity(
        queryText,
        candidateTexts[i],
        candidateTexts // Use candidates as corpus
      );

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = i;
      }
    }

    return {
      index: bestIndex,
      similarity: bestSimilarity
    };
  }

  /**
   * Find all conversations above a similarity threshold
   *
   * Helper function to filter conversations by minimum similarity
   *
   * @param queryText - The conversation to compare against
   * @param candidateTexts - Array of candidate conversation texts
   * @param threshold - Minimum similarity score (0.0 to 1.0)
   * @returns Array of { index, similarity } for matches above threshold
   *
   * @example
   * const matches = findSimilarAboveThreshold(
   *   "Customer needs help with coverage report",
   *   allConversationTexts,
   *   0.7 // 70% similarity threshold
   * );
   * // Returns: [
   * //   { index: 5, similarity: 0.82 },
   * //   { index: 12, similarity: 0.75 }
   * // ]
   */
  static findSimilarAboveThreshold(
    queryText: string,
    candidateTexts: string[],
    threshold: number
  ): Array<{ index: number; similarity: number }> {
    const matches: Array<{ index: number; similarity: number }> = [];

    for (let i = 0; i < candidateTexts.length; i++) {
      const similarity = this.calculateTextSimilarity(
        queryText,
        candidateTexts[i],
        candidateTexts
      );

      if (similarity >= threshold) {
        matches.push({ index: i, similarity });
      }
    }

    // Sort by similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);

    return matches;
  }
}
