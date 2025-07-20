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

describe('Mock API Tests', () => {
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

  test('works with mock server instead of external API', async () => {
    // Create a simple mock server
    const server = Bun.serve({
      port: 0, // Use any available port
      fetch(request) {
        if (request.url.endsWith('/posts/1')) {
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
      await replayAPI.start('mock-server-test');

      // First run - should record
      const response1 = await fetch(`${baseUrl}/posts/1`);
      const data1 = await response1.json();

      const result1 = await replayAPI.done();
      expect(result1.mode).toBe('record');
      expect(result1.wasReplayed).toBe(false);
      expect(data1.id).toBe(1);
      expect(data1.title).toBe('Test Post');

      // Second run - should replay
      await replayAPI.start('mock-server-test');
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

  test('handles JSON parsing errors gracefully', async () => {
    // Create a mock server that returns invalid JSON
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        if (request.url.endsWith('/invalid-json')) {
          return new Response('{"invalid": json}', {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response('Not Found', { status: 404 });
      }
    });

    const baseUrl = `http://localhost:${server.port}`;

    try {
      await replayAPI.start('invalid-json-test');

      // This should handle the invalid JSON gracefully
      const response = await fetch(`${baseUrl}/invalid-json`);
      const text = await response.text();

      expect(text).toBe('{"invalid": json}');

      const result = await replayAPI.done();
      expect(result.mode).toBe('record');
    } finally {
      server.stop();
    }
  });
});
