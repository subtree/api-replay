import { RecordedCall, RecordingFile, MatchingConfig } from './types';
import { testNameToFilename, ensureDirectory, headersToObject, extractBody, parseRequestBody } from './utils';
import { RequestMatcher } from './matcher';
import { join } from 'node:path';

export class Recorder {
  private recordedCalls: RecordedCall[] = [];
  private recordingsDir: string;
  private config: MatchingConfig;

  constructor(recordingsDir: string, config: MatchingConfig = {}) {
    this.recordingsDir = recordingsDir;
    this.config = config;
  }

  async recordCall(request: Request, response: Response): Promise<void> {
    // Skip recording failed responses unless explicitly configured to record them
    if (!this.shouldRecordResponse(response)) {
      return;
    }

    const recordedCall: RecordedCall = {
      request: {
        method: request.method,
        url: this.filterUrl(request.url),
        headers: this.filterHeaders(headersToObject(request.headers)),
        body: this.config.exclude?.body ? null : await parseRequestBody(request)
      },
      response: {
        status: response.status,
        headers: headersToObject(response.headers),
        body: await extractBody(response)
      }
    };

    this.recordedCalls.push(recordedCall);
  }

  private shouldRecordResponse(response: Response): boolean {
    // If recordFailedResponses is explicitly set to true, record all responses
    if (this.config.recordFailedResponses === true) {
      return true;
    }

    // Default behavior: only record successful responses (2xx and 3xx)
    return response.status >= 200 && response.status < 400;
  }

  private filterUrl(url: string): string {
    const excludedParams = this.config.exclude?.query || [];
    if (excludedParams.length === 0) {
      return url;
    }

    const urlObj = new URL(url);
    excludedParams.forEach((param) => {
      urlObj.searchParams.delete(param);
    });

    return urlObj.toString();
  }

  private filterHeaders(headers: Record<string, string>): Record<string, string> {
    const includedHeaders = this.config.include?.headers || [];

    // Default behavior: no headers are recorded unless explicitly included
    if (includedHeaders.length === 0) {
      return {};
    }

    // If specific headers are included, only keep those
    const filtered: Record<string, string> = {};
    for (const header of includedHeaders) {
      const headerLower = header.toLowerCase();
      if (headers[headerLower] !== undefined) {
        filtered[headerLower] = headers[headerLower];
      }
    }
    return filtered;
  }

  async saveRecording(testName: string): Promise<void> {
    await ensureDirectory(this.recordingsDir);

    const filename = testNameToFilename(testName);
    const filepath = join(this.recordingsDir, filename);

    const recordingFile: RecordingFile = {
      meta: {
        recordedAt: new Date().toISOString(),
        testName,
        replayAPIVersion: '1.0.0'
      },
      calls: this.recordedCalls
    };

    await Bun.write(filepath, JSON.stringify(recordingFile, null, 2));
  }

  async findExistingCall(request: Request, matcher: RequestMatcher): Promise<RecordedCall | null> {
    for (const call of this.recordedCalls) {
      if (await matcher.matches(call.request, request)) {
        return call;
      }
    }
    return null;
  }

  reset(): void {
    this.recordedCalls = [];
  }
}
