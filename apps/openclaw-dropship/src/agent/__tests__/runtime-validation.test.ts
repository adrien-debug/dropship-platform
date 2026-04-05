/**
 * Runtime validation test for pipeline and tools
 * Run with: npx tsx src/agent/__tests__/runtime-validation.test.ts
 */

import { runFastPipeline } from '../fast-pipeline.js';
import { createToolRegistry, getToolHandler } from '../tools.js';

console.log('=== Runtime Validation Test Cases ===\n');

// Test 1: Pipeline with invalid market
console.log('Test 1: Pipeline with invalid market');
(async () => {
  const result = await runFastPipeline({
    keywords: ['watches'],
    market: 'unknown' as any, // intentionally invalid for test
    positioning: 'mid',
  });
  
  console.log('Result:', {
    success: result.success,
    hasEvents: result.events.length > 0,
    errorEvent: result.events.find(e => e.step === 'input_validation'),
  });
  
  const hasValidationError = result.events.some(e => 
    e.step === 'input_validation' && 
    e.status === 'error' &&
    typeof e.detail === 'string' &&
    e.detail.includes('Invalid market value')
  );
  
  console.log('✓ Pass:', !result.success && hasValidationError);
  console.log();
  
  // Test 2: Pipeline with invalid positioning
  console.log('Test 2: Pipeline with invalid positioning');
  const result2 = await runFastPipeline({
    keywords: ['watches'],
    market: 'FR',
    positioning: 'unknown' as any, // intentionally invalid for test
  });
  
  console.log('Result:', {
    success: result2.success,
    hasEvents: result2.events.length > 0,
    errorEvent: result2.events.find(e => e.step === 'input_validation'),
  });
  
  const hasValidationError2 = result2.events.some(e => 
    e.step === 'input_validation' && 
    e.status === 'error' &&
    typeof e.detail === 'string' &&
    e.detail.includes('Invalid positioning value')
  );
  
  console.log('✓ Pass:', !result2.success && hasValidationError2);
  console.log();
  
  // Test 3: Pipeline with valid inputs (should not fail at validation)
  console.log('Test 3: Pipeline with valid inputs (no validation error)');
  const result3 = await runFastPipeline({
    keywords: ['watches'],
    market: 'france' as any, // normalized to FR
    positioning: 'luxe' as any, // normalized to premium
  });
  
  const hasValidationError3 = result3.events.some(e => e.step === 'input_validation' && e.status === 'error');
  
  console.log('Result:', {
    hasValidationError: hasValidationError3,
    firstEvent: result3.events[0]?.step,
  });
  console.log('✓ Pass:', !hasValidationError3 && result3.events[0]?.step === 'pipeline_start');
  console.log();
  
  // Test 4: Tool handler with invalid market
  console.log('Test 4: Tool handler (generate_site_content) with invalid market');
  const registry = createToolRegistry();
  const handler = getToolHandler(registry, 'generate_site_content');
  
  if (handler) {
    try {
      await handler({
        niche: 'watches',
        market: 'unknown',
        positioning: 'mid',
      });
      console.log('✗ Fail: Should have thrown error');
    } catch (err) {
      console.log('Error thrown:', err instanceof Error ? err.message : err);
      console.log('✓ Pass:', err instanceof Error && err.message.includes('Invalid market value'));
    }
  }
  console.log();
  
  // Test 5: Tool handler with invalid positioning
  console.log('Test 5: Tool handler (generate_site_content) with invalid positioning');
  if (handler) {
    try {
      await handler({
        niche: 'watches',
        market: 'FR',
        positioning: 'unknown',
      });
      console.log('✗ Fail: Should have thrown error');
    } catch (err) {
      console.log('Error thrown:', err instanceof Error ? err.message : err);
      console.log('✓ Pass:', err instanceof Error && err.message.includes('Invalid positioning value'));
    }
  }
  console.log();
  
  console.log('=== All Runtime Tests Complete ===');
})();
