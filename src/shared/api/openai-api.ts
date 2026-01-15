import { StorageService } from './storage.js';
import { OPENAI_CONFIG } from '../constants.js';
import { HelpCenterUtils } from '../utils/help-center-utils.js';
import type { ConversationAnalysis, OpenAIUsage, HelpCenterSearchResult } from '../types/index.js';

/**
 * OpenAI API integration service
 */
export class OpenAIService {
  private static apiKey: string | null = null;

  /**
   * Set the API key
   */
  static async setApiKey(key: string): Promise<void> {
    if (!key || !key.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }
    
    this.apiKey = key;
    await StorageService.set('openaiApiKey', key);
  }

  /**
   * Get the stored API key
   * Checks in order: 1) Environment variable, 2) Memory cache, 3) Chrome storage
   */
  static async getApiKey(): Promise<string | null> {
    // PRIORITY 1: Check environment variable (from .env file via build)
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey && envKey.startsWith('sk-')) {
      this.apiKey = envKey;
      return envKey;
    }

    // PRIORITY 2: Check if already loaded in memory
    if (this.apiKey) {
      return this.apiKey;
    }

    // PRIORITY 3: Load from Chrome storage (user-entered via UI)
    try {
      this.apiKey = await StorageService.get<string>('openaiApiKey');
      return this.apiKey;
    } catch (error) {
      console.warn('Failed to load OpenAI API key:', error);
      return null;
    }
  }

  /**
   * Check if API key is configured
   * Verifies that a valid OpenAI API key is stored
   */
  static async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    const hasKey = !!(key && key.startsWith('sk-'));
    return hasKey;
  }

  /**
   * Clear the API key
   */
  static async clearApiKey(): Promise<void> {
    this.apiKey = null;
    await StorageService.remove('openaiApiKey');
  }

  /**
   * Analyze conversation with OpenAI including help center articles
   */
  static async analyzeConversation(
    conversationText: string,
    customerInfo?: any
  ): Promise<ConversationAnalysis> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!conversationText || conversationText.trim().length < 20) {
      throw new Error('Conversation text too short for analysis');
    }

    // Check rate limits
    await this.checkRateLimit();

    // Find relevant help center articles (if available)
    let relatedArticles: HelpCenterSearchResult[] = [];
    try {
      relatedArticles = await HelpCenterUtils.findRelevantArticles(conversationText, 5);
      if (relatedArticles.length > 0) {
        console.log(`Found ${relatedArticles.length} relevant help center articles`);
      } else {
        console.log('No help center articles available - continuing without them');
      }
    } catch (error) {
      console.warn('Help center integration not available:', error);
      // Continue without articles if this fails
    }

    const prompt = this.buildAnalysisPrompt(conversationText, customerInfo, relatedArticles);

    try {
      const response = await this.callOpenAI(apiKey, prompt);
      const analysis = this.parseAnalysisResponse(response, conversationText, relatedArticles);

      // Update usage tracking
      await this.updateUsage();

      // Cache the result
      await this.cacheAnalysis(analysis);

      return analysis;
    } catch (error) {
      console.error('OpenAI API call failed:', error);

      // FALLBACK: Try Claude API if OpenAI fails
      const claudeKey = process.env.CLAUDE_API_KEY;
      if (claudeKey && claudeKey.startsWith('sk-ant-')) {
        console.log('⚠️ OpenAI failed, trying Claude API as fallback...');
        try {
          const response = await this.callClaude(claudeKey, prompt);
          const analysis = this.parseAnalysisResponse(response, conversationText, relatedArticles);

          await this.updateUsage();
          await this.cacheAnalysis(analysis);

          console.log('✅ Claude API succeeded!');
          return analysis;
        } catch (claudeError) {
          console.error('Claude API also failed:', claudeError);
          throw new Error(`Both OpenAI and Claude failed: ${error.message}`);
        }
      }

      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Build the analysis prompt with help center articles
   */
  private static buildAnalysisPrompt(
    conversationText: string, 
    customerInfo?: any, 
    relatedArticles: HelpCenterSearchResult[] = []
  ): string {
    const customerContext = customerInfo?.name 
      ? `Customer: ${customerInfo.name}${customerInfo.company ? ` from ${customerInfo.company}` : ''}\n\n`
      : '';

    const articlesContext = relatedArticles.length > 0 
      ? `Relevant Help Center Articles:\n${relatedArticles.map((result, index) => 
          `${index + 1}. ${result.article.title}\n   URL: ${result.article.url}\n   Summary: ${result.article.description || 'No description'}\n   Relevance: ${Math.round(result.relevanceScore * 100)}%`
        ).join('\n\n')}\n\n`
      : '';

    return `${customerContext}${articlesContext}Analyze this customer support conversation and provide:

1. A brief analysis of what the customer needs and the core issue
2. A narrative explanation of the recommended solution approach (paragraph format, NO numbered lists)
3. Specific actionable troubleshooting steps (numbered array format)
4. 3-4 boolean search queries for finding relevant media outlets/contacts
${relatedArticles.length > 0 ? '5. Reference specific help center articles when applicable in your solution' : ''}

Conversation:
${conversationText}

Please respond in this exact JSON format:
{
  "analysis": "Brief analysis of customer needs and core issue",
  "suggestedSolution": "PARAGRAPH FORMAT: Explain the recommended solution approach and what the support agent should do. Reference help center articles if relevant. Do NOT use numbered lists here.${relatedArticles.length > 0 ? ' Reference help center articles where relevant.' : ''}",
  "troubleshootingSteps": ["Step 1: Action to take", "Step 2: Next action", "Step 3: Final verification"],
  "booleanQueries": ["query1", "query2", "query3", "query4"],
  "confidence": 0.85
}`;
  }

  /**
   * Call OpenAI API
   */
  private static async callOpenAI(apiKey: string, prompt: string): Promise<any> {
    const response = await fetch(`${OPENAI_CONFIG.API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant for Muck Rack customer support. Provide concise, professional responses focused on media research and journalist outreach.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: OPENAI_CONFIG.MAX_TOKENS,
        temperature: OPENAI_CONFIG.TEMPERATURE
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Call Claude API (Anthropic) as fallback
   */
  private static async callClaude(apiKey: string, prompt: string): Promise<any> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are a helpful AI assistant for Muck Rack customer support. Provide concise, professional responses focused on media research and journalist outreach.\n\n${prompt}`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Convert Claude response format to OpenAI-compatible format
    return {
      choices: [{
        message: {
          content: data.content[0].text
        }
      }]
    };
  }

  /**
   * Parse OpenAI response into analysis object
   */
  private static parseAnalysisResponse(
    response: any, 
    originalText: string,
    relatedArticles: HelpCenterSearchResult[] = []
  ): ConversationAnalysis {
    try {
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Strip markdown code fences if present (Claude often wraps JSON in ```json ... ```)
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```')) {
        // Remove opening code fence (```json or ```)
        cleanContent = cleanContent.replace(/^```(?:json)?\s*\n/, '');
        // Remove closing code fence
        cleanContent = cleanContent.replace(/\n```\s*$/, '');
      }

      // Try to parse as JSON
      let parsed;
      try {
        parsed = JSON.parse(cleanContent);
      } catch {
        // If JSON parsing fails, create a basic analysis
        parsed = {
          analysis: 'AI analysis completed',
          suggestedSolution: cleanContent,
          troubleshootingSteps: ['Review conversation details', 'Identify core issue', 'Provide targeted assistance'],
          booleanQueries: [],
          confidence: 0.7
        };
      }

      return {
        conversationHash: this.hashString(originalText),
        analysis: parsed.analysis || 'Analysis completed',
        suggestedSolution: parsed.suggestedSolution || parsed.suggestedReply || parsed.reply || content,
        troubleshootingSteps: Array.isArray(parsed.troubleshootingSteps) ? parsed.troubleshootingSteps : ['Review conversation', 'Identify issue', 'Provide assistance'],
        booleanQueries: Array.isArray(parsed.booleanQueries) ? parsed.booleanQueries : [],
        relatedArticles: relatedArticles,
        confidence: parsed.confidence || 0.8,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to parse OpenAI response: ${error.message}`);
    }
  }

  /**
   * Check rate limits
   */
  private static async checkRateLimit(): Promise<void> {
    try {
      const usage = await this.getUsage();
      const today = new Date().toDateString();
      
      if (usage.lastResetDate !== today) {
        // Reset daily counter
        await StorageService.set('openaiUsage', {
          requestsToday: 0,
          lastResetDate: today,
          totalRequests: usage.totalRequests
        });
        return;
      }

      if (usage.requestsToday >= OPENAI_CONFIG.RATE_LIMIT_PER_HOUR) {
        throw new Error('Daily rate limit exceeded. Please try again tomorrow.');
      }
    } catch (error) {
      console.warn('Rate limit check failed:', error);
      // Continue anyway if rate limit check fails
    }
  }

  /**
   * Update usage statistics
   */
  private static async updateUsage(): Promise<void> {
    try {
      const usage = await this.getUsage();
      const today = new Date().toDateString();
      
      await StorageService.set('openaiUsage', {
        requestsToday: usage.lastResetDate === today ? usage.requestsToday + 1 : 1,
        lastResetDate: today,
        totalRequests: usage.totalRequests + 1
      });
    } catch (error) {
      console.warn('Failed to update usage:', error);
    }
  }

  /**
   * Get usage statistics
   */
  static async getUsage(): Promise<OpenAIUsage> {
    try {
      const usage = await StorageService.get<OpenAIUsage>('openaiUsage');
      return usage || {
        requestsToday: 0,
        lastResetDate: new Date().toDateString(),
        totalRequests: 0
      };
    } catch (error) {
      return {
        requestsToday: 0,
        lastResetDate: new Date().toDateString(),
        totalRequests: 0
      };
    }
  }

  /**
   * Cache analysis result
   */
  private static async cacheAnalysis(analysis: ConversationAnalysis): Promise<void> {
    try {
      const cache = await StorageService.get<{ [key: string]: ConversationAnalysis }>('openaiCache') || {};
      
      // Limit cache size to prevent storage bloat
      const cacheKeys = Object.keys(cache);
      if (cacheKeys.length >= 50) {
        // Remove oldest entries
        const sortedKeys = cacheKeys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
        const keysToRemove = sortedKeys.slice(0, 10);
        keysToRemove.forEach(key => delete cache[key]);
      }

      cache[analysis.conversationHash] = analysis;
      await StorageService.set('openaiCache', cache);
    } catch (error) {
      console.warn('Failed to cache analysis:', error);
    }
  }

  /**
   * Get cached analysis
   */
  static async getCachedAnalysis(conversationText: string): Promise<ConversationAnalysis | null> {
    try {
      const hash = this.hashString(conversationText);
      const cache = await StorageService.get<{ [key: string]: ConversationAnalysis }>('openaiCache') || {};
      
      const cached = cache[hash];
      if (cached && (Date.now() - cached.timestamp) < OPENAI_CONFIG.CACHE_DURATION) {
        return cached;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to get cached analysis:', error);
      return null;
    }
  }

  /**
   * Clear analysis cache
   */
  static async clearCache(): Promise<void> {
    await StorageService.remove('openaiCache');
  }

  /**
   * Hash string for cache keys
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Test API key validity
   */
  static async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${OPENAI_CONFIG.API_BASE_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('API key test failed:', error);
      return false;
    }
  }

  /**
   * Get API key status info
   */
  static async getApiKeyStatus(): Promise<{
    hasKey: boolean;
    isValid: boolean;
    keyPreview?: string;
  }> {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      return { hasKey: false, isValid: false };
    }

    const keyPreview = `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
    
    try {
      const isValid = await this.testApiKey(apiKey);
      return { hasKey: true, isValid, keyPreview };
    } catch {
      return { hasKey: true, isValid: false, keyPreview };
    }
  }
}