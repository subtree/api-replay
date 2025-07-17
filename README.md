# 📼 api-replay

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

Only Bun is supported. This library uses native Bun APIs (`Bun.write`, `Bun.file`, etc.).

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
[RECORDING] GET https://api.example.com/orders
[REPLAYING] GET https://api.example.com/orders
```

Default: `true`

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

## 📄 License

MIT