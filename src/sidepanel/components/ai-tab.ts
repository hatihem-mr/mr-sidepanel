import { LitElement, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { OpenAIService } from '../../shared/api/openai-api.js';
import { IntercomService } from '../../shared/api/intercom-api.js';
import { TicketMatchingService } from '../../shared/api/ticket-matching.js';
import { extractConversationText } from '../../shared/utils/intercom-utils.js';
import { IS_DEV } from '../../shared/utils/debug.js';
import { FEATURE_FLAGS } from '../../shared/constants.js';
import type { AppSettings, ConversationAnalysis, SimilarTicket } from '../../shared/types/index.js';
import { aiTabStyles } from './ai-tab.styles.js';

export class AITabComponent extends LitElement {
  @property({ type: Object })
  settings: AppSettings | null = null;

  @state()
  private isIntercomPage = false;

  @state()
  private isAnalyzing = false;

  @state()
  private currentAnalysis: ConversationAnalysis | null = null;

  @state()
  private hasApiKey = false;

  @state()
  private apiKeyStatus = { hasKey: false, isValid: false, keyPreview: '' };

  @state()
  private showApiKeyInput = false;

  @state()
  private apiKeyInput = '';

  @state()
  private isTestingKey = false;

  @state()
  private selectedText = '';

  @state()
  private usageInfo = { requestsToday: 0, totalRequests: 0 };

  @state()
  private expandedSections = new Set(); // All sections collapsed by default initially

  @state()
  private defaultsInitialized = false;

  @state()
  private similarTickets: SimilarTicket[] = [];

  @state()
  private isLoadingTickets = false;

  @state()
  private ticketMatchStatus: 'loading' | 'found' | 'no-tags' | 'no-matches' = 'loading';

  @state()
  private currentLoadingMessage = 'Analyzing conversation...';

  private loadingMessages = [
    'Analyzing conversation...',
    'Summarizing key points...',
    'Searching past conversations...',
    'Suggesting troubleshooting...',
    'Gathering articles...',
    'Finding similar tickets...'
  ];

  private loadingMessageIndex = 0;
  private loadingMessageInterval?: number;

  // Import styles from separate file for better maintainability
  static styles = aiTabStyles;

  connectedCallback() {
    super.connectedCallback();
    this.loadUsageInfo();
    this.checkApiKeyStatus();
    
    // Listen for AI analysis requests from context menu
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  private async checkApiKeyStatus() {
    try {
      this.apiKeyStatus = await OpenAIService.getApiKeyStatus();
      this.hasApiKey = this.apiKeyStatus.hasKey && this.apiKeyStatus.isValid;
    } catch (error) {
      console.warn('Failed to check API key status:', error);
      this.hasApiKey = false;
    }
  }

  private handleMessage(message: any, sender: any, sendResponse: any) {
    if (message.action === 'ai-analyze-text') {
      this.selectedText = message.text || '';
      this.analyzeConversation();
    }
  }

  private async loadUsageInfo() {
    try {
      this.usageInfo = await OpenAIService.getUsage();
    } catch (error) {
      console.warn('Failed to load AI usage info:', error);
    }
  }

  private async saveApiKey() {
    if (!this.apiKeyInput.trim()) {
      this.showNotification('Please enter an API key', 'warning');
      return;
    }

    if (!this.apiKeyInput.startsWith('sk-')) {
      this.showNotification('Invalid API key format', 'danger');
      return;
    }

    try {
      this.isTestingKey = true;
      
      // Test the API key
      const isValid = await OpenAIService.testApiKey(this.apiKeyInput);
      if (!isValid) {
        throw new Error('Invalid API key');
      }

      // Save the key
      await OpenAIService.setApiKey(this.apiKeyInput);
      await this.checkApiKeyStatus();
      
      this.apiKeyInput = '';
      this.showApiKeyInput = false;
      this.showNotification('API key saved successfully', 'success');
      
    } catch (error) {
      console.error('Failed to save API key:', error);
      this.showNotification(`Failed to save API key: ${error.message}`, 'danger');
    } finally {
      this.isTestingKey = false;
    }
  }

  private async removeApiKey() {
    if (!confirm('Remove OpenAI API key? AI features will be disabled.')) {
      return;
    }

    try {
      await OpenAIService.clearApiKey();
      await this.checkApiKeyStatus();
      this.currentAnalysis = null;
      this.showNotification('API key removed', 'success');
    } catch (error) {
      console.error('Failed to remove API key:', error);
      this.showNotification('Failed to remove API key', 'danger');
    }
  }

  private async analyzeConversation() {
    if (!this.isIntercomPage) {
      this.showNotification('AI analysis only available on Intercom pages', 'warning');
      return;
    }

    if (!this.hasApiKey) {
      this.showNotification('Please configure your OpenAI API key first', 'warning');
      this.showApiKeyInput = true;
      return;
    }

    try {
      this.isAnalyzing = true;
      
      // Start rotating loading messages
      this.startLoadingMessages();
      
      // Get conversation context from current page
      const context = await extractConversationText();
      
      if (!context || context.trim().length < 50) {
        throw new Error('Not enough conversation context found');
      }

      // Check for cached analysis first
      const cached = await OpenAIService.getCachedAnalysis(context);
      if (cached) {
        this.currentAnalysis = cached;
        this.showNotification('Loaded cached analysis, loading similar tickets...', 'info');
        // Load similar tickets for cached analysis - don't set isAnalyzing to false yet
        await this.loadSimilarTickets(context);
        return;
      }

      // Call OpenAI API
      const analysis = await OpenAIService.analyzeConversation(context, await this.getCustomerInfo());
      
      this.currentAnalysis = analysis;
      this.updateUsageInfo();
      
      this.showNotification('Analysis complete, loading similar tickets...', 'info');
      
      // Load similar tickets after analysis completes - wait for it to finish
      await this.loadSimilarTickets(context);
      
    } catch (error) {
      console.error('AI analysis failed:', error);
      this.showNotification(`Analysis failed: ${error.message}`, 'danger');
    } finally {
      // Only set to false after EVERYTHING is complete (including similar tickets)
      this.isAnalyzing = false;
      this.stopLoadingMessages();
    }
  }

  private startLoadingMessages() {
    this.loadingMessageIndex = 0;
    this.currentLoadingMessage = this.loadingMessages[0];
    
    // Change message every 2.5 seconds
    this.loadingMessageInterval = setInterval(() => {
      this.loadingMessageIndex = (this.loadingMessageIndex + 1) % this.loadingMessages.length;
      this.currentLoadingMessage = this.loadingMessages[this.loadingMessageIndex];
      this.requestUpdate();
    }, 2500) as any;
  }

  private stopLoadingMessages() {
    if (this.loadingMessageInterval) {
      clearInterval(this.loadingMessageInterval);
      this.loadingMessageInterval = undefined;
    }
  }

  private async loadSimilarTickets(context: string) {
    try {
      this.isLoadingTickets = true;
      this.ticketMatchStatus = 'loading';
      
      // Keep Similar Resolved Issues collapsed by default - don't auto-expand
      
      // FORCE currentAnalysis to exist so UI shows
      if (!this.currentAnalysis) {
        this.currentAnalysis = {
          conversationHash: 'fake-hash',
          analysis: 'Fake analysis for testing',
          suggestedSolution: 'Fake solution for testing',
          troubleshootingSteps: ['Step 1: Fake step'],
          booleanQueries: ['fake query'],
          relatedArticles: []
        };
      }
      
      // PHASE 1: Extract tags from conversation context (non-breaking)
      
      // DEBUG LOGGING - TO BE REMOVED AFTER BUG FIX
      
      // Try multiple patterns to extract tags
      const currentTags: string[] = [];
      
      // Pattern 1: Tags in HTML spans (most common)
      const htmlPattern = /<span[^>]*data-tag-name[^>]*>\s*(CX:[^<]+)\s*<\/span>/g;
      let match;
      let htmlMatches = 0;
      while ((match = htmlPattern.exec(context)) !== null) {
        htmlMatches++;
        currentTags.push(match[1].trim());
      }

      // Pattern 2: Quoted tags (backup)
      if (currentTags.length === 0) {
        const quotedPattern = /"(CX:[^"]+)"/g;
        let quotedMatches = 0;
        while ((match = quotedPattern.exec(context)) !== null) {
          quotedMatches++;
          currentTags.push(match[1].trim());
        }
      }

      // Pattern 3: Plain text tags (fallback)
      if (currentTags.length === 0) {
        const plainPattern = /CX:[^\n\r,;]+/g;
        const plainMatches = context.match(plainPattern);
        if (plainMatches) {
          currentTags.push(...plainMatches.map(tag => tag.trim()));
        } else {
        }
      }
      

      // Create a simple conversation object from the context
      const currentConversation = {
        text: context,
        messages: [],
        extractedTags: currentTags // Pass tags along but don't use them yet
      };
      
      
      // Find similar tickets using REAL API
      const tickets = await TicketMatchingService.findSimilarTickets(currentConversation);
      
      
      this.similarTickets = tickets;
      
      // Set appropriate status based on tags and results
      if (currentTags.length === 0) {
        this.ticketMatchStatus = 'no-tags';
        this.showNotification('Analysis complete - no CX tags found', 'success');
      } else if (tickets.length > 0) {
        this.ticketMatchStatus = 'found';
        this.showNotification(`Analysis complete - found ${tickets.length} similar tickets`, 'success');
      } else {
        this.ticketMatchStatus = 'no-matches';
        this.showNotification('Analysis complete - no similar tickets found', 'success');
      }
      
    } catch (error) {
      console.error('🔧 Error in REAL API test:', error);
      this.showNotification('🔧 REAL API: Failed to load similar tickets', 'danger');
      this.similarTickets = [];
      this.ticketMatchStatus = 'no-matches';
    } finally {
      this.isLoadingTickets = false;
    }
  }

  private async getCustomerInfo(): Promise<any> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) return null;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Try to extract customer info from Intercom page
          const nameElement = document.querySelector('span[data-conversation-title]');
          const name = nameElement?.textContent?.trim();
          
          // Look for company info
          const companySelectors = [
            '[data-testid="customer-company"]',
            '.customer-company'
          ];
          
          let company = null;
          for (const selector of companySelectors) {
            const element = document.querySelector(selector);
            if (element?.textContent?.trim()) {
              company = element.textContent.trim();
              break;
            }
          }
          
          return { name, company };
        }
      });

      return results[0]?.result || null;
    } catch (error) {
      console.warn('Failed to extract customer info:', error);
      return null;
    }
  }


  private async updateUsageInfo() {
    try {
      this.usageInfo = await OpenAIService.getUsage();
    } catch (error) {
      console.warn('Failed to update usage info:', error);
    }
  }

  private async copyQuery(query: string) {
    try {
      await navigator.clipboard.writeText(query);
      this.showNotification('Query copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy query:', error);
      this.showNotification('Failed to copy query', 'danger');
    }
  }

  private async copyArticleLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      this.showNotification('Article link copied to clipboard', 'success');
    } catch (error) {
      console.error('Failed to copy article link:', error);
      this.showNotification('Failed to copy article link', 'danger');
    }
  }

  private async clearCache() {
    if (!confirm('Clear AI analysis cache? This will remove all stored analyses.')) {
      return;
    }

    try {
      await OpenAIService.clearCache();
      this.currentAnalysis = null;
      this.showNotification('Cache cleared', 'success');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      this.showNotification('Failed to clear cache', 'danger');
    }
  }

  private async testIntercomConnection() {
    try {
      this.showNotification('Testing Intercom API connection...', 'info');
      const isConnected = await IntercomService.testConnection();
      
      if (isConnected) {
        this.showNotification('Intercom API connected successfully!', 'success');
      } else {
        this.showNotification('Intercom API connection failed. Check console for details.', 'danger');
      }
    } catch (error) {
      console.error('Intercom connection test error:', error);
      this.showNotification('Failed to test Intercom connection', 'danger');
    }
  }

  private showNotification(message: string, type: 'success' | 'danger' | 'warning' | 'info') {
    // Toast notifications disabled - users can see what's happening in the UI directly
    return;
  }

  private toggleSection(sectionId: string) {
    const newExpanded = new Set(this.expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    this.expandedSections = newExpanded;
  }

  private renderCollapsibleSection(
    id: string,
    title: string,
    icon: any,
    content: any,
    count: number = 0,
    expandedByDefault: boolean = false,
    isLoading: boolean = false,
    error: string | null = null,
    hideBadge: boolean = false
  ) {
    // Only set defaults once when analysis results first appear
    if (!this.defaultsInitialized && this.currentAnalysis && expandedByDefault) {
      if (!this.expandedSections.has(id)) {
        this.expandedSections.add(id);
      }
    }
    const isExpanded = this.expandedSections.has(id);
    
    return html`
      <div class="collapsible-section">
        <div class="section-header" @click=${() => this.toggleSection(id)}>
          <div class="section-header-left">
            ${icon}
            <span class="section-title">${title}</span>
          </div>
          <div class="section-header-right">
            ${!hideBadge && count > 0 ? html`
              <div class="section-badge ${isLoading ? 'loading' : ''}">
                ${isLoading ? '...' : count}
              </div>
            ` : ''}
            <svg class="expand-icon ${isExpanded ? 'expanded' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
        <div class="section-content ${isExpanded ? '' : 'collapsed'}">
          ${error ? html`<div class="section-error">${error}</div>` : 
            isLoading ? html`<div class="section-loading">
              <div class="loading-spinner" style="width: 16px; height: 16px;"></div>
              Loading...
            </div>` :
            count === 0 ? html`<div class="section-empty">No ${title.toLowerCase()} found</div>` :
            content
          }
        </div>
      </div>
    `;
  }

  public updateSettings(settings: AppSettings) {
    this.settings = settings;
  }

  public updateContext(context: { isIntercom: boolean; tabUrl?: string }) {
    this.isIntercomPage = context.isIntercom;
  }

  public onTabActivated() {
    // Refresh context when tab becomes active
    this.loadUsageInfo();
  }

  render() {
    return html`
      <div class="ai-container">
        <!-- Removed OpenAI Configuration and Intercom Status boxes -->

        <!-- API Key Configuration Section -->
        ${!this.hasApiKey ? html`
          <div class="section">
            <div class="api-key-section">
              <h3 class="section-title">
                <svg class="section-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
                OpenAI API Key Required
              </h3>
              <p class="api-key-description">
                To use AI analysis features, please enter your OpenAI API key. Your key will be securely stored in Chrome's encrypted storage.
              </p>
              <div class="api-key-input-group">
                <input
                  type="password"
                  class="api-key-input"
                  placeholder="sk-..."
                  .value=${this.apiKeyInput}
                  @input=${(e: Event) => this.apiKeyInput = (e.target as HTMLInputElement).value}
                  @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.saveApiKey()}
                  ?disabled=${this.isTestingKey}
                />
                <button 
                  class="save-api-key-btn"
                  @click=${this.saveApiKey}
                  ?disabled=${this.isTestingKey || !this.apiKeyInput.trim()}
                >
                  ${this.isTestingKey ? 'Testing...' : 'Save Key'}
                </button>
              </div>
              <div class="api-key-help">
                <a href="https://platform.openai.com/api-keys" target="_blank" class="help-link">
                  Get your API key from OpenAI →
                </a>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Not on Intercom Page Message -->
        ${!this.isIntercomPage && this.hasApiKey ? html`
          <div class="section">
            <div class="intercom-status status-inactive">
              <div class="status-icon" style="background: currentColor;"></div>
              AI analysis is only available on Intercom conversation pages
            </div>
          </div>
        ` : ''}

        <!-- Analysis Section -->
        ${this.isIntercomPage && this.hasApiKey ? html`
          <div class="section">
            <div class="analyze-section">
              <button
                class="analyze-btn ${this.isAnalyzing ? 'analyzing' : ''} ${this.currentAnalysis && this.isLoadingTickets ? 'loading-tickets' : ''}"
                ?disabled=${this.isAnalyzing || !FEATURE_FLAGS.ENABLE_ANALYZE_CONVERSATION}
                @click=${this.analyzeConversation}
                title="${!FEATURE_FLAGS.ENABLE_ANALYZE_CONVERSATION ? 'Analyze Conversation (Coming soon)' : 'Analyze the current Intercom conversation'}"
              >
                <div class="button-fill"></div>
                <div class="button-content">
                  ${this.isAnalyzing ? html`
                    <svg class="analyze-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <!-- Magnifying glass with animated searching motion -->
                      <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                      <path class="search-handle" d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    ${this.currentLoadingMessage}
                  ` : html`
                    <svg class="analyze-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <!-- Magnifying glass with animated searching motion -->
                      <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                      <path class="search-handle" d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Analyze Conversation
                  `}
                </div>
              </button>
              
              <div class="analyze-description">
                AI will analyze the current conversation and provide solution recommendations, troubleshooting steps, and search queries
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Results Section -->
        ${this.currentAnalysis && !this.isAnalyzing ? html`
            ${this.renderCollapsibleSection(
              'analysis',
              'Analysis',
              html`<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11H1v4h8v4l8-6-8-6v4z"/>
              </svg>`,
              html`<div class="analysis-content">${this.currentAnalysis.analysis}</div>`,
              1, // has content
              true, // expanded by default
              false, // not loading
              null, // no error
              true // hide badge
            )}

            ${this.renderCollapsibleSection(
              'suggested-solution',
              'Suggested Solution',
              html`<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>`,
              html`<div class="analysis-content">${this.currentAnalysis.suggestedSolution}</div>`,
              1, // has content
              true, // expanded by default
              false, // not loading
              null, // no error
              true // hide badge
            )}

            ${this.renderCollapsibleSection(
              'troubleshooting-steps',
              'Troubleshooting Steps',
              html`<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>`,
              html`
                <div class="troubleshooting-steps">
                  ${this.currentAnalysis.troubleshootingSteps.map((step, index) => {
                    // Strip "Step X:" prefix if Claude adds it
                    const cleanStep = step.replace(/^Step\s+\d+:\s*/i, '').trim();
                    return html`
                      <div class="troubleshooting-step">
                        <span class="step-number">${index + 1}</span>
                        <span class="step-text">${cleanStep}</span>
                      </div>
                    `;
                  })}
                </div>
              `,
              this.currentAnalysis.troubleshootingSteps.length, // actual count
              true, // expanded by default
              false, // not loading
              null, // no error
              true // hide badge
            )}

            ${(() => {
              // Mark defaults as initialized after first analysis render
              if (this.currentAnalysis && !this.defaultsInitialized) {
                this.defaultsInitialized = true;
              }
              return '';
            })()}

            <!-- Content Sections -->
              ${this.renderCollapsibleSection(
                'help-center',
                'Help Center Articles',
                html`<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>`,
                this.currentAnalysis.relatedArticles && this.currentAnalysis.relatedArticles.length > 0 ? html`
                  <div class="related-articles">
                    ${this.currentAnalysis.relatedArticles.map(result => html`
                      <div class="article-card">
                        <div class="article-header">
                          <a href="${result.article.url}" target="_blank" class="article-title">
                            ${result.article.title}
                          </a>
                          <span class="relevance-score">${Math.round(result.relevanceScore * 100)}%</span>
                        </div>
                        <div class="article-summary">${result.article.description || 'No description available'}</div>
                        <div class="article-actions">
                          <button class="copy-btn" @click=${() => this.copyArticleLink(result.article.url)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                            Copy Link
                          </button>
                        </div>
                      </div>
                    `)}
                  </div>
                ` : '',
                this.currentAnalysis.relatedArticles?.length || 0,
                false // collapsed by default
              )}
              
              ${this.renderCollapsibleSection(
                'conversations',
                'Similar Resolved Issues',
                html`<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>`,
                this.isLoadingTickets ? html`
                  <div class="section-loading">
                    <div class="loading-spinner"></div>
                    Loading similar tickets...
                  </div>
                ` : this.similarTickets.length > 0 ? html`
                  <div class="similar-tickets">
                    ${this.similarTickets.map(ticket => html`
                      <div class="ticket-card">
                        <div class="ticket-header">
                          <span class="ticket-customer">${ticket.customerName}</span>
                          <span class="ticket-confidence">${ticket.confidence}% match</span>
                        </div>
                        <div class="ticket-summary">${ticket.summary}</div>
                        <div class="ticket-meta">
                          <span class="ticket-keywords">Keywords: ${ticket.matchedKeywords.join(', ')}</span>
                        </div>
                        <div class="ticket-actions">
                          <a href="${ticket.intercomUrl}" target="_blank" class="ticket-link">
                            View in Intercom
                          </a>
                        </div>
                      </div>
                    `)}
                  </div>
                ` : html`
                  <div class="section-empty">
                    ${this.ticketMatchStatus === 'no-tags'
                      ? 'No matches found - please add a CX tag'
                      : this.ticketMatchStatus === 'no-matches'
                      ? 'No similar tickets found with matching tags'
                      : 'No similar tickets found'
                    }
                  </div>
                `,
                this.similarTickets.length,
                false // collapsed by default
              )}
              
              ${this.renderCollapsibleSection(
                'guru-cards',
                'Guru Cards',
                html`<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                  <path d="M7 7V3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/>
                </svg>`,
                html`<div class="section-empty">Coming soon - Guru knowledge cards</div>`,
                0,
                false // collapsed by default
              )}

              ${this.renderCollapsibleSection(
                'search-queries',
                'Suggested Search Queries',
                html`<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>`,
                html`
                  <div class="boolean-queries">
                    ${this.currentAnalysis.booleanQueries.map(query => html`
                      <div class="boolean-query">
                        <span class="query-text">${query}</span>
                        <button class="copy-btn" @click=${() => this.copyQuery(query)}>
                          Copy
                        </button>
                      </div>
                    `)}
                  </div>
                `,
                this.currentAnalysis.booleanQueries.length,
                false // collapsed by default
              )}
            </div>
          </div>
        ` : this.isIntercomPage && !this.isAnalyzing ? html`
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <div>Click "Analyze Conversation" to get AI-powered insights and suggestions</div>
          </div>
        ` : ''}

        <!-- Usage Info and Settings -->
        <div class="usage-info">
          <span>Today: ${this.usageInfo.requestsToday} | Total: ${this.usageInfo.totalRequests}</span>
          <div style="display: flex; gap: var(--spacing-sm); flex-wrap: wrap;">
            ${this.hasApiKey ? html`
              <button class="clear-cache-btn" @click=${this.removeApiKey}>
                Change API Key
              </button>
            ` : ''}
            <button class="clear-cache-btn" @click=${this.testIntercomConnection}>
              Test Intercom
            </button>
            <button class="clear-cache-btn" @click=${this.clearCache}>
              Clear Cache
            </button>
          </div>
        </div>
      </div>
    `;
  }
}