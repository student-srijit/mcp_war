import { GET } from '../app/api/jobs/[jobId]/stream/route';
import { JobManager } from '../lib/jobManager';

import { describe, it, expect } from 'vitest';

describe('SSE stream route', () => {
  it('returns text/event-stream for existing job', async () => {
    const job = JobManager.createJob('unit test query', 'General Technical');
    const req: any = { signal: new AbortController().signal };

    const res: any = await GET(req, { params: { jobId: job.jobId } });

    expect(res).toBeDefined();
    const ct = res.headers.get('Content-Type') || res.headers.get('content-type');
    expect(ct).toMatch(/text\/event-stream/i);
  });

  it('returns 404 for missing job', async () => {
    const req: any = { signal: new AbortController().signal };
    const res: any = await GET(req, { params: { jobId: 'NO-SUCH-JOB' } });
    expect(res.status).toBe(404);
  });
});
