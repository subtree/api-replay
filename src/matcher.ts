import { MatchingConfig, RecordedRequest } from './types';
import { headersToObject, parseRequestBody } from './utils';

export class RequestMatcher {
  constructor(private config: MatchingConfig = {}) {}

  async matches(recorded: RecordedRequest, incoming: Request): Promise<boolean> {
    const incomingData = await this.extractRequestData(incoming);

    // Always match method
    if (recorded.method !== incomingData.method) {
      return false;
    }

    // Match URL pathname
    const recordedUrl = new URL(recorded.url);
    const incomingUrl = new URL(incomingData.url);

    if (recordedUrl.pathname !== incomingUrl.pathname) {
      return false;
    }

    // Match query parameters
    if (!this.matchQueryParams(recordedUrl, incomingUrl)) {
      return false;
    }

    // Match headers
    if (!this.matchHeaders(recorded.headers, incomingData.headers)) {
      return false;
    }

    // Match body
    if (!this.matchBody(recorded.body, incomingData.body)) {
      return false;
    }

    return true;
  }

  async extractRequestData(request: Request): Promise<RecordedRequest> {
    return {
      method: request.method,
      url: request.url,
      headers: headersToObject(request.headers),
      body: await parseRequestBody(request)
    };
  }

  private matchQueryParams(recordedUrl: URL, incomingUrl: URL): boolean {
    const excludedParams = this.config.exclude?.query || [];

    // Get all unique parameter names from both URLs
    const allParams = new Set([...recordedUrl.searchParams.keys(), ...incomingUrl.searchParams.keys()]);

    for (const param of allParams) {
      // Skip excluded parameters
      if (excludedParams.includes(param)) {
        continue;
      }

      const recordedValue = recordedUrl.searchParams.get(param);
      const incomingValue = incomingUrl.searchParams.get(param);

      if (recordedValue !== incomingValue) {
        return false;
      }
    }

    return true;
  }

  private matchHeaders(recordedHeaders: Record<string, string>, incomingHeaders: Record<string, string>): boolean {
    const includedHeaders = this.config.include?.headers || [];

    // Default behavior: headers are not matched unless explicitly included
    if (includedHeaders.length === 0) {
      return true;
    }

    // If specific headers are included, only check those
    for (const header of includedHeaders) {
      const headerLower = header.toLowerCase();
      if (recordedHeaders[headerLower] !== incomingHeaders[headerLower]) {
        return false;
      }
    }
    return true;
  }

  private matchBody(recordedBody: string | null, incomingBody: string | null): boolean {
    // If body matching is excluded, always return true
    if (this.config.exclude?.body === true) {
      return true;
    }

    // Both null or both have content
    if ((recordedBody === null) !== (incomingBody === null)) {
      return false;
    }

    // If both null, they match
    if (recordedBody === null && incomingBody === null) {
      return true;
    }

    // Compare normalized JSON if possible
    if (recordedBody && incomingBody) {
      try {
        const recordedJson = JSON.parse(recordedBody);
        const incomingJson = JSON.parse(incomingBody);
        return JSON.stringify(recordedJson) === JSON.stringify(incomingJson);
      } catch {
        // Not JSON, compare as strings
        return recordedBody === incomingBody;
      }
    }

    // Both should be null at this point
    return recordedBody === incomingBody;
  }
}
