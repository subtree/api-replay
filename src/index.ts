import { MatchingConfig } from './types';
import { Recorder } from './recorder';
import { Replayer } from './replayer';
import { RequestMatcher } from './matcher';
import { testNameToFilename } from './utils';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface ReplayResult {
  wasReplayed: boolean;
  mode: 'record' | 'replay';
}

export class ReplayAPI {
  private originalFetch: typeof fetch | null = null;
  private isActive: boolean = false;
  private mode: 'record' | 'replay' | null = null;
  private testName: string | null = null;
  private config: MatchingConfig | null = null;
  private recorder: Recorder | null = null;
  private replayer: Replayer | null = null;
  private matcher: RequestMatcher | null = null;
  private verbose: boolean = true;
  private wasReplayedFlag: boolean = false;

  async start(testName: string, config: MatchingConfig = {}): Promise<void> {
    if (this.isActive) {
      throw new Error('ReplayAPI is already active. Call done() first.');
    }

    this.testName = testName;
    this.config = config;
    this.wasReplayedFlag = false;
    this.matcher = new RequestMatcher(config);

    // Determine mode based on whether recording file exists
    const recordingsDir = join(process.cwd(), 'apirecordings');
    const filename = testNameToFilename(testName);
    const filepath = join(recordingsDir, filename);

    if (existsSync(filepath)) {
      this.mode = 'replay';
      this.replayer = new Replayer();
      await this.replayer.loadRecording(testName);
    } else {
      this.mode = 'record';
      this.recorder = new Recorder();
    }

    // Store original fetch and override it
    this.originalFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = this.createFetchInterceptor();

    this.isActive = true;

    if (this.verbose) {
      console.log(`🎬 ReplayAPI started in ${this.mode} mode for test: ${testName}`);
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
            if (this.verbose) {
              console.log(`🔄 Reusing existing recording for: ${request.method} ${request.url}`);
            }
            // Use the replayer to create a properly formatted response
            if (!this.replayer) {
              this.replayer = new Replayer();
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchedCall = await this.replayer.findMatchingCall(request as any, this.matcher);

        if (!matchedCall) {
          throw new Error(`No matching recorded call found for: ${request.method} ${request.url}`);
        }

        this.wasReplayedFlag = true;
        return this.replayer.createResponse(matchedCall.response);
      }

      throw new Error('Invalid mode state');
    };
  }

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

    if (this.verbose) {
      console.log(`🎬 ReplayAPI finished in ${this.mode} mode. Was replayed: ${this.wasReplayedFlag}`);
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

  setVerbose(enabled: boolean): void {
    this.verbose = enabled;
  }

  wasReplayed(): boolean {
    return this.wasReplayedFlag;
  }

  getMode(): 'record' | 'replay' | null {
    return this.mode;
  }
}

export const replayAPI = new ReplayAPI();
export * from './types';
