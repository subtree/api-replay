/**
 * Configuration for matching requests during replay.
 * Controls which parts of HTTP requests are considered when finding matching recorded calls.
 */
export interface MatchingConfig {
  /** Inclusion rules - only specified elements will be matched */
  include?: {
    /** Only these headers will be considered for matching (case-insensitive) */
    headers?: string[];
  };
  /** Exclusion rules - specified elements will be ignored during matching */
  exclude?: {
    /** These headers will be ignored during matching (case-insensitive) */
    headers?: string[];
    /** These query parameters will be ignored during matching */
    query?: string[];
    /** If true, request body will be ignored during matching */
    body?: boolean;
  };
  /**
   * Enable debug logging for this session.
   * When true, logs recording/replay operations to console.
   * Can also be enabled globally via APIREPLAYLOGS environment variable.
   */
  debug?: boolean;
  /**
   * Directory where recordings will be stored.
   * Defaults to '.api-replay' in the current working directory.
   * Path can be relative to cwd or absolute.
   */
  recordingsDir?: string;
  /**
   * Whether to record and match responses with HTTP error status codes (4xx, 5xx).
   * When false (default), only successful responses (2xx, 3xx) are recorded and matched.
   * When true, all responses including errors are recorded and matched.
   */
  recordFailedResponses?: boolean;
  /**
   * Configuration for recording response headers.
   * By default, response headers are not recorded.
   * - string[]: Only record these specific headers (case-insensitive)
   * - "*": Record all response headers
   * - undefined/false: Don't record any response headers (default)
   */
  recordResponseHeaders?: string[] | '*';
}

/**
 * Represents a recorded HTTP request.
 */
export interface RecordedRequest {
  /** HTTP method (GET, POST, etc.) */
  method: string;
  /** Full URL including query parameters */
  url: string;
  /** Request headers as key-value pairs (keys are lowercase) */
  headers: Record<string, string>;
  /** Request body as string, or null if no body */
  body: string | null;
}

/**
 * Represents a recorded HTTP response.
 */
export interface RecordedResponse {
  /** HTTP status code (200, 404, etc.) */
  status: number;
  /** Response headers as key-value pairs (keys are lowercase) */
  headers: Record<string, string>;
  /** Response body as string */
  body: string;
}

/**
 * Represents a complete recorded HTTP request-response pair.
 */
export interface RecordedCall {
  /** The HTTP request that was made */
  request: RecordedRequest;
  /** The HTTP response that was received */
  response: RecordedResponse;
}

/**
 * Structure of a recording file saved to disk.
 * Contains metadata and all recorded HTTP calls for a test.
 */
export interface RecordingFile {
  /** Metadata about the recording */
  meta: {
    /** ISO timestamp when recording was created */
    recordedAt: string;
    /** Name of the test that created this recording */
    testName: string;
    /** Version of api-replay that created this recording */
    replayAPIVersion: string;
  };
  /** Array of all recorded HTTP request-response pairs */
  calls: RecordedCall[];
}

/**
 * Search details for debugging when no matching recording is found.
 */
export interface SearchDetails {
  /** The HTTP method being searched for */
  method: string;
  /** The full URL being searched for */
  url: string;
  /** The URL pathname */
  pathname: string;
  /** Query parameters as key-value pairs */
  queryParams: Record<string, string>;
  /** Request headers as key-value pairs */
  headers: Record<string, string>;
  /** Request body content */
  body: string | null;
  /** All available recordings with their details */
  availableRecordings: Array<{
    method: string;
    url: string;
    pathname: string;
    queryParams: Record<string, string>;
    headers: Record<string, string>;
    bodyLength?: number; // Length of body content for reference
  }>;
}

/**
 * Result of searching for a matching recorded call.
 */
export interface SearchResult {
  /** The matching recorded call, or null if no match found */
  call: RecordedCall | null;
  /** Search details for debugging (only present when no match found) */
  searchDetails?: SearchDetails;
}
