import { NextRequest, NextResponse } from 'next/server';
import { JobManager } from '@/lib/jobManager';
import { classifyDomain } from '@/lib/agents/domainClassifier';
import { runVerificationPipeline } from '@/lib/agents/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, domain } = body;

    if (!query || typeof query !== 'string' || query.length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Classify domain if auto-detect
    const finalDomain = await classifyDomain(query, domain || 'Auto-Detect');

    // Create job
    const job = JobManager.createJob(query, finalDomain);

    // Start verification pipeline in background (don't await)
    runVerificationPipeline(job).catch((error) => {
      console.error('[v0] Background pipeline error:', error);
    });

    // Return job immediately
    return NextResponse.json({
      jobId: job.jobId,
      query: job.query,
      domain: job.domain,
      status: job.status,
      createdAt: job.createdAt,
    });
  } catch (error) {
    console.error('[v0] Verification API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
