// Core data types

export interface SearchLocation {
  name: string;
  url: string;
  isSearchable: boolean;
  extraParams?: string;
  resultType?: string;
  queryType?: 'admin_search' | 'exact_url' | 'coverage_report_search';
  supportsResultCheck?: boolean;
}

export interface SearchTerm {
  original: string;
  processed: string;
  url: string;
}

export interface SearchResult {
  term: string;
  url: string;
  hasResults?: boolean;
  resultCount?: number;
  error?: string;
  needsAuth?: boolean;
}

export interface SearchHistory {
  id: string;
  terms: string[];
  displayName: string;
  contactName?: string;
  searchType: string;
  location: string;
  locationName: string;
  timestamp: number;
  isFavorite: boolean;
  // Multi-category search support
  categories?: string[]; // Selected categories for multi-category searches (e.g., ['people', 'articles'])
  cacheId?: string; // Reference to cached results (only for People + Outlets)
}

// Cache entry for search results (People + Outlets only, NOT Articles)
export interface SearchResultsCache {
  searchId: string; // Links to SearchHistory.id
  results: any[]; // CategoryResults[] from search-results-inline.ts - using any to avoid circular import
  timestamp: number; // When cache was created
  expiresAt: number; // When cache expires (timestamp + CACHE_EXPIRATION_MS)
  categories: string[]; // Which categories are cached
}

export interface SearchSummary {
  total: number;
  found: number;
  empty: number;
  errors: number;
  pending: number;
}

// OpenAI integration types

// Ticket matching types
export interface SimilarTicket {
  conversationId: string;
  customerName: string;
  summary: string;
  confidence: number;
  matchedKeywords: string[];
  intercomUrl: string;
  messageCount: number;
}

export interface ConversationAnalysis {
  conversationHash: string;
  analysis: string;
  suggestedSolution: string;
  troubleshootingSteps: string[];
  booleanQueries: string[];
  relatedArticles: HelpCenterSearchResult[];
  confidence: number;
  timestamp: number;
}

export interface OpenAICache {
  [conversationHash: string]: ConversationAnalysis;
}

export interface OpenAIUsage {
  requestsToday: number;
  lastResetDate: string;
  totalRequests: number;
}

// File upload types

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  content: string;
}

export interface ParsedCSV {
  data: string[][];
  headers: string[];
  rowCount: number;
  errors: string[];
}

export interface GoogleSheetsInfo {
  url: string;
  sheetId: string;
  gid?: string;
  isValid: boolean;
  csvUrl?: string;
}

// UI Component types

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  component: string;
  visible: boolean;
}

export interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

// Settings and preferences

export interface AppSettings {
  darkMode: boolean;
  checkResultsEnabled: boolean;
  lastSearchLocation: string;
  openaiApiKey: string;
  autoOpenSidePanel: boolean;
  maxConcurrentRequests: number;
  requestTimeout: number;
}

// Result checking types

export interface ResultCheckStatus {
  hasResults: boolean | null;
  error?: string;
  errorType?: 'timeout' | 'auth' | 'network' | 'http';
  needsAuth?: boolean;
  resultCount?: number;
  status?: number;
}

export interface ResultCheckProgress {
  completed: number;
  total: number;
  currentTerm?: string;
  errors: number;
}

// Content script communication types

export interface ContentScriptMessage {
  type: 'GET_SELECTED_TEXT' | 'GET_CONVERSATION_CONTEXT' | 'INJECT_ANALYSIS';
  data?: any;
}

export interface ContentScriptResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Background script message types

export interface BackgroundMessage {
  action: 'fetch' | 'openSidePanel' | 'performSearch' | 'checkResults';
  requestId?: string;
  url?: string;
  options?: any;
  data?: any;
}

export interface BackgroundResponse {
  success: boolean;
  data?: any;
  error?: string;
  timing?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

// URL processing types

export interface URLInfo {
  original: string;
  cleaned: string;
  domain: string;
  isValid: boolean;
  needsProtocol: boolean;
  needsWWW: boolean;
  errors: string[];
}

export interface TextParseResult {
  parsed: string[];
  confidence: number;
  suggestions: string[];
  unknownTerms: string[];
  urlCount: number;
  outletCount: number;
}

// Query generation types

export interface QueryGenerationOptions {
  searchType: 'public' | 'admin';
  resultType?: string;
  enableQuotes: boolean;
  enableOR: boolean;
  caseSensitive: boolean;
}

export interface GeneratedQuery {
  original: string;
  processed: string;
  explanation: string;
  confidence: number;
  alternatives: string[];
}

// Storage utility types

export interface StorageOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Event types for component communication

export interface SearchEvent extends CustomEvent {
  detail: {
    terms: string[];
    location: SearchLocation;
    checkResults: boolean;
  };
}

export interface ResultsEvent extends CustomEvent {
  detail: {
    results: SearchResult[];
    summary: SearchSummary;
  };
}

export interface FileUploadEvent extends CustomEvent {
  detail: {
    file: UploadedFile;
    parsedData: ParsedCSV | string[];
  };
}

export interface AIAnalysisEvent extends CustomEvent {
  detail: {
    analysis: ConversationAnalysis;
    context: string;
  };
}

// Intercom integration types

export interface IntercomConversation {
  id: string;
  subject: string;
  state: string;
  createdAt: number;
  updatedAt: number;
  contactId: string | null;
  contactName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  messageCount: number;
  tags: string[];
  source: any; // Keep full source object for body and metadata
  conversation_parts?: any[]; // Keep conversation parts for text extraction
  conversation_rating?: any; // Keep rating for quality scoring

  // *** PHASE 1 IMPROVEMENTS - Ticket Matching Accuracy ***

  // Topics - ML-powered categorization (HIGHEST PRIORITY)
  // Automatic categorization by Intercom's ML, much better than manual tags
  topics?: {
    type: string;
    topics: Array<{
      id: string;
      name: string;
      applied_at?: number;
    }>;
    total_count: number;
  };

  // Priority - Urgency indicator
  priority?: string; // "priority" | "not_priority"

  // Team Assignment - Expertise area matching
  teamAssigneeId?: string | null;

  // First Contact Reply - Core issue identification
  // First message from customer contains purest description of issue
  firstContactReplyBody?: string;
}

export interface IntercomConversationPart {
  id: string;
  partType: string;
  body: string;
  createdAt: number;
  authorId: string | null;
  authorName: string | null;
  authorType: string;
}

export interface IntercomArticle {
  id: string;
  title: string;
  description: string;
  body: string;
  url: string;
  state: string;
  createdAt: number;
  updatedAt: number;
  authorId: string | null;
  parentId: string | null;
  parentType: string | null;
}

export interface HelpCenterSearchResult {
  article: IntercomArticle;
  relevanceScore: number;
  matchedKeywords: string[];
  matchReasons: string[];
}

export interface ArticleRelevanceScore {
  score: number;
  matchedKeywords: string[];
  reasons: string[];
}