# Muck Rack Side Panel Extension

A sophisticated Chrome Extension that transforms PR workflow efficiency by providing bulk search capabilities, AI-powered analysis, and intelligent overlay interfaces for Muck Rack. This extension helps PR professionals search for media outlets, journalists, and articles at scale while automating repetitive tasks.

## 🚀 Current Phase: Advanced Overlay System Implementation

**Status**: Actively implementing CSP-compliant overlay system to replace context menus  
**Branch**: `2.2-fix-overlay`  
**Focus**: Creating draggable, intelligent overlays that provide contextual information on Muck Rack admin pages

### Recent Overlay Fixes:
- ✅ Resolved iframe sandboxing issues on Intercom pages
- ✅ Fixed CSP violations with proper event handling
- ✅ Implemented direct DOM manipulation via content scripts
- ✅ Eliminated dual overlay system conflicts

See [Overlay Implementation Plan](docs/overlay-phase/extension-overlay-plan.md) and [Latest Fix](docs/overlay-phase/main-overlay-fix.md) for technical details.

## 📁 Project Structure

```
├── docs/                     # All documentation
│   ├── project-specs/        # Project specifications and requirements
│   ├── development/          # Development docs (CLAUDE.md, refactor plans)
│   ├── overlay-phase/        # Current overlay implementation docs
│   ├── sales-marketing/     # Sales decks and marketing materials
│   ├── guides/              # User guides and testing docs
│   └── archive/             # Deprecated documentation
├── reference/               # Reference materials
│   ├── screenshots/         # UI screenshots and diagrams
│   ├── logs/               # Debug and error logs
│   ├── sample-responses/   # API response samples
│   └── Overlay_Manager/    # Reference overlay implementation
├── src/                    # Source code
│   ├── background/         # Service worker
│   ├── sidepanel/         # Side panel UI (Lit components)
│   ├── content/           # Content scripts
│   ├── overlay/           # Overlay system (current focus)
│   └── shared/            # Shared utilities and types
├── dist/                  # Build output
├── assets/                # Static assets
└── archives/              # Backup files

```

## 🔧 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

**IMPORTANT**: This extension requires API keys to function.

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and add your API keys:
# - INTERCOM_ACCESS_TOKEN (required)
# - OPENAI_API_KEY (optional - for AI features)
```

See [SECURITY.md](SECURITY.md) for detailed setup instructions and security best practices.

### 3. Build & Run

```bash
# Development mode with hot reload
npm run dev

# Production build
npm run build

# Run linter
npm run lint
```

### 4. Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` directory

## 🔒 Security

This project uses **environment variables** for all sensitive API keys. Secrets are never committed to git.

- See [SECURITY.md](SECURITY.md) for complete security documentation
- `.env` file contains your private keys (never commit this!)
- `.env.example` is a template for sharing configuration structure

## 📚 Key Documentation

- **Project Specification**: [docs/project-specs/README.md](docs/project-specs/README.md)
- **Development Instructions**: [docs/development/CLAUDE.md](docs/development/CLAUDE.md)
- **User Guide**: [docs/guides/USER_GUIDE.md](docs/guides/USER_GUIDE.md)
- **Overlay Implementation**: [docs/overlay-phase/extension-overlay-plan.md](docs/overlay-phase/extension-overlay-plan.md)

## 🎯 Core Features

### Search & Analysis
- **Bulk Search**: Process hundreds of search terms simultaneously across media outlets, people, articles
- **Result Pre-Checking**: Validate searches before opening tabs (shows ✅ found vs ❌ empty)
- **Boolean Search Support**: Full support for Muck Rack's boolean operators with syntax highlighting
- **Smart Query Generation**: 
  - CamelCase handling: `TechCrunch` → `TechCrunch OR "Tech Crunch"`
  - URL processing: `techcrunch.com` → `techcrunch.com OR techcrunch`
  - Multi-word detection: Automatic phrase quotation

### Data Import & Processing
- **CSV Upload**: Drag-and-drop with automatic column detection
- **Google Sheets Integration**: Direct import from public sheet URLs
- **URL Cleaning**: Smart formatting and validation of bulk URLs
- **Batch Operations**: Process up to 500 items with progress tracking

