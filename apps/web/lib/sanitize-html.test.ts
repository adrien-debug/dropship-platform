import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from './sanitize-html';

describe('sanitizeRichText', () => {
  it('keeps allowed tags', () => {
    expect(sanitizeRichText('<em>hi</em>')).toBe('<em>hi</em>');
    expect(sanitizeRichText('<strong>bold</strong>')).toBe('<strong>bold</strong>');
  });
  it('strips script tag', () => {
    expect(sanitizeRichText('<script>alert(1)</script>hi')).toBe('hi');
  });
  it('strips img onerror', () => {
    const out = sanitizeRichText('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('<img');
  });
  it('strips attributes from allowed tags', () => {
    expect(sanitizeRichText('<em style="color:red" onclick="x()">hi</em>')).toBe('<em>hi</em>');
  });
  it('handles null/undefined', () => {
    expect(sanitizeRichText(null)).toBe('');
    expect(sanitizeRichText(undefined)).toBe('');
  });
  it('preserves nested allowed', () => {
    expect(sanitizeRichText('<em>a<strong>b</strong>c</em>')).toBe('<em>a<strong>b</strong>c</em>');
  });
});
