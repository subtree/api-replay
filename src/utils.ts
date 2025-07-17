import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

export function testNameToFilename(testName: string): string {
  return testName
    .replace(/\//g, '--')
    .replace(/\s+/g, '-')
    .toLowerCase() + '.json';
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
  const clonedResponse = response.clone();
  
  if (contentType.includes('application/json')) {
    try {
      const json = await clonedResponse.json();
      return JSON.stringify(json);
    } catch {
      return await clonedResponse.text();
    }
  }
  
  return await clonedResponse.text();
}

export async function parseRequestBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  
  const contentType = request.headers.get('content-type') || '';
  
  try {
    if (contentType.includes('application/json')) {
      const json = await request.json();
      return JSON.stringify(json);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      return await request.text();
    } else if (contentType.includes('multipart/form-data')) {
      // For multipart, we'll store as text representation
      const formData = await request.formData();
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
    
    return await request.text();
  } catch (error) {
    console.warn('Failed to parse request body:', error);
    return null;
  }
}