# TODO: api-replay Implementation

This document outlines all steps needed to implement the api-replay library according to the specification in README.md.

## 🎯 Project Setup

### ✅ Initial Configuration
- [ ] Create `package.json` with:
  - Name: `api-replay`
  - Version: `1.0.0`
  - Main: `dist/index.js`
  - Types: `dist/index.d.ts`
  - License: MIT
  - Author: Pål Brattberg
  - Keywords: bun, testing, http, recording, replay, api
  - Engines: specify Bun version requirement
  - Scripts:
    - `build`: TypeScript compilation
    - `test`: Bun test runner
    - `test:watch`: Bun test runner in watch mode
    - `typecheck`: Type checking without emit
    - `prepublishOnly`: Build before publishing

- [ ] Create `tsconfig.json` with:
  - Target: ESNext
  - Module: ESNext
  - ModuleResolution: bundler
  - Strict mode enabled
  - Output directory: `dist/`
  - Include: `src/**/*`
  - Exclude: `node_modules`, `dist`, `__tests__`

- [ ] Create `bunfig.toml` for Bun-specific configuration

- [ ] Add `.gitignore` with:
  - `node_modules/`
  - `dist/`
  - `apirecordings/`
  - `*.log`
  - `.DS_Store`

- [ ] Create `.npmignore` to exclude:
  - `__tests__/`
  - `apirecordings/`
  - `src/`
  - `tsconfig.json`
  - `bunfig.toml`
  - `TODO.md`
  - `ai-history.md`
  - `CLAUDE.md`

## 📁 Core Implementation

### ✅ Type Definitions (`src/types.ts`)
- [ ] Define `MatchingConfig` interface:
  ```typescript
  interface MatchingConfig {
    include?: {
      headers?: string[];
    };
    exclude?: {
      headers?: string[];
      query?: string[];
      body?: boolean;
    };
  }
  ```

- [ ] Define `RecordedRequest` interface:
  ```typescript
  interface RecordedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string | null;
  }
  ```

- [ ] Define `RecordedResponse` interface:
  ```typescript
  interface RecordedResponse {
    status: number;
    headers: Record<string, string>;
    body: string;
  }
  ```

- [ ] Define `RecordedCall` interface:
  ```typescript
  interface RecordedCall {
    request: RecordedRequest;
    response: RecordedResponse;
  }
  ```

- [ ] Define `RecordingFile` interface:
  ```typescript
  interface RecordingFile {
    meta: {
      recordedAt: string;
      testName: string;
      replayAPIVersion: string;
    };
    calls: RecordedCall[];
  }
  ```

### ✅ Request Matcher (`src/matcher.ts`)
- [ ] Create `RequestMatcher` class with:
  - Constructor accepting `MatchingConfig`
  - Method `matches(recorded: RecordedRequest, incoming: Request): boolean`
  - Helper `extractRequestData(request: Request): Promise<RecordedRequest>`
  - URL parsing and comparison logic
  - Query parameter matching with exclusions
  - Header matching with includes/excludes
  - Body comparison with option to exclude
  - Handle case-insensitive header names

- [ ] Implement matching algorithm:
  1. Always match method and pathname
  2. Match query parameters (excluding specified ones)
  3. Match included headers (if specified)
  4. Exclude specified headers from comparison
  5. Match body unless excluded

### ✅ Recorder (`src/recorder.ts`)
- [ ] Create `Recorder` class with:
  - Property to store recorded calls
  - Method `recordCall(request: Request, response: Response): Promise<void>`
  - Method `saveRecording(testName: string): Promise<void>`
  - Convert test name to filename (replace spaces/slashes)
  - Ensure `apirecordings/` directory exists
  - Write pretty-printed JSON using `Bun.write()`

- [ ] Handle edge cases:
  - Large response bodies
  - Binary responses (store as base64?)
  - Streaming responses
  - Failed requests (non-2xx status codes)

### ✅ Replayer (`src/replayer.ts`)
- [ ] Create `Replayer` class with:
  - Method `loadRecording(testName: string): Promise<RecordingFile>`
  - Method `findMatchingCall(request: Request, matcher: RequestMatcher): Promise<RecordedCall | null>`
  - Method `createResponse(recorded: RecordedResponse): Response`
  - Handle missing recording files gracefully
  - Support returning recorded headers and status codes

### ✅ Main API (`src/index.ts`)
- [ ] Create `ReplayAPI` class implementing:
  - Private properties:
    - `originalFetch: typeof fetch | null`
    - `isActive: boolean`
    - `mode: 'record' | 'replay' | null`
    - `testName: string | null`
    - `config: MatchingConfig | null`
    - `recorder: Recorder | null`
    - `replayer: Replayer | null`
    - `verbose: boolean = true`
    - `recordedCalls: RecordedCall[]`

- [ ] Implement `start(testName: string, config?: MatchingConfig)`:
  1. Check if already active (throw error if so)
  2. Store original fetch
  3. Determine mode (record if no file exists, replay if it does)
  4. Override global fetch with interceptor
  5. Initialize recorder or replayer based on mode
  6. Log mode if verbose

- [ ] Implement fetch interceptor:
  ```typescript
  globalThis.fetch = async (input, init?) => {
    if (mode === 'record') {
      const response = await originalFetch(input, init);
      await recorder.recordCall(request, response);
      return response;
    } else if (mode === 'replay') {
      const matched = await replayer.findMatchingCall(request, matcher);
      if (!matched) throw new Error('No matching recorded call');
      return replayer.createResponse(matched.response);
    }
  };
  ```

- [ ] Implement `done()`:
  1. Restore original fetch
  2. If recording, save to file
  3. Reset all state
  4. Log completion if verbose

- [ ] Implement `setVerbose(enabled: boolean)`:
  - Simple setter for verbose property

- [ ] Export singleton instance:
  ```typescript
  export const replayAPI = new ReplayAPI();
  ```

### ✅ Utilities (`src/utils.ts`)
- [ ] Create filename converter:
  ```typescript
  function testNameToFilename(testName: string): string {
    return testName
      .replace(/\//g, '--')
      .replace(/\s+/g, '-')
      .toLowerCase() + '.json';
  }
  ```

- [ ] Create directory ensurer:
  ```typescript
  async function ensureDirectory(path: string): Promise<void> {
    // Use Bun APIs to create directory if not exists
  }
  ```

- [ ] Create request/response serializers:
  - Handle different body types (JSON, text, FormData, etc.)
  - Convert Headers object to plain object
  - Handle edge cases (null bodies, empty responses)

## 🧪 Testing

### ✅ Test Setup (`__tests__/setup.ts`)
- [ ] Create test utilities:
  - Helper to clean up recordings between tests
  - Mock server using jsonplaceholder.typicode.com
  - Assertion helpers for recorded files

### ✅ Core Tests (`__tests__/api-replay.test.ts`)
- [ ] Test basic recording and replay:
  ```typescript
  test('records and replays a simple GET request', async () => {
    // First run - record
    await replayAPI.start('simple-get-test');
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data = await response.json();
    await replayAPI.done();
    
    // Second run - replay
    await replayAPI.start('simple-get-test');
    const response2 = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data2 = await response2.json();
    await replayAPI.done();
    
    expect(data2).toEqual(data);
  });
  ```

- [ ] Test matching configurations:
  - Include specific headers
  - Exclude query parameters
  - Exclude body from matching
  - Multiple simultaneous configurations

- [ ] Test error scenarios:
  - No matching recording found
  - Corrupted recording file
  - Network errors during recording
  - Calling start() twice without done()

- [ ] Test different request types:
  - GET requests
  - POST with JSON body
  - POST with FormData
  - PUT/PATCH/DELETE methods
  - Requests with custom headers

### ✅ Matcher Tests (`__tests__/matcher.test.ts`)
- [ ] Test URL matching logic
- [ ] Test query parameter inclusion/exclusion
- [ ] Test header matching with various configurations
- [ ] Test body matching and exclusion
- [ ] Test case sensitivity handling

### ✅ Edge Case Tests (`__tests__/edge-cases.test.ts`)
- [ ] Test with large payloads
- [ ] Test with special characters in test names
- [ ] Test with concurrent requests
- [ ] Test with redirects
- [ ] Test with timeout scenarios

## 📦 Publishing Preparation

- [ ] Add comprehensive JSDoc comments to all public APIs
- [ ] Create `CHANGELOG.md` with initial 1.0.0 entry
- [ ] Update README.md with:
  - npm/bun badge
  - Link to npm package
  - Contributing guidelines

- [ ] Run final checks:
  - All tests passing
  - TypeScript builds without errors
  - No sensitive data in recordings
  - Package.json has all required fields

- [ ] Test local installation:
  ```bash
  bun link
  # In another project:
  bun link api-replay
  ```

## 🔄 CI/CD (Optional Future Enhancement)

- [ ] GitHub Actions workflow for:
  - Running tests on push
  - Type checking
  - Auto-publishing to npm on tags
  - Testing against multiple Bun versions

## 📝 Documentation Enhancements

- [ ] Add API documentation with examples
- [ ] Create migration guide for users of similar tools
- [ ] Add troubleshooting section
- [ ] Include performance considerations

## 🎨 Code Quality

- [ ] Set up ESLint with TypeScript rules
- [ ] Configure Prettier for consistent formatting
- [ ] Add pre-commit hooks with Husky
- [ ] Ensure 100% type coverage

This TODO list should guide the implementation from start to finish, ensuring all aspects of the api-replay library are properly built according to the specification.