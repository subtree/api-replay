import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { replayAPI, ReplayResult } from '../src/index';
import { Recorder } from '../src/recorder';
import { Replayer } from '../src/replayer';
import { RequestMatcher } from '../src/matcher';
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
    await replayAPI.start(testName, { recordingsDir: 'apirecordings' });
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data1 = await response1.json();
    const result1 = await replayAPI.done();

    expectRecorded(result1);
    expect(replayAPI.wasReplayed()).toBe(false);
    expect(data1).toHaveProperty('id', 1);
    expect(data1).toHaveProperty('title');

    // Second run - replay
    await replayAPI.start(testName, { recordingsDir: 'apirecordings' });
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

  test('debug mode is disabled by default', async () => {
    // Capture console output
    const originalConsoleLog = console.log;
    const logMessages: string[] = [];
    console.log = (...args: any[]) => {
      logMessages.push(args.join(' '));
      originalConsoleLog(...args);
    };

    try {
      await replayAPI.start('debug-test', { recordingsDir: 'apirecordings' });
      await fetch('https://jsonplaceholder.typicode.com/posts/1');
      await replayAPI.done();

      // Should not contain any ReplayAPI debug messages
      const replayMessages = logMessages.filter((msg) => msg.includes('replay-api'));
      expect(replayMessages).toHaveLength(0);
    } finally {
      // Reset to default
      console.log = originalConsoleLog;
    }
  });

  describe('getMode() method', () => {
    test('should return null when not active', () => {
      expect(replayAPI.getMode()).toBeNull();
    });

    test('should return record mode when recording', async () => {
      const testName = 'test-getmode-record';
      const recordingsDir = join(process.cwd(), 'apirecordings');
      const filepath = join(recordingsDir, `${testName}.json`);

      // Ensure recording doesn't exist
      if (existsSync(filepath)) {
        await Bun.write(filepath, ''); // Clear it
        const fs = require('fs');
        fs.unlinkSync(filepath);
      }

      await replayAPI.start(testName);
      expect(replayAPI.getMode()).toBe('record');
      await replayAPI.done();

      // Clean up
      if (existsSync(filepath)) {
        const fs = require('fs');
        fs.unlinkSync(filepath);
      }
    });

    test('should return replay mode when replaying', async () => {
      const testName = 'test-getmode-replay';
      const recordingsDir = join(process.cwd(), 'apirecordings');
      const filepath = join(recordingsDir, `${testName}.json`);

      // Create a mock recording
      const mockRecording = {
        meta: {
          recordedAt: new Date().toISOString(),
          testName: testName,
          replayAPIVersion: '1.0.0'
        },
        calls: []
      };

      await Bun.write(filepath, JSON.stringify(mockRecording, null, 2));

      await replayAPI.start(testName, { recordingsDir: 'apirecordings' });
      expect(replayAPI.getMode()).toBe('replay');
      await replayAPI.done();

      // Clean up
      if (existsSync(filepath)) {
        const fs = require('fs');
        fs.unlinkSync(filepath);
      }
    });

    test('should return null after done() is called', async () => {
      const testName = 'test-getmode-done';
      const recordingsDir = join(process.cwd(), 'apirecordings');
      const filepath = join(recordingsDir, `${testName}.json`);

      // Ensure recording doesn't exist
      if (existsSync(filepath)) {
        const fs = require('fs');
        fs.unlinkSync(filepath);
      }

      await replayAPI.start(testName);
      expect(replayAPI.getMode()).toBe('record');

      await replayAPI.done();
      expect(replayAPI.getMode()).toBeNull();

      // Clean up
      if (existsSync(filepath)) {
        const fs = require('fs');
        fs.unlinkSync(filepath);
      }
    });
  });

  describe('wasReplayed() method', () => {
    test('should return true after successful replay', async () => {
      const testName = 'test-wasreplayed-true';
      const recordingsDir = join(process.cwd(), 'apirecordings');
      const filepath = join(recordingsDir, `${testName}.json`);

      // Create a mock recording with a call
      const mockRecording = {
        meta: {
          recordedAt: new Date().toISOString(),
          testName: testName,
          replayAPIVersion: '1.0.0'
        },
        calls: [
          {
            request: {
              method: 'GET',
              url: 'http://example.com/test',
              headers: {},
              body: null
            },
            response: {
              status: 200,
              headers: { 'content-type': 'text/plain' },
              body: 'test response'
            }
          }
        ]
      };

      await Bun.write(filepath, JSON.stringify(mockRecording, null, 2));

      // Start in replay mode
      await replayAPI.start(testName, { recordingsDir: 'apirecordings' });

      // Initially should be false
      expect(replayAPI.wasReplayed()).toBe(false);

      // Make a matching request
      const response = await fetch('http://example.com/test');
      const body = await response.text();

      // Now should be true
      expect(replayAPI.wasReplayed()).toBe(true);
      expect(body).toBe('test response');

      await replayAPI.done();

      // After done, should be false again
      expect(replayAPI.wasReplayed()).toBe(false);

      // Clean up
      const fs = require('fs');
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });
  });

  describe('error handling', () => {
    test('should handle invalid mode state gracefully', async () => {
      const testName = 'test-invalid-mode';
      const recordingsDir = join(process.cwd(), 'apirecordings');
      const filepath = join(recordingsDir, `${testName}.json`);

      // Ensure recording doesn't exist
      if (existsSync(filepath)) {
        const fs = require('fs');
        fs.unlinkSync(filepath);
      }

      await replayAPI.start(testName);

      // Hack: Force an invalid mode to test the edge case
      (replayAPI as any).mode = 'invalid';

      // Try to fetch - should throw invalid mode error
      await expect(fetch('http://example.com')).rejects.toThrow('Invalid mode state');

      // Reset mode and clean up
      (replayAPI as any).mode = 'record';
      await replayAPI.done();

      // Clean up
      if (existsSync(filepath)) {
        const fs = require('fs');
        fs.unlinkSync(filepath);
      }
    });
  });

  describe('component functionality', () => {
    test('Replayer should return cached recording file on subsequent calls', async () => {
      const testName = 'test-replayer-cache';
      const recordingsDir = join(process.cwd(), 'apirecordings');
      const filepath = join(recordingsDir, `${testName}.json`);

      // Create a mock recording
      const mockRecording = {
        meta: {
          recordedAt: new Date().toISOString(),
          testName: testName,
          replayAPIVersion: '1.0.0'
        },
        calls: [
          {
            request: {
              method: 'GET',
              url: 'http://example.com',
              headers: {},
              body: null
            },
            response: {
              status: 200,
              headers: { 'content-type': 'text/plain' },
              body: 'cached'
            }
          }
        ]
      };

      await Bun.write(filepath, JSON.stringify(mockRecording, null, 2));

      const replayer = new Replayer(join(process.cwd(), 'apirecordings'));

      // First call - loads from file
      const recording1 = await replayer.loadRecording(testName);
      expect(recording1.calls.length).toBe(1);

      // Second call - should return cached version
      const recording2 = await replayer.loadRecording(testName);
      expect(recording2).toBe(recording1); // Same reference
      expect(recording2.calls.length).toBe(1);

      // Clean up
      if (existsSync(filepath)) {
        const fs = require('fs');
        fs.unlinkSync(filepath);
      }
    });

    test('Recorder should clear recorded calls on reset', async () => {
      const recorder = new Recorder(join(process.cwd(), 'apirecordings'));

      // Create mock request and response
      const request = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      const response = new Response(JSON.stringify({ result: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });

      // Record a call
      await recorder.recordCall(request.clone(), response);

      // Create a fresh request for finding
      const searchRequest = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      // Verify call was recorded by checking it can be found
      const matcher = new RequestMatcher({});
      const foundCall = await recorder.findExistingCall(searchRequest, matcher);
      expect(foundCall).not.toBeNull();

      // Reset the recorder
      recorder.reset();

      // Create another fresh request for finding
      const searchRequest2 = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      });

      // Verify calls are cleared
      const foundCallAfterReset = await recorder.findExistingCall(searchRequest2, matcher);
      expect(foundCallAfterReset).toBeNull();
    });

    test('Replayer should clear loaded recording file on reset', async () => {
      const testName = 'test-replayer-reset';
      const recordingsDir = join(process.cwd(), 'apirecordings');
      const filepath = join(recordingsDir, `${testName}.json`);

      // Create a mock recording
      const mockRecording = {
        meta: {
          recordedAt: new Date().toISOString(),
          testName: testName,
          replayAPIVersion: '1.0.0'
        },
        calls: [
          {
            request: {
              method: 'GET',
              url: 'http://example.com',
              headers: {},
              body: null
            },
            response: {
              status: 200,
              headers: {},
              body: 'test'
            }
          }
        ]
      };

      await Bun.write(filepath, JSON.stringify(mockRecording, null, 2));

      const replayer = new Replayer(join(process.cwd(), 'apirecordings'));

      // Load recording
      await replayer.loadRecording(testName);

      // Verify it's loaded by finding a call
      const matcher = new RequestMatcher({});
      const request = new Request('http://example.com');
      const foundCall = await replayer.findMatchingCall(request, matcher);
      expect(foundCall).not.toBeNull();

      // Reset the replayer
      replayer.reset();

      // Try to find a call again - should throw because no recording is loaded
      await expect(replayer.findMatchingCall(request, matcher)).rejects.toThrow('No recording file loaded');

      // Clean up
      const fs = require('fs');
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    });

    test('Replayer should allow loading a new recording after reset', async () => {
      const testName1 = 'test-replayer-reset-1';
      const testName2 = 'test-replayer-reset-2';
      const recordingsDir = join(process.cwd(), 'apirecordings');
      const filepath1 = join(recordingsDir, `${testName1}.json`);
      const filepath2 = join(recordingsDir, `${testName2}.json`);

      // Create two different mock recordings
      const mockRecording1 = {
        meta: {
          recordedAt: new Date().toISOString(),
          testName: testName1,
          replayAPIVersion: '1.0.0'
        },
        calls: [
          {
            request: {
              method: 'GET',
              url: 'http://example.com/one',
              headers: {},
              body: null
            },
            response: {
              status: 200,
              headers: {},
              body: 'response one'
            }
          }
        ]
      };

      const mockRecording2 = {
        meta: {
          recordedAt: new Date().toISOString(),
          testName: testName2,
          replayAPIVersion: '1.0.0'
        },
        calls: [
          {
            request: {
              method: 'GET',
              url: 'http://example.com/two',
              headers: {},
              body: null
            },
            response: {
              status: 200,
              headers: {},
              body: 'response two'
            }
          }
        ]
      };

      await Bun.write(filepath1, JSON.stringify(mockRecording1, null, 2));
      await Bun.write(filepath2, JSON.stringify(mockRecording2, null, 2));

      const replayer = new Replayer(join(process.cwd(), 'apirecordings'));
      const matcher = new RequestMatcher({});

      // Load first recording
      await replayer.loadRecording(testName1);

      // Verify first recording is loaded
      const request1 = new Request('http://example.com/one');
      const foundCall1 = await replayer.findMatchingCall(request1, matcher);
      expect(foundCall1).not.toBeNull();
      expect(foundCall1?.response.body).toBe('response one');

      // Reset
      replayer.reset();

      // Load second recording
      await replayer.loadRecording(testName2);

      // Verify second recording is loaded and first is not accessible
      const request2 = new Request('http://example.com/two');
      const foundCall2 = await replayer.findMatchingCall(request2, matcher);
      expect(foundCall2).not.toBeNull();
      expect(foundCall2?.response.body).toBe('response two');

      // Verify first recording's call is not found
      const foundCall1Again = await replayer.findMatchingCall(request1, matcher);
      expect(foundCall1Again).toBeNull();

      // Clean up
      const fs = require('fs');
      if (fs.existsSync(filepath1)) {
        fs.unlinkSync(filepath1);
      }
      if (fs.existsSync(filepath2)) {
        fs.unlinkSync(filepath2);
      }
    });
  });

  describe('configurable recordings directory', () => {
    test('should use custom recordings directory when specified', async () => {
      const customDir = join(process.cwd(), 'custom-test-recordings');
      const testName = 'custom-dir-test';

      // Clean up any existing custom directory
      if (existsSync(customDir)) {
        await rm(customDir, { recursive: true });
      }

      try {
        // First run - record with custom directory
        await replayAPI.start(testName, { recordingsDir: 'custom-test-recordings' });
        const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
        const data1 = await response1.json();
        const result1 = await replayAPI.done();

        expectRecorded(result1);

        // Verify the recording was saved in the custom directory
        const filename = testName + '.json';
        const filepath = join(customDir, filename);
        expect(existsSync(filepath)).toBe(true);

        // Second run - replay from custom directory
        await replayAPI.start(testName, { recordingsDir: 'custom-test-recordings' });
        const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
        const data2 = await response2.json();
        const result2 = await replayAPI.done();

        expectReplayed(result2);
        expect(data2).toEqual(data1);
      } finally {
        // Clean up custom directory
        if (existsSync(customDir)) {
          await rm(customDir, { recursive: true });
        }
      }
    });

    test('should use absolute path for recordings directory', async () => {
      const absoluteDir = join(process.cwd(), 'temp-absolute-recordings');
      const testName = 'absolute-dir-test';

      // Clean up any existing directory
      if (existsSync(absoluteDir)) {
        await rm(absoluteDir, { recursive: true });
      }

      try {
        // Record with absolute path
        await replayAPI.start(testName, { recordingsDir: absoluteDir });
        const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/2');
        const data1 = await response1.json();
        const result1 = await replayAPI.done();

        expectRecorded(result1);

        // Verify the recording was saved in the absolute directory
        const filename = testName + '.json';
        const filepath = join(absoluteDir, filename);
        expect(existsSync(filepath)).toBe(true);

        // Replay from absolute path
        await replayAPI.start(testName, { recordingsDir: absoluteDir });
        const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/2');
        const data2 = await response2.json();
        const result2 = await replayAPI.done();

        expectReplayed(result2);
        expect(data2).toEqual(data1);
      } finally {
        // Clean up absolute directory
        if (existsSync(absoluteDir)) {
          await rm(absoluteDir, { recursive: true });
        }
      }
    });

    test('should default to .api-replay directory when not specified', async () => {
      const defaultDir = join(process.cwd(), '.api-replay');
      const testName = 'default-dir-test';

      // Clean up any existing default directory
      if (existsSync(defaultDir)) {
        await rm(defaultDir, { recursive: true });
      }

      try {
        // Record without specifying directory (should use default)
        await replayAPI.start(testName);
        const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/3');
        const data1 = await response1.json();
        const result1 = await replayAPI.done();

        expectRecorded(result1);

        // Verify the recording was saved in the default directory
        const filename = testName + '.json';
        const filepath = join(defaultDir, filename);
        expect(existsSync(filepath)).toBe(true);

        // Replay from default directory
        await replayAPI.start(testName);
        const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/3');
        const data2 = await response2.json();
        const result2 = await replayAPI.done();

        expectReplayed(result2);
        expect(data2).toEqual(data1);
      } finally {
        // Clean up default directory
        if (existsSync(defaultDir)) {
          await rm(defaultDir, { recursive: true });
        }
      }
    });
  });

  describe('logging control', () => {
    const originalLog = console.log;
    const originalEnv = process.env.APIREPLAYLOGS;
    let logs: string[] = [];

    beforeEach(() => {
      logs = [];
      console.log = (...args: any[]) => {
        logs.push(args.join(' '));
      };
      delete process.env.APIREPLAYLOGS;
    });

    afterEach(async () => {
      console.log = originalLog;
      if (originalEnv !== undefined) {
        process.env.APIREPLAYLOGS = originalEnv;
      } else {
        delete process.env.APIREPLAYLOGS;
      }
      // Ensure replayAPI is reset
      if (replayAPI.getMode()) {
        await replayAPI.done();
      }
      // No need to reset anything since debug mode is per-session
    });

    test('default behavior should not log (silent by default)', async () => {
      await replayAPI.start('logging-default-test');
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBe(0);
    });

    test('config.debug: true should enable logging', async () => {
      await replayAPI.start('logging-config-debug-test', { debug: true });
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBeGreaterThan(0);
      expect(replayLogs.some((log) => log.includes('Started'))).toBe(true);
      expect(replayLogs.some((log) => log.includes('Finished'))).toBe(true);
    });

    test('APIREPLAYLOGS=true environment variable should enable logging', async () => {
      process.env.APIREPLAYLOGS = 'true';

      await replayAPI.start('logging-env-true-test');
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBeGreaterThan(0);
      expect(replayLogs.some((log) => log.includes('Started'))).toBe(true);
    });

    test('APIREPLAYLOGS=1 environment variable should enable logging', async () => {
      process.env.APIREPLAYLOGS = '1';

      await replayAPI.start('logging-env-1-test');
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBeGreaterThan(0);
    });

    test('APIREPLAYLOGS=* environment variable should enable logging', async () => {
      process.env.APIREPLAYLOGS = '*';

      await replayAPI.start('logging-env-star-test');
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBeGreaterThan(0);
    });

    test('APIREPLAYLOGS=false should not enable logging', async () => {
      process.env.APIREPLAYLOGS = 'false';

      await replayAPI.start('logging-env-false-test');
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBe(0);
    });

    test('APIREPLAYLOGS=other should not enable logging', async () => {
      process.env.APIREPLAYLOGS = 'other';

      await replayAPI.start('logging-env-other-test');
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBe(0);
    });

    test('config.debug should take precedence over environment variable', async () => {
      process.env.APIREPLAYLOGS = 'false'; // Would normally disable

      await replayAPI.start('logging-precedence-test', { debug: true });
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBeGreaterThan(0);
    });

    test('debug mode only enabled per session when configured', async () => {
      // First session without debug
      await replayAPI.start('logging-session-1');
      await replayAPI.done();

      let replayLogs = logs.filter((log) => log.includes('ReplayAPI'));
      expect(replayLogs.length).toBe(0);

      // Clear logs
      logs = [];

      // Second session with debug enabled
      await replayAPI.start('logging-session-2', { debug: true });
      await replayAPI.done();

      replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBeGreaterThan(0);

      // Clear logs
      logs = [];

      // Third session without debug - should be silent again
      await replayAPI.start('logging-session-3');
      await replayAPI.done();

      replayLogs = logs.filter((log) => log.includes('ReplayAPI'));
      expect(replayLogs.length).toBe(0);
    });

    test('logging should show both start and done messages in record mode', async () => {
      await replayAPI.start('logging-messages-record', { debug: true });
      await replayAPI.done();

      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.some((log) => log.includes('Started') && log.includes('record mode'))).toBe(true);
      expect(replayLogs.some((log) => log.includes('Finished') && log.includes('record mode'))).toBe(true);
    });

    test('logging should show reuse messages during deduplication', async () => {
      // Make first request to record it
      await replayAPI.start('logging-dedup-test', { debug: true });

      // Make request to create a recording
      const mockServer = Bun.serve({
        port: 0,
        fetch() {
          return new Response('test response');
        }
      });

      try {
        const url = `http://localhost:${mockServer.port}/test`;
        await fetch(url);

        // Make the same request again - should show reuse message
        await fetch(url);

        await replayAPI.done();

        const replayLogs = logs.filter((log) => log.includes('Reusing existing recording'));
        expect(replayLogs.length).toBeGreaterThan(0);
      } finally {
        mockServer.stop();
      }
    });
  });
});
