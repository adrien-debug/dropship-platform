import { describe, expect, it } from 'vitest';
import { buildMedusaHandle, slugifyTitle } from './handle';

describe('slugifyTitle', () => {
  it('lowercases, strips accents, dashes separators', () => {
    expect(slugifyTitle('Café à emporter — édition limitée!')).toBe('cafe-a-emporter-edition-limitee');
  });

  it('caps at 60 chars', () => {
    const long = 'a'.repeat(100);
    expect(slugifyTitle(long).length).toBe(60);
  });

  it('handles already-clean ASCII', () => {
    expect(slugifyTitle('wireless earbuds pro')).toBe('wireless-earbuds-pro');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugifyTitle('  -hello-  ')).toBe('hello');
  });
});

describe('buildMedusaHandle', () => {
  it('combines slug + 8 chars of externalId + 6 chars of storeId', () => {
    const h = buildMedusaHandle({
      title: 'Wireless Earbuds Pro',
      externalId: '1005006789012345',
      storeId: 'aabbccdd-eeff-0011-2233-445566778899',
    });
    expect(h).toBe('wireless-earbuds-pro-10050067-aabbcc');
  });

  it('strips non-alphanumerics from externalId8 (slice → strip, not strip → slice)', () => {
    // slice(0, 8) on 'AE-100-50/06789' → 'AE-100-5', then strip → 'AE1005'.
    // This is the existing import convention; changing it would invalidate
    // every handle already in Medusa, so we lock it via test.
    const h = buildMedusaHandle({
      title: 'X',
      externalId: 'AE-100-50/06789',
      storeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
    expect(h).toBe('x-AE1005-aaaaaa');
  });

  it('survives short externalId', () => {
    const h = buildMedusaHandle({
      title: 'short',
      externalId: 'abc',
      storeId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
    expect(h).toBe('short-abc-aaaaaa');
  });
});
