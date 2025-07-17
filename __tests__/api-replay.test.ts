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
  const recordingsDir = join(process.cwd(), 'apirecordings');
  if (existsSync(recordingsDir)) {
    await rm(recordingsDir, { recursive: true });
  }
}

describe('api-replay', () => {
  beforeEach(async () => {
    await cleanupRecordings();
  });

  afterEach(async () => {
    // Ensure we clean up if a test fails
    try {
      await replayAPI.done();
    } catch {
      // Ignore if already done
    }
  });

  test('records and replays a simple GET request', async () => {
    const testName = 'simple-get-test';
    
    // First run - record
    await replayAPI.start(testName);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data1 = await response1.json();
    const result1 = await replayAPI.done();
    
    expectRecorded(result1);
    expect(replayAPI.wasReplayed()).toBe(false);
    expect(data1).toHaveProperty('id', 1);
    expect(data1).toHaveProperty('title');
    
    // Second run - replay
    await replayAPI.start(testName);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data2 = await response2.json();
    const result2 = await replayAPI.done();
    
    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('records and replays POST request with JSON body', async () => {
    const testName = 'post-json-test';
    const postData = { title: 'Test Post', body: 'Test content', userId: 1 };
    
    // First run - record
    await replayAPI.start(testName);
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });
    const data1 = await response1.json();
    const result1 = await replayAPI.done();
    
    expectRecorded(result1);
    expect(data1).toHaveProperty('id');
    expect(data1.title).toBe(postData.title);
    
    // Second run - replay
    await replayAPI.start(testName);
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData)
    });
    const data2 = await response2.json();
    const result2 = await replayAPI.done();
    
    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('supports header exclusion in matching', async () => {
    const testName = 'header-exclusion-test';
    
    // First run - record
    await replayAPI.start(testName, {
      exclude: { headers: ['x-test-header'] }
    });
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: { 'x-test-header': 'original-value' }
    });
    const data1 = await response1.json();
    const result1 = await replayAPI.done();
    
    expectRecorded(result1);
    
    // Second run - replay with different excluded header value
    await replayAPI.start(testName, {
      exclude: { headers: ['x-test-header'] }
    });
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: { 'x-test-header': 'different-value' }
    });
    const data2 = await response2.json();
    const result2 = await replayAPI.done();
    
    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('supports query parameter exclusion', async () => {
    const testName = 'query-exclusion-test';
    
    // First run - record
    await replayAPI.start(testName, {
      exclude: { query: ['timestamp'] }
    });
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=123456');
    const data1 = await response1.json();
    const result1 = await replayAPI.done();
    
    expectRecorded(result1);
    
    // Second run - replay with different excluded query parameter
    await replayAPI.start(testName, {
      exclude: { query: ['timestamp'] }
    });
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1?timestamp=654321');
    const data2 = await response2.json();
    const result2 = await replayAPI.done();
    
    expectReplayed(result2);
    expect(data2).toEqual(data1);
  });

  test('throws error when no matching recording found', async () => {
    const testName = 'no-match-test';
    
    // First run - record a specific request
    await replayAPI.start(testName);
    await fetch('https://jsonplaceholder.typicode.com/posts/1');
    await replayAPI.done();
    
    // Second run - try to replay a different request
    await replayAPI.start(testName);
    
    // Properly test async error throwing
    await expect(async () => {
      await fetch('https://jsonplaceholder.typicode.com/posts/2');
    }).toThrow('No matching recorded call found');
    
    await replayAPI.done();
  });

  test('throws error when start() called twice', async () => {
    await replayAPI.start('test-double-start');
    
    // Properly test async error throwing
    await expect(async () => {
      await replayAPI.start('test-double-start-2');
    }).toThrow('ReplayAPI is already active');
    
    await replayAPI.done();
  });

  test('verbose mode can be disabled', async () => {
    // Capture console output
    const originalConsoleLog = console.log;
    const logMessages: string[] = [];
    console.log = (...args: any[]) => {
      logMessages.push(args.join(' '));
      originalConsoleLog(...args);
    };
    
    try {
      replayAPI.setVerbose(false);
      
      await replayAPI.start('verbose-test');
      await fetch('https://jsonplaceholder.typicode.com/posts/1');
      await replayAPI.done();
      
      // Should not contain any ReplayAPI verbose messages
      const replayMessages = logMessages.filter(msg => msg.includes('🎬 ReplayAPI'));
      expect(replayMessages).toHaveLength(0);
      
    } finally {
      // Reset to default
      console.log = originalConsoleLog;
      replayAPI.setVerbose(true);
    }
  });
});