# 📼 api-replay

[![npm version](https://badge.fury.io/js/api-replay.svg)](https://www.npmjs.com/package/api-replay)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

A lightweight HTTP recording and replay library for Bun + TypeScript, designed to simplify and accelerate integration tests by recording real fetch responses and replaying them in future test runs.

---

## ✨ Purpose

api-replay helps you:
- Record actual HTTP API calls made during integration tests
- Replay those responses later, eliminating the need for live API access
- Speed up test runs and improve reliability
- Easily customize what parts of a request are considered for matching

---

## 🛠 Use Case Example

```typescript
test('can read orders for a range of dates given day', async () => {
  await replayAPI.start('shopify client/can read orders for a range of dates given day', {
    debug: true, // Enable logging for this test
    include: {
      headers: ['Authorization'],
    },
    exclude: {
      headers: ['Cookie'],
      query: ['startDate', 'endDate'],
    },
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
- Becomes: `./apirecordings/shopify-client--can-read-orders-for-a-range-of-dates-given-day.json`
- `config` (optional): controls which parts of the request are included or excluded from match comparison

### `await replayAPI.done(): Promise<void>`

Stops interception and saves recordings (if in record mode).

### `replayAPI.setVerbose(enabled: boolean): void`

Turns on or off logging like:

```
🎬 ReplayAPI started in record mode for test: my-test
🔄 Reusing existing recording for: GET https://api.example.com/orders
🎬 ReplayAPI finished in record mode. Was replayed: false
```

Default: `false` (no logging)

### 🔧 Enabling Debug Logging

Logging is **disabled by default** for clean test output. Enable it via:

**Option 1: Environment Variable**
```bash
APIREPLAYLOGS=true bun test
# or
APIREPLAYLOGS=1 bun test  
# or
APIREPLAYLOGS=* bun test
```

**Option 2: Config Option**
```typescript
await replayAPI.start('test-name', { debug: true });
```

**Option 3: Method Call**
```typescript
replayAPI.setVerbose(true);
```

---

## ⚙️ Matching Behavior

### ✅ Always matched:
- HTTP method (GET, POST, etc.)
- URL path (/orders, /posts/1)

### ✅ By default:
- Query string (all keys)
- Request body (if present)

### ❌ Not matched by default:
- Headers

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

// Combine options
{ 
  debug: true,
  exclude: { headers: ['user-agent'], query: ['timestamp'] }
}
```

---

## 📂 File Naming Convention

- All recordings are saved under: `./apirecordings/`
- Filename is derived from the test name by replacing slashes and spaces:

```
shopify client/can read orders for a range of dates given day
=>
shopify-client--can-read-orders-for-a-range-of-dates-given-day.json
```

- No versioning logic is used. Each test has one recording file.

---

## 🗃 JSON File Format

Each recording file is a pretty-printed `.json` with this structure:

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
        "headers": {
          "content-type": "application/json"
        },
        "body": "[{\"orderId\":1234}]"
      }
    }
  ]
}
```

---

## 🧪 Testing & Validation

- Example integration tests should use https://jsonplaceholder.typicode.com/ to verify:
  - Recording works the first time
  - Replays correctly without a network call on the second run
- Use Bun's built-in test runner
- Tests can be structured under `./__tests__/`

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