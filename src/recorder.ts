import { RecordedCall, RecordingFile, MatchingConfig } from './types';
import { testNameToFilename, ensureDirectory, headersToObject, extractBody, parseRequestBody } from './utils';
import { RequestMatcher } from './matcher';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export class Recorder {
  private recordedCalls: RecordedCall[] = [];
  private recordingsDir: string;
  private config: MatchingConfig;
  private existingCalls: RecordedCall[] = [];

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
        headers: this.filterResponseHeaders(headersToObject(response.headers)),
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

  private filterResponseHeaders(headers: Record<string, string>): Record<string, string> {
    const recordResponseHeaders = this.config.recordResponseHeaders;

    // Default behavior: no response headers are recorded
    if (!recordResponseHeaders) {
      return {};
    }

    // If "*", record all headers
    if (recordResponseHeaders === '*') {
      return headers;
    }

    // If array of specific headers, only record those
    if (Array.isArray(recordResponseHeaders)) {
      const filtered: Record<string, string> = {};
      for (const header of recordResponseHeaders) {
        const headerLower = header.toLowerCase();
        if (headers[headerLower] !== undefined) {
          filtered[headerLower] = headers[headerLower];
        }
      }
      return filtered;
    }

    return {};
  }

  async saveRecording(testName: string): Promise<void> {
    // Only save if we have recorded calls
    if (this.recordedCalls.length === 0) {
      return;
    }

    await ensureDirectory(this.recordingsDir);

    const filename = testNameToFilename(testName);
    const filepath = join(this.recordingsDir, filename);

    // Load existing recordings first
    let allCalls: RecordedCall[] = [...this.existingCalls];

    // Add new calls that weren't already matched
    allCalls = allCalls.concat(this.recordedCalls);

    const recordingFile: RecordingFile = {
      meta: {
        recordedAt: new Date().toISOString(),
        testName,
        replayAPIVersion: '1.0.0'
      },
      calls: allCalls
    };

    await Bun.write(filepath, JSON.stringify(recordingFile, null, 2));
  }

  async findExistingCall(request: Request, matcher: RequestMatcher): Promise<RecordedCall | null> {
    // First check in-memory recorded calls from this session
    for (const call of this.recordedCalls) {
      if (await matcher.matches(call.request, request)) {
        return call;
      }
    }
    // Then check existing calls loaded from file
    for (const call of this.existingCalls) {
      if (await matcher.matches(call.request, request)) {
        return call;
      }
    }
    return null;
  }

  async loadExistingRecording(testName: string): Promise<void> {
    const filename = testNameToFilename(testName);
    const filepath = join(this.recordingsDir, filename);

    if (existsSync(filepath)) {
      const file = Bun.file(filepath);
      const content = await file.text();
      const recordingFile: RecordingFile = JSON.parse(content);
      this.existingCalls = recordingFile.calls || [];
    } else {
      this.existingCalls = [];
    }
  }

  reset(): void {
    this.recordedCalls = [];
    this.existingCalls = [];
  }
}
