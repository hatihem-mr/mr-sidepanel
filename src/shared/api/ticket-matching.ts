import { IntercomService } from './intercom-api.js';
import { ConversationParser } from '../utils/conversation-parser.js';
import type { IntercomConversation } from '../types/index.js';
import { TICKET_MATCHING_CONFIG } from '../constants.js';
import { TextProcessor } from '../utils/text-processor.js';
import { TFIDFCalculator } from '../utils/tfidf-calculator.js';

/**
 * Ticket matching service for finding similar resolved issues
 */
export class TicketMatchingService {
  private static readonly CUSTOMER_SUCCESS_TAG = 'CX:';
  private static readonly CACHE_KEY = 'ticket_matching_cache';
  private static readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Find similar tickets based on current conversation
   */
  static async findSimilarTickets(currentConversation: any): Promise<SimilarTicket[]> {
    try {
      console.log('=== TICKET MATCHING DEBUG ===');
      console.log('Starting ticket matching for conversation:', currentConversation);
      
      // Get recent CX conversations
      const recentConversations = await this.getRecentCSConversations();
      console.log(`Found ${recentConversations.length} recent CS conversations`);
      
      if (recentConversations.length === 0) {
        console.log('No recent CS conversations found - returning empty array to debug');
        return [];
      }
      
      // PHASE 2: Apply exact tag matching if current conversation has tags
      let filteredConversations = recentConversations;
      const currentTags = currentConversation.extractedTags;
      
      if (currentTags && currentTags.length > 0) {
        console.log('🎯 PHASE 2: Applying exact tag matching...');
        console.log('🎯 Current conversation tags:', currentTags);
        
        // Step 1: Try exact tag matching first
        filteredConversations = this.filterByExactTagMatch(recentConversations, currentTags);
        console.log(`🎯 After exact tag matching: ${filteredConversations.length} conversations`);
        
        // Step 2: If no exact matches, try category-based matching as fallback
        if (filteredConversations.length === 0) {
          console.log('🎯 No exact tag matches found - trying category-based fallback');
          filteredConversations = this.filterByCategoryMatch(recentConversations, currentTags);
          console.log(`🎯 After category-based matching: ${filteredConversations.length} conversations`);
        }
        
        // Step 3: If still no matches, return empty array (don't fallback to all conversations)
        if (filteredConversations.length === 0) {
          console.log('🎯 No matches found at all - returning empty array');
          return [];
        }
      } else {
        console.log('🎯 PHASE 2: No tags extracted - returning empty array with message');
        // Return empty array when no tags are present
        return [];
      }
      
      // Phase 2: Prepare TF-IDF corpus if enhancement is enabled
      let corpusTexts: string[] = [];
      let currentText = '';

      if (TICKET_MATCHING_CONFIG.ENABLE_TFIDF_SCORING) {
        // Extract text from current conversation (uses different structure than API conversations)
        currentText = currentConversation.text || '';

        // Build corpus from all filtered conversations (these come from Intercom API)
        corpusTexts = filteredConversations.map(conv => {
          return conv.source?.body || '';
        });

        console.log('📊 TF-IDF Enhancement Enabled');
        console.log(`📊 Current text length: ${currentText.length} chars`);
        console.log(`📊 Corpus size: ${corpusTexts.length} conversations`);
      }

      // Convert filtered conversations to similar tickets using ConversationParser
      // Limit to 5 results for better performance and UI
      const tickets = filteredConversations.slice(0, 5).map((conv, index) => {
        const conversationInfo = ConversationParser.extractConversationInfo(conv);

        // Calculate base confidence (tag-based ranking)
        let baseConfidence = 100 - (index * 5); // Simple decreasing confidence
        let finalConfidence = baseConfidence;

        // Phase 2: Apply hybrid scoring if TF-IDF enhancement is enabled
        if (TICKET_MATCHING_CONFIG.ENABLE_TFIDF_SCORING && currentText && corpusTexts.length > 0) {
          const convText = conv.source?.body || '';

          try {
            // Calculate text similarity (0.0 to 1.0)
            const textSimilarity = TFIDFCalculator.calculateTextSimilarity(
              currentText,
              convText,
              corpusTexts
            );

            // Apply hybrid scoring: 70% tag-based + 30% text similarity
            finalConfidence =
              (baseConfidence * TICKET_MATCHING_CONFIG.TAG_WEIGHT) +
              (textSimilarity * 100 * TICKET_MATCHING_CONFIG.TFIDF_WEIGHT);

            console.log(`📊 Conversation ${conv.id}: Base=${baseConfidence.toFixed(1)}, Text=${(textSimilarity * 100).toFixed(1)}%, Final=${finalConfidence.toFixed(1)}`);
          } catch (error) {
            console.warn('TF-IDF calculation failed, using base confidence:', error);
            finalConfidence = baseConfidence;
          }
        }

        return {
          conversationId: conv.id,
          customerName: conversationInfo.customerName,
          summary: conversationInfo.summary,
          confidence: Math.round(finalConfidence), // Round to whole number
          matchedKeywords: conversationInfo.keywords.slice(0, 3), // Show first 3 keywords
          intercomUrl: `https://app.intercom.com/a/inbox/all934iy/inbox/admin/7843575/conversation/${conv.id}?view=List`,
          messageCount: 0 // Not important, removing from display
        };
      });
      
      console.log('Generated tickets:', tickets);
      return tickets;
    } catch (error) {
      console.error('Failed to find similar tickets:', error);
      console.log('Returning empty array due to error');
      return [];
    }
  }

  /**
   * Get test data for development
   */
  private static getTestData(): SimilarTicket[] {
    return [
      {
        conversationId: 'test-123',
        customerName: 'Test Customer',
        summary: 'Customer had trouble finding coverage in their report and needed help with filters',
        confidence: 85,
        matchedKeywords: ['coverage', 'report', 'search'],
        intercomUrl: 'https://muckrack.intercom.io/a/inbox/shared/conversations/test-123',
        messageCount: 12
      },
      {
        conversationId: 'test-456',
        customerName: 'Another Customer',
        summary: 'Issue with boolean search not returning expected results',
        confidence: 72,
        matchedKeywords: ['boolean', 'search', 'results'],
        intercomUrl: 'https://muckrack.intercom.io/a/inbox/shared/conversations/test-456',
        messageCount: 8
      }
    ];
  }

  /**
   * Get recent CX conversations from cache or API
   */
  private static async getRecentCSConversations(): Promise<IntercomConversation[]> {
    try {
      // Check cache first
      const cached = await this.getCachedConversations();
      if (cached && cached.length > 0) {
        console.log('Using cached conversations');
        return cached;
      }

      // Fetch conversations from API (broader search)
      console.log('Fetching conversations from Intercom API...');
      const allConversations = await IntercomService.searchCustomerSuccessConversations(150);
      console.log(`Fetched ${allConversations.length} total conversations from API`);
      console.log('Sample conversation:', allConversations[0]);
      
      // Filter for CX tags in JavaScript
      const csConversations = allConversations.filter(conv => {
        const hasCSTag = conv.tags?.some(tag =>
          tag.toLowerCase().includes('cx:')
        );
        console.log(`Conversation ${conv.id}: has CX tag = ${hasCSTag}, tags:`, conv.tags);
        return hasCSTag;
      });

      console.log(`Filtered to ${csConversations.length} CX conversations`);

      // Return all CX conversations (not just first 5)
      // This gives the tag matching logic a proper pool to work with
      console.log('Returning all CS conversations for tag matching:', csConversations.length);
      console.log('Sample conversations:', csConversations.slice(0, 5).map(conv => ({
        id: conv.id,
        contactName: conv.contactName,
        subject: conv.subject,
        state: conv.state,
        tags: conv.tags
      })));
      
      return csConversations;
    } catch (error) {
      console.error('Failed to get recent CS conversations:', error);
      return [];
    }
  }

  /**
   * Check if conversation is CX related
   */
  private static isCustomerSuccessConversation(conversation: IntercomConversation): boolean {
    console.log('Checking CS conversation:', {
      id: conversation.id,
      tags: conversation.tags,
      state: conversation.state,
      rating: conversation.rating,
      messageCount: conversation.conversation_parts?.length
    });
    
    // Since we're already searching for CX conversations, this should always be true
    // But let's add some basic checks as a safety net
    if (conversation.tags?.some(tag =>
      tag.name?.includes('CX:') ||
      tag.name?.includes('Support')
    )) {
      console.log('✓ Found CX tag');
      return true;
    }
    
    // If no CS tags found but it came from our CS search, include it anyway
    console.log('✓ From CS search, including');
    return true;
  }

  /**
   * Check if conversation meets quality criteria
   */
  private static meetsQualityCriteria(conversation: IntercomConversation): boolean {
    const messageCount = conversation.conversation_parts?.length || 0;
    const rating = conversation.rating;
    const state = conversation.state;
    
    console.log('Checking quality criteria:', {
      id: conversation.id,
      messageCount,
      rating,
      state,
      created_at: conversation.created_at
    });
    
    // Since we're searching for specific criteria, most should already meet requirements
    // But let's add minimal checks
    
    // Must have at least 3 messages
    if (messageCount < 3) {
      console.log('✗ Not enough messages');
      return false;
    }
    
    // Must be within last 30 days
    if (conversation.created_at) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (new Date(conversation.created_at * 1000) < thirtyDaysAgo) {
        console.log('✗ Too old');
        return false;
      }
    }
    
    console.log('✓ Meets quality criteria');
    return true;
  }

  /**
   * Score matches between current conversation and historical ones
   */
  private static async scoreMatches(
    currentConversation: any, 
    historicalConversations: IntercomConversation[]
  ): Promise<SimilarTicket[]> {
    const matches: SimilarTicket[] = [];
    
    // Extract current conversation keywords
    const currentKeywords = this.extractKeywords(currentConversation);
    console.log('Current conversation keywords:', currentKeywords);
    
    for (const historical of historicalConversations) {
      const score = this.calculateSimilarityScore(currentKeywords, historical);
      
      if (score > 0.3) { // Only include matches with >30% similarity
        const conversationInfo = ConversationParser.extractConversationInfo(historical);
        
        matches.push({
          conversationId: historical.id,
          customerName: conversationInfo.customerName,
          summary: conversationInfo.summary,
          confidence: Math.round(score * 100),
          matchedKeywords: this.getMatchedKeywords(currentKeywords, historical),
          intercomUrl: `https://muckrack.intercom.io/a/inbox/shared/conversations/${historical.id}`,
          messageCount: conversationInfo.messageCount
        });
      }
    }
    
    // Sort by confidence score
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract keywords from conversation
   */
  private static extractKeywords(conversation: any): string[] {
    if (!conversation) {
      console.log('No conversation provided for keyword extraction');
      return [];
    }
    
    let text = '';
    
    console.log('Extracting keywords from conversation:', conversation);
    
    // Try to get text from different sources
    if (conversation.messages) {
      text = conversation.messages.slice(0, 5).map((msg: any) => msg.text || '').join(' ');
      console.log('Used messages for text extraction');
    } else if (conversation.text) {
      text = conversation.text;
      console.log('Used text property for extraction');
    } else if (typeof conversation === 'string') {
      text = conversation;
      console.log('Used conversation as string');
    }
    
    console.log('Extracted text (first 200 chars):', text.substring(0, 200));
    
    if (!text || text.trim().length === 0) {
      console.log('No text found, returning default keywords');
      return ['search', 'help', 'issue', 'problem', 'coverage']; // Default keywords
    }
    
    // Extract meaningful keywords
    const keywords = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(word)
      );
    
    const uniqueKeywords = [...new Set(keywords)].slice(0, 10); // Top 10 unique keywords
    console.log('Extracted keywords:', uniqueKeywords);
    
    return uniqueKeywords;
  }

  /**
   * Calculate similarity score between conversations
   */
  private static calculateSimilarityScore(currentKeywords: string[], historical: IntercomConversation): number {
    const historicalText = historical.conversation_parts
      ?.map(part => part.body || '')
      .join(' ')
      .toLowerCase();
    
    if (!historicalText) return 0;
    
    const matches = currentKeywords.filter(keyword => 
      historicalText.includes(keyword)
    );
    
    return matches.length / currentKeywords.length;
  }

  /**
   * Get matched keywords between conversations
   */
  private static getMatchedKeywords(currentKeywords: string[], historical: IntercomConversation): string[] {
    const historicalText = historical.conversation_parts
      ?.map(part => part.body || '')
      .join(' ')
      .toLowerCase();
    
    if (!historicalText) return [];
    
    return currentKeywords.filter(keyword => 
      historicalText.includes(keyword)
    );
  }

  // COMMENTED OUT - Now using ConversationParser module for consistency
  // /**
  //  * Extract customer name from conversation
  //  */
  // private static extractCustomerName(conversation: IntercomConversation): string {
  //   // Try to get from user or first conversation part
  //   if (conversation.user?.name) {
  //     return conversation.user.name;
  //   }
  //   
  //   if (conversation.conversation_parts?.[0]?.author?.name) {
  //     return conversation.conversation_parts[0].author.name;
  //   }
  //   
  //   return 'Unknown Customer';
  // }

  // /**
  //  * Generate summary for conversation
  //  */
  // private static generateSummary(conversation: IntercomConversation): string {
  //   const firstMessage = conversation.conversation_parts?.[0]?.body || '';
  //   const summary = firstMessage.slice(0, 100).trim();
  //   
  //   if (summary.length === 100) {
  //     return summary + '...';
  //   }
  //   
  //   return summary || 'No summary available';
  // }

  /**
   * Cache conversations locally
   */
  private static async cacheConversations(conversations: IntercomConversation[]): Promise<void> {
    try {
      const cacheData = {
        conversations,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({
        [this.CACHE_KEY]: cacheData
      });
    } catch (error) {
      console.warn('Failed to cache conversations:', error);
    }
  }

  /**
   * Get cached conversations
   */
  private static async getCachedConversations(): Promise<IntercomConversation[] | null> {
    try {
      const result = await chrome.storage.local.get([this.CACHE_KEY]);
      const cacheData = result[this.CACHE_KEY];
      
      if (!cacheData) return null;
      
      // Check if cache is expired
      if (Date.now() - cacheData.timestamp > this.CACHE_DURATION) {
        await chrome.storage.local.remove([this.CACHE_KEY]);
        return null;
      }
      
      return cacheData.conversations;
    } catch (error) {
      console.warn('Failed to get cached conversations:', error);
      return null;
    }
  }

  /**
   * PHASE 2: Filter conversations by exact tag match using X-1 logic
   */
  private static filterByExactTagMatch(conversations: any[], currentTags: string[]): any[] {
    console.log('🎯 Filtering by exact tag match...');
    console.log('🎯 Current tags to match:', currentTags);
    console.log('🎯 X-1 Logic: Will require', this.getRequiredTagMatches(currentTags.length), 'matches out of', currentTags.length, 'tags');
    
    // DEBUG LOGGING - TO BE REMOVED AFTER BUG FIX
    currentTags.forEach((tag, index) => {
    });
    
    const requiredMatches = this.getRequiredTagMatches(currentTags.length);
    
    return conversations.filter(conv => {
      const convTags = conv.tags || [];
      
      // DEBUG LOGGING - TO BE REMOVED AFTER BUG FIX
      convTags.forEach((tag, index) => {
      });
      
      // DEBUG LOGGING - TO BE REMOVED AFTER BUG FIX
      const matchDetails = [];
      currentTags.forEach(currentTag => {
        const exactMatch = convTags.includes(currentTag);
        matchDetails.push({
          currentTag,
          exactMatch,
          convTags: convTags
        });
        if (!exactMatch) {
          // Show which tags are close but not exact
          convTags.forEach(convTag => {
            if (convTag.toLowerCase().includes('cx:')) {
            }
          });
        }
      });
      
      const matchCount = currentTags.filter(tag => convTags.includes(tag)).length;
      const isMatch = matchCount >= requiredMatches;
      
      // DEBUG LOGGING - TO BE REMOVED AFTER BUG FIX
      
      console.log(`🎯 Conv ${conv.id}: ${matchCount}/${currentTags.length} tags match, required: ${requiredMatches}, result: ${isMatch}`);
      
      return isMatch;
    });
  }

  /**
   * Get required number of tag matches based on X-1 logic
   */
  private static getRequiredTagMatches(totalTags: number): number {
    if (totalTags <= 1) return 1;      // 1 tag needs 1 match (100%)
    if (totalTags === 2) return 1;     // 2 tags need 1 match (50% similarity)  
    if (totalTags === 3) return 2;     // 3 tags need 2 matches (67% similarity)
    return 3;                          // 4+ tags need 3 matches (75% similarity)
  }

  /**
   * Filter conversations by category-based tag match (fallback matching)
   * Example: "Customer Success: Media Lists: Education" matches "Customer Success: Media Lists: Troubleshooting"
   */
  private static filterByCategoryMatch(conversations: any[], currentTags: string[]): any[] {
    console.log('🎯 Filtering by category-based tag match...');
    console.log('🎯 Current tags for category matching:', currentTags);
    
    // Extract category prefixes from current tags (first two parts: "CX: Feature:")
    const categoryPrefixes = currentTags.map(tag => {
      const parts = tag.split(':').map(part => part.trim());
      if (parts.length >= 2) {
        return `${parts[0]}: ${parts[1]}:`;
      }
      return tag; // Return full tag if less than 2 parts
    }).filter(prefix => prefix.startsWith('CX:'));

    console.log('🎯 Category prefixes to match:', categoryPrefixes);

    if (categoryPrefixes.length === 0) {
      console.log('🎯 No CX category prefixes found - returning empty array');
      return [];
    }
    
    return conversations.filter(conv => {
      const convTags = conv.tags || [];
      
      console.log(`🎯 Checking conversation ${conv.id} for category match`);
      console.log(`🎯 Conv ${conv.id} tags:`, convTags);
      
      // Check if any conversation tag starts with any of our category prefixes
      const hasMatch = convTags.some(convTag => {
        return categoryPrefixes.some(prefix => {
          const matches = convTag.startsWith(prefix) && convTag !== prefix; // Must have content after prefix
          if (matches) {
            console.log(`🎯 Category match found: "${convTag}" matches prefix "${prefix}"`);
          }
          return matches;
        });
      });
      
      console.log(`🎯 Conv ${conv.id} category match result: ${hasMatch}`);
      return hasMatch;
    });
  }
}

/**
 * Interface for similar ticket results
 */
export interface SimilarTicket {
  conversationId: string;
  customerName: string;
  summary: string;
  confidence: number;
  matchedKeywords: string[];
  intercomUrl: string;
  messageCount: number;
}