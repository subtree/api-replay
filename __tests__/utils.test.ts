import { describe, test, expect, spyOn } from 'bun:test';
import {
  testNameToFilename,
  ensureDirectory,
  headersToObject,
  objectToHeaders,
  extractBody,
  parseRequestBody
} from '../src/utils';

describe('utils', () => {
  describe('testNameToFilename', () => {
    test('should convert test names to valid filenames', () => {
      expect(testNameToFilename('Simple Test')).toBe('simple-test.json');
      expect(testNameToFilename('Test/With/Slashes')).toBe('test--with--slashes.json');
      expect(testNameToFilename('Test  With  Multiple  Spaces')).toBe('test-with-multiple-spaces.json');
      expect(testNameToFilename('UPPERCASE TEST')).toBe('uppercase-test.json');
    });
  });

  describe('ensureDirectory', () => {
    test('should create directory if it does not exist', async () => {
      // We'll test with a temporary directory that we know doesn't exist
      const tempDir = `/tmp/test-api-replay-${Date.now()}`;

      // Ensure it doesn't exist first
      const fs = require('node:fs');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }

      await ensureDirectory(tempDir);

      // Check it was created
      expect(fs.existsSync(tempDir)).toBe(true);

      // Clean up
      fs.rmSync(tempDir, { recursive: true });
    });

    test('should not throw if directory already exists', async () => {
      // Test with a directory we know exists
      const existingDir = '/tmp';

      // Should not throw
      await expect(ensureDirectory(existingDir)).resolves.toBeUndefined();
    });
  });

  describe('headersToObject', () => {
    test('should convert Headers to object with lowercase keys', () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value'
      });

      const obj = headersToObject(headers);

      expect(obj).toEqual({
        'content-type': 'application/json',
        'x-custom-header': 'value'
      });
    });
  });

  describe('objectToHeaders', () => {
    test('should convert object to Headers', () => {
      const obj = {
        'content-type': 'application/json',
        'x-custom-header': 'value'
      };

      const headers = objectToHeaders(obj);

      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('x-custom-header')).toBe('value');
    });
  });

  describe('extractBody', () => {
    test('should extract JSON body', async () => {
      const response = new Response(JSON.stringify({ foo: 'bar' }), {
        headers: { 'content-type': 'application/json' }
      });

      const body = await extractBody(response);
      expect(body).toBe('{"foo":"bar"}');
    });

    test('should extract text body', async () => {
      const response = new Response('plain text', {
        headers: { 'content-type': 'text/plain' }
      });

      const body = await extractBody(response);
      expect(body).toBe('plain text');
    });

    test('should handle malformed JSON by falling back to text', async () => {
      const response = new Response('{ invalid json', {
        headers: { 'content-type': 'application/json' }
      });

      const body = await extractBody(response);
      expect(body).toBe('{ invalid json');
    });

    test('should handle response with unreadable body', async () => {
      const response = new Response('test body', {
        headers: { 'content-type': 'text/plain' }
      });

      // Mock the clone method to throw an error
      response.clone = () => {
        throw new Error('Cannot clone response');
      };

      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      const body = await extractBody(response);

      expect(body).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to extract response body:', expect.any(Error));

      consoleWarnSpy.mockRestore();
    });

    test('should handle response that throws on text()', async () => {
      const response = new Response(null, {
        headers: { 'content-type': 'text/plain' }
      });

      // Create a mock response that throws on text()
      const mockResponse = {
        ...response,
        clone: () => ({
          text: async () => {
            throw new Error('Failed to read body');
          },
          json: async () => {
            throw new Error('Not JSON');
          }
        }),
        headers: response.headers
      };

      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      const body = await extractBody(mockResponse as unknown as Response);

      expect(body).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to extract response body:', expect.any(Error));

      consoleWarnSpy.mockRestore();
    });
  });

  describe('parseRequestBody', () => {
    test('should return null for request without body', async () => {
      const request = new Request('http://example.com');
      const body = await parseRequestBody(request);
      expect(body).toBeNull();
    });

    test('should parse JSON body', async () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' })
      });

      const body = await parseRequestBody(request);
      expect(body).toBe('{"foo":"bar"}');
    });

    test('should parse form-urlencoded body', async () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'name=John&age=30'
      });

      const body = await parseRequestBody(request);
      expect(body).toBe('name=John&age=30');
    });

    test('should parse multipart form data with string fields', async () => {
      // Create a mock request with formData method
      const mockFormData = new FormData();
      mockFormData.append('name', 'John');
      mockFormData.append('age', '30');

      const request = {
        body: {},
        headers: new Headers({ 'content-type': 'multipart/form-data' }),
        formData: async () => mockFormData
      } as unknown as Request;

      const body = await parseRequestBody(request);
      expect(body).toBe('name=John&age=30');
    });

    test('should parse multipart form data with file uploads', async () => {
      // Create a mock request with formData method
      const mockFormData = new FormData();
      mockFormData.append('name', 'John');
      mockFormData.append('file', new File(['content'], 'test.txt', { type: 'text/plain' }));

      const request = {
        body: {},
        headers: new Headers({ 'content-type': 'multipart/form-data' }),
        formData: async () => mockFormData
      } as unknown as Request;

      const body = await parseRequestBody(request);
      expect(body).toContain('name=John');
      expect(body).toContain('file=[File:test.txt]');
    });

    test('should parse multipart form data with mixed content', async () => {
      // Create a mock request with formData method
      const mockFormData = new FormData();
      mockFormData.append('username', 'johndoe');
      mockFormData.append('avatar', new File(['image data'], 'avatar.png', { type: 'image/png' }));
      mockFormData.append('bio', 'Software developer');
      mockFormData.append('resume', new File(['resume content'], 'resume.pdf', { type: 'application/pdf' }));

      const request = {
        body: {},
        headers: new Headers({ 'content-type': 'multipart/form-data' }),
        formData: async () => mockFormData
      } as unknown as Request;

      const body = await parseRequestBody(request);
      expect(body).toContain('username=johndoe');
      expect(body).toContain('avatar=[File:avatar.png]');
      expect(body).toContain('bio=Software developer');
      expect(body).toContain('resume=[File:resume.pdf]');
    });

    test('should handle plain text body', async () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'Plain text content'
      });

      const body = await parseRequestBody(request);
      expect(body).toBe('Plain text content');
    });

    test('should handle body parsing errors', async () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json'
      });

      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      const body = await parseRequestBody(request);

      expect(body).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to parse request body:', expect.any(Error));

      consoleWarnSpy.mockRestore();
    });

    test('should handle corrupted request body', async () => {
      const request = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'test body'
      });

      // Mock the text() method to throw an error
      request.text = async () => {
        throw new Error('Failed to read body');
      };

      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      const body = await parseRequestBody(request);

      expect(body).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to parse request body:', expect.any(Error));

      consoleWarnSpy.mockRestore();
    });
  });
});
