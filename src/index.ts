import { MatchingConfig } from './types';
import { Recorder } from './recorder';
import { Replayer } from './replayer';
import { RequestMatcher } from './matcher';
import { testNameToFilename } from './utils';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Result returned by the done() method, indicating the mode and replay status.
 */
export interface ReplayResult {
  /** Whether responses were replayed from recordings (true) or from actual HTTP calls (false) */
  wasReplayed: boolean;
  /** The mode that was active - 'record' for recording new calls, 'replay' for using existing recordings */
  mode: 'record' | 'replay';
}

/**
 * Main API class for HTTP recording and replay functionality.
 *
 * This class provides a simple interface to record HTTP requests during the first test run
 * and replay them from saved recordings in subsequent runs, making tests faster and more reliable.
 *
 * @example
 * ```typescript
 * import { replayAPI } from 'api-replay';
 *
 * // Start recording/replaying for a test
 * await replayAPI.start('my-test-name');
 *
 * // Make HTTP requests as normal
 * const response = await fetch('https://api.example.com/data');
 * const data = await response.json();
 *
 * // Finish and get results
 * const result = await replayAPI.done();
 * console.log('Was replayed:', result.wasReplayed);
 * ```
 */
export class ReplayAPI {
  private originalFetch: typeof fetch | null = null;
  private isActive: boolean = false;
  private mode: 'record' | 'replay' | null = null;
  private testName: string | null = null;
  private config: MatchingConfig | null = null;
  private recorder: Recorder | null = null;
  private replayer: Replayer | null = null;
  private matcher: RequestMatcher | null = null;
  private debug: boolean = false;
  private wasReplayedFlag: boolean = false;

  /**
   * Start recording or replaying HTTP requests for a test.
   *
   * If a recording file exists for the test name, enters replay mode.
   * Otherwise, enters record mode and will save new HTTP calls.
   *
   * @param testName - Unique identifier for this test (used as filename)
   * @param config - Optional configuration for request matching during replay
   *
   * @throws {Error} If ReplayAPI is already active (call done() first)
   *
   * @example
   * ```typescript
   * // Basic usage (no logging)
   * await replayAPI.start('user-profile-test');
   *
   * // With debug logging and custom recordings directory
   * await replayAPI.start('api-test', {
   *   debug: true,
   *   recordingsDir: 'my-recordings', // Custom directory
   *   exclude: {
   *     headers: ['authorization'], // Ignore auth headers
   *     query: ['timestamp']        // Ignore timestamp params
   *   }
   * });
   *
   * // Or enable logging via environment variable
   * // APIREPLAYLOGS=true bun test
   * ```
   */
  async start(testName: string, config: MatchingConfig = {}): Promise<void> {
    if (this.isActive) {
      throw new Error('ReplayAPI is already active. Call done() first.');
    }

    this.testName = testName;
    this.config = config;
    this.wasReplayedFlag = false;
    this.matcher = new RequestMatcher(config);

    // Determine if debug logging should be enabled
    // Config debug flag takes precedence, then environment variable
    if (config.debug === true) {
      this.debug = true;
    } else {
      const envVar = process.env.APIREPLAYLOGS;
      if (envVar && (envVar === 'true' || envVar === '1' || envVar === '*')) {
        this.debug = true;
      } else {
        this.debug = false;
      }
    }

    // Determine mode based on whether recording file exists
    const configuredDir = config.recordingsDir || '.api-replay';
    const recordingsDir = configuredDir.startsWith('/') ? configuredDir : join(process.cwd(), configuredDir);
    const filename = testNameToFilename(testName);
    const filepath = join(recordingsDir, filename);

    if (existsSync(filepath)) {
      this.mode = 'replay';
      this.replayer = new Replayer(recordingsDir);
      await this.replayer.loadRecording(testName);

      if (this.debug && Object.keys(config).length > 0) {
        console.log('replay-api: Using matching config:', JSON.stringify(config, null, 2));
      }
    } else {
      this.mode = 'record';
      this.recorder = new Recorder(recordingsDir);
    }

    // Store original fetch and override it
    this.originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = this.createFetchInterceptor();

    this.isActive = true;

    if (this.debug) {
      console.log(`replay-api: Started in ${this.mode} mode for test: ${testName}`);
    }
  }

