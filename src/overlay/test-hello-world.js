// ===================================================================
// HELLO WORLD OVERLAY TEST - Phase 1.1 Completion
// ===================================================================
// Simple test to verify the overlay system is working correctly
// Run this in the browser console after loading the extension
// ===================================================================

import { createHelloWorldOverlay, getSystemInfo } from './index.js';

/**
 * Tests the basic overlay functionality
 */
function testOverlaySystem() {
  console.log('🎯 Testing Overlay System v2.2.0');
  
  // Get system info
  const systemInfo = getSystemInfo();
  console.log('📊 System Info:', systemInfo);
  
  // Check if we're in a supported environment
  if (!systemInfo.supportsCustomElements) {
    console.warn('⚠️  Custom Elements not supported');
  }
  
  if (!systemInfo.supportsShadowDOM) {
    console.warn('⚠️  Shadow DOM not supported');
  }
  
  // Create the Hello World overlay
  console.log('🚀 Creating Hello World overlay...');
  
  try {
    const overlayId = createHelloWorldOverlay();
    console.log('✅ Hello World overlay created successfully!');
    console.log('📋 Overlay ID:', overlayId);
    
    // Test completed
    console.log('🎉 Phase 1.1 Infrastructure Test: PASSED');
    
    return {
      success: true,
      overlayId,
      systemInfo,
    };
    
  } catch (error) {
    console.error('❌ Hello World overlay creation failed:', error);
    console.log('💥 Phase 1.1 Infrastructure Test: FAILED');
    
    return {
      success: false,
      error: error.message,
      systemInfo,
    };
  }
}

/**
 * Console-friendly test runner
 */
window.testOverlaySystem = testOverlaySystem;

// Export for module usage
export { testOverlaySystem };

console.log('🔧 Overlay Test loaded. Run testOverlaySystem() in console to test.');