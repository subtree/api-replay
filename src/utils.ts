import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export function testNameToFilename(testName: string): string {
  // Replace all non-alphanumeric characters (except spaces, hyphens, and underscores) with underscores
  // Then replace spaces with hyphens, collapse multiple hyphens/underscores, and convert to lowercase
  const safeName = testName
    .replace(/[^a-zA-Z0-9\s\-_]/g, '_') // Replace special chars with underscores
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[-_]+/g, (match) => match[0]) // Collapse multiple hyphens/underscores
    .replace(/^[-_]+|[-_]+$/g, '') // Remove leading/trailing hyphens/underscores
    .toLowerCase() // Convert to lowercase
    .slice(0, 200); // Limit length to prevent filesystem issues

  // Ensure we have a valid filename (not empty)
  const finalName = safeName || 'unnamed-test';

  return `${finalName}.json`;
}

export async function ensureDirectory(path: string): Promise<void> {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

export function headersToObject(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

export function objectToHeaders(obj: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(obj)) {
    headers.set(key, value);
  }
  return headers;
}

export async function extractBody(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  try {
    // Clone the response to avoid consuming the original body
    const clonedResponse = response.clone();

    if (contentType.includes('application/json')) {
      try {
        const json = await clonedResponse.json();
        return JSON.stringify(json);
      } catch {
        // If JSON parsing fails, try text
        const textClone = response.clone();
        return await textClone.text();
      }
    }

    return await clonedResponse.text();
  } catch (error) {
    console.warn('Failed to extract response body:', error);
    return '';
  }
}

export async function parseRequestBody(request: Request): Promise<string | null> {
  if (!request.body) return null;

  const contentType = request.headers.get('content-type') || '';

  try {
    // Try to clone the request to avoid consuming the original body
    // If clone fails or isn't available, use the original request
    let requestToUse = request;
    try {
      if (typeof request.clone === 'function') {
        requestToUse = request.clone() as Request;
      }
    } catch {
      // If cloning fails (e.g., body already consumed), use original
      requestToUse = request;
    }

    if (contentType.includes('application/json')) {
      const json = await requestToUse.json();
      return JSON.stringify(json);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      return await requestToUse.text();
    } else if (contentType.includes('multipart/form-data')) {
      // For multipart, we'll store as text representation
      const formData = await requestToUse.formData();
      const parts: string[] = [];
      for (const [key, value] of formData) {
        if (typeof value === 'string') {
          parts.push(`${key}=${value}`);
        } else {
          parts.push(`${key}=[File:${value.name}]`);
        }
      }
      return parts.join('&');
    }

    return await requestToUse.text();
  } catch (error) {
    console.warn('Failed to parse request body:', error);
    return null;
  }
}
