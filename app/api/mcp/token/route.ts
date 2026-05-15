import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/jobManager';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = JobManager.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Generate a secure token
    const token = `mcp_${uuidv4().replace(/-/g, '')}`;
    
    // Save token to job
    JobManager.updateJob(jobId, { mcpToken: token });

    return NextResponse.json({
      jobId,
      token,
      message: 'Token generated successfully. Use this to connect via MCP IDE extensions.',
    });
  } catch (error) {
    console.error('[VERITAS] MCP Token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
