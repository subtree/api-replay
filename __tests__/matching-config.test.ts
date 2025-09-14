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

describe('Matching Configuration Tests', () => {
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

  test('include specific headers only - matches when included headers match', async () => {
    const testName = 'include-headers-match';
    const config = {
      include: { headers: ['authorization', 'content-type'] }
    };

    // First run - record
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        authorization: 'Bearer token123',
        'content-type': 'application/json',
        'x-random': 'should-be-ignored'
      }
    });
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Second run - replay with same included headers, different excluded ones
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        authorization: 'Bearer token123',
        'content-type': 'application/json',
        'x-random': 'different-value',
        'x-another': 'new-header'
      }
    });
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('include specific headers only - fails when included headers differ', async () => {
    const testName = 'include-headers-differ';
    const config = {
      include: { headers: ['authorization'] }
    };

    // First run - record
    await replayAPI.start(testName, config);
    await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: { authorization: 'Bearer token123' }
    });
    await replayAPI.done();

    // Second run - try to replay with different included header
    await replayAPI.start(testName, config);

    // Should make actual HTTP call when headers don't match
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: { authorization: 'Bearer differenttoken' }
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.id).toBe(1);

    await replayAPI.done();
  });

  test('exclude query parameters - allows different values for excluded params', async () => {
    const testName = 'exclude-query-params';
    const config = {
      exclude: { query: ['timestamp', 'sessionId'] }
    };

    // First run - record
    await replayAPI.start(testName, config);
    const response1 = await fetch(
      'https://jsonplaceholder.typicode.com/posts/1?timestamp=123&sessionId=abc&userId=456'
    );
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Second run - replay with different excluded params but same included ones
    await replayAPI.start(testName, config);
    const response2 = await fetch(
      'https://jsonplaceholder.typicode.com/posts/1?timestamp=999&sessionId=xyz&userId=456'
    );
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('exclude query parameters - fails when non-excluded params differ', async () => {
    const testName = 'exclude-query-fails';
    const config = {
      exclude: { query: ['timestamp'] }
    };

    // First run - record
    await replayAPI.start(testName, config);
    await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=123&userId=456');
    await replayAPI.done();

    // Second run - try to replay with different non-excluded param
    await replayAPI.start(testName, config);

    // Should make actual HTTP call when non-excluded query params differ
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=999&userId=789');

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.id).toBe(1);

    await replayAPI.done();
  });

  test('exclude request body - matches regardless of body differences', async () => {
    const testName = 'exclude-body';
    const config = {
      exclude: { body: true }
    };

    // First run - record POST with body
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Original Post', body: 'Original content' })
    });
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Second run - replay with completely different body
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Different Post', body: 'Different content', userId: 999 })
    });
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('combined include/exclude configuration', async () => {
    const testName = 'combined-config';
    const config = {
      include: { headers: ['authorization'] },
      exclude: {
        headers: ['user-agent', 'accept-encoding'],
        query: ['timestamp'],
        body: false // Explicitly include body matching
      }
    };

    // First run - record
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token123',
        'user-agent': 'test-agent-1',
        'accept-encoding': 'gzip',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ title: 'Test Post' })
    });
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Second run - replay with same auth and body, different excluded headers
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token123',
        'user-agent': 'test-agent-2',
        'accept-encoding': 'deflate, gzip',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ title: 'Test Post' })
    });
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('demonstrate replay matching with timestamp exclusion', async () => {
    const testName = 'demonstrate-matching';
    const config = {
      exclude: {
        query: ['timestamp', 'nonce'],
        headers: ['x-request-id']
      }
    };

    // First run - record a single call
    await replayAPI.start(testName, config);

    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=1234567890&nonce=abc123', {
      headers: { 'x-request-id': 'req-001' }
    });
    const data1 = await response1.json();

    const result1 = await replayAPI.done();
    expectRecorded(result1);

    // Verify one call was recorded
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(1);

    // Second run - replay should work for different timestamp/nonce variations
    await replayAPI.start(testName, config);

    // This should match the recorded call despite different excluded params
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=9876543210&nonce=xyz789', {
      headers: { 'x-request-id': 'req-002' }
    });
    const data2 = await response2.json();

    // This should also match the same recorded call
    const response3 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=5555555555&nonce=newvalue', {
      headers: { 'x-request-id': 'req-003' }
    });
    const data3 = await response3.json();

    const result2 = await replayAPI.done();
    expectReplayed(result2);

    // All responses should be identical (replayed from the same recorded call)
    expect(data2).toEqual(data1);
    expect(data3).toEqual(data1);
  });

  test('multiple similar requests create multiple recordings', async () => {
    const testName = 'multiple-recordings';

    // First run - record multiple similar calls (no exclusion config)
    await replayAPI.start(testName);

    // Make two calls with different timestamps - these will create separate recordings
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=1111');
    const data1 = await response1.json();

    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=2222');
    const data2 = await response2.json();

    const result1 = await replayAPI.done();
    expectRecorded(result1);

    // Verify both calls were recorded as separate entries
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(2);
    expect(data1).toEqual(data2); // Same endpoint returns same data

    // Second run - replay with exact matches
    await replayAPI.start(testName);

    const response3 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=1111');
    const data3 = await response3.json();

    const response4 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=2222');
    const data4 = await response4.json();

    const result2 = await replayAPI.done();
    expectReplayed(result2);

    expect(data3).toEqual(data1);
    expect(data4).toEqual(data2);
  });

  test('case-insensitive header matching', async () => {
    const testName = 'case-insensitive-headers';
    const config = {
      include: { headers: ['Authorization', 'Content-Type'] }
    };

    // First run - record with mixed case headers
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Test' })
    });
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Second run - replay with different case headers
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        authorization: 'Bearer token123', // lowercase
        'content-type': 'application/json' // lowercase
      },
      body: JSON.stringify({ title: 'Test' })
    });
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('exclude body but include headers - complex scenario', async () => {
    const testName = 'exclude-body-include-headers';
    const config = {
      include: { headers: ['x-api-key'] },
      exclude: { body: true }
    };

    // First run - record
    await replayAPI.start(testName, config);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        'x-api-key': 'secret123',
        'content-type': 'application/json',
        'user-agent': 'test-client'
      },
      body: JSON.stringify({ title: 'Original', content: 'Original content' })
    });
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);

    // Second run - replay with same API key but different body and other headers
    await replayAPI.start(testName, config);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        'x-api-key': 'secret123',
        'content-type': 'application/xml',
        'user-agent': 'different-client'
      },
      body: JSON.stringify({ title: 'Completely Different', content: 'Different content', extra: 'field' })
    });
    const data2 = await response2.json();
    const result2 = await replayAPI.done();

    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('different hostnames should not match (hostname matching bug reproduction)', async () => {
    const testName = 'hostname-matching-bug';

    // First run - record requests to different domains
    await replayAPI.start(testName);

    const response1 = await fetch('https://jsonplaceholder.typicode.com/');
    const data1 = await response1.json();

    // This should NOT match the previous request because hostname is different
    const response2 = await fetch('https://httpbin.org/');
    const data2 = await response2.json();

    const result1 = await replayAPI.done();
    expectRecorded(result1);

    // The responses should be different because they come from different services
    expect(data2).not.toEqual(data1);

    // Verify we have 2 recordings for different hostnames
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(2);

    // Second run - replay should work for exact matches
    await replayAPI.start(testName);

    // These should replay from the recorded calls
    const response3 = await fetch('https://jsonplaceholder.typicode.com/');
    const data3 = await response3.json();

    const response4 = await fetch('https://httpbin.org/');
    const data4 = await response4.json();

    const result2 = await replayAPI.done();
    expectReplayed(result2);

    // Replayed responses should match original recorded responses
    expect(data3).toEqual(data1);
    expect(data4).toEqual(data2);
  });
});
