/**
 * Manual test cases for input normalization
 * Run with: npx tsx src/agent/__tests__/input-normalizer.test.ts
 */

import { normalizeKeywords, normalizeMarket, normalizePositioning, normalizePipelineInput } from '../input-normalizer.js';

console.log('=== Input Normalizer Test Cases ===\n');

// Test 1: Phrase complète
console.log('Test 1: Phrase complète');
const test1 = normalizeKeywords(['je veux vendre des sacs de luxe pour femmes']);
console.log('Input: "je veux vendre des sacs de luxe pour femmes"');
console.log('Output:', test1);
console.log('Expected: ["bags", "luxury", "women"]');
console.log('✓ Pass:', JSON.stringify(test1) === JSON.stringify(['bags', 'luxury', 'women']));
console.log();

// Test 2: Typo simple
console.log('Test 2: Typo simple');
const test2 = normalizeKeywords(['chausure femme sport']);
console.log('Input: "chausure femme sport"');
console.log('Output:', test2);
console.log('Expected: includes "shoes", "women", "sports"');
console.log('✓ Pass:', test2.includes('shoes') && test2.includes('women') && test2.includes('sports'));
console.log();

// Test 3: Filler words
console.log('Test 3: Filler words');
const test3 = normalizeKeywords(['hey jveu des trucs gaming']);
console.log('Input: "hey jveu des trucs gaming"');
console.log('Output:', test3);
console.log('Expected: ["gaming"] (hey, jveu, des, trucs removed)');
console.log('✓ Pass:', test3.includes('gaming') && !test3.includes('hey') && !test3.includes('trucs') && !test3.includes('jveu'));
console.log();

// Test 4: Empty/nonsense input
console.log('Test 4: Empty/nonsense input');
const test4a = normalizeKeywords(['']);
const test4b = normalizeKeywords(['hey yo trucs']);
console.log('Input: ""');
console.log('Output:', test4a);
console.log('Expected: []');
console.log('✓ Pass:', test4a.length === 0);
console.log('Input: "hey yo trucs"');
console.log('Output:', test4b);
console.log('Expected: []');
console.log('✓ Pass:', test4b.length === 0);
console.log();

// Test 5: Market normalization (absent vs valid vs invalid)
console.log('Test 5: Market normalization (absent vs valid vs invalid)');
const marketAbsent = normalizeMarket();
const marketValid = normalizeMarket('france');
const marketInvalid = normalizeMarket('unknown');
console.log('Absent:', marketAbsent);
console.log('Valid (france):', marketValid);
console.log('Invalid (unknown):', marketInvalid);
console.log('✓ Pass:', 
  !marketAbsent.provided &&
  marketValid.provided && marketValid.valid && marketValid.value === 'FR' &&
  marketInvalid.provided && !marketInvalid.valid && marketInvalid.input === 'unknown'
);
console.log();

// Test 6: Positioning normalization (absent vs valid vs invalid)
console.log('Test 6: Positioning normalization (absent vs valid vs invalid)');
const posAbsent = normalizePositioning();
const posValid = normalizePositioning('luxe');
const posInvalid = normalizePositioning('unknown');
console.log('Absent:', posAbsent);
console.log('Valid (luxe):', posValid);
console.log('Invalid (unknown):', posInvalid);
console.log('✓ Pass:', 
  !posAbsent.provided &&
  posValid.provided && posValid.valid && posValid.value === 'premium' &&
  posInvalid.provided && !posInvalid.valid && posInvalid.input === 'unknown'
);
console.log();

// Test 7: Full pipeline input (valid)
console.log('Test 7: Full pipeline input (valid)');
const test7 = normalizePipelineInput({
  keywords: ['je veux vendre des montres de luxe pour homme'],
  market: 'france',
  positioning: 'haut de gamme',
});
console.log('Input:', {
  keywords: ['je veux vendre des montres de luxe pour homme'],
  market: 'france',
  positioning: 'haut de gamme',
});
console.log('Output:', test7);
console.log('Expected: { keywords: ["watches", "luxury", "men"], market: "FR", positioning: "premium" }');
console.log('✓ Pass:', 
  test7.keywords.includes('watches') && 
  test7.keywords.includes('luxury') && 
  test7.keywords.includes('men') &&
  test7.market === 'FR' && 
  test7.positioning === 'premium'
);
console.log();

// Test 8: Full pipeline input (absent = defaults applied)
console.log('Test 8: Full pipeline input (absent = defaults applied)');
const test8 = normalizePipelineInput({
  keywords: ['watches'],
  // market and positioning absent
});
console.log('Input:', { keywords: ['watches'] });
console.log('Output:', test8);
console.log('Expected: market="FR" (default), positioning="mid" (default)');
console.log('✓ Pass:', test8.market === 'FR' && test8.positioning === 'mid');
console.log();

// Test 9: Full pipeline input (invalid = error thrown)
console.log('Test 9: Full pipeline input (invalid = error thrown)');
try {
  normalizePipelineInput({
    keywords: ['watches'],
    market: 'unknown',
  });
  console.log('✗ Fail: Should have thrown error');
} catch (err) {
  console.log('Error thrown:', err instanceof Error ? err.message : err);
  console.log('✓ Pass: Error thrown for invalid market');
}
console.log();

// Test 10: Full pipeline input (invalid positioning = error thrown)
console.log('Test 10: Full pipeline input (invalid positioning = error thrown)');
try {
  normalizePipelineInput({
    keywords: ['watches'],
    positioning: 'unknown',
  });
  console.log('✗ Fail: Should have thrown error');
} catch (err) {
  console.log('Error thrown:', err instanceof Error ? err.message : err);
  console.log('✓ Pass: Error thrown for invalid positioning');
}
console.log();

console.log('=== All Tests Complete ===');
