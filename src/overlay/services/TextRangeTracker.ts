import { debug } from '../../shared/utils/debug.js';
// ===================================================================
// TEXT RANGE TRACKER - Advanced Text Selection and Range Management
// ===================================================================
// Enhanced text range tracking system for text-based overlays with
// pattern matching, selection monitoring, and range validation.
// ===================================================================

/**
 * Represents a matched text range with metadata
 */
export interface TextRangeMatch {
  /** The matched text content */
  text: string;
  /** The DOM range object */
  range: Range;
  /** The container element containing the text */
  containerElement: Element;
  /** Start offset within the container */
  startOffset: number;
  /** End offset within the container */
  endOffset: number;
  /** Bounding rectangle of the text range */
  bounds: DOMRect;
  /** The pattern that matched this text */
  pattern?: RegExp;
  /** Additional metadata about the match */
  metadata?: Record<string, unknown>;
  /** Unique identifier for this match */
  id: string;
  /** Timestamp when match was created */
  timestamp: number;
}

/**
 * Options for text range tracking
 */
export interface TextRangeTrackerOptions {
  /** Whether to track changes to existing ranges */
  trackChanges?: boolean;
  /** Debounce time for change detection (ms) */
  changeDebounceMs?: number;
  /** Maximum number of matches to track */
  maxMatches?: number;
  /** Whether to ignore matches in certain elements */
  ignoreElements?: string[]; // CSS selectors
  /** Minimum text length to consider for matching */
  minTextLength?: number;
  /** Whether to merge overlapping ranges */
  mergeOverlapping?: boolean;
}

/**
 * Callback for text range events
 */
export type TextRangeCallback = (matches: TextRangeMatch[]) => void;

/**
 * Creates an enhanced text range tracker for overlay system
 */
