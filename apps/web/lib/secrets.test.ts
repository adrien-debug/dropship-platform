import { describe, expect, it, beforeAll } from 'vitest';
import { encryptSecret, decryptSecret, tryDecryptSecret, secretsConfigured } from './secrets';

const TEST_KEY_B64 = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='; // 32 bytes 0..31

describe('secrets', () => {
  beforeAll(() => {
    process.env.STORE_SECRETS_KEY = TEST_KEY_B64;
  });

  it('round-trips a value', () => {
    const { encrypted, nonce } = encryptSecret('EAACPa...token-with-special/chars=');
    expect(encrypted.length).toBeGreaterThan(16);
    expect(nonce.length).toBe(12);
    const back = decryptSecret(encrypted, nonce);
    expect(back).toBe('EAACPa...token-with-special/chars=');
  });

  it('produces a different nonce per call', () => {
    const a = encryptSecret('same');
    const b = encryptSecret('same');
    expect(a.nonce.equals(b.nonce)).toBe(false);
    expect(a.encrypted.equals(b.encrypted)).toBe(false);
  });

  it('rejects empty plaintext', () => {
    expect(() => encryptSecret('')).toThrow();
  });

  it('detects tampering via auth tag', () => {
    const { encrypted, nonce } = encryptSecret('payload');
    const tampered = Buffer.from(encrypted);
    tampered[0] ^= 0x01;
    expect(() => decryptSecret(tampered, nonce)).toThrow();
  });

  it('tryDecryptSecret returns null on null inputs', () => {
    expect(tryDecryptSecret(null, null)).toBeNull();
    expect(tryDecryptSecret(undefined, undefined)).toBeNull();
  });

  it('tryDecryptSecret returns null on tampered ciphertext', () => {
    const { encrypted, nonce } = encryptSecret('payload');
    const tampered = Buffer.from(encrypted);
    tampered[0] ^= 0x01;
    expect(tryDecryptSecret(tampered, nonce)).toBeNull();
  });

  it('secretsConfigured is true with a 32-byte key', () => {
    expect(secretsConfigured()).toBe(true);
  });
});
