export interface MatchingConfig {
  include?: {
    headers?: string[];
  };
  exclude?: {
    headers?: string[];
    query?: string[];
    body?: boolean;
  };
}

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
}

export interface RecordedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface RecordedCall {
  request: RecordedRequest;
  response: RecordedResponse;
}

export interface RecordingFile {
  meta: {
    recordedAt: string;
    testName: string;
    replayAPIVersion: string;
  };
  calls: RecordedCall[];
}