### AI & Automation
- **OpenAI GPT-4 Integration**: Analyze Intercom conversations for context
- **Suggested Replies**: AI-generated response templates
- **Boolean Query Generation**: Convert natural language to boolean searches
- **Smart Context Detection**: Identify journalists, outlets, and relevant entities

### Admin Enhancement (In Development)
- **Overlay Information Cards**: Hover over names for instant admin data
- **Quick Search Links**: Direct access to relevant searches from any page
- **Admin Panel Parsing**: Extract and display key information cleanly
- **Text Selection Actions**: Highlight text to trigger contextual overlays

## 🛠️ Technology Stack

- **Framework**: Lit Web Components with TypeScript
- **Build Tool**: esbuild
- **Extension**: Chrome Extension Manifest V3
- **UI**: Chrome Side Panel API
- **Storage**: Chrome Storage API
- **AI**: OpenAI GPT-4 integration

## 📈 Development Status

### ✅ Completed Features
- Core bulk search engine with result checking
- Side panel UI with tabbed interface (Search, Results, AI, History)
- CSV/Google Sheets import with validation
- OpenAI GPT-4 integration for conversation analysis
- Boolean search with visual syntax highlighting
- Smart query generation and URL cleaning
- Search history with favorites (10 recent, 20 favorites)
- CORS bypass through service worker
- Secure cookie authentication with expiration validation

### 🚧 In Progress
- **Overlay System** (Current Sprint):
  - ✅ Basic overlay infrastructure
  - ✅ CSP-compliant implementation
  - 🔄 Muck Rack element detection
  - 🔄 Context menu replacement
  - 📋 Information card overlays

### 📋 Planned Enhancements
- API key authentication option (Phase 2 ready, awaiting deployment)
- Help Center article extraction from conversations
- Article success tracking based on outcomes
- Smart article matching using historical data
- Broadcast/Clips search implementation
- Advanced admin panel actions
- Confidence scoring for search results

## 🔐 Security & Performance

### Security Features
- **Enhanced Cookie Authentication**: Filtered access with expiration validation
- **API Key Option**: Ready for deployment (Phase 2 complete)
- **CSP Compliance**: Full Content Security Policy adherence
- **Input Sanitization**: XSS prevention and URL validation
- **Secure Storage**: Chrome's encrypted storage for sensitive data

### Performance Optimizations
- **5-minute authentication cache**: Reduces API calls
- **Lazy loading**: Components load on-demand
- **Debounced inputs**: Prevents excessive API requests
- **Batch operations**: Efficient handling of bulk searches
- **Result caching**: Avoid redundant searches

## 📝 Version & Deployment

**Current Version**: 2.1.9 (Manifest V3)  
**Active Branch**: `2.2-fix-overlay`  
**Main Branch**: Protected, merge only after validation  
**Chrome Web Store**: Ready for deployment (dist/ folder)

## 🧪 Testing

```bash
# Load extension in Chrome
1. Open chrome://extensions/
2. Enable Developer mode
3. Load unpacked → select dist/ folder
4. Right-click anywhere → "Muck Rack Search"

# Test overlay system
MROverlay.create() # In side panel console
```

## 🤝 Development Guidelines

### Critical Rules
1. **No code changes without approval** - Describe changes and wait for go-ahead
2. **Never commit without user testing** - User must confirm functionality
3. **Professional scrutiny** - Challenge approaches and suggest improvements

### Code Standards
- TypeScript with strict typing
- Lit Web Components for UI
- `.js` extension for all imports (Chrome extension requirement)
- Comprehensive comments for handoffs
- Follow existing patterns in codebase

See [CLAUDE.md](docs/development/CLAUDE.md) for complete development guidelines.

## 📞 Support & Feedback

- **Documentation**: [Complete Project Specification](docs/project-specs/)
- **User Guide**: [docs/guides/USER_GUIDE.md](docs/guides/USER_GUIDE.md)
- **Known Issues**: [docs/development/known-issues.md](docs/development/known-issues.md)
- **Sales Materials**: [docs/sales-marketing/](docs/sales-marketing/)

---

**Project Goal**: Transform PR workflow efficiency through intelligent automation, making Muck Rack searches faster, smarter, and more scalable.