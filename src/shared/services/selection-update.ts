/**
 * Selection Update Service
 * 
 * Handles automatic updating of search text when new text is selected,
 * while respecting user input and not interfering with existing functionality.
 */
export class SelectionUpdateService {
  private static instance: SelectionUpdateService | null = null;
  
  // Track typing state to prevent overwriting user input
  private isUserTyping = false;
  private typingTimeout: number | null = null;
  private readonly TYPING_TIMEOUT = 2000; // 2 seconds after user stops typing
  
  // Reference to search component for updates
  private searchComponent: any = null;
  
  private constructor() {}
  
  static getInstance(): SelectionUpdateService {
    if (!SelectionUpdateService.instance) {
      SelectionUpdateService.instance = new SelectionUpdateService();
    }
    return SelectionUpdateService.instance;
  }
  
  /**
   * Register the search component for text updates
   */
  setSearchComponent(component: any): void {
    this.searchComponent = component;
  }
  
  /**
   * Notify service that user is actively typing
   * Called from search component's input handler
   */
  notifyUserTyping(): void {
    this.isUserTyping = true;
    
    // Clear existing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Set new timeout - user considered "done typing" after 2 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      this.isUserTyping = false;
      this.typingTimeout = null;
    }, this.TYPING_TIMEOUT);
  }
  
  /**
   * Handle new selected text from content script
   * Only updates if user is not actively typing
   */
  handleSelectedText(text: string): void {
    
    // Don't update if user is currently typing
    if (this.isUserTyping) {
      console.log('⏸️ SelectionUpdateService: User is typing, skipping auto-update');
      return;
    }
    
    // Don't update if no search component registered
    if (!this.searchComponent) {
      console.log('❌ SelectionUpdateService: No search component registered');
      return;
    }
    
    // Don't update if text is empty or too short
    if (!text || text.trim().length < 3) {
      console.log('❌ SelectionUpdateService: Text too short, skipping update:', text?.length || 0, 'chars');
      return;
    }
    
    console.log('✅ SelectionUpdateService: Updating search text with selected text:', text);
    
    // Use existing populateSearchText method - this preserves all existing functionality
    if (typeof this.searchComponent.populateSearchText === 'function') {
      this.searchComponent.populateSearchText(text);
      console.log('✅ SelectionUpdateService: populateSearchText called successfully');
    } else {
      console.warn('❌ SelectionUpdateService: populateSearchText method not available');
    }
  }
  
  /**
   * Check if user is currently typing
   */
  isCurrentlyTyping(): boolean {
    return this.isUserTyping;
  }
  
  /**
   * Force clear typing state (for testing or special cases)
   */
  clearTypingState(): void {
    this.isUserTyping = false;
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }
}