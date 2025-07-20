import { describe, test, expect } from 'bun:test';
import { RequestMatcher } from '../src/matcher';

describe('Body reuse bug reproduction', () => {
  test('should handle multiple matches without "Body already used" error', async () => {
    const config = {}; // Default matching config
    const matcher = new RequestMatcher(config);

    // Create a request with a JSON body
    const request = new Request('https://api.example.com/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });

    // Create some recorded requests that will be checked for matches
    const recordedRequest1 = {
      method: 'POST',
      url: 'https://api.example.com/other',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ different: 'data' })
    };

    const recordedRequest2 = {
      method: 'POST',
      url: 'https://api.example.com/test',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    };

    // The bug occurs when matcher.matches() is called multiple times
    // because parseRequestBody() consumes the request body each time

    // First call - this should work
    const match1 = await matcher.matches(recordedRequest1, request);
    expect(match1).toBe(false); // Different URL

    // Second call - this should fail with "Body already used" without the fix
    const match2 = await matcher.matches(recordedRequest2, request);
    expect(match2).toBe(true); // Should match

    // Third call - to really stress test
    const match3 = await matcher.matches(recordedRequest2, request);
    expect(match3).toBe(true); // Should still match
  });

  test('should handle multiple parseRequestBody calls on same request', async () => {
    const { parseRequestBody } = await import('../src/utils');

    const request = new Request('https://api.example.com/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });

    // Without the fix, the second call would fail with "Body already used"
    const body1 = await parseRequestBody(request);
    expect(body1).toBe('{"test":"data"}');

    const body2 = await parseRequestBody(request);
    expect(body2).toBe('{"test":"data"}');

    const body3 = await parseRequestBody(request);
    expect(body3).toBe('{"test":"data"}');
  });
});
