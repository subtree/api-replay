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

describe('CI Safe Tests', () => {
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

  test('basic record and replay with mock server', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/posts/1') {
          return new Response(
            JSON.stringify({
              id: 1,
              title: 'Test Post',
              body: 'Test content',
              userId: 1
            }),
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        return new Response('Not Found', { status: 404 });
      }
    });

    const baseUrl = `http://localhost:${server.port}`;

    try {
      // First run - record
      await replayAPI.start('ci-safe-test');
      const response1 = await fetch(`${baseUrl}/posts/1`);
      const data1 = await response1.json();
      const result1 = await replayAPI.done();

      expect(result1.mode).toBe('record');
      expect(result1.wasReplayed).toBe(false);
      expect(data1.id).toBe(1);

      // Second run - replay
      await replayAPI.start('ci-safe-test');
      const response2 = await fetch(`${baseUrl}/posts/1`);
      const data2 = await response2.json();
      const result2 = await replayAPI.done();

      expect(result2.mode).toBe('replay');
      expect(result2.wasReplayed).toBe(true);
      expect(data2).toEqual(data1);
    } finally {
      server.stop();
    }
  });

  test('header exclusion with mock server', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/api/test') {
          return new Response(
            JSON.stringify({
              message: 'success',
              headers: Object.fromEntries(request.headers.entries())
            }),
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        return new Response('Not Found', { status: 404 });
      }
    });

    const baseUrl = `http://localhost:${server.port}`;
    const config = {
      exclude: { headers: ['user-agent', 'accept-encoding'] }
    };

    try {
      // First run - record
      await replayAPI.start('ci-safe-header-test', config);
      const response1 = await fetch(`${baseUrl}/api/test`, {
        headers: {
          'user-agent': 'test-agent-1',
          'accept-encoding': 'gzip'
        }
      });
      const data1 = await response1.json();
      const result1 = await replayAPI.done();

      expect(result1.mode).toBe('record');
      expect(result1.wasReplayed).toBe(false);

      // Second run - replay with different excluded headers
      await replayAPI.start('ci-safe-header-test', config);
      const response2 = await fetch(`${baseUrl}/api/test`, {
        headers: {
          'user-agent': 'test-agent-2',
          'accept-encoding': 'deflate'
        }
      });
      const data2 = await response2.json();
      const result2 = await replayAPI.done();

      expect(result2.mode).toBe('replay');
      expect(result2.wasReplayed).toBe(true);
      expect(data2).toEqual(data1);
    } finally {
      server.stop();
    }
  });

  test('deduplication with mock server', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/api/posts') {
          return new Response(
            JSON.stringify({
              id: 1,
              title: 'Post',
              timestamp: Date.now()
            }),
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
        return new Response('Not Found', { status: 404 });
      }
    });

    const baseUrl = `http://localhost:${server.port}`;
    const config = {
      exclude: { query: ['timestamp'] }
    };

    try {
      await replayAPI.start('ci-safe-dedup-test', config);

      // First call - should make real HTTP request
      const response1 = await fetch(`${baseUrl}/api/posts?timestamp=123`);
      const data1 = await response1.json();

      // Second call - should reuse existing recording
      const response2 = await fetch(`${baseUrl}/api/posts?timestamp=456`);
      const data2 = await response2.json();

      const result = await replayAPI.done();
      expect(result.mode).toBe('record');
      expect(result.wasReplayed).toBe(false);
      expect(data1).toEqual(data2);
    } finally {
      server.stop();
    }
  });

  test('error handling', async () => {
    await replayAPI.start('ci-safe-error-test');

    // Test that we can handle failed requests gracefully
    try {
      await fetch('http://localhost:99999/nonexistent');
      expect(false).toBe(true); // Should not reach here
    } catch (error) {
      // Expected to fail
      expect(error).toBeDefined();
    }

    await replayAPI.done();
  });

  test('debug mode', async () => {
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
    };

    try {
      // First run with debug enabled
      await replayAPI.start('ci-safe-debug-test', { debug: true });
      await replayAPI.done();

      // Second run with debug disabled
      await replayAPI.start('ci-safe-debug-test');
      await replayAPI.done();

      // Should have some log messages when debug is true
      const replayLogs = logs.filter((log) => log.includes('replay-api'));
      expect(replayLogs.length).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
    }
  });
});
