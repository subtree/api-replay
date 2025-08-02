import { RecordingFile, RecordedResponse, SearchResult, SearchDetails, MatchingConfig, RecordedCall } from './types';
import { testNameToFilename, objectToHeaders } from './utils';
import { RequestMatcher } from './matcher';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export class Replayer {
  private recordingFile: RecordingFile | null = null;
  private recordingsDir: string;
  private config: MatchingConfig;

  constructor(recordingsDir: string, config: MatchingConfig = {}) {
    this.recordingsDir = recordingsDir;
    this.config = config;
  }

  async loadRecording(testName: string): Promise<RecordingFile> {
    if (this.recordingFile) {
      return this.recordingFile;
    }

    const filename = testNameToFilename(testName);
    const filepath = join(this.recordingsDir, filename);

    if (!existsSync(filepath)) {
      throw new Error(`Recording file not found: ${filepath}`);
    }

    const file = Bun.file(filepath);
    const content = await file.text();

    try {
      this.recordingFile = JSON.parse(content) as RecordingFile;
      return this.recordingFile;
    } catch (error) {
      throw new Error(`Failed to parse recording file: ${filepath}. Error: ${error}`);
    }
  }

  async findMatchingCall(request: Request, matcher: RequestMatcher): Promise<SearchResult> {
    if (!this.recordingFile) {
      throw new Error('No recording file loaded');
    }

    const requestData = await matcher.extractRequestData(request);
    const availableCalls = this.getMatchableCalls();

    for (const call of availableCalls) {
      if (await matcher.matches(call.request, request)) {
        return { call };
      }
    }

    // No match found - create search details for debugging
    const filteredHeaders = this.filterHeaders(requestData.headers);
    const filteredBody = this.filterBody(requestData.body);
    const shouldIncludeHeaders = this.shouldIncludeHeaders();
    const shouldIncludeBody = this.shouldIncludeBody();

    const searchDetails: SearchDetails = {
      method: requestData.method,
      url: requestData.url,
      pathname: new URL(requestData.url).pathname,
      queryParams: this.filterQueryParams(Object.fromEntries(new URL(requestData.url).searchParams)),
      availableRecordings: availableCalls.map((call) => {
        const recordingHeaders = this.filterHeaders(call.request.headers);
        const recordingBodyLength = this.filterBody(call.request.body) ? call.request.body?.length : undefined;

        const recording: any = {
          method: call.request.method,
          url: call.request.url,
          pathname: new URL(call.request.url).pathname,
          queryParams: this.filterQueryParams(Object.fromEntries(new URL(call.request.url).searchParams))
        };

        if (shouldIncludeHeaders) {
          recording.headers = recordingHeaders;
        }

        if (shouldIncludeBody && recordingBodyLength !== undefined) {
          recording.bodyLength = recordingBodyLength;
        }

        return recording;
      })
    };

    if (shouldIncludeHeaders) {
      searchDetails.headers = filteredHeaders;
    }

    if (shouldIncludeBody) {
      searchDetails.body = filteredBody;
    }

    return { call: null, searchDetails };
  }

  createResponse(recorded: RecordedResponse): Response {
    const headers = objectToHeaders(recorded.headers);

    // Ensure body is properly formatted based on content-type
    const contentType = headers.get('content-type') || '';
    let body: string | null;

    if (contentType.includes('application/json') && recorded.body) {
      // For JSON responses, ensure the body is valid JSON
      try {
        // Parse and re-stringify to ensure valid JSON
        const jsonData = JSON.parse(recorded.body);
        body = JSON.stringify(jsonData);
      } catch {
        // If parsing fails, use the body as-is
        body = recorded.body;
      }
    } else {
      body = recorded.body || '';
    }

    return new Response(body, {
      status: recorded.status,
      headers
    });
  }

  private getMatchableCalls(): RecordedCall[] {
    if (!this.recordingFile) {
      return [];
    }

    // If recordFailedResponses is explicitly set to true, include all calls
    if (this.config.recordFailedResponses === true) {
      return this.recordingFile.calls;
    }

    // Default behavior: only match successful responses (2xx and 3xx)
    return this.recordingFile.calls.filter((call) => call.response.status >= 200 && call.response.status < 400);
  }

  reset(): void {
    this.recordingFile = null;
  }

  private filterHeaders(headers: Record<string, string>): Record<string, string> {
    const includedHeaders = this.config.include?.headers || [];

    // If no headers are explicitly included for matching, don't show them in search details
    if (includedHeaders.length === 0) {
      return {};
    }

    // Only show headers that are considered for matching
    const filtered: Record<string, string> = {};
    for (const header of includedHeaders) {
      const headerLower = header.toLowerCase();
      if (headers[headerLower] !== undefined) {
        filtered[headerLower] = headers[headerLower];
      }
    }
    return filtered;
  }

  private filterQueryParams(queryParams: Record<string, string>): Record<string, string> {
    const excludedParams = this.config.exclude?.query || [];

    // Filter out excluded query parameters
    const filtered: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (!excludedParams.includes(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  private filterBody(body: string | null): string | null {
    // If body matching is excluded, don't show it in search details
    if (this.config.exclude?.body === true) {
      return null;
    }
    return body;
  }

  private shouldIncludeHeaders(): boolean {
    const includedHeaders = this.config.include?.headers || [];
    // Only include headers if they are explicitly included for matching
    return includedHeaders.length > 0;
  }

  private shouldIncludeBody(): boolean {
    // Include body unless explicitly excluded
    return this.config.exclude?.body !== true;
  }
}
