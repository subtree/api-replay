import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { replayAPI, ReplayResult } from '../src/index';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

function expectReplayed(result: ReplayResult) {
  expect(result.mode).toBe('replay');
  expect(result.wasReplayed).toBe(true);
}

function expectRecorded(result: ReplayResult) {
  expect(result.mode).toBe('record');
  expect(result.wasReplayed).toBe(false);
}

async function cleanupRecordings() {
  const recordingsDir = join(process.cwd(), '.api-replay');
  if (existsSync(recordingsDir)) {
    await rm(recordingsDir, { recursive: true });
  }
}

async function getRecordingFile(testName: string): Promise<any> {
  const recordingsDir = join(process.cwd(), '.api-replay');
  const filename = testName.replace(/\//g, '--').replace(/\s+/g, '-').toLowerCase() + '.json';
  const filepath = join(recordingsDir, filename);

  if (!existsSync(filepath)) {
    throw new Error(`Recording file not found: ${filepath}`);
  }

  const file = Bun.file(filepath);
  const content = await file.text();
  return JSON.parse(content);
}

describe('Response Headers Recording Tests', () => {
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

  test('default behavior - no response headers recorded', async () => {
    const testName = 'no-response-headers-default';

    // First run - record without header config
    await replayAPI.start(testName);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Check the recording file
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(1);
    expect(recording.calls[0].response.headers).toEqual({});

    // Second run - replay should work
    await replayAPI.start(testName);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('record all response headers with "*"', async () => {
    const testName = 'record-all-response-headers';
    const config = {
      recordResponseHeaders: '*' as const
    };

    // First run - record with all headers
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Check the recording file
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(1);
    const recordedHeaders = recording.calls[0].response.headers;

    // Should have common response headers
    expect(recordedHeaders).toHaveProperty('content-type');
    expect(recordedHeaders['content-type']).toContain('application/json');
    expect(Object.keys(recordedHeaders).length).toBeGreaterThan(0);

    // Second run - replay should work
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('record specific response headers only', async () => {
    const testName = 'record-specific-response-headers';
    const config = {
      recordResponseHeaders: ['content-type', 'x-custom-header']
    };

    // First run - record with specific headers
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Check the recording file
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(1);
    const recordedHeaders = recording.calls[0].response.headers;

    // Should only have content-type (x-custom-header won't be present in this API)
    expect(recordedHeaders).toHaveProperty('content-type');
    expect(recordedHeaders).not.toHaveProperty('date');
    expect(recordedHeaders).not.toHaveProperty('server');

    // Should only have the headers we requested
    const headerKeys = Object.keys(recordedHeaders);
    expect(headerKeys.every((key) => ['content-type', 'x-custom-header'].includes(key))).toBe(true);

    // Second run - replay should work
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('case-insensitive response header filtering', async () => {
    const testName = 'case-insensitive-response-headers';
    const config = {
      recordResponseHeaders: ['Content-Type', 'X-Custom-Header']
    };

    // First run - record with mixed case header names
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Check the recording file
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(1);
    const recordedHeaders = recording.calls[0].response.headers;

    // Should have content-type (stored in lowercase)
    expect(recordedHeaders).toHaveProperty('content-type');

    // Headers should be stored in lowercase
    const headerKeys = Object.keys(recordedHeaders);
    expect(headerKeys.every((key) => key === key.toLowerCase())).toBe(true);

    // Second run - replay should work
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('combined request and response header config', async () => {
    const testName = 'combined-request-response-headers';
    const config = {
      include: { headers: ['authorization'] },
      recordResponseHeaders: ['content-type', 'x-api-version']
    };

    // First run - record with both request and response header config
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        authorization: 'Bearer token123',
        'user-agent': 'test-client'
      }
    });
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Check the recording file
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(1);

    // Request headers should only include authorization
    expect(recording.calls[0].request.headers).toEqual({
      authorization: 'Bearer token123'
    });

    // Response headers should only include content-type
    const responseHeaders = recording.calls[0].response.headers;
    expect(responseHeaders).toHaveProperty('content-type');
    expect(responseHeaders).not.toHaveProperty('date');

    // Second run - replay should work with same auth header
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        authorization: 'Bearer token123',
        'user-agent': 'different-client'
      }
    });
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('empty array for recordResponseHeaders means no headers', async () => {
    const testName = 'empty-array-response-headers';
    const config = {
      recordResponseHeaders: []
    };

    // First run - record with empty array
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Check the recording file
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(1);
    expect(recording.calls[0].response.headers).toEqual({});

    // Second run - replay should work
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });
});
