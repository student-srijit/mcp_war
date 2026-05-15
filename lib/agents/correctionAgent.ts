import { AgentVerdict, ClaimUnit, VerificationJob } from '../schemas';
import { generateClaims } from './generator';

export interface CorrectionBrief {
  originalQuery: string;
  originalResponse: string;
  failedClaims: ClaimUnit[];
  allHints: string[];
  retryNumber: number;
  hardConstraints: string[];
}

function buildCorrectionSystemPrompt(brief: CorrectionBrief): string {
  const hintsText = brief.allHints.join('\n- ');
  const constraintsText = brief.hardConstraints.map((c) => `- ${c}`).join('\n');

  return `You are correcting specific errors in a prior technical response.
This is retry #${brief.retryNumber} of 3 maximum.

ERRORS DETECTED:
- ${hintsText}

HARD CONSTRAINTS that MUST be satisfied:
${constraintsText}

INSTRUCTIONS:
1. Reproduce the full response with only these corrections applied
2. Do NOT change any claims that were not flagged as errors
3. Ensure all hard constraints are strictly satisfied
4. Maintain the same response structure and tone
5. If a correction is impossible, note it explicitly

Return the corrected response in the same structured JSON format.`;
}

function extractFailedClaims(
  allClaims: ClaimUnit[],
  verdicts: AgentVerdict[]
): { claims: ClaimUnit[]; hints: string[] } {
  const failedClaimIds = new Set<string>();
  const hints: string[] = [];

  for (const verdict of verdicts) {
    for (const issue of verdict.issues) {
      failedClaimIds.add(issue.claimId);
      hints.push(`[${verdict.agentId}] ${issue.description}`);
    }

    if (verdict.correctiveHints.length > 0) {
      hints.push(...verdict.correctiveHints);
    }
  }

  const failedClaims = allClaims.filter((c) => failedClaimIds.has(c.claimId));

  return { claims: failedClaims, hints };
}

export async function runCorrectionAgent(
  job: VerificationJob,
  allVerdicts: AgentVerdict[]
): Promise<{
  correctedClaims: ClaimUnit[];
  retryCount: number;
  escalated: boolean;
}> {
  const previousRetries = job.retryCount || 0;
  const currentRetryNumber = previousRetries + 1;

  if (currentRetryNumber > 3) {
    return {
      correctedClaims: job.claims || [],
      retryCount: currentRetryNumber,
      escalated: true,
    };
  }

  const { claims: failedClaims, hints } = extractFailedClaims(
    job.claims || [],
    allVerdicts
  );

  // Build hard constraints from verdict details
  const hardConstraints: string[] = [];
  for (const verdict of allVerdicts) {
    for (const hint of verdict.correctiveHints) {
      if (hint.includes('must') || hint.includes('MUST')) {
        hardConstraints.push(hint);
      }
    }
  }

  const correctionBrief: CorrectionBrief = {
    originalQuery: job.query,
    originalResponse: '', // Would contain the full response in real scenario
    failedClaims,
    allHints: hints,
    retryNumber: currentRetryNumber,
    hardConstraints,
  };

  // In production, this would call the Generator with the correction prompt
  // For now, we'll simulate by returning a corrected version
  const systemPrompt = buildCorrectionSystemPrompt(correctionBrief);

  console.log(
    `[v0] Correction Agent: Retry ${currentRetryNumber}/3, correcting ${failedClaims.length} failed claims`
  );

  try {
    // Simulate calling Generator with correction prompt
    const correctedClaims = await generateClaims(job.query, job.domain, {
      systemPromptOverride: systemPrompt,
    });

    return {
      correctedClaims: correctedClaims || [],
      retryCount: currentRetryNumber,
      escalated: false,
    };
  } catch (error) {
    console.error('[v0] Correction Agent error:', error);
    return {
      correctedClaims: failedClaims,
      retryCount: currentRetryNumber,
      escalated: currentRetryNumber >= 3,
    };
  }
}

export function buildCorrectionHints(verdicts: AgentVerdict[]): string[] {
  const hints: string[] = [];

  for (const verdict of verdicts) {
    if (verdict.verdict === 'fail') {
      hints.push(`Fix ${verdict.agentId} issues: ${verdict.issues.length} errors found`);
    }

    if (verdict.correctiveHints.length > 0) {
      hints.push(...verdict.correctiveHints);
    }
  }

  return hints;
}
