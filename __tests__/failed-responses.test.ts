import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { replayAPI } from '../src/index';
import { join } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

const TEST_DIR = join(process.cwd(), '.test-recordings');

describe('Failed Responses Configuration', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await replayAPI.done();
    } catch {
      // Ignore if not active
    }
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  test('should not record 4xx responses by default', async () => {
    await replayAPI.start('test-default-no-4xx', {
      recordingsDir: TEST_DIR
    });

    // Make a request that will return 404
    try {
      await fetch('https://jsonplaceholder.typicode.com/posts/999999');
    } catch {
      // Ignore network errors
    }

    await replayAPI.done();

    // Check that no recording was created since 404 should not be recorded
    const recordingPath = join(TEST_DIR, 'test-default-no-4xx.json');

    if (existsSync(recordingPath)) {
      const recording = await Bun.file(recordingPath).json();
      expect(recording.calls.length).toBe(0);
    }
  });

  test('should not record 5xx responses by default', async () => {
    // Create a simple mock server that returns 500
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response('Internal Server Error', { status: 500 });
      }
    });

    const baseUrl = `http://localhost:${server.port}`;

    try {
      await replayAPI.start('test-default-no-5xx', {
        recordingsDir: TEST_DIR
      });

      // Make a request that will return 500
      try {
        await fetch(`${baseUrl}/error`);
      } catch {
        // Ignore network errors
      }

      await replayAPI.done();

      // Check that no recording was created since 500 should not be recorded
      const recordingPath = join(TEST_DIR, 'test-default-no-5xx.json');

      if (existsSync(recordingPath)) {
        const recording = await Bun.file(recordingPath).json();
        expect(recording.calls.length).toBe(0);
      }
    } finally {
      server.stop();
    }
  });

  test('should record 4xx responses when recordFailedResponses is true', async () => {
    await replayAPI.start('test-record-4xx', {
      recordingsDir: TEST_DIR,
      recordFailedResponses: true
    });

    // Make a request that will return 404
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/999999');
    await response.text(); // Consume response

    await replayAPI.done();

    // Check that the 404 response was recorded
    const recordingPath = join(TEST_DIR, 'test-record-4xx.json');
    expect(existsSync(recordingPath)).toBe(true);

    const recording = await Bun.file(recordingPath).json();
    expect(recording.calls.length).toBe(1);
    expect(recording.calls[0].response.status).toBe(404);
  });

  test('should record 5xx responses when recordFailedResponses is true', async () => {
    // Create a simple mock server that returns 500
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response('Internal Server Error', { status: 500 });
      }
    });

    const baseUrl = `http://localhost:${server.port}`;

    try {
      await replayAPI.start('test-record-5xx', {
        recordingsDir: TEST_DIR,
        recordFailedResponses: true
      });

      // Make a request that will return 500
      const response = await fetch(`${baseUrl}/error`);
      await response.text(); // Consume response

      await replayAPI.done();

      // Check that the 500 response was recorded
      const recordingPath = join(TEST_DIR, 'test-record-5xx.json');
      expect(existsSync(recordingPath)).toBe(true);

      const recording = await Bun.file(recordingPath).json();
      expect(recording.calls.length).toBe(1);
      expect(recording.calls[0].response.status).toBe(500);
    } finally {
      server.stop();
    }
  });

  test('should replay 4xx responses when recordFailedResponses is true', async () => {
    // First run: record the 404 response
    await replayAPI.start('test-replay-4xx', {
      recordingsDir: TEST_DIR,
      recordFailedResponses: true
    });

    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/999999');
    await response1.text();

    const result1 = await replayAPI.done();
    expect(result1.mode).toBe('record');
    expect(result1.wasReplayed).toBe(false);

    // Second run: replay the 404 response
    await replayAPI.start('test-replay-4xx', {
      recordingsDir: TEST_DIR,
      recordFailedResponses: true
    });

    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/999999');
    expect(response2.status).toBe(404);

    const result2 = await replayAPI.done();
    expect(result2.mode).toBe('replay');
    expect(result2.wasReplayed).toBe(true);
  });

  test('should not match error responses when recordFailedResponses is false', async () => {
    // First run: record with recordFailedResponses true
    await replayAPI.start('test-mixed-responses', {
      recordingsDir: TEST_DIR,
      recordFailedResponses: true
    });

    // Record both successful and error responses
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    await response1.json();

    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/999999');
    await response2.text();

    await replayAPI.done();

    // Second run: replay with recordFailedResponses false (default)
    await replayAPI.start('test-mixed-responses', {
      recordingsDir: TEST_DIR
      // recordFailedResponses defaults to false
    });

    // Should be able to match the successful response
    const response3 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    expect(response3.status).toBe(200);

    // Should NOT be able to match the error response (filtered out), but will make actual call
    const response4 = await fetch('https://jsonplaceholder.typicode.com/posts/999999');
    // The actual call to a non-existent post should return 404
    expect(response4.status).toBe(404);

    const result = await replayAPI.done();
    expect(result.mode).toBe('replay');
    expect(result.wasReplayed).toBe(true); // At least one was replayed
  });

  test('should record 2xx and 3xx responses by default', async () => {
    // Create a mock server with various response codes
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/success') {
          return new Response('OK', { status: 200 });
        } else if (url.pathname === '/redirect') {
          return new Response('Moved', { status: 301 });
        }
        return new Response('Not Found', { status: 404 });
      }
    });

    const baseUrl = `http://localhost:${server.port}`;

    try {
      await replayAPI.start('test-successful-responses', {
        recordingsDir: TEST_DIR
      });

      // Make requests with different status codes
      const response1 = await fetch(`${baseUrl}/success`);
      await response1.text();

      const response2 = await fetch(`${baseUrl}/redirect`);
      await response2.text();

      try {
        const response3 = await fetch(`${baseUrl}/error`);
        await response3.text();
      } catch {
        // Ignore
      }

      await replayAPI.done();

      // Check that only 2xx and 3xx responses were recorded
      const recordingPath = join(TEST_DIR, 'test-successful-responses.json');
      expect(existsSync(recordingPath)).toBe(true);

      const recording = await Bun.file(recordingPath).json();
      expect(recording.calls.length).toBe(2); // Only 200 and 301, not 404

      const statuses = recording.calls.map((call) => call.response.status);
      expect(statuses).toContain(200);
      expect(statuses).toContain(301);
      expect(statuses).not.toContain(404);
    } finally {
      server.stop();
    }
  });
});
