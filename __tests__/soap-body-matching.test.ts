import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { replayAPI } from '../src';
import * as fs from 'fs';
import * as path from 'path';

describe('SOAP/XML Body Matching', () => {
  const recordingsDir = path.join(__dirname, '.api-replay-test');

  beforeEach(() => {
    // Clean up any existing recordings
    if (fs.existsSync(recordingsDir)) {
      fs.rmSync(recordingsDir, { recursive: true });
    }
  });

  afterEach(async () => {
    await replayAPI.done();
    // Clean up recordings after test
    if (fs.existsSync(recordingsDir)) {
      fs.rmSync(recordingsDir, { recursive: true });
    }
  });

  test('should match SOAP requests with XML body by default', async () => {
    // Mock SOAP endpoint
    const mockServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <GetUserResponse>
                <User>
                  <Id>123</Id>
                  <Name>John Doe</Name>
                </User>
              </GetUserResponse>
            </soap:Body>
          </soap:Envelope>`,
          {
            status: 200,
            headers: { 'Content-Type': 'text/xml; charset=utf-8' }
          }
        );
      }
    });

    const serverUrl = `http://localhost:${mockServer.port}`;

    // Record the SOAP request
    await replayAPI.start('soap-test', { recordingsDir });

    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetUser>
          <UserId>123</UserId>
        </GetUser>
      </soap:Body>
    </soap:Envelope>`;

    const response1 = await fetch(`${serverUrl}/soap/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'GetUser'
      },
      body: soapRequest
    });

    const responseText1 = await response1.text();
    expect(response1.status).toBe(200);
    expect(responseText1).toContain('<Name>John Doe</Name>');

    await replayAPI.done();
    mockServer.stop();

    // Replay mode - same body should match
    await replayAPI.start('soap-test', { recordingsDir });

    const response2 = await fetch(`${serverUrl}/soap/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'GetUser'
      },
      body: soapRequest
    });

    const responseText2 = await response2.text();
    expect(response2.status).toBe(200);
    expect(responseText2).toContain('<Name>John Doe</Name>');

    // Different body should not match
    const differentSoapRequest = `<?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetUser>
          <UserId>456</UserId>
        </GetUser>
      </soap:Body>
    </soap:Envelope>`;

    await expect(async () => {
      await fetch(`${serverUrl}/soap/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'GetUser'
        },
        body: differentSoapRequest
      });
    }).toThrow(/No matching recorded call found/);
  });

  test('should ignore SOAP body when exclude.body is true', async () => {
    // Mock SOAP endpoint
    const mockServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <GetUserResponse>
                <User>
                  <Id>999</Id>
                  <Name>Any User</Name>
                </User>
              </GetUserResponse>
            </soap:Body>
          </soap:Envelope>`,
          {
            status: 200,
            headers: { 'Content-Type': 'text/xml; charset=utf-8' }
          }
        );
      }
    });

    const serverUrl = `http://localhost:${mockServer.port}`;

    // Record with body exclusion
    await replayAPI.start('soap-test-no-body', {
      recordingsDir,
      exclude: { body: true }
    });

    const soapRequest1 = `<?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetUser>
          <UserId>123</UserId>
        </GetUser>
      </soap:Body>
    </soap:Envelope>`;

    const response1 = await fetch(`${serverUrl}/soap/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'GetUser'
      },
      body: soapRequest1
    });

    expect(response1.status).toBe(200);
    await replayAPI.done();
    mockServer.stop();

    // Replay with different body - should still match
    await replayAPI.start('soap-test-no-body', {
      recordingsDir,
      exclude: { body: true }
    });

    const soapRequest2 = `<?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetUser>
          <UserId>789</UserId>
        </GetUser>
      </soap:Body>
    </soap:Envelope>`;

    const response2 = await fetch(`${serverUrl}/soap/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'GetUser'
      },
      body: soapRequest2
    });

    const responseText = await response2.text();
    expect(response2.status).toBe(200);
    expect(responseText).toContain('<Name>Any User</Name>');
  });

  test('should handle complex SOAP requests with namespaces', async () => {
    // Mock SOAP endpoint
    const mockServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?>
          <soap:Envelope 
            xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
            xmlns:ns1="http://example.com/users">
            <soap:Body>
              <ns1:CreateUserResponse>
                <ns1:Result>
                  <ns1:Success>true</ns1:Success>
                  <ns1:UserId>NEW-123</ns1:UserId>
                </ns1:Result>
              </ns1:CreateUserResponse>
            </soap:Body>
          </soap:Envelope>`,
          {
            status: 200,
            headers: { 'Content-Type': 'text/xml; charset=utf-8' }
          }
        );
      }
    });

    const serverUrl = `http://localhost:${mockServer.port}`;

    await replayAPI.start('soap-namespaces', { recordingsDir });

    const complexSoapRequest = `<?xml version="1.0" encoding="UTF-8"?>
    <soap:Envelope 
      xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:ns1="http://example.com/users">
      <soap:Body>
        <ns1:CreateUser>
          <ns1:UserData>
            <ns1:FirstName>Jane</ns1:FirstName>
            <ns1:LastName>Smith</ns1:LastName>
            <ns1:Email>jane.smith@example.com</ns1:Email>
          </ns1:UserData>
        </ns1:CreateUser>
      </soap:Body>
    </soap:Envelope>`;

    const response1 = await fetch(`${serverUrl}/soap/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://example.com/users/CreateUser'
      },
      body: complexSoapRequest
    });

    const responseText1 = await response1.text();
    expect(response1.status).toBe(200);
    expect(responseText1).toContain('<ns1:Success>true</ns1:Success>');

    await replayAPI.done();
    mockServer.stop();

    // Replay - exact same body should match
    await replayAPI.start('soap-namespaces', { recordingsDir });

    const response2 = await fetch(`${serverUrl}/soap/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://example.com/users/CreateUser'
      },
      body: complexSoapRequest
    });

    const responseText2 = await response2.text();
    expect(response2.status).toBe(200);
    expect(responseText2).toContain('<ns1:Success>true</ns1:Success>');
  });
});
