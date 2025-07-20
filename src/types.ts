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
