import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { replayAPI, ReplayResult } from '../src/index';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

function expectRecorded(result: ReplayResult) {
  expect(result.mode).toBe('record');
  expect(result.wasReplayed).toBe(false);
}

async function cleanupRecordings() {
  const recordingsDir = join(process.cwd(), 'apirecordings');
  if (existsSync(recordingsDir)) {
    await rm(recordingsDir, { recursive: true });
  }
}

async function getRecordingFile(testName: string): Promise<any> {
  const recordingsDir = join(process.cwd(), 'apirecordings');
  const filename = testName.replace(/\//g, '--').replace(/\s+/g, '-').toLowerCase() + '.json';
  const filepath = join(recordingsDir, filename);
  
  if (!existsSync(filepath)) {
    throw new Error(`Recording file not found: ${filepath}`);
  }
  
  const file = Bun.file(filepath);
  const content = await file.text();
  return JSON.parse(content);
}

describe('Request Deduplication During Recording', () => {
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

  test('prevents duplicate remote calls with timestamp exclusion', async () => {
    const testName = 'dedup-timestamps';
    const config = {
      exclude: { 
        query: ['timestamp', 'nonce'],
        headers: ['x-request-id']
      }
    };
    
    // Track actual HTTP calls by intercepting the original fetch
    let httpCallCount = 0;
    const originalFetch = globalThis.fetch;
    
    // Mock fetch to count real HTTP calls
    globalThis.fetch = async (input: any, init?: any) => {
      httpCallCount++;
      // Add unique response data to distinguish real vs cached calls
      const response = await originalFetch(input, init);
      
      // Clone the response to safely read the body
      const clonedResponse = response.clone();
      const data = await clonedResponse.json();
      
      // Add a unique marker to each real HTTP response
      const modifiedData = { ...data, httpCallNumber: httpCallCount };
      
      // Create new headers to ensure content-type is set correctly
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      
      return new Response(JSON.stringify(modifiedData), {
        status: response.status,
        headers: headers
      });
    };
    
    try {
      await replayAPI.start(testName, config);
      
      // First call - should make real HTTP request
      const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=1234567890&nonce=abc123', {
        headers: { 'x-request-id': 'req-001' }
      });
      const data1 = await response1.json();
      
      // Second call - should reuse existing recording (no HTTP request)
      const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=9876543210&nonce=xyz789', {
        headers: { 'x-request-id': 'req-002' }
      });
      const data2 = await response2.json();
      
      // Third call - should also reuse existing recording
      const response3 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=5555555555&nonce=newvalue', {
        headers: { 'x-request-id': 'req-003' }
      });
      const data3 = await response3.json();
      
      const result = await replayAPI.done();
      expectRecorded(result);
      
      // Critical test: Only 1 HTTP call should have been made
      expect(httpCallCount).toBe(1);
      
      // Verify only one call was recorded
      const recording = await getRecordingFile(testName);
      expect(recording.calls).toHaveLength(1);
      
      // All responses should be identical (from the same cached call)
      expect(data1).toEqual(data2);
      expect(data1).toEqual(data3);
      
      // The second and third calls should have the same httpCallNumber as the first
      // because they were served from cache
      expect(data1.httpCallNumber).toBe(1);
      expect(data2.httpCallNumber).toBe(1);
      expect(data3.httpCallNumber).toBe(1);
      
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  test('prevents duplicate remote calls with header exclusion', async () => {
    const testName = 'dedup-headers';
    const config = {
      exclude: { 
        headers: ['user-agent', 'accept-encoding']
      }
    };
    
    // Track actual HTTP calls
    let httpCallCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: any, init?: any) => {
      httpCallCount++;
      const response = await originalFetch(input, init);
      // Ensure we return a cloned response to avoid body consumption issues
      return response.clone();
    };
    
    try {
      await replayAPI.start(testName, config);
      
      // First call - should make real HTTP request
      const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
        headers: {
          'user-agent': 'test-agent-1',
          'accept-encoding': 'gzip'
        }
      });
      const data1 = await response1.json();
      
      // Second call - should reuse existing recording (different excluded headers)
      const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
        headers: {
          'user-agent': 'test-agent-2',
          'accept-encoding': 'deflate'
        }
      });
      const data2 = await response2.json();
      
      const result = await replayAPI.done();
      expectRecorded(result);
      
      // Critical test: Only 1 HTTP call should have been made
      expect(httpCallCount).toBe(1);
      
      // Verify only one call was recorded
      const recording = await getRecordingFile(testName);
      expect(recording.calls).toHaveLength(1);
      
      // Both responses should be identical
      expect(data1).toEqual(data2);
      
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('prevents duplicate remote calls with body exclusion', async () => {
    const testName = 'dedup-body';
    const config = {
      exclude: { body: true }
    };
    
    // Track actual HTTP calls
    let httpCallCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: any, init?: any) => {
      httpCallCount++;
      const response = await originalFetch(input, init);
      // Ensure we return a cloned response to avoid body consumption issues
      return response.clone();
    };
    
    try {
      await replayAPI.start(testName, config);
      
      // First call - should make real HTTP request
      const response1 = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'First Post', body: 'First content' })
      });
      const data1 = await response1.json();
      
      // Second call - should reuse existing recording (different body)
      const response2 = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Second Post', body: 'Second content', userId: 999 })
      });
      const data2 = await response2.json();
      
      const result = await replayAPI.done();
      expectRecorded(result);
      
      // Critical test: Only 1 HTTP call should have been made
      expect(httpCallCount).toBe(1);
      
      // Verify only one call was recorded
      const recording = await getRecordingFile(testName);
      expect(recording.calls).toHaveLength(1);
      
      // Both responses should be identical
      expect(data1).toEqual(data2);
      
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('still makes multiple calls when requests differ in non-excluded fields', async () => {
    const testName = 'dedup-no-match';
    const config = {
      exclude: { query: ['timestamp'] }
    };
    
    // Track actual HTTP calls to verify multiple calls are made
    let httpCallCount = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: any, init?: any) => {
      httpCallCount++;
      return originalFetch(input, init);
    };
    
    try {
      await replayAPI.start(testName, config);
      
      // First call
      const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=123&userId=1');
      const data1 = await response1.json();
      
      // Second call - different non-excluded parameter, should make new request
      const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=456&userId=2');
      const data2 = await response2.json();
      
      const result = await replayAPI.done();
      expectRecorded(result);
      
      // Critical test: Should have made 2 HTTP calls (no deduplication)
      expect(httpCallCount).toBe(2);
      
      // Verify two calls were recorded (different userId)
      const recording = await getRecordingFile(testName);
      expect(recording.calls).toHaveLength(2);
      
      // Both responses should be identical (same endpoint)
      expect(data1).toEqual(data2);
      
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('combined include/exclude deduplication', async () => {
    const testName = 'dedup-combined';
    const config = {
      include: { headers: ['authorization'] },
      exclude: { 
        query: ['timestamp'],
        headers: ['user-agent']
      }
    };
    
    await replayAPI.start(testName, config);
    
    // First call
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=123', {
      headers: {
        'authorization': 'Bearer token123',
        'user-agent': 'client-1'
      }
    });
    const data1 = await response1.json();
    
    // Second call - same auth, different excluded fields, should reuse
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=456', {
      headers: {
        'authorization': 'Bearer token123',
        'user-agent': 'client-2'
      }
    });
    const data2 = await response2.json();
    
    // Third call - different auth, should make new request
    const response3 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=789', {
      headers: {
        'authorization': 'Bearer token456',
        'user-agent': 'client-3'
      }
    });
    const data3 = await response3.json();
    
    const result = await replayAPI.done();
    expectRecorded(result);
    
    // Verify two calls were recorded (different auth tokens)
    const recording = await getRecordingFile(testName);
    expect(recording.calls).toHaveLength(2);
    
    // First two responses should be identical
    expect(data1).toEqual(data2);
    // Third response should also be identical (same endpoint)
    expect(data1).toEqual(data3);
  });
});