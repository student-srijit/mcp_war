import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/jobManager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const logs = JobManager.getFeedLogs(jobId);

    if (!JobManager.getJob(jobId)) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[VERITAS] Feed logs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
