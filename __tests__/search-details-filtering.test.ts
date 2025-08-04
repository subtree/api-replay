import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { replayAPI } from '../src/index';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

async function cleanupRecordings() {
  const recordingsDir = join(process.cwd(), '.api-replay');
  if (existsSync(recordingsDir)) {
    await rm(recordingsDir, { recursive: true });
  }
}

describe('Search Details Filtering Tests', () => {
  beforeEach(async () => {
    await cleanupRecordings();
  });

  afterEach(async () => {
    try {
      await replayAPI.done();
    } catch {
      // Ignore if already done
    }
  });

  test('search details should not include headers when headers are not considered for matching', async () => {
    const testName = 'search-details-headers-excluded';

    // No headers included in matching config, so headers should not be matched
    const config = {};

    // First run - record with some headers
    await replayAPI.start(testName, config);
    await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        accept: 'application/json',
        'x-authorization': 'Bearer token123'
      }
    });
    await replayAPI.done();

    // Second run - try to replay with different URL to trigger search details
    await replayAPI.start(testName, config);

    let errorMessage = '';
    try {
      // This should fail to match and show search details
      await fetch('https://jsonplaceholder.typicode.com/posts/2', {
        headers: {
          accept: 'application/json',
          'x-authorization': 'Bearer token456'
        }
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    await replayAPI.done();

    // The error should contain search details
    expect(errorMessage).toContain('No matching recorded call found');
    expect(errorMessage).toContain('Search details:');

    // FIX: Headers should NOT be included in search details when not considered for matching
    expect(errorMessage).not.toContain('"headers"');
    expect(errorMessage).not.toContain('"x-authorization"');
  });

  test('search details should include headers when headers are explicitly included for matching', async () => {
    const testName = 'search-details-headers-included';

    // Headers are explicitly included in matching config
    const config = {
      include: { headers: ['x-authorization'] }
    };

    // First run - record with some headers
    await replayAPI.start(testName, config);
    await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        accept: 'application/json',
        'x-authorization': 'Bearer token123'
      }
    });
    await replayAPI.done();

    // Second run - try to replay with different URL to trigger search details
    await replayAPI.start(testName, config);

    let errorMessage = '';
    try {
      // This should fail to match and show search details
      await fetch('https://jsonplaceholder.typicode.com/posts/2', {
        headers: {
          accept: 'application/json',
          'x-authorization': 'Bearer token456'
        }
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    await replayAPI.done();

    // The error should contain search details with headers since they're considered for matching
    expect(errorMessage).toContain('No matching recorded call found');
    expect(errorMessage).toContain('Search details:');
    expect(errorMessage).toContain('"headers"');
    expect(errorMessage).toContain('"x-authorization"');
  });

  test('search details should not include body when body is excluded from matching', async () => {
    const testName = 'search-details-body-excluded';

    // Body is explicitly excluded from matching
    const config = {
      exclude: { body: true }
    };

    // First run - record with a body
    await replayAPI.start(testName, config);
    await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Test Post', content: 'Test content' })
    });
    await replayAPI.done();

    // Second run - try to replay with different URL to trigger search details
    await replayAPI.start(testName, config);

    let errorMessage = '';
    try {
      // This should fail to match and show search details
      await fetch('https://jsonplaceholder.typicode.com/posts/999', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Different Post', content: 'Different content' })
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    await replayAPI.done();

    // The error should contain search details but NOT include body since it's excluded from matching
    expect(errorMessage).toContain('No matching recorded call found');
    expect(errorMessage).toContain('Search details:');
    expect(errorMessage).not.toContain('"body"');
  });

  test('search details should include query params but filter out excluded ones', async () => {
    const testName = 'search-details-query-filtered';

    // Some query params are excluded from matching
    const config = {
      exclude: { query: ['timestamp', 'nonce'] }
    };

    // First run - record with query params
    await replayAPI.start(testName, config);
    await fetch('https://jsonplaceholder.typicode.com/posts/1?userId=123&timestamp=1234567890&nonce=abc123');
    await replayAPI.done();

    // Second run - try to replay with different URL to trigger search details
    await replayAPI.start(testName, config);

    let errorMessage = '';
    try {
      // This should fail to match and show search details
      await fetch('https://jsonplaceholder.typicode.com/posts/2?userId=456&timestamp=9876543210&nonce=xyz789');
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    await replayAPI.done();

    // The error should contain search details with queryParams but without excluded ones
    expect(errorMessage).toContain('No matching recorded call found');
    expect(errorMessage).toContain('Search details:');
    expect(errorMessage).toContain('"userId"'); // This should be included
    expect(errorMessage).not.toContain('"timestamp"'); // This should be excluded
    expect(errorMessage).not.toContain('"nonce"'); // This should be excluded
  });
});
