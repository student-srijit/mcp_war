import { NextRequest } from 'next/server';
import { JobManager } from '@/lib/jobManager';

export const runtime = 'nodejs';

function encodeEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!JobManager.getJob(jobId)) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const pushSnapshot = () => {
        const job = JobManager.getJob(jobId);
        if (!job) {
          controller.enqueue(encoder.encode(encodeEvent({ type: 'error', error: 'Job not found' })));
          controller.close();
          clearInterval(intervalId);
          return;
        }

        controller.enqueue(
          encoder.encode(encodeEvent({
            type: 'snapshot',
            job,
            logs: JobManager.getFeedLogs(jobId),
          }))
        );

        if (job.status === 'completed' || job.status === 'failed') {
          controller.enqueue(encoder.encode(encodeEvent({ type: 'done' })));
          controller.close();
          clearInterval(intervalId);
        }
      };

      const intervalId = setInterval(pushSnapshot, 500);
      pushSnapshot();

      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}