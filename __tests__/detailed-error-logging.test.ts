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

  test('should make actual HTTP call when no match found and record new call', async () => {
    // Create a recording with a specific request
    await replayAPI.start(testName, {
      debug: true,
      recordFailedResponses: true,
      include: {
        headers: ['content-type', 'authorization', 'x-custom-header']
      }
    });

    // Make a request that will be recorded
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1?userId=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'value1'
      },
      body: JSON.stringify({ title: 'Test Post', body: 'Test content' })
    });

    await response1.text(); // Consume the response
    await replayAPI.done();

    // Now try to replay with a different request (should make actual call)
    await replayAPI.start(testName, {
      debug: true,
      recordFailedResponses: true,
      include: {
        headers: ['content-type', 'authorization', 'x-custom-header']
      }
    });

    // Make a request that doesn't match the recorded one - should make actual HTTP call
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/2?userId=2', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token456',
        'X-Custom-Header': 'value2'
      }
    });

    // Should succeed by making actual HTTP call
    expect(response2.ok).toBe(true);
    const data = await response2.json();
    expect(data.id).toBe(2);

    const result = await replayAPI.done();
    expect(result.mode).toBe('replay');
    // wasReplayed might be false if no matching calls were found and only actual calls were made
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
