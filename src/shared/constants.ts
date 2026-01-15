// Search location configurations from original extension
export const ALL_SEARCH_LOCATIONS = {
  "Public Site": [
    {
      name: "People",
      url: "https://{{muckRackHost}}/search/results?result_type=person",
      isSearchable: true,
      extraParams: '&must_appear_in_people=names',
      resultType: 'person',
      queryType: 'person_search',
      supportsResultCheck: true
    },
    {
      name: "Articles",
      url: "https://{{muckRackHost}}/search/results?result_type=article",
      isSearchable: true,
      resultType: 'article',
      supportsResultCheck: true
    },
    {
      name: "Media Outlets",
      url: "https://{{muckRackHost}}/search/results?result_type=media_outlet",
      isSearchable: true,
      resultType: 'media_outlet',
      supportsResultCheck: true
    },
    {
      name: "Broadcast / Clips",
      url: "https://{{muckRackHost}}/search/results?result_type=clip",
      isSearchable: true,
      resultType: 'clip',
      supportsResultCheck: false
    }
  ],
  "Admin": [
    { name: "People (Admin)", url: "https://muckrack.com/mradmin/directory/person/", isSearchable: true, queryType: 'admin_search' },
    { name: "Media Outlets (Admin)", url: "https://muckrack.com/mradmin/directory/mediaoutlet/", isSearchable: true, queryType: 'admin_search' },
    { name: "Users (Admin)", url: "https://muckrack.com/mradmin/auth/user/", isSearchable: true, queryType: 'admin_search' },
    { name: "Links (Admin)", url: "https://muckrack.com/mradmin/scraper/link/", isSearchable: true, queryType: 'exact_url' },
    { name: "Coverage Reports (Admin)", url: "https://muckrack.com/mradmin/coverage_reports/coveragereport/", isSearchable: true, queryType: 'coverage_report_search' }
  ]
};

// Known multi-word outlets that should stay together
export const KNOWN_MULTI_WORD_OUTLETS = [
  "The New York Times", "Wall Street Journal", "Washington Post",
  "Los Angeles Times", "USA Today", "The Guardian", "BBC News",
  "Fox News", "CNN News", "Associated Press", "Reuters",
  "Bloomberg News", "Financial Times", "Chicago Tribune",
  "Boston Globe", "San Francisco Chronicle", "Miami Herald",
  "Denver Post", "Seattle Times", "Atlanta Journal Constitution",
  "New York Post", "Daily Mail", "The Sun", "The Times",
  "The Independent", "Sky News", "NBC News", "CBS News",
  "ABC News", "NPR", "PBS NewsHour", "Vice News",
  "BuzzFeed News", "Huffington Post", "Politico",
  "The Hill", "Axios", "Vox Media", "The Verge",
  "Ars Technica", "Tech Crunch", "The Next Web",
  "Business Insider", "Forbes", "Fortune Magazine",
  "Time Magazine", "Newsweek", "The Atlantic",
  "The New Yorker", "Rolling Stone", "Vanity Fair",
  "People Magazine", "Entertainment Weekly", "Fast Company",
  "Wired Magazine", "Popular Science", "Scientific American"
];

// Regex patterns for text processing
export const REGEX_PATTERNS = {
  URL: /https?:\/\/\S+/,
  URL_GLOBAL: /https?:\/\/\S+/g,
  DOMAIN: /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+)\.([a-zA-Z]{2,})(?:\/.*)?$/,
  SIMPLE_DOMAIN: /^(?!https?:\/\/)(?:www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/,
  CAMEL_CASE: /([a-z])([A-Z])/g,
  COVERAGE_REPORT: /https?:\/\/[\w.-]+\.muckrack\.com\/coverage-reports\//
};

// Application limits
export const LIMITS = {
  MAX_SEARCH_TERMS: 1000,
  MAX_RESULTS_PER_PAGE: 500,
  MAX_INPUT_LENGTH: 50000,
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_RECENT_SEARCHES: 10,
  MAX_FAVORITES: 20,
  CACHE_EXPIRATION_MS: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
};

// Storage keys
export const STORAGE_KEYS = {
  LAST_LOCATION: 'lastSearchLocation',
  RECENT_SEARCHES: 'recentSearches',
  FAVORITES: 'favorites',
  SETTINGS: 'settings',
  OPENAI_CACHE: 'openaiCache',
  CHECK_RESULTS_ENABLED: 'checkResultsEnabled',
  DARK_MODE_ENABLED: 'darkModeEnabled',
  SEARCH_RESULTS_CACHE: 'searchResultsCache' // Cache for People + Outlets results (not Articles)
};

