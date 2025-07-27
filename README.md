# 📼 api-replay

[![npm version](https://badge.fury.io/js/api-replay.svg)](https://www.npmjs.com/package/api-replay)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

A lightweight HTTP recording and replay library for Bun + TypeScript, designed to simplify and accelerate integration tests by recording real fetch responses and replaying them in future test runs.

`api-replay` helps you:
- Record HTTP API calls made during integration tests
- Replay those responses later, eliminating the need for live API access
- Speed up test runs and improve reliability
- Easily customize what parts of a request are considered for matching

---

## Basic Usage

```typescript 
import { replayAPI } from 'api-replay';

const startTime = performance.now();
await replayAPI.start('my-first-call-recording',);

// You long-running call here
const response = await fetch("https://dummyjson.com/test?delay=1500");

const endTime = performance.now();
const timeTaken = endTime - startTime;

console.log(`Time taken: ${timeTaken.toFixed(1)}ms`);

await replayAPI.done();
```

Run using `bun run file.ts`. The second time you run this, it will be very fast since it replays the recorded response instead of making a live network call.

```shell
$ bun run basic-test.ts
Time taken: 1829.2ms

$ bun run basic-test.ts
Time taken: 2.2ms
```

## More involved example

```typescript
test('can read orders for a range of dates given day', async () => {
  await replayAPI.start('shopify client/can read orders for a range of dates given day', {
    debug: true, // Enable logging for this test
    include: {
      headers: ['Authorization'], // Include Authorization header in matching to support multiple users
    },
    exclude: {
      headers: ['Cookie'], // Ignore Cookie header to avoid issues with session-specific data
      query: ['token'], // Ignore token query param to avoid issues with session-specific data
    },
    recordingsDir: 'myapirecordings', // Custom directory for storing recordings
  });

  const client = new ShopifyClient();
  const orders = await client.getOrders('2024-08-26', '2024-08-28');
  expect(orders.length).toEqual(42);

  await replayAPI.done();
});
```

---

## 📦 Installation

```bash
bun add -d api-replay
```

**npm package:** [api-replay](https://www.npmjs.com/package/api-replay)

Requirements:
- Bun >=1.1.0

This library uses native Bun APIs (`Bun.write`, `Bun.file`, etc.) and requires Bun 1.1.0 or later due to improvements in fetch and Response handling.

---

## 🧩 Library API

### `await replayAPI.start(testName: string, config?: MatchingConfig): Promise<void>`

Starts intercepting and recording or replaying API calls made via fetch.
- `testName` is used to determine the filename for storing or reading recordings
- Example: `'shopify client/can read orders for a range of dates given day'`
- Becomes: `./.api-replay/shopify-client--can-read-orders-for-a-range-of-dates-given-day.json`
- `config` (optional): controls which parts of the request are included or excluded from match comparison

### `await replayAPI.done(): Promise<void>`

Stops interception and saves recordings (if in record mode).

### 🔧 Debug Logging

Logging is **disabled by default** for clean test output. Enable it via:

**Option 1: Environment Variable**
```bash
APIREPLAYLOGS=1 bun test  
```

**Option 2: Config Option**
```typescript
await replayAPI.start('test-name', { debug: true });
```

### 🔍 Detailed Error Information

When no matching recording is found during replay, `api-replay` provides detailed error information to help you understand why the match failed. This includes:

- **What was searched for**: The exact request details (method, URL, headers, body)
- **What's available**: All recorded calls that could potentially match
- **Why it didn't match**: By comparing search criteria with available recordings

---

## ⚙️ Matching Behavior

### ✅ Always matched:
- HTTP method (GET, POST, etc.)
- URL path (/orders, /posts/1)

### ✅ By default:
- Query string (all keys)

### ❌ Not matched by default:
- Headers
- Failed responses (4xx, 5xx status codes)
- Response headers (not recorded by default)

### 🔍 When No Match is Found

If a request doesn't match any recorded calls during replay, `api-replay` throws an error with detailed information about:
- The request that was being searched for
- All available recorded calls
- The specific differences that caused the mismatch

This helps you quickly identify why the match failed and configure the appropriate exclusions or inclusions.

### ✅ Configurable via:

```typescript
type MatchingConfig = {
  include?: {
    headers?: string[];
  };
  exclude?: {
    headers?: string[];
    query?: string[];
    body?: boolean;
  };
  debug?: boolean; // Enable logging for this session
  recordingsDir?: string; // Directory for storing recordings (default: '.api-replay')
  recordFailedResponses?: boolean; // Record and match failed responses (4xx, 5xx) (default: false)
  recordResponseHeaders?: string[] | "*"; // Response headers to record (default: none)
};
```

**Examples:**

```typescript
// Match specific headers
{ include: { headers: ['Authorization'] } }

// Ignore some volatile query params
{ exclude: { query: ['timestamp', 'token'] } }

// Don't match on body
{ exclude: { body: true } }

// Enable debug logging for this test
{ debug: true }

// Use custom recordings directory
{ recordingsDir: 'my-recordings' }

// Use absolute path for recordings
{ recordingsDir: '/tmp/api-recordings' }

// Record and match failed responses
{ recordFailedResponses: true }

// Record all response headers
{ recordResponseHeaders: "*" }

// Record specific response headers only
{ recordResponseHeaders: ['content-type', 'x-api-version'] }

// Combine options
{ 
  debug: true,
  recordingsDir: 'custom-recordings',
  recordFailedResponses: true,
  recordResponseHeaders: ['content-type'],
  exclude: { headers: ['user-agent'], query: ['timestamp'] }
}
```

---

## 📋 Response Header Recording

By default, `api-replay` **does not record response headers** to keep recordings lightweight and avoid issues with volatile headers like timestamps or server-specific values.

### Default Behavior

```typescript
await replayAPI.start('my-test');

const response = await fetch('/api/data');
// Response headers are not recorded in the JSON file
```

### Recording All Response Headers

```typescript
await replayAPI.start('my-test', {
  recordResponseHeaders: "*"
});

const response = await fetch('/api/data');
// All response headers (content-type, date, server, etc.) are recorded
```

### Recording Specific Response Headers

```typescript
await replayAPI.start('my-test', {
  recordResponseHeaders: ['content-type', 'x-api-version', 'cache-control']
});

const response = await fetch('/api/data');
// Only content-type, x-api-version, and cache-control headers are recorded
```

**Note:** Response header names are case-insensitive. Headers are stored in lowercase in the recording files. See https://datatracker.ietf.org/doc/html/rfc7230#section-3.2

---

## 🚫 Failed Response Handling

By default, `api-replay` **only records and matches successful responses** (2xx and 3xx status codes). Failed responses (4xx and 5xx) are ignored to improve test reliability and avoid brittle tests that depend on specific error conditions.

### Default Behavior

```typescript
await replayAPI.start('my-test');

// These responses are recorded and matched:
await fetch('/api/users/1'); // 200 OK ✅
await fetch('/api/redirect'); // 301 Moved ✅

// These responses are ignored:
await fetch('/api/nonexistent'); // 404 Not Found ❌
await fetch('/api/server-error'); // 500 Internal Server Error ❌
```

### Recording Failed Responses

If you need to test error handling scenarios, enable `recordFailedResponses`:

```typescript
await replayAPI.start('error-handling-test', {
  recordFailedResponses: true
});

// Now all responses are recorded and matched:
await fetch('/api/users/1'); // 200 OK ✅
await fetch('/api/nonexistent'); // 404 Not Found ✅
await fetch('/api/server-error'); // 500 Internal Server Error ✅
```

---

## 📂 File Naming Convention

- By default, recordings are saved under: `./.api-replay/`
- Directory can be customized using the `recordingsDir` configuration option
- Filename is derived from the test name by replacing slashes and spaces:

```
shopify client/can read orders for a range of dates given day
=>
shopify-client--can-read-orders-for-a-range-of-dates-given-day.json
```

---

## 🗃 JSON File Format

Each recording file is a pretty-printed `.json` with this structure:

**Note:** Response headers are empty by default. Use `recordResponseHeaders` configuration to record specific headers or all headers.

```json
{
  "meta": {
    "recordedAt": "2025-07-17T12:34:56Z",
    "testName": "shopify client/can read orders for a range of dates given day",
    "replayAPIVersion": "1.0.0"
  },
  "calls": [
    {
      "request": {
        "method": "GET",
        "url": "https://api.example.com/orders?startDate=2022-01-01",
        "headers": {
          "Authorization": "Bearer xyz"
        },
        "body": null
      },
      "response": {
        "status": 200,
        "headers": {},
        "body": "[{\"orderId\":1234}]"
      }
    }
  ]
}
```

---

## 🔧 Troubleshooting

### Common Issues

**"No matching recorded call found" Error**

When you see this error, the detailed output will show you exactly what was searched for and what's available. Common solutions:

1. **Headers differ**: Use `exclude: { headers: ['authorization', 'user-agent'] }` to ignore volatile headers
2. **Query params differ**: Use `exclude: { query: ['timestamp', 'token'] }` to ignore dynamic parameters
3. **Body differs**: Use `exclude: { body: true }` if the body content varies between runs
4. **Method/URL differs**: Check that your request matches exactly what was recorded

**Example Fix:**
```typescript
// If you see authorization headers differ in the error output:
await replayAPI.start('my-test', {
  exclude: {
    headers: ['authorization', 'x-api-key'],
    query: ['timestamp']
  }
});
```

### Debug Mode

Enable debug logging to see what's happening:
```typescript
await replayAPI.start('my-test', { debug: true });
// or
APIREPLAYLOGS=1 bun test
```

---

## 🔐 Security Note

Recorded headers and bodies are stored in plaintext. Be careful when recording:
- Authorization
- Cookies
- Personally identifiable information (PII)

---

## 📎 Roadmap Ideas

Future improvements (not in scope of v1):
- Header redaction or masking
- Expiration of recordings
- Request/response transformers
- Snapshot diffing and versioning

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Run tests: `bun test`
4. Run type checking: `bun run typecheck`
5. Build the project: `bun run build`

### Code Quality

This project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for pre-commit hooks
- **TypeScript** for type safety

All contributions should pass the existing test suite and maintain 100% type coverage.

---

## 📄 License

MIT