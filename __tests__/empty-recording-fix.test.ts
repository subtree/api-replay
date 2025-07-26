import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { replayAPI } from '../src';
import * as fs from 'fs';
import * as path from 'path';

describe('Empty Recording File Prevention', () => {
  const recordingsDir = path.join(__dirname, '.api-replay-test');

  beforeEach(() => {
    // Clean up any existing recordings
    if (fs.existsSync(recordingsDir)) {
      fs.rmSync(recordingsDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Only call done() if a session is active
    if (replayAPI.getMode() !== null) {
      await replayAPI.done();
    }
    // Clean up recordings after test
    if (fs.existsSync(recordingsDir)) {
      fs.rmSync(recordingsDir, { recursive: true });
    }
  });

  test('should not create recording file when no calls are made', async () => {
    // Start recording session
    await replayAPI.start('empty-test', { recordingsDir });

    // Don't make any API calls

    // End recording session
    await replayAPI.done();

    // Check that no recording file was created
    const expectedFile = path.join(recordingsDir, 'empty-test.json');
    expect(fs.existsSync(expectedFile)).toBe(false);

    // Directory might not even exist if no recordings
    expect(fs.existsSync(recordingsDir) ? fs.readdirSync(recordingsDir).length : 0).toBe(0);
  });

  test('should not create recording file when all responses are errors and recordFailedResponses is false', async () => {
    // Mock server that only returns errors
    const mockServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response('Not Found', { status: 404 });
      }
    });

    const serverUrl = `http://localhost:${mockServer.port}`;

    // Start recording with default config (recordFailedResponses: false)
    await replayAPI.start('error-only-test', { recordingsDir });

    // Make only error requests
    const response1 = await fetch(`${serverUrl}/test1`);
    expect(response1.status).toBe(404);

    const response2 = await fetch(`${serverUrl}/test2`);
    expect(response2.status).toBe(404);

    // End recording session
    await replayAPI.done();
    mockServer.stop();

    // Check that no recording file was created
    const expectedFile = path.join(recordingsDir, 'error-only-test.json');
    expect(fs.existsSync(expectedFile)).toBe(false);
  });

  test('should create recording file when at least one successful call is made', async () => {
    // Mock server with mixed responses
    const mockServer = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === '/success') {
          return new Response('OK', { status: 200 });
        }
        return new Response('Not Found', { status: 404 });
      }
    });

    const serverUrl = `http://localhost:${mockServer.port}`;

    // Start recording
    await replayAPI.start('mixed-test', { recordingsDir });

    // Make error request first
    await fetch(`${serverUrl}/error`);

    // Make successful request
    const response = await fetch(`${serverUrl}/success`);
    expect(response.status).toBe(200);

    // Make another error request
    await fetch(`${serverUrl}/another-error`);

    // End recording session
    await replayAPI.done();
    mockServer.stop();

    // Check that recording file was created
    const expectedFile = path.join(recordingsDir, 'mixed-test.json');
    expect(fs.existsSync(expectedFile)).toBe(true);

    // Verify it only contains the successful call
    const recording = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
    expect(recording.calls.length).toBe(1);
    expect(recording.calls[0].response.status).toBe(200);
  });

  test('should create recording file with recordFailedResponses enabled', async () => {
    // Mock server that returns errors
    const mockServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response('Server Error', { status: 500 });
      }
    });

    const serverUrl = `http://localhost:${mockServer.port}`;

    // Start recording with recordFailedResponses enabled
    await replayAPI.start('record-errors-test', {
      recordingsDir,
      recordFailedResponses: true
    });

    // Make error requests
    const response1 = await fetch(`${serverUrl}/test1`);
    expect(response1.status).toBe(500);

    const response2 = await fetch(`${serverUrl}/test2`);
    expect(response2.status).toBe(500);

    // End recording session
    await replayAPI.done();
    mockServer.stop();

    // Check that recording file was created
    const expectedFile = path.join(recordingsDir, 'record-errors-test.json');
    expect(fs.existsSync(expectedFile)).toBe(true);

    // Verify it contains the error calls
    const recording = JSON.parse(fs.readFileSync(expectedFile, 'utf-8'));
    expect(recording.calls.length).toBe(2);
    expect(recording.calls[0].response.status).toBe(500);
    expect(recording.calls[1].response.status).toBe(500);
  });
});
