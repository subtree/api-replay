import { expect, test, describe, afterEach } from 'bun:test';
import { replayAPI } from '../src/index';
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';

describe('Detailed Error Logging', () => {
  const testName = 'detailed-error-test';
  const recordingsDir = join(process.cwd(), '.api-replay');
  const filepath = join(recordingsDir, `${testName}.json`);

  afterEach(async () => {
    // Ensure replayAPI is stopped if still active
    try {
      await replayAPI.done();
    } catch {
      // Ignore if not active
    }
    if (existsSync(filepath)) {
      unlinkSync(filepath);
    }
  });

  test('should provide detailed search information when no match found', async () => {
    // Create a recording with a specific request
    await replayAPI.start(testName, {
      debug: true,
      recordFailedResponses: true,
      include: {
        headers: ['content-type', 'authorization', 'x-custom-header']
      }
    });

    // Make a request that will be recorded
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1?userId=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'value1'
      },
      body: JSON.stringify({ title: 'Test Post', body: 'Test content' })
    });

    await response.text(); // Consume the response
    await replayAPI.done();

    // Now try to replay with a different request
    await replayAPI.start(testName, {
      debug: true,
      recordFailedResponses: true,
      include: {
        headers: ['content-type', 'authorization', 'x-custom-header']
      }
    });

    try {
      // Make a request that doesn't match the recorded one
      await fetch('https://jsonplaceholder.typicode.com/posts/2?userId=2', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer token456',
          'X-Custom-Header': 'value2'
        }
      });

      // This should not be reached
      expect(true).toBe(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Verify the error contains detailed search information
      expect(errorMessage).toContain(
        'No matching recorded call found for: GET https://jsonplaceholder.typicode.com/posts/2?userId=2'
      );
      expect(errorMessage).toContain('Search details:');

      // Parse the JSON search details
      const searchDetailsMatch = errorMessage.match(/Search details:\n([\s\S]*)/);
      expect(searchDetailsMatch).toBeTruthy();

      if (searchDetailsMatch) {
        const searchDetails = JSON.parse(searchDetailsMatch[1]);

        // Verify the search details structure
        expect(searchDetails.method).toBe('GET');
        expect(searchDetails.url).toBe('https://jsonplaceholder.typicode.com/posts/2?userId=2');
        expect(searchDetails.pathname).toBe('/posts/2');
        expect(searchDetails.queryParams).toEqual({ userId: '2' });
        expect(searchDetails.headers).toHaveProperty('authorization', 'Bearer token456');
        expect(searchDetails.headers).toHaveProperty('x-custom-header', 'value2');
        expect(searchDetails.body).toBeNull();

        // Verify available recordings
        expect(searchDetails.availableRecordings).toHaveLength(1);
        const availableRecording = searchDetails.availableRecordings[0];
        expect(availableRecording.method).toBe('POST');
        expect(availableRecording.url).toBe('https://jsonplaceholder.typicode.com/posts/1?userId=1');
        expect(availableRecording.pathname).toBe('/posts/1');
        expect(availableRecording.queryParams).toEqual({ userId: '1' });
        expect(availableRecording.headers).toHaveProperty('authorization', 'Bearer token123');
        expect(availableRecording.headers).toHaveProperty('x-custom-header', 'value1');
        expect(availableRecording.bodyLength).toBeGreaterThan(0);
      }
    }

    await replayAPI.done();
  });

  test('should show matching configuration in debug mode', async () => {
    const config = {
      debug: true,
      exclude: {
        headers: ['authorization'],
        query: ['timestamp']
      }
    };

    // Create a recording
    await replayAPI.start(testName, config);
    await fetch('https://jsonplaceholder.typicode.com/posts/1');
    await replayAPI.done();

    // Replay with debug enabled
    await replayAPI.start(testName, config);

    await fetch('https://jsonplaceholder.typicode.com/posts/1', {
      headers: {
        Authorization: 'Bearer different-token'
      }
    });

    await replayAPI.done();
  });
});