// Context menu structure (complete from original extension)
export const CONTEXT_MENU_STRUCTURE = [
  {
    name: "ACCOUNT",
    children: [
      { name: "Organizations", url: "https://muckrack.com/mradmin/account/organization/", isSearchable: true, queryType: 'admin_search' },
      { name: "User changes", url: "https://muckrack.com/mradmin/account/userchange/", isSearchable: true, queryType: 'admin_search' },
    ],
  },
  {
    name: "ALERTS",
    children: [{ name: "Alerts", url: "https://muckrack.com/mradmin/alerts/alert/", isSearchable: true, queryType: 'admin_search' }],
  },
  {
    name: "AUTHENTICATION AND AUTHORIZATION",
    children: [{ name: "Users", url: "https://muckrack.com/mradmin/auth/user/", isSearchable: true, queryType: 'admin_search' }],
  },
  {
    name: "BACKGROUND TASKS",
    children: [{ name: "Admin tasks", url: "https://muckrack.com/mradmin/user_background_tasks/admintaskstatus/", isSearchable: true, queryType: 'admin_search' }],
  },
  {
    name: "BROADCAST",
    children: [{ name: "Saved clips", url: "https://muckrack.com/mradmin/broadcast/savedclip/", isSearchable: true, queryType: 'admin_search' }],
  },
  {
    name: "COVERAGE REPORTS",
    children: [
      { name: "Coverage Comparisons", url: "https://muckrack.com/mradmin/coverage_reports/coveragereportcomparison/", isSearchable: true, queryType: 'admin_search' },
      { name: "Coverage report exports", url: "https://muckrack.com/mradmin/coverage_reports/coveragereportexport/", isSearchable: true, queryType: 'admin_search' },
      { name: "Coverage reports", url: "https://muckrack.com/mradmin/coverage_reports/coveragereport/", isSearchable: true, queryType: 'coverage_report_search' },
      { name: "Bulk add entries to a coverage report", url: "https://muckrack.com/mradmin/coverage_reports/coveragereport/bulk_add_entries", isSearchable: false },
    ],
  },
  {
    name: "DASHBOARDS",
    children: [
      { name: "Dashboards", url: "https://muckrack.com/mradmin/dashboards/dashboard/", isSearchable: true, queryType: 'admin_search' },
      { name: "Widget data sources", url: "https://muckrack.com/mradmin/dashboards/widgetdatasource/", isSearchable: false },
      { name: "Widgets", url: "https://muckrack.com/mradmin/dashboards/widget/", isSearchable: true, queryType: 'admin_search' },
    ],
  },
  {
    name: "DIRECTORY",
    children: [
      { name: "Activity", url: "https://muckrack.com/mradmin/directory/activity/", isSearchable: true, queryType: 'admin_search' },
      { name: "Custom Contact", url: "https://muckrack.com/mradmin/directory/customcontact/", isSearchable: true, queryType: 'admin_search' },
      { name: "Media outlets", url: "https://muckrack.com/mradmin/directory/mediaoutlet/", isSearchable: true, queryType: 'admin_search' },
      { name: "People", url: "https://muckrack.com/mradmin/directory/person/", isSearchable: true, queryType: 'admin_search' },
    ],
  },
  {
    name: "IDENTITY",
    children: [
      { name: "Email domains", url: "https://muckrack.com/mradmin/identity/emaildomain/", isSearchable: true, queryType: 'admin_search' },
      { name: "Email authorizations", url: "https://muckrack.com/mradmin/identity/externalauthorization/", isSearchable: true, queryType: 'admin_search' },
      { name: "Sender identities", url: "https://muckrack.com/mradmin/identity/emailsenderidentity/", isSearchable: true, queryType: 'admin_search' },
      { name: "Test email recipients", url: "https://muckrack.com/mradmin/identity/testemailrecipient/", isSearchable: true, queryType: 'admin_search' },
    ],
  },
  {
    name: "MEDIA LISTS",
    children: [
      { name: "Media list exports", url: "https://muckrack.com/mradmin/medialists/medialistexport/", isSearchable: true, queryType: 'admin_search' },
      { name: "Media lists", url: "https://muckrack.com/mradmin/medialists/medialist/", isSearchable: true, queryType: 'admin_search' },
      { name: "Memberships", url: "https://muckrack.com/mradmin/medialists/membership/", isSearchable: true, queryType: 'admin_search' },
    ],
  },
  {
    name: "NEWSLETTERS",
    children: [
      { name: "Newsletter Editions", url: "https://muckrack.com/mradmin/newsletters/edition/", isSearchable: true, queryType: 'admin_search' },
      { name: "Newsletter email suppressions", url: "https://muckrack.com/mradmin/newsletters/newsletteremailsuppression/", isSearchable: true, queryType: 'admin_search' },
      { name: "Newsletters", url: "https://muckrack.com/mradmin/newsletters/newsletter/", isSearchable: true, queryType: 'admin_search' },
      { name: "Subscriber Lists", url: "https://muckrack.com/mradmin/newsletters/subscriberslist/", isSearchable: true, queryType: 'admin_search' },
      { name: "Subscribers", url: "https://muckrack.com/mradmin/newsletters/subscriber/", isSearchable: true, queryType: 'admin_search' },
      { name: "Import subscribers list", url: "https://muckrack.com/mradmin/newsletters/subscriberslist/import_subscribers_list", isSearchable: false },
    ],
  },
  {
    name: "OUTLETS_LISTS",
    children: [
      { name: "Outlet list exports", url: "https://muckrack.com/mradmin/outlets_lists/outletlistexport/", isSearchable: true, queryType: 'admin_search' },
      { name: "Outlet list memberships", url: "https://muckrack.com/mradmin/outlets_lists/outletlistmembership/", isSearchable: true, queryType: 'admin_search' },
      { name: "Outlet lists", url: "https://muckrack.com/mradmin/outlets_lists/outletlist/", isSearchable: true, queryType: 'admin_search' },
    ],
  },
  {
    name: "PERMISSIONS",
    children: [
      { name: "Organization package add-ons", url: "https://muckrack.com/mradmin/permissions/addon/", isSearchable: true, queryType: 'admin_search' },
      { name: "Organization permission overrides", url: "https://muckrack.com/mradmin/permissions/organizationpermissionoverride/", isSearchable: true, queryType: 'admin_search' },
      { name: "Organization permissions disabled", url: "https://muckrack.com/mradmin/permissions/organizationpermissiondisable/", isSearchable: true, queryType: 'admin_search' },
      { name: "Package permissions", url: "https://muckrack.com/mradmin/permissions/packagepermission/", isSearchable: true, queryType: 'admin_search' },
      { name: "Packages", url: "https://muckrack.com/mradmin/permissions/package/", isSearchable: true, queryType: 'admin_search' },
      { name: "Permission actions", url: "https://muckrack.com/mradmin/permissions/permissionaction/", isSearchable: true, queryType: 'admin_search' },
      { name: "User permission overrides", url: "https://muckrack.com/mradmin/permissions/userpermissionoverride/", isSearchable: true, queryType: 'admin_search' },
    ],
  },
  {
    name: "PITCHING",
    children: [
      { name: "Email suppressions", url: "https://muckrack.com/mradmin/pitching/emailsuppression/", isSearchable: true, queryType: 'admin_search' },
      { name: "Pitch recipients", url: "https://muckrack.com/mradmin/pitching/pitchrecipient/", isSearchable: true, queryType: 'admin_search' },
      { name: "Pitches", url: "https://muckrack.com/mradmin/pitching/pitch/", isSearchable: true, queryType: 'admin_search' },
    ],
  },
  {
    name: "PRESENTATIONS",
    children: [{ name: "Presentations", url: "https://muckrack.com/mradmin/presentations/presentation/", isSearchable: false }],
  },
  {
    name: "PRESS_RELEASES",
    children: [{ name: "Press Releases", url: "https://muckrack.com/mradmin/press_releases/pressrelease/", isSearchable: true, queryType: 'admin_search' }],
  },
  {
    name: "SCRAPER",
    children: [
      { name: "Links", url: "https://muckrack.com/mradmin/scraper/link/", isSearchable: true, queryType: 'exact_url' }
    ],
  },
  {
    name: "SEARCH",
    children: [{ name: "Saved Searches", url: "https://muckrack.com/mradmin/search/savedsearch/", isSearchable: true, queryType: 'admin_search' }],
  },
  {
    name: "TRENDS",
    children: [{ name: "Trend Reports", url: "https://muckrack.com/mradmin/trends/trendreport/", isSearchable: true, queryType: 'admin_search' }],
  },
];

// OpenAI configuration
export const OPENAI_CONFIG = {
  API_BASE_URL: 'https://api.openai.com/v1',
  MODEL: 'gpt-4',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.7,
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
  RATE_LIMIT_PER_HOUR: 50
};

// Intercom API configuration
export const INTERCOM_CONFIG = {
  API_BASE_URL: 'https://api.intercom.io',
  RATE_LIMIT_DELAY: 1000, // 1 second between requests
  CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
  MAX_CONVERSATION_HISTORY: 20,
  MAX_HELP_CENTER_RESULTS: 10,
  MIN_RELEVANCE_SCORE: 0.1
};

// Ticket Matching Configuration (Phase 2 - TF-IDF Enhancement)
export const TICKET_MATCHING_CONFIG = {
  ENABLE_TFIDF_SCORING: true,   // Enabled - Phase 2 complete and working
  TFIDF_WEIGHT: 0.3,              // 30% text similarity
  TAG_WEIGHT: 0.7                 // 70% tag matching
};

// Feature flags for production builds
export const FEATURE_FLAGS = {
  ENABLE_ANALYZE_CONVERSATION: true,  // Enable AI conversation analysis in production
  ENABLE_BROADCAST_SEARCH: false      // Broadcast search not ready for production yet
};

// Default settings
export const DEFAULT_SETTINGS = {
  darkMode: false,
  checkResultsEnabled: false,
  lastSearchLocation: '',
  openaiApiKey: '',
  autoOpenSidePanel: true
};