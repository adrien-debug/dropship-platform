import { describe, expect, it } from 'vitest';
import { extractJson } from './json';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('strips ```json fence', () => {
    const input = '```json\n{"hello": "world"}\n```';
    expect(extractJson<{ hello: string }>(input)).toEqual({ hello: 'world' });
  });

  it('strips bare ``` fence', () => {
    const input = '```\n{"n": 42}\n```';
    expect(extractJson<{ n: number }>(input)).toEqual({ n: 42 });
  });

  it('extracts JSON from surrounding prose', () => {
    const input = 'Sure thing! Here is the result:\n\n{"ok": true, "items": [1,2,3]}\n\nLet me know if you need more.';
    expect(extractJson(input)).toEqual({ ok: true, items: [1, 2, 3] });
  });

  it('returns the first balanced object when multiple are present', () => {
    const input = '{"first": 1} and then {"second": 2}';
    expect(extractJson(input)).toEqual({ first: 1 });
  });

  it('respects braces inside string literals', () => {
    const input = 'preamble {"text": "this string has } a closing brace inside", "n": 7} trailing';
    expect(extractJson(input)).toEqual({
      text: 'this string has } a closing brace inside',
      n: 7,
    });
  });

  it('returns null on null / empty / non-string input', () => {
    expect(extractJson(null)).toBeNull();
    expect(extractJson(undefined)).toBeNull();
    expect(extractJson('')).toBeNull();
  });

  it('returns null when no JSON object is present', () => {
    expect(extractJson('I am unable to help with that.')).toBeNull();
  });

  it('returns null on malformed JSON without a balanced fallback', () => {
    expect(extractJson('{"unterminated": ')).toBeNull();
  });

  it('handles nested objects', () => {
    const input = '```json\n{"a": {"b": {"c": 1}}, "d": [1,2,3]}\n```';
    expect(extractJson(input)).toEqual({ a: { b: { c: 1 } }, d: [1, 2, 3] });
  });

  it('handles escaped quotes in strings', () => {
    const input = '{"msg": "he said \\"hi\\""}';
    expect(extractJson<{ msg: string }>(input)).toEqual({ msg: 'he said "hi"' });
  });
});
