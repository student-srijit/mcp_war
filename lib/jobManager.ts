import { VerificationJob, PipelineStep, FeedLogEntry, AgentResponse } from './schemas';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// File-based store that survives Turbopack worker isolation.
// Turbopack runs each API route in a SEPARATE worker process,
// so in-memory Maps, globalThis, and even `process` DO NOT share state.
// The only solution: filesystem.
const STORE_DIR = path.join(process.cwd(), '.veritas-store');
const JOBS_DIR = path.join(STORE_DIR, 'jobs');
const LOGS_DIR = path.join(STORE_DIR, 'logs');
const RESPONSES_DIR = path.join(STORE_DIR, 'responses');

function ensureDirs() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  if (!fs.existsSync(RESPONSES_DIR)) fs.mkdirSync(RESPONSES_DIR, { recursive: true });
}

function readJSON<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON(filePath: string, data: unknown) {
  ensureDirs();
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

export class JobManager {
  static createJob(query: string, domain: string): VerificationJob {
    ensureDirs();
    const jobId = `JOB-${uuidv4().slice(0, 8)}`;
    const now = Date.now();

    const job: VerificationJob = {
      jobId,
      query,
      domain,
      status: 'pending',
      createdAt: now,
      claims: [],
      agentVerdicts: [],
      evidence: [],
      compositeScore: 0,
      verdict: 'APPROVED',
      pipelineSteps: [],
    };

    writeJSON(path.join(JOBS_DIR, `${jobId}.json`), job);
    writeJSON(path.join(LOGS_DIR, `${jobId}.json`), []);
    console.log(`[VERITAS] Job ${jobId} CREATED`);
    return job;
  }

  static getJob(jobId: string): VerificationJob | null {
    return readJSON<VerificationJob>(path.join(JOBS_DIR, `${jobId}.json`));
  }

  static updateJob(jobId: string, updates: Partial<VerificationJob>): void {
    const job = this.getJob(jobId);
    if (job) {
      writeJSON(path.join(JOBS_DIR, `${jobId}.json`), { ...job, ...updates });
    }
  }

  static addPipelineStep(jobId: string, step: PipelineStep): void {
    const job = this.getJob(jobId);
    if (job) {
      job.pipelineSteps.push(step);
      writeJSON(path.join(JOBS_DIR, `${jobId}.json`), job);
    }
  }

  static addFeedLog(jobId: string, entry: FeedLogEntry): void {
    const logs = this.getFeedLogs(jobId);
    logs.push(entry);
    writeJSON(path.join(LOGS_DIR, `${jobId}.json`), logs);
  }

  static getFeedLogs(jobId: string): FeedLogEntry[] {
    return readJSON<FeedLogEntry[]>(path.join(LOGS_DIR, `${jobId}.json`)) || [];
  }

  static getAllJobs(): VerificationJob[] {
    ensureDirs();
    try {
      const files = fs.readdirSync(JOBS_DIR).filter(f => f.endsWith('.json'));
      return files.map(f => readJSON<VerificationJob>(path.join(JOBS_DIR, f))).filter(Boolean) as VerificationJob[];
    } catch {
      return [];
    }
  }

  static saveAgentResponse(response: AgentResponse): void {
    ensureDirs();
    const jobResponsesDir = path.join(RESPONSES_DIR, response.jobId);
    if (!fs.existsSync(jobResponsesDir)) fs.mkdirSync(jobResponsesDir, { recursive: true });
    
    // Save metadata
    const metadataPath = path.join(jobResponsesDir, `${response.id}.json`);
    writeJSON(metadataPath, response);
    
    // Save content to raw file if applicable (useful for IDEs)
    const contentPath = path.join(jobResponsesDir, response.filename);
    fs.writeFileSync(contentPath, response.content, 'utf-8');
    console.log(`[VERITAS] Saved agent response ${response.filename} for job ${response.jobId}`);
  }

  static getAgentResponses(jobId: string): AgentResponse[] {
    ensureDirs();
    const jobResponsesDir = path.join(RESPONSES_DIR, jobId);
    if (!fs.existsSync(jobResponsesDir)) return [];
    
    try {
      const files = fs.readdirSync(jobResponsesDir).filter(f => f.endsWith('.json'));
      return files.map(f => readJSON<AgentResponse>(path.join(jobResponsesDir, f))).filter(Boolean) as AgentResponse[];
    } catch {
      return [];
    }
  }
}

// WebSocket stubs — no-op for now since SSE polling handles real-time updates
export function addWSClient(_jobId: string, _ws: any) {}
export function removeWSClient(_jobId: string, _ws: any) {}
export function broadcastUpdate(_jobId: string, _data: Record<string, unknown>) {}
export function broadcastFeedLog(_jobId: string, _entry: FeedLogEntry) {}
