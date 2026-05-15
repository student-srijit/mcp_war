import { VerificationJob, PipelineStep, FeedLogEntry } from './schemas';
import { v4 as uuidv4 } from 'uuid';

// In-memory job storage (would use Redis in production)
const jobStore = new Map<string, VerificationJob>();
const feedLogs = new Map<string, FeedLogEntry[]>();

export class JobManager {
  static createJob(query: string, domain: string): VerificationJob {
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

    jobStore.set(jobId, job);
    feedLogs.set(jobId, []);

    return job;
  }

  static getJob(jobId: string): VerificationJob | null {
    return jobStore.get(jobId) || null;
  }

  static updateJob(jobId: string, updates: Partial<VerificationJob>): void {
    const job = jobStore.get(jobId);
    if (job) {
      jobStore.set(jobId, { ...job, ...updates });
    }
  }

  static addPipelineStep(jobId: string, step: PipelineStep): void {
    const job = jobStore.get(jobId);
    if (job) {
      job.pipelineSteps.push(step);
    }
  }

  static addFeedLog(jobId: string, entry: FeedLogEntry): void {
    const logs = feedLogs.get(jobId) || [];
    logs.push(entry);
    feedLogs.set(jobId, logs);
  }

  static getFeedLogs(jobId: string): FeedLogEntry[] {
    return feedLogs.get(jobId) || [];
  }

  static getAllJobs(): VerificationJob[] {
    return Array.from(jobStore.values());
  }
}

// WebSocket client registry for real-time updates
const wsClients = new Map<string, Set<any>>();

export function addWSClient(jobId: string, ws: any) {
  if (!wsClients.has(jobId)) {
    wsClients.set(jobId, new Set());
  }
  wsClients.get(jobId)!.add(ws);
}

export function removeWSClient(jobId: string, ws: any) {
  const clients = wsClients.get(jobId);
  if (clients) {
    clients.delete(ws);
  }
}

export function broadcastUpdate(jobId: string, data: Record<string, unknown>) {
  const clients = wsClients.get(jobId);
  if (clients) {
    clients.forEach((ws) => {
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        console.error('[v0] WebSocket send error:', error);
      }
    });
  }
}

export function broadcastFeedLog(jobId: string, entry: FeedLogEntry) {
  broadcastUpdate(jobId, {
    type: 'feed_log',
    entry,
  });
}
