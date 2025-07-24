import { RecordingFile, RecordedResponse, SearchResult, SearchDetails } from './types';
import { testNameToFilename, objectToHeaders } from './utils';
import { RequestMatcher } from './matcher';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export class Replayer {
  private recordingFile: RecordingFile | null = null;
  private recordingsDir: string;

  constructor(recordingsDir: string) {
    this.recordingsDir = recordingsDir;
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
    const availableCalls = this.recordingFile.calls;

    for (const call of availableCalls) {
      if (await matcher.matches(call.request, request)) {
        return { call };
      }
    }

    // No match found - create search details for debugging
    const searchDetails: SearchDetails = {
      method: requestData.method,
      url: requestData.url,
      pathname: new URL(requestData.url).pathname,
      queryParams: Object.fromEntries(new URL(requestData.url).searchParams),
      headers: requestData.headers,
      body: requestData.body,
      availableRecordings: availableCalls.map((call) => ({
        method: call.request.method,
        url: call.request.url,
        pathname: new URL(call.request.url).pathname,
        queryParams: Object.fromEntries(new URL(call.request.url).searchParams),
        headers: call.request.headers,
        bodyLength: call.request.body ? call.request.body.length : undefined
      }))
    };

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

  reset(): void {
    this.recordingFile = null;
  }
}
