import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { replayAPI } from '../src/index';
import { join } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

const TEST_DIR = join(process.cwd(), '.test-recordings');

describe('Filtered Recording', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await replayAPI.done().catch(() => {});
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  test('should only record headers specified in include.headers', async () => {
    await replayAPI.start('test-include-headers', {
      recordingsDir: TEST_DIR,
      include: {
        headers: ['content-type', 'x-custom-header']
      }
    });

    // Make a request with multiple headers
    await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        Authorization: 'Bearer token123',
        'User-Agent': 'test-agent'
      }
    });

    await replayAPI.done();

    // Read the recording file
    const recordingPath = join(TEST_DIR, 'test-include-headers.json');
    const recording = await Bun.file(recordingPath).json();

    // Check that only included headers were recorded
    const recordedHeaders = recording.calls[0].request.headers;
    expect(Object.keys(recordedHeaders).length).toBe(2);
    expect(recordedHeaders['content-type']).toBe('application/json');
    expect(recordedHeaders['x-custom-header']).toBe('custom-value');
    expect(recordedHeaders['authorization']).toBeUndefined();
    expect(recordedHeaders['user-agent']).toBeUndefined();
  });

  test('should record no headers by default', async () => {
    await replayAPI.start('test-default-no-headers', {
      recordingsDir: TEST_DIR
    });

    // Make a request with multiple headers
    await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        Authorization: 'Bearer token123',
        'User-Agent': 'test-agent'
      }
    });

    await replayAPI.done();

    // Read the recording file
    const recordingPath = join(TEST_DIR, 'test-default-no-headers.json');
    const recording = await Bun.file(recordingPath).json();

    // Check that no headers were recorded by default
    const recordedHeaders = recording.calls[0].request.headers;
    expect(Object.keys(recordedHeaders).length).toBe(0);
  });

  test('should exclude query parameters specified in exclude.query', async () => {
    await replayAPI.start('test-exclude-query', {
      recordingsDir: TEST_DIR,
      exclude: {
        query: ['timestamp', 'session']
      }
    });

    // Make a request with query parameters
    await fetch('https://jsonplaceholder.typicode.com/posts?userId=1&timestamp=12345&session=abc123');

    await replayAPI.done();

    // Read the recording file
    const recordingPath = join(TEST_DIR, 'test-exclude-query.json');
    const recording = await Bun.file(recordingPath).json();

    // Check that excluded query params were not recorded
    const recordedUrl = recording.calls[0].request.url;
    expect(recordedUrl).toContain('userId=1');
    expect(recordedUrl).not.toContain('timestamp=');
    expect(recordedUrl).not.toContain('session=');
  });

  test('should exclude body when exclude.body is true', async () => {
    await replayAPI.start('test-exclude-body', {
      recordingsDir: TEST_DIR,
      exclude: {
        body: true
      }
    });

    // Make a POST request with a body
    await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Test', body: 'Test body' })
    });

    await replayAPI.done();

    // Read the recording file
    const recordingPath = join(TEST_DIR, 'test-exclude-body.json');
    const recording = await Bun.file(recordingPath).json();

    // Check that body was not recorded
    expect(recording.calls[0].request.body).toBeNull();
  });

  test('should apply all filters together', async () => {
    await replayAPI.start('test-all-filters', {
      recordingsDir: TEST_DIR,
      include: {
        headers: ['content-type']
      },
      exclude: {
        query: ['timestamp'],
        body: true
      }
    });

    // Make a request with headers, query params, and body
    await fetch('https://jsonplaceholder.typicode.com/posts?userId=1&timestamp=12345', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123'
      },
      body: JSON.stringify({ title: 'Test' })
    });

    await replayAPI.done();

    // Read the recording file
    const recordingPath = join(TEST_DIR, 'test-all-filters.json');
    const recording = await Bun.file(recordingPath).json();

    const recordedRequest = recording.calls[0].request;

    // Check headers - only content-type should be included
    expect(Object.keys(recordedRequest.headers).length).toBe(1);
    expect(recordedRequest.headers['content-type']).toBe('application/json');
    expect(recordedRequest.headers['authorization']).toBeUndefined();

    // Check URL - timestamp should be excluded
    expect(recordedRequest.url).toContain('userId=1');
    expect(recordedRequest.url).not.toContain('timestamp=');

    // Check body - should be null
    expect(recordedRequest.body).toBeNull();
  });
});
