import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { replayAPI } from '../src/index';
import { Replayer } from '../src/replayer';
import { RequestMatcher } from '../src/matcher';
import { join } from 'node:path';
import { rmSync, existsSync } from 'node:fs';

const RECORDINGS_DIR = './test-recordings-search-details';

// Test the exact issue reported: search details should not include headers when they are not considered for matching
describe('Search Details Filtering', () => {
  beforeEach(() => {
    // Clean up before each test
    if (existsSync(RECORDINGS_DIR)) {
      rmSync(RECORDINGS_DIR, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    try {
      await replayAPI.done();
    } catch {
      // Ignore errors if not active
    }

    // Clean up after each test
    if (existsSync(RECORDINGS_DIR)) {
      rmSync(RECORDINGS_DIR, { recursive: true, force: true });
    }
  });

  test('should not include headers in search details when headers not considered for matching', async () => {
    // Test the replayer directly to verify search details filtering
    const replayer = new Replayer(RECORDINGS_DIR, {
      // No include.headers specified, so headers should not be considered for matching
    });
    const matcher = new RequestMatcher({});

    // Create a mock recording file with some data
    replayer['recordingFile'] = {
      meta: { recordedAt: '2024-01-01T00:00:00Z', testName: 'test', replayAPIVersion: '1.0.0' },
      calls: [
        {
          request: { method: 'GET', url: 'https://example.com/api', headers: {}, body: null },
          response: { status: 200, headers: {}, body: '{}' }
        }
      ]
    };

    // Create a request that won't match due to different URL and method
    const request = new Request('https://different.com/api', {
      method: 'POST', // Different method to ensure no match
      headers: { 'x-authorization': 'secret-token', 'x-test': 'value' }
    });

    const result = await replayer.findMatchingCall(request, matcher);

    // Should not find a match and return search details
    expect(result.call).toBeNull();
    expect(result.searchDetails).toBeDefined();

    // Headers should NOT be present in search details since they're not configured for matching
    expect(result.searchDetails!.headers).toBeUndefined();
    expect(result.searchDetails!.method).toBe('POST');
    expect(result.searchDetails!.url).toBe('https://different.com/api');
  });

  test('should include headers in search details when explicitly configured for matching', async () => {
    // Test the replayer directly with headers configured for matching
    const replayer = new Replayer(RECORDINGS_DIR, {
      include: {
        headers: ['x-custom-header']
      }
    });
    const matcher = new RequestMatcher({
      include: {
        headers: ['x-custom-header']
      }
    });

    // Create a mock recording file
    replayer['recordingFile'] = {
      meta: { recordedAt: '2024-01-01T00:00:00Z', testName: 'test', replayAPIVersion: '1.0.0' },
      calls: [
        {
          request: {
            method: 'GET',
            url: 'https://example.com/api',
            headers: { 'x-custom-header': 'original' },
            body: null
          },
          response: { status: 200, headers: {}, body: '{}' }
        }
      ]
    };

    // Create a request that won't match due to different URL
    const request = new Request('https://different.com/api', {
      headers: { 'x-custom-header': 'different-value', 'x-other': 'ignored' }
    });

    const result = await replayer.findMatchingCall(request, matcher);

    // Should not find a match and return search details
    expect(result.call).toBeNull();
    expect(result.searchDetails).toBeDefined();

    // Headers SHOULD be present since they're explicitly configured for matching
    expect(result.searchDetails!.headers).toBeDefined();
    expect(result.searchDetails!.headers!['x-custom-header']).toBe('different-value');
    // Other headers not configured for matching should be excluded
    expect(result.searchDetails!.headers!['x-other']).toBeUndefined();
  });

  test('should not include body in search details when body excluded from matching', async () => {
    // Test the replayer directly with body exclusion
    const replayer = new Replayer(RECORDINGS_DIR, {
      exclude: {
        body: true
      }
    });
    const matcher = new RequestMatcher({
      exclude: {
        body: true
      }
    });

    // Create a mock recording file
    replayer['recordingFile'] = {
      meta: { recordedAt: '2024-01-01T00:00:00Z', testName: 'test', replayAPIVersion: '1.0.0' },
      calls: [
        {
          request: { method: 'POST', url: 'https://example.com/api', headers: {}, body: 'original body' },
          response: { status: 200, headers: {}, body: '{}' }
        }
      ]
    };

    // Create a request that won't match due to different method
    const request = new Request('https://example.com/api', {
      method: 'GET', // Different method from recorded POST
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sensitive: 'data' })
    });

    const result = await replayer.findMatchingCall(request, matcher);

    // Should not find a match and return search details
    expect(result.call).toBeNull();
    expect(result.searchDetails).toBeDefined();

    // Body should NOT be present in search details since it's excluded from matching
    expect(result.searchDetails!.body).toBeUndefined();
    expect(result.searchDetails!.method).toBe('GET');
  });

  test('should filter query parameters in search details based on exclude config', async () => {
    // Test the replayer directly with query parameter exclusion
    const replayer = new Replayer(RECORDINGS_DIR, {
      exclude: {
        query: ['timestamp', 'session_id']
      }
    });
    const matcher = new RequestMatcher({
      exclude: {
        query: ['timestamp', 'session_id']
      }
    });

    // Create a mock recording file
    replayer['recordingFile'] = {
      meta: { recordedAt: '2024-01-01T00:00:00Z', testName: 'test', replayAPIVersion: '1.0.0' },
      calls: [
        {
          request: { method: 'GET', url: 'https://example.com/api?page=1', headers: {}, body: null },
          response: { status: 200, headers: {}, body: '{}' }
        }
      ]
    };

    // Create a request that won't match due to different method
    const request = new Request('https://example.com/api?page=1&timestamp=456&session_id=xyz', {
      method: 'POST' // Different method to ensure no match
    });

    const result = await replayer.findMatchingCall(request, matcher);

    // Should not find a match and return search details
    expect(result.call).toBeNull();
    expect(result.searchDetails).toBeDefined();

    // Search details should include queryParams but exclude the filtered ones
    expect(result.searchDetails!.queryParams.page).toBe('1');

    // Excluded parameters should NOT be present in search details
    expect(result.searchDetails!.queryParams.timestamp).toBeUndefined();
    expect(result.searchDetails!.queryParams.session_id).toBeUndefined();
  });

  test('should include body in search details when body is considered for matching', async () => {
    // Test the replayer directly with body considered for matching (default behavior)
    const replayer = new Replayer(RECORDINGS_DIR, {
      // No exclude.body specified, so body is considered for matching
    });
    const matcher = new RequestMatcher({});

    // Create a mock recording file
    replayer['recordingFile'] = {
      meta: { recordedAt: '2024-01-01T00:00:00Z', testName: 'test', replayAPIVersion: '1.0.0' },
      calls: [
        {
          request: { method: 'POST', url: 'https://example.com/api', headers: {}, body: 'original body' },
          response: { status: 200, headers: {}, body: '{}' }
        }
      ]
    };

    // Create a request that won't match due to different URL
    const request = new Request('https://different.com/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });

    const result = await replayer.findMatchingCall(request, matcher);

    // Should not find a match and return search details
    expect(result.call).toBeNull();
    expect(result.searchDetails).toBeDefined();

    // Body SHOULD be present in search details since it's considered for matching
    expect(result.searchDetails!.body).toBeDefined();
    expect(result.searchDetails!.body).toContain('test');
  });
});
