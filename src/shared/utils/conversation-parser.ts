import type { IntercomConversation } from '../types/index.js';

/**
 * Conversation parsing utilities for extracting information from Intercom conversations
 * 
 * Purpose: Centralize conversation data parsing logic to ensure consistency across
 * ticket matching, search history, favorites, and other features that work with conversations.
 * 
 * This module provides functions to extract:
 * - Customer names from various conversation data sources
 * - Conversation summaries from message content
 * - Accurate message counts
 * - Keywords from conversation text
 */
export class ConversationParser {
  
  /**
   * Extract customer name from conversation data
   * Checks multiple sources in order of preference:
   * 1. Source author name (where the name actually is in the API response)
   * 2. Primary contact name from contacts.data array
   * 3. First message author name
   * 4. User object name
   * 5. Already parsed contactName
   * 6. Fallback to 'Unknown Customer'
   */
  static extractCustomerName(conversation: any): string {
    // Check source author (this is where the name actually is in the API response)
    if (conversation.source?.author?.name) {
      return conversation.source.author.name;
    }
    
    // Check primary contact (original parseConversation logic)
    if (conversation.contacts?.data?.[0]?.name) {
      return conversation.contacts.data[0].name;
    }
    
    // Check if this is already a parsed conversation with contactName
    if (conversation.contactName) {
      return conversation.contactName;
    }
    
    // Check conversation parts for first message author
    if (conversation.conversation_parts?.length > 0) {
      const firstPart = conversation.conversation_parts[0];
      if (firstPart.author?.name) {
        return firstPart.author.name;
      }
    }
    
    // Check user object
    if (conversation.user?.name) {
      return conversation.user.name;
    }
    
    // Check if conversation has a direct name field
    if (conversation.name) {
      return conversation.name;
    }
    
    return 'Unknown Customer';
  }

  /**
   * Extract conversation summary from message content
   * Uses the first message body, cleaned and truncated appropriately
   */
  static extractConversationSummary(conversation: any): string {
    // Check if conversation has a subject/title
    if (conversation.subject || conversation.title) {
      return conversation.subject || conversation.title;
    }
    
    // Extract from source body (where the first message body actually is)
    if (conversation.source?.body) {
      // Clean HTML tags and get first 100 characters
      const cleanBody = conversation.source.body.replace(/<[^>]*>/g, '').trim();
      if (cleanBody.length > 100) {
        return cleanBody.substring(0, 100) + '...';
      }
      return cleanBody;
    }
    
    // Extract from first message body (fallback)
    const firstMessage = conversation.conversation_parts?.[0];
    if (firstMessage?.body) {
      // Clean HTML tags and get first 100 characters
      const cleanBody = firstMessage.body.replace(/<[^>]*>/g, '').trim();
      if (cleanBody.length > 100) {
        return cleanBody.substring(0, 100) + '...';
      }
      return cleanBody;
    }
    
    return 'No summary available';
  }

  /**
   * Get accurate message count from conversation
   */
  static extractMessageCount(conversation: any): number {
    // Check statistics.count_conversation_parts (where the real count is)
    if (conversation.statistics?.count_conversation_parts) {
      return conversation.statistics.count_conversation_parts;
    }
    
    // Check if already parsed and has messageCount
    if (conversation.messageCount && conversation.messageCount > 0) {
      return conversation.messageCount;
    }
    
    // Count conversation parts
    if (conversation.conversation_parts?.length) {
      return conversation.conversation_parts.length;
    }
    
    // Check for conversation_message total_count
    if (conversation.conversation_message?.total_count) {
      return conversation.conversation_message.total_count;
    }
    
    return 0;
  }

  /**
   * Extract keywords from conversation content
   * Returns meaningful keywords filtered from common stop words
   */
  static extractKeywords(conversation: any): string[] {
    let text = '';
    
    // Collect text from various sources
    if (conversation.subject || conversation.title) {
      text += (conversation.subject || conversation.title) + ' ';
    }
    
    // Extract from source body (where the main content is)
    if (conversation.source?.body) {
      text += conversation.source.body + ' ';
    }
    
    if (conversation.conversation_parts?.length > 0) {
      // Use first 5 messages for keyword extraction
      const messagesToAnalyze = conversation.conversation_parts.slice(0, 5);
      text += messagesToAnalyze
        .map((part: any) => part.body || '')
        .join(' ');
    }
    
    if (!text.trim()) {
      return [];
    }
    
    // Extract and filter keywords (same logic as ticket matching)
    const keywords = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !this.isStopWord(word)
      );
    
    // Return unique keywords, limited to 10
    return [...new Set(keywords)].slice(0, 10);
  }

  /**
   * Check if word is a common stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 
      'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 
      'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'been', 'have',
      'will', 'would', 'could', 'should', 'may', 'might', 'this', 'that',
      'these', 'those', 'with', 'they', 'them', 'there', 'when', 'where',
      'what', 'why', 'help', 'need', 'want', 'says', 'said', 'hello', 'hi',
      'thanks', 'thank', 'please'
    ]);
    
    return stopWords.has(word);
  }

  /**
   * Extract all relevant information from conversation in one call
   * Useful for creating rich conversation summaries
   */
  static extractConversationInfo(conversation: any): {
    customerName: string;
    summary: string;
    messageCount: number;
    keywords: string[];
  } {
    return {
      customerName: this.extractCustomerName(conversation),
      summary: this.extractConversationSummary(conversation),
      messageCount: this.extractMessageCount(conversation),
      keywords: this.extractKeywords(conversation)
    };
  }

  /**
   * Check if conversation has meaningful content
   * Useful for filtering out empty or low-quality conversations
   */
  static hasmeaningfulContent(conversation: any): boolean {
    const messageCount = this.extractMessageCount(conversation);
    const keywords = this.extractKeywords(conversation);
    
    return messageCount >= 2 && keywords.length > 0;
  }
}