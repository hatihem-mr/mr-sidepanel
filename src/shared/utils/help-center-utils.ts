import { IntercomService } from '../api/intercom-api.js';
import type { 
  IntercomArticle, 
  HelpCenterSearchResult, 
  ArticleRelevanceScore 
} from '../types/index.js';

/**
 * Help Center utilities for article search and relevance scoring
 * Handles all help center logic separate from API calls
 */
export class HelpCenterUtils {
  private static articleCache: IntercomArticle[] = [];
  private static cacheTimestamp = 0;
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  /**
   * Find relevant articles based on conversation context
   */
  static async findRelevantArticles(
    conversationText: string,
    maxResults: number = 5
  ): Promise<HelpCenterSearchResult[]> {
    try {
      // Get all articles (with caching)
      const articles = await this.getAllArticles();
      
      // Extract keywords from conversation
      const keywords = this.extractKeywords(conversationText);
      
      // Score articles for relevance
      const scoredArticles = articles.map(article => ({
        article,
        relevanceScore: this.calculateRelevanceScore(article, keywords, conversationText)
      }));
      
      // Sort by relevance and return top results
      return scoredArticles
        .filter(result => result.relevanceScore.score > 0.1) // Minimum relevance threshold
        .sort((a, b) => b.relevanceScore.score - a.relevanceScore.score)
        .slice(0, maxResults)
        .map(result => ({
          article: result.article,
          relevanceScore: result.relevanceScore.score,
          matchedKeywords: result.relevanceScore.matchedKeywords,
          matchReasons: result.relevanceScore.reasons
        }));
    } catch (error) {
      console.error('Failed to find relevant articles:', error);
      return [];
    }
  }

