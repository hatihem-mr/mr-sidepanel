import type { 
  IntercomConversation, 
  IntercomArticle, 
  IntercomConversationPart 
} from '../types/index.js';

/**
 * Intercom API integration service
 * Handles conversation history and help center articles
 *
 * SECURITY: API token is loaded from environment variables at build time
 * Set INTERCOM_ACCESS_TOKEN in your .env file (never commit .env!)
 */
export class IntercomService {
  private static readonly API_BASE_URL = 'https://api.intercom.io';

  /**
   * Get Intercom access token from environment variables
   * Token is injected at build time from .env file
   */
  private static getAccessToken(): string {
    const token = process.env.INTERCOM_ACCESS_TOKEN;
    if (!token) {
      throw new Error('INTERCOM_ACCESS_TOKEN not found in environment variables. Please configure your .env file.');
    }
    return token;
  }

  private static readonly RATE_LIMIT_DELAY = 1000; // 1 second between requests
  private static lastRequestTime = 0;

  /**
   * Get conversation details by ID
   */
  static async getConversation(conversationId: string): Promise<IntercomConversation | null> {
    try {
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.API_BASE_URL}/conversations/${conversationId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Conversation ${conversationId} not found`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseConversation(data);
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }
  }

  /**
   * Search for Customer Success conversations specifically
   */
  static async searchCustomerSuccessConversations(limit: number = 50): Promise<IntercomConversation[]> {
    try {
      await this.enforceRateLimit();
      
      
      // Calculate 15 days ago timestamp 
      const fifteenDaysAgo = Math.floor((Date.now() - 15 * 24 * 60 * 60 * 1000) / 1000);
      
      
      // Use the search endpoint with working format (revert to what gave us 200 status)
      const serviceWorkerResponse = await chrome.runtime.sendMessage({
        action: 'fetch',
        url: `${this.API_BASE_URL}/conversations/search`,
        options: {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            query: {
              operator: 'AND',
              value: [
                {
                  field: 'state',
                  operator: '=',
                  value: 'closed'
                },
                {
                  field: 'conversation_rating.score',
                  operator: '>',
                  value: 2
                },
                {
                  field: 'created_at',
                  operator: '>',
                  value: fifteenDaysAgo
                }
              ]
            },
            pagination: {
              per_page: Math.min(limit, 150)
            }
          })
        }
      });

      
      // Extract the actual data from service worker response
      const response = serviceWorkerResponse?.data || serviceWorkerResponse;

      
      if (!response || response.error) {
        console.error('🔧 FAILED - Response error details:');
        console.error('🔧 Response exists:', !!response);
        console.error('🔧 Error message:', response?.error || 'Unknown error');
        console.error('🔧 Full error object:', response);
        return [];
      }

      
      const rawConversations = response.conversations || [];
      console.log('First raw conversation:', rawConversations[0]);
      
      const conversations = rawConversations.map((rawConv, index) => {
        const parsed = this.parseConversation(rawConv);
        return parsed;
      });
      
      
      if (conversations.length === 0) {
        console.error('🔧 ZERO CONVERSATIONS - Full debugging info:');
        console.error('🔧 Raw conversations length:', rawConversations.length);
        console.error('🔧 Raw conversations array:', rawConversations);
        console.error('🔧 Full API response:', JSON.stringify(response, null, 2));
      }
      
      return conversations;
    } catch (error) {
      console.error('Failed to fetch CS conversations:', error);
      return [];
    }
  }

  /**
   * Search conversations for a contact
   */
  static async searchConversations(contactId?: string, limit: number = 20): Promise<IntercomConversation[]> {
    try {
      await this.enforceRateLimit();
      
      const params = new URLSearchParams({
        per_page: limit.toString(),
        order: 'desc'
      });

      if (contactId) {
        params.append('contact_id', contactId);
      }

      const response = await fetch(`${this.API_BASE_URL}/conversations/search?${params}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query: {
            operator: 'AND',
            value: contactId ? [
              {
                field: 'contact_id',
                operator: '=',
                value: contactId
              }
            ] : []
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.conversations?.map(this.parseConversation) || [];
    } catch (error) {
      console.error('Failed to search conversations:', error);
      return [];
    }
  }

  /**
   * Get conversation parts (messages) for a conversation
   */
  static async getConversationParts(conversationId: string): Promise<IntercomConversationPart[]> {
    try {
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.API_BASE_URL}/conversations/${conversationId}/conversation_parts`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.conversation_parts?.map(this.parseConversationPart) || [];
    } catch (error) {
      console.error('Failed to fetch conversation parts:', error);
      return [];
    }
  }

  /**
   * Search help center articles
   */
  static async searchHelpCenterArticles(query: string, limit: number = 10): Promise<IntercomArticle[]> {
    try {
      await this.enforceRateLimit();
      
      const params = new URLSearchParams({
        query: query,
        per_page: limit.toString()
      });

      const response = await fetch(`${this.API_BASE_URL}/articles/search?${params}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          query: {
            phrase: query
          }
        })
      });

      if (!response.ok) {
        console.warn(`Article search failed: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data.data?.map(this.parseArticle) || [];
    } catch (error) {
      console.warn('Failed to search help center articles:', error);
      return [];
    }
  }

  /**
   * Get all help center articles
   */
  static async getAllHelpCenterArticles(): Promise<IntercomArticle[]> {
    try {
      await this.enforceRateLimit();
      
      const params = new URLSearchParams({
        per_page: '50'
      });
      
      const response = await fetch(`${this.API_BASE_URL}/articles?${params}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        console.warn('Help center articles not available');
        return [];
      }

      const data = await response.json();
      const articles = data.data || data.articles || [];
      return articles.map((article: any) => this.parseArticle(article));
    } catch (error) {
      console.warn('Help center articles error:', error);
      return [];
    }
  }

  /**
   * Get specific help center article by ID
   */
  static async getHelpCenterArticle(articleId: string): Promise<IntercomArticle | null> {
    try {
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.API_BASE_URL}/help_center/articles/${articleId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseArticle(data);
    } catch (error) {
      console.error('Failed to fetch help center article:', error);
      return null;
    }
  }

  /**
   * Get request headers with authentication
   * Uses environment variable token (injected at build time)
   */
  private static getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.getAccessToken()}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Intercom-Version': '2.13'  // Latest API version header
    };
  }

  /**
   * Enforce rate limiting
   */
  private static async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const waitTime = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Parse raw conversation data from API
   * PHASE 1: Enhanced parsing for improved ticket matching accuracy
   */
  private static parseConversation(raw: any): IntercomConversation {
    // Extract first user message for better keyword extraction
    // First message contains the purest description of the issue
    const firstUserMessage = raw.conversation_parts?.conversation_parts?.find(
      (part: any) => part.author?.type === 'user' || part.author?.type === 'contact'
    );

    const firstContactReplyBody = firstUserMessage?.body || raw.source?.body || '';

    const parsed = {
      id: raw.id,
      subject: raw.title || '',
      state: raw.state || 'unknown',
      createdAt: raw.created_at || 0,
      updatedAt: raw.updated_at || 0,
      contactId: raw.contacts?.data?.[0]?.id || null,
      contactName: raw.contacts?.data?.[0]?.name || raw.source?.author?.name || null,
      assigneeId: raw.assignee?.id || null,
      assigneeName: raw.assignee?.name || null,
      messageCount: raw.conversation_message?.total_count || 0,
      tags: raw.tags?.tags?.map((tag: any) => tag.name) || [],
      source: raw.source || {}, // KEEP THE FULL SOURCE OBJECT!
      conversation_parts: raw.conversation_parts?.conversation_parts || [], // KEEP CONVERSATION PARTS!
      conversation_rating: raw.conversation_rating || null, // KEEP RATING!

      // *** PHASE 1 IMPROVEMENTS ***

      // Topics - ML-powered categorization (HIGHEST PRIORITY)
      topics: raw.topics ? {
        type: raw.topics.type || 'topic.list',
        topics: raw.topics.topics?.map((topic: any) => ({
          id: topic.id,
          name: topic.name,
          applied_at: topic.applied_at
        })) || [],
        total_count: raw.topics.total_count || 0
      } : undefined,

      // Priority - Urgency indicator
      priority: raw.priority || undefined,

      // Team Assignment - Expertise area matching
      teamAssigneeId: raw.team_assignee_id || null,

      // First Contact Reply - Core issue identification
      firstContactReplyBody
    };

    return parsed;
  }

  /**
   * Parse raw conversation part data from API
   */
  private static parseConversationPart(raw: any): IntercomConversationPart {
    return {
      id: raw.id,
      partType: raw.part_type || 'comment',
      body: raw.body || '',
      createdAt: raw.created_at || 0,
      authorId: raw.author?.id || null,
      authorName: raw.author?.name || null,
      authorType: raw.author?.type || 'unknown'
    };
  }

  /**
   * Parse raw article data from API
   */
  private static parseArticle(raw: any): IntercomArticle {
    // Handle different article structures from various endpoints
    return {
      id: raw.id || raw.article_id,
      title: raw.title || raw.name || '',
      description: raw.description || raw.summary || '',
      body: raw.body || raw.content || raw.body_html || '',
      url: raw.url || raw.public_url || `https://help.intercom.com/articles/${raw.id}`,
      state: raw.state || raw.status || 'published',
      createdAt: raw.created_at || raw.created || 0,
      updatedAt: raw.updated_at || raw.updated || 0,
      authorId: raw.author_id || raw.author?.id || null,
      parentId: raw.parent_id || raw.parent?.id || null,
      parentType: raw.parent_type || raw.parent?.type || null
    };
  }

  /**
   * Test API connectivity and authentication
   */
  static async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/me`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (response.ok) {
        console.log('Intercom API connected successfully');
      }
      
      return response.ok;
    } catch (error) {
      console.error('Intercom API connection test failed:', error);
      return false;
    }
  }
}