export function createTextRangeTracker(
  document: Document,
  options: TextRangeTrackerOptions = {}
): {
  findTextMatches: (pattern: RegExp, containerElement?: Element) => TextRangeMatch[];
  trackPattern: (pattern: RegExp, callback: TextRangeCallback) => () => void;
  trackSelection: (callback: (selection: TextRangeMatch | null) => void) => () => void;
  createRangeFromText: (text: string, containerElement?: Element) => TextRangeMatch | null;
  validateRange: (range: Range) => boolean;
  updateRangeBounds: (match: TextRangeMatch) => TextRangeMatch;
  clearAllMatches: () => void;
  destroy: () => void;
} {
  const {
    trackChanges = true,
    changeDebounceMs = 300,
    maxMatches = 100,
    ignoreElements = ['script', 'style', 'noscript', '.overlay-instance'],
    minTextLength = 1,
    mergeOverlapping = true,
  } = options;

  let isDestroyed = false;
  let changeObserver: MutationObserver | null = null;
  let selectionObserver: (() => void) | null = null;
  const trackedPatterns = new Map<RegExp, { callback: TextRangeCallback; matches: TextRangeMatch[] }>();
  const allMatches = new Map<string, TextRangeMatch>();

  /**
   * Generates a unique ID for a text range match
   */
  function generateMatchId(): string {
    return `text-match-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Checks if an element should be ignored for text matching
   */
  function shouldIgnoreElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    
    for (const selector of ignoreElements) {
      if (selector.startsWith('.') || selector.startsWith('#') || selector.includes('[')) {
        if (element.matches(selector)) {
          return true;
        }
      } else if (tagName === selector.toLowerCase()) {
        return true;
      }
    }

    // Check if element is hidden
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true;
    }

    return false;
  }

  /**
   * Gets all text nodes within a container element
   */
  function getTextNodes(container: Element): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parentElement = node.parentElement;
          if (!parentElement || shouldIgnoreElement(parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          const text = node.textContent || '';
          return text.trim().length >= minTextLength ? 
            NodeFilter.FILTER_ACCEPT : 
            NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    return textNodes;
  }

  /**
   * Creates a TextRangeMatch from a Range object
   */
  function createTextRangeMatch(
    range: Range,
    pattern?: RegExp,
    metadata?: Record<string, unknown>
  ): TextRangeMatch {
    const bounds = range.getBoundingClientRect();
    const containerElement = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE 
      ? range.commonAncestorContainer as Element
      : range.commonAncestorContainer.parentElement!;

    return {
      text: range.toString(),
      range: range.cloneRange(),
      containerElement,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      bounds,
      pattern,
      metadata,
      id: generateMatchId(),
      timestamp: Date.now(),
    };
  }

  /**
   * Finds all text matches for a given pattern
   */
  function findTextMatches(
    pattern: RegExp,
    containerElement: Element = document.documentElement
  ): TextRangeMatch[] {
    if (isDestroyed) {
      return [];
    }

    const matches: TextRangeMatch[] = [];
    const textNodes = getTextNodes(containerElement);

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      
      let match;
      while ((match = globalPattern.exec(text)) !== null) {
        try {
          const range = document.createRange();
          range.setStart(textNode, match.index);
          range.setEnd(textNode, match.index + match[0].length);

          if (validateRange(range)) {
            const textMatch = createTextRangeMatch(range, pattern);
            matches.push(textMatch);
            
            // Store in all matches registry
            allMatches.set(textMatch.id, textMatch);
          }
        } catch (error) {
          debug.warn('TextRangeTracker: Error creating range:', error);
        }

        // Prevent infinite loop
        if (!globalPattern.global) {
          break;
        }
      }
    }

    // Merge overlapping ranges if requested
    if (mergeOverlapping) {
      return mergeOverlappingRanges(matches);
    }

    // Limit matches to prevent performance issues
    return matches.slice(0, maxMatches);
  }

  /**
   * Merges overlapping text range matches
   */
  function mergeOverlappingRanges(matches: TextRangeMatch[]): TextRangeMatch[] {
    if (matches.length <= 1) {
      return matches;
    }

    // Sort matches by position
    const sorted = matches.sort((a, b) => {
      const aPos = a.range.compareBoundaryPoints(Range.START_TO_START, b.range);
      return aPos;
    });

    const merged: TextRangeMatch[] = [];
    let current = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      
      // Check if ranges overlap
      try {
        const comparison = current.range.compareBoundaryPoints(Range.END_TO_START, next.range);
        
        if (comparison >= 0) {
          // Ranges overlap, merge them
          const mergedRange = document.createRange();
          mergedRange.setStart(current.range.startContainer, current.range.startOffset);
          mergedRange.setEnd(
            next.range.endContainer.compareDocumentPosition(current.range.endContainer) & Node.DOCUMENT_POSITION_FOLLOWING
              ? next.range.endContainer : current.range.endContainer,
            next.range.endOffset > current.range.endOffset ? next.range.endOffset : current.range.endOffset
          );
          
          current = createTextRangeMatch(mergedRange, current.pattern, {
            ...current.metadata,
            merged: true,
            originalIds: [current.id, next.id],
          });
        } else {
          // No overlap, add current to results and move to next
          merged.push(current);
          current = next;
        }
      } catch (error) {
        // If comparison fails, treat as non-overlapping
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Tracks a pattern and calls callback when matches are found
   */
  function trackPattern(pattern: RegExp, callback: TextRangeCallback): () => void {
    if (isDestroyed) {
      return () => {};
    }

    // Find initial matches
    const initialMatches = findTextMatches(pattern);
    trackedPatterns.set(pattern, { callback, matches: initialMatches });
    
    // Call callback with initial matches
    callback(initialMatches);

    // Set up change tracking if enabled
    if (trackChanges && !changeObserver) {
      setupChangeObserver();
    }

    // Return unsubscribe function
    return () => {
      trackedPatterns.delete(pattern);
      
      // Remove matches from registry
      initialMatches.forEach(match => {
        allMatches.delete(match.id);
      });
    };
  }

  /**
   * Tracks text selection changes
   */
  function trackSelection(callback: (selection: TextRangeMatch | null) => void): () => void {
    if (isDestroyed) {
      return () => {};
    }

    function handleSelectionChange(): void {
      const selection = document.getSelection();
      
      if (!selection || selection.rangeCount === 0) {
        callback(null);
        return;
      }

      const range = selection.getRangeAt(0);
      
      if (range.collapsed || !validateRange(range)) {
        callback(null);
        return;
      }

      const textMatch = createTextRangeMatch(range, undefined, { source: 'selection' });
      callback(textMatch);
    }

    // Listen to selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Initial check
    handleSelectionChange();

    // Return unsubscribe function
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }

  /**
   * Creates a range from text within a container
   */
  function createRangeFromText(
    text: string,
    containerElement: Element = document.documentElement
  ): TextRangeMatch | null {
    const textNodes = getTextNodes(containerElement);
    
    for (const textNode of textNodes) {
      const nodeText = textNode.textContent || '';
      const index = nodeText.indexOf(text);
      
      if (index !== -1) {
        try {
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + text.length);
          
          if (validateRange(range)) {
            return createTextRangeMatch(range, undefined, { source: 'manual' });
          }
        } catch (error) {
          debug.warn('TextRangeTracker: Error creating manual range:', error);
        }
      }
    }

    return null;
  }

  /**
   * Validates that a range is still valid in the DOM
   */
  function validateRange(range: Range): boolean {
    try {
      // Check if start and end containers are still in the document
      if (!document.contains(range.startContainer) || !document.contains(range.endContainer)) {
        return false;
      }

      // Check if range is not collapsed when it shouldn't be
      if (range.collapsed && range.toString().length > 0) {
        return false;
      }

      // Check if range has valid bounds
      const bounds = range.getBoundingClientRect();
      if (bounds.width === 0 && bounds.height === 0 && range.toString().trim().length > 0) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Updates the bounds of a text range match
   */
  function updateRangeBounds(match: TextRangeMatch): TextRangeMatch {
    if (!validateRange(match.range)) {
      return match;
    }

    return {
      ...match,
      bounds: match.range.getBoundingClientRect(),
      timestamp: Date.now(),
    };
  }

  /**
   * Sets up mutation observer for change tracking
   */
  function setupChangeObserver(): void {
    changeObserver = new MutationObserver(debounce(() => {
      if (isDestroyed) {
        return;
      }

      // Re-evaluate all tracked patterns
      for (const [pattern, data] of trackedPatterns) {
        const newMatches = findTextMatches(pattern);
        data.matches = newMatches;
        data.callback(newMatches);
      }
    }, changeDebounceMs));

    changeObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /**
   * Simple debounce implementation
   */
  function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout | null = null;
    
    return ((...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        func(...args);
        timeout = null;
      }, wait);
    }) as T;
  }

  /**
   * Clears all tracked matches
   */
  function clearAllMatches(): void {
    allMatches.clear();
    trackedPatterns.clear();
  }

  /**
   * Destroys the tracker and cleans up resources
   */
  function destroy(): void {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    
    if (changeObserver) {
      changeObserver.disconnect();
      changeObserver = null;
    }
    
    clearAllMatches();
  }

  return {
    findTextMatches,
    trackPattern,
    trackSelection,
    createRangeFromText,
    validateRange,
    updateRangeBounds,
    clearAllMatches,
    destroy,
  };
}