  /**
   * Search articles by specific query
   */
  static async searchArticles(query: string, limit: number = 10): Promise<IntercomArticle[]> {
    try {
      // First try API search if available
      const apiResults = await IntercomService.searchHelpCenterArticles(query, limit);
      if (apiResults.length > 0) {
        return apiResults;
      }

      // Fallback to local search through cached articles
      const articles = await this.getAllArticles();
      const keywords = this.extractKeywords(query);
      
      return articles
        .map(article => ({
          article,
          score: this.calculateRelevanceScore(article, keywords, query).score
        }))
        .filter(result => result.score > 0.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(result => result.article);
    } catch (error) {
      console.error('Failed to search articles:', error);
      return [];
    }
  }

  /**
   * Get all articles with caching
   */
  static async getAllArticles(): Promise<IntercomArticle[]> {
    const now = Date.now();
    
    // Return cached articles if still valid
    if (this.articleCache.length > 0 && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.articleCache;
    }

    try {
      // Fetch fresh articles
      const articles = await IntercomService.getAllHelpCenterArticles();
      
      // Update cache
      this.articleCache = articles;
      this.cacheTimestamp = now;
      
      return articles;
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      
      // Return cached articles if available, even if stale
      return this.articleCache;
    }
  }

  /**
   * Extract keywords from conversation text
   */
  private static extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful terms
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he',
      'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'this',
      'that', 'these', 'those', 'me', 'him', 'us', 'them', 'am', 'hi', 'hello', 'thanks',
      'thank', 'please', 'help', 'need', 'want', 'says', 'say', 'there', 'when', 'open',
      'new', 'why', 'does', 'aren\'t', 'isn\'t', 'what', 'where', 'how'
    ]);

    // First extract important multi-word phrases
    const phrases: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Muck Rack feature phrases based on actual product features
    const featurePhrases = [
      'coverage reports', 'coverage report', 'media list', 'media lists', 'alerts', 'pitching',
      'newsletter', 'press release distribution', 'press release', 'featured searches',
      'saved searches', 'saved search', 'advanced search', 'outlet lists', 'outlet list',
      'relationship owners', 'custom contacts', 'activity', 'inbound media manager',
      'presspal.ai', 'outreach activity report', 'media brief assistant', 'topics',
      'saved broadcast clips', 'social listening tracks', 'social listening', 'social profiles',
      'dashboards', 'dashboard', 'who shared my link', 'key messages', 'trends',
      'presentations', 'muck rack academy', 'global media outlet ranking', 'media database',
      'contact list', 'media monitoring', 'email alerts', 'rss feed', 'api access',
      'team member', 'user permissions'
    ];
    
    featurePhrases.forEach(phrase => {
      if (lowerText.includes(phrase)) {
        phrases.push(phrase);
      }
    });

    // Extract single keywords
    const keywords = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index);

    // Combine phrases and keywords, with phrases having priority
    return [...phrases, ...keywords].slice(0, 25);
  }

  /**
   * Calculate relevance score for an article
   */
  private static calculateRelevanceScore(
    article: IntercomArticle,
    keywords: string[],
    fullText: string
  ): ArticleRelevanceScore {
    let score = 0;
    const matchedKeywords: string[] = [];
    const reasons: string[] = [];

    const articleText = `${article.title} ${article.description} ${article.body}`.toLowerCase();
    const titleText = article.title.toLowerCase();
    const descriptionText = article.description.toLowerCase();

    // Separate multi-word phrases from single keywords
    const phrases = keywords.filter(k => k.includes(' '));
    const singleWords = keywords.filter(k => !k.includes(' '));

    // Multi-word phrase matches in title (HIGHEST weight - 3.0)
    phrases.forEach(phrase => {
      if (titleText.includes(phrase)) {
        score += 3.0;
        matchedKeywords.push(phrase);
        reasons.push(`Title contains feature "${phrase}"`);
      }
    });

    // Multi-word phrase matches in description (HIGH weight - 2.0)
    phrases.forEach(phrase => {
      if (descriptionText.includes(phrase) && !titleText.includes(phrase)) {
        score += 2.0;
        if (!matchedKeywords.includes(phrase)) {
          matchedKeywords.push(phrase);
        }
        reasons.push(`Description contains feature "${phrase}"`);
      }
    });

    // Single keyword matches in title (medium-high weight - 1.0)
    singleWords.forEach(keyword => {
      if (titleText.includes(keyword)) {
        score += 1.0;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
        reasons.push(`Title contains "${keyword}"`);
      }
    });

    // Single keyword matches in description (medium weight - 0.6)
    singleWords.forEach(keyword => {
      if (descriptionText.includes(keyword) && !titleText.includes(keyword)) {
        score += 0.6;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
        reasons.push(`Description contains "${keyword}"`);
      }
    });

    // Body matches (lower weight - 0.3 for single words, 1.0 for phrases)
    keywords.forEach(keyword => {
      const isPhrase = keyword.includes(' ');
      if (articleText.includes(keyword) && !titleText.includes(keyword) && !descriptionText.includes(keyword)) {
        score += isPhrase ? 1.0 : 0.3;
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
        reasons.push(`Content contains ${isPhrase ? 'feature' : 'keyword'} "${keyword}"`);
      }
    });

    // Context bonus - if article title contains related terms together
    const contextPairs = [
      ['media list', 'contacts'], ['media list', 'empty'], ['media list', 'missing'],
      ['media list', 'view'], ['media list', 'open'], ['media list', 'display'],
      ['coverage report', 'export'], ['coverage report', 'download'], ['coverage report', 'generate'],
      ['dashboard', 'customize'], ['dashboard', 'configure'], ['dashboard', 'setup'],
      ['alerts', 'setup'], ['alerts', 'configure'], ['alerts', 'email'],
      ['saved search', 'create'], ['saved search', 'edit'], ['saved search', 'manage'],
      ['social listening', 'track'], ['social listening', 'monitor'], ['social listening', 'setup'],
      ['press release', 'distribute'], ['press release', 'send'], ['press release', 'publish'],
      ['inbound media', 'manage'], ['inbound media', 'respond'], ['inbound media', 'track']
    ];

    contextPairs.forEach(([term1, term2]) => {
      if (titleText.includes(term1) && fullText.toLowerCase().includes(term2)) {
        score += 1.5;
        reasons.push(`Title relates to "${term1}" issue with "${term2}"`);
      }
    });

    // Penalize generic articles
    const genericTerms = ['introduction', 'overview', 'getting started', 'guide'];
    const isGeneric = genericTerms.some(term => titleText.includes(term));
    
    // Unless the generic article is specifically about the feature mentioned
    if (isGeneric && !phrases.some(phrase => titleText.includes(phrase))) {
      score *= 0.7;
      reasons.push('Generic article penalty applied');
    }

    // Don't over-normalize - let good matches stand out
    const normalizedScore = Math.min(score / 10, 1.0); // Adjusted normalization

    return {
      score: normalizedScore,
      matchedKeywords: [...new Set(matchedKeywords)],
      reasons: [...new Set(reasons)]
    };
  }

  /**
   * Extract meaningful phrases from text
   */
  private static extractPhrases(text: string): string[] {
    // Extract quoted text and multi-word phrases
    const phrases: string[] = [];

    // Extract quoted strings
    const quotedMatches = text.match(/"([^"]+)"/g);
    if (quotedMatches) {
      phrases.push(...quotedMatches.map(match => match.slice(1, -1)));
    }

    // Extract technical terms (words with numbers, hyphens, or mixed case)
    const technicalTerms = text.match(/\b[A-Za-z]*[A-Z][A-Za-z]*\b|\b\w*\d+\w*\b|\b\w+-\w+\b/g);
    if (technicalTerms) {
      phrases.push(...technicalTerms);
    }

    return phrases.filter(phrase => phrase.length > 3);
  }

  /**
   * Clear article cache
   */
  static clearCache(): void {
    this.articleCache = [];
    this.cacheTimestamp = 0;
  }

  /**
   * Get cache status
   */
  static getCacheStatus(): { cached: number; age: number } {
    return {
      cached: this.articleCache.length,
      age: Date.now() - this.cacheTimestamp
    };
  }

  /**
   * Format article for display
   */
  static formatArticleForDisplay(article: IntercomArticle): {
    title: string;
    summary: string;
    url: string;
    relevance?: string;
  } {
    // Create a clean summary from description or first part of body
    let summary = article.description || '';
    if (!summary && article.body) {
      // Extract first sentence or paragraph from body (strip HTML)
      const cleanBody = article.body.replace(/<[^>]*>/g, '').trim();
      const firstSentence = cleanBody.split(/[.!?]/)[0];
      summary = firstSentence.length > 20 ? firstSentence + '...' : cleanBody.substring(0, 150) + '...';
    }

    return {
      title: article.title,
      summary: summary.substring(0, 200) + (summary.length > 200 ? '...' : ''),
      url: article.url
    };
  }
}