  private createFetchInterceptor() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (input: any, init?: any): Promise<Response> => {
      if (!this.originalFetch) {
        throw new Error('Original fetch is not available');
      }

      const request = new Request(input, init);

      if (this.mode === 'record') {
        // Record mode: check if we already have a matching call recorded
        if (this.recorder && this.matcher) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existingCall = await this.recorder.findExistingCall(request as any, this.matcher);
          if (existingCall) {
            // Return the existing recorded response instead of making a new request
            if (this.debug) {
              console.log(`replay-api: Reusing existing recording for: ${request.method} ${request.url}`);
            }
            // Use the replayer to create a properly formatted response
            if (!this.replayer) {
              const configuredDir = this.config?.recordingsDir || '.api-replay';
              const replayerDir = configuredDir.startsWith('/') ? configuredDir : join(process.cwd(), configuredDir);
              this.replayer = new Replayer(replayerDir);
            }
            return this.replayer.createResponse(existingCall.response);
          }
        }

        // Make real request and save it
        const requestClone = request.clone();
        const response = await this.originalFetch(input, init);

        if (this.recorder) {
          // Clone response for recording to avoid consuming the body
          const responseClone = response.clone();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await this.recorder.recordCall(requestClone as any, responseClone as any);
        }

        // Return a fresh clone to ensure the body can be consumed by the caller
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return response.clone() as any;
      } else if (this.mode === 'replay') {
        // Replay mode: find matching recorded call and return it
        if (!this.replayer || !this.matcher) {
          throw new Error('Replayer or matcher not initialized');
        }

        if (this.debug) {
          console.log(`replay-api: Searching for matching call: ${request.method} ${request.url}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const searchResult = await this.replayer.findMatchingCall(request as any, this.matcher);

        if (!searchResult.call) {
          const errorMessage = `No matching recorded call found for: ${request.method} ${request.url}`;

          if (searchResult.searchDetails) {
            throw new Error(
              `${errorMessage}\n\nSearch details:\n${JSON.stringify(searchResult.searchDetails, null, 2)}`
            );
          } else {
            throw new Error(errorMessage);
          }
        }

        const matchedCall = searchResult.call;

        if (this.debug) {
          console.log(`replay-api: Found matching call for: ${request.method} ${request.url}`);
        }

        this.wasReplayedFlag = true;
        return this.replayer.createResponse(matchedCall.response);
      }

      throw new Error('Invalid mode state');
    };
  }

  /**
   * Stop recording/replaying and clean up intercepted fetch.
   *
   * Must be called after start() to restore normal fetch behavior and save recordings.
   * Returns information about the session including mode and replay status.
   *
   * @returns Result containing mode and replay status information
   *
   * @throws {Error} If ReplayAPI is not active (call start() first)
   *
   * @example
   * ```typescript
   * await replayAPI.start('test-name');
   * // ... make HTTP requests
   * const result = await replayAPI.done();
   *
   * if (result.mode === 'record') {
   *   console.log('New recording saved');
   * } else {
   *   console.log('Used existing recording');
   * }
   * ```
   */
  async done(): Promise<ReplayResult> {
    if (!this.isActive) {
      throw new Error('ReplayAPI is not active. Call start() first.');
    }

    // Restore original fetch
    if (this.originalFetch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = this.originalFetch;
      this.originalFetch = null;
    }

    if (!this.mode) {
      throw new Error('Mode is not set');
    }

    const result: ReplayResult = {
      wasReplayed: this.wasReplayedFlag,
      mode: this.mode
    };

    // Save recording if in record mode
    if (this.mode === 'record' && this.recorder && this.testName) {
      await this.recorder.saveRecording(this.testName);
    }

    if (this.debug) {
      console.log(`replay-api: Finished in ${this.mode} mode. Was replayed: ${this.wasReplayedFlag}`);
    }

    // Reset state
    this.isActive = false;
    this.mode = null;
    this.testName = null;
    this.config = null;
    this.wasReplayedFlag = false;

    if (this.recorder) {
      this.recorder.reset();
      this.recorder = null;
    }

    if (this.replayer) {
      this.replayer.reset();
      this.replayer = null;
    }

    this.matcher = null;

    return result;
  }

  /**
   * Check if any requests were replayed in the current session.
   *
   * Returns true if at least one HTTP request was served from recordings
   * rather than making actual network calls.
   *
   * @returns True if requests were replayed, false if all were made to real APIs
   *
   * @example
   * ```typescript
   * await replayAPI.start('test-name');
   * await fetch('https://api.example.com/data');
   *
   * if (replayAPI.wasReplayed()) {
   *   console.log('Using cached response');
   * } else {
   *   console.log('Made real API call');
   * }
   *
   * await replayAPI.done();
   * ```
   */
  wasReplayed(): boolean {
    return this.wasReplayedFlag;
  }

  /**
   * Get the current operating mode.
   *
   * Returns the active mode: 'record' for saving new calls, 'replay' for using
   * existing recordings, or null if ReplayAPI is not currently active.
   *
   * @returns Current mode or null if not active
   *
   * @example
   * ```typescript
   * await replayAPI.start('test-name');
   *
   * const mode = replayAPI.getMode();
   * if (mode === 'record') {
   *   console.log('Recording new API calls');
   * } else if (mode === 'replay') {
   *   console.log('Using existing recordings');
   * }
   *
   * await replayAPI.done();
   * ```
   */
  getMode(): 'record' | 'replay' | null {
    return this.mode;
  }
}

/**
 * Pre-configured singleton instance of ReplayAPI.
 *
 * This is the main export that most users will interact with.
 * Provides a ready-to-use instance without needing to instantiate the class.
 *
 * @example
 * ```typescript
 * import { replayAPI } from 'api-replay';
 *
 * // Use the singleton instance
 * await replayAPI.start('my-test');
 * const response = await fetch('https://api.example.com/data');
 * await replayAPI.done();
 * ```
 */
export const replayAPI = new ReplayAPI();

export * from './types';
