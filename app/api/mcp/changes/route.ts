import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/jobManager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const token = searchParams.get('token');

    if (!jobId || !token) {
      return NextResponse.json({ error: 'jobId and token are required' }, { status: 400 });
    }

    const job = JobManager.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.mcpToken !== token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    // Fetch all patches/edits
    const responses = JobManager.getAgentResponses(jobId);

    return NextResponse.json({
      jobId,
      status: job.status,
      verdict: job.verdict,
      responses,
    });
  } catch (error) {
    console.error('[VERITAS] MCP Changes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
