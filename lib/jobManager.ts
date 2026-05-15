import { VerificationJob, PipelineStep, FeedLogEntry } from './schemas';
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

function ensureDirs() {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  if (!fs.existsSync(JOBS_DIR)) fs.mkdirSync(JOBS_DIR, { recursive: true });
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
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
}

// WebSocket stubs — no-op for now since SSE polling handles real-time updates
export function addWSClient(_jobId: string, _ws: any) {}
export function removeWSClient(_jobId: string, _ws: any) {}
export function broadcastUpdate(_jobId: string, _data: Record<string, unknown>) {}
export function broadcastFeedLog(_jobId: string, _entry: FeedLogEntry) {}
