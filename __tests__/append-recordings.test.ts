import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { replayAPI } from '../src/index';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Append Recordings', () => {
  const recordingsDir = '.test-append-recordings';
  const testName = 'append-test';
  const recordingFile = join(recordingsDir, `${testName}.json`);

  beforeEach(() => {
    // Clean up any existing recordings
    if (existsSync(recordingsDir)) {
      rmSync(recordingsDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Ensure we're not in active state
    try {
      await replayAPI.done();
    } catch {
      // Ignore if already done
    }

    // Clean up
    if (existsSync(recordingsDir)) {
      rmSync(recordingsDir, { recursive: true });
    }
  });

  it('should append new recordings to existing file instead of overwriting', async () => {
    // First session - record one call
    await replayAPI.start(testName, { recordingsDir });
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    await response1.json();
    await replayAPI.done();

    // Verify first recording exists
    expect(existsSync(recordingFile)).toBe(true);
    const recording1 = JSON.parse(readFileSync(recordingFile, 'utf-8'));
    expect(recording1.calls).toHaveLength(1);
    expect(recording1.calls[0].request.url).toContain('/posts/1');

    // Second session - record another call (should append, not overwrite)
    await replayAPI.start(testName, { recordingsDir });
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/2');
    await response2.json();
    await replayAPI.done();

    // Verify both recordings exist
    const recording2 = JSON.parse(readFileSync(recordingFile, 'utf-8'));
    expect(recording2.calls).toHaveLength(2);
    expect(recording2.calls[0].request.url).toContain('/posts/1');
    expect(recording2.calls[1].request.url).toContain('/posts/2');

    // Third session - verify replay mode still works with multiple recordings
    await replayAPI.start(testName, { recordingsDir });

    // These should be replayed from the recording
    const replay1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data1 = await replay1.json();
    expect(data1.id).toBe(1);

    const replay2 = await fetch('https://jsonplaceholder.typicode.com/posts/2');
    const data2 = await replay2.json();
    expect(data2.id).toBe(2);

    const result = await replayAPI.done();
    expect(result.wasReplayed).toBe(true);
    expect(result.mode).toBe('replay');
  });

  it('should not duplicate existing recordings when appending', async () => {
    // First session - record a call
    await replayAPI.start(testName, { recordingsDir });
    const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    await response1.json();
    await replayAPI.done();

    // Second session - make the same call (should reuse, not duplicate)
    await replayAPI.start(testName, { recordingsDir });
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    await response2.json();
    await replayAPI.done();

    // Verify no duplication
    const recording = JSON.parse(readFileSync(recordingFile, 'utf-8'));
    expect(recording.calls).toHaveLength(1);
    expect(recording.calls[0].request.url).toContain('/posts/1');
  });
});
