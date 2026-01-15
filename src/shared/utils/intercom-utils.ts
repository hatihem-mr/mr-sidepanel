/**
 * Utility functions for extracting information from Intercom pages
 */

/**
 * Extract contact name from Intercom conversation page
 * Based on the patterns from the original extension
 */
export async function getContactName(tabId: number): Promise<string | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Look for the contact name using the specific Intercom structure
        const nameElement = document.querySelector('span[data-conversation-title]');
        if (nameElement && nameElement.textContent?.trim()) {
          return nameElement.textContent.trim();
        }
        
        // Fallback selectors if the first one doesn't work
        const fallbackSelectors = [
          'span.truncate[data-conversation-title]',
          '[data-conversation-title]',
          '.conversation-header span.truncate',
          '[class*="conversation-title"]'
        ];
        
        for (const selector of fallbackSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent?.trim() && 
              !element.textContent.toLowerCase().includes('inbox') &&
              !element.textContent.toLowerCase().includes('conversation')) {
            return element.textContent.trim();
          }
        }
        
        return null;
      }
    });
    
    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
  } catch (error) {
    console.log('Could not extract contact name:', error);
  }
  return null;
}

/**
 * Check if current tab is an Intercom conversation page
 */
export function isIntercomPage(url: string): boolean {
  return url.includes('intercom.com') || url.includes('intercom.io');
}

/**
 * Get current active tab and extract contact name if it's Intercom
 */
export async function getCurrentContactName(): Promise<string | null> {
  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!currentTab?.url || !currentTab.id) {
      return null;
    }
    
    if (!isIntercomPage(currentTab.url)) {
      return null;
    }
    
    return await getContactName(currentTab.id);
  } catch (error) {
    console.log('Failed to get current contact name:', error);
    return null;
  }
}

/**
 * Extract conversation text from Intercom conversation page
 * Based on the DOM structure with customer vs agent detection
 */
export async function extractConversationText(tabId?: number): Promise<string> {
  try {
    const [tab] = tabId ? [{ id: tabId }] : await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error('No active tab');

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        
        // Find the conversation stream container
        const conversationStream = document.querySelector('[data-conversation-stream]');
        if (!conversationStream) {
          return '';
        }
        
        // Extract individual message groups
        const messageGroups = Array.from(conversationStream.querySelectorAll('[data-part-group-id]'));
        
        if (messageGroups.length === 0) {
          return '';
        }
        
        // Process messages and determine sender
        const messages = messageGroups
          .slice(-20) // Last 20 messages for token limit
          .map((messageGroup, index) => {
            const messageText = messageGroup.textContent?.trim();
            if (!messageText || messageText.length < 5) {
              return null;
            }
            
            // Determine if it's customer or agent based on avatar
            const avatar = messageGroup.querySelector('.inbox2__avatar');
            let sender = 'Unknown';
            
            if (avatar) {
              const style = avatar.getAttribute('style') || '';
              if (style.includes('background-image')) {
                sender = 'Agent';
              } else if (style.includes('background-color')) {
                sender = 'Customer';
              }
            }
            
            return `${sender}: ${messageText}`;
          })
          .filter(message => message !== null);
        
        const finalConversation = messages.join('\n\n');
        
        return finalConversation;
      }
    });

    const conversationText = results[0]?.result || '';
    
    return conversationText;
  } catch (error) {
    console.warn('Failed to extract conversation context:', error);
    return '';
  }
}