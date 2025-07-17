import { RecordedCall, RecordingFile } from './types';
import { 
  testNameToFilename, 
  ensureDirectory, 
  headersToObject, 
  extractBody, 
  parseRequestBody 
} from './utils';
import { RequestMatcher } from './matcher';
import { join } from 'node:path';

export class Recorder {
  private recordedCalls: RecordedCall[] = [];
  
  async recordCall(request: Request, response: Response): Promise<void> {
    const recordedCall: RecordedCall = {
      request: {
        method: request.method,
        url: request.url,
        headers: headersToObject(request.headers),
        body: await parseRequestBody(request)
      },
      response: {
        status: response.status,
        headers: headersToObject(response.headers),
        body: await extractBody(response)
      }
    };
    
    this.recordedCalls.push(recordedCall);
  }
  
  async saveRecording(testName: string): Promise<void> {
    const recordingsDir = join(process.cwd(), 'apirecordings');
    await ensureDirectory(recordingsDir);
    
    const filename = testNameToFilename(testName);
    const filepath = join(recordingsDir, filename);
    
    const recordingFile: RecordingFile = {
      meta: {
        recordedAt: new Date().toISOString(),
        testName: testName,
        replayAPIVersion: '1.0.0'
      },
      calls: this.recordedCalls
    };
    
    await Bun.write(filepath, JSON.stringify(recordingFile, null, 2));
  }
  
  async findExistingCall(request: Request, matcher: RequestMatcher): Promise<RecordedCall | null> {
    for (const call of this.recordedCalls) {
      if (await matcher.matches(call.request, request)) {
        return call;
      }
    }
    return null;
  }
  
  reset(): void {
    this.recordedCalls = [];
  }
}