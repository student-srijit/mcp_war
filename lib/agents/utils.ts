import { AgentVerdict, Issue, Evidence, Finding } from '../schemas';

type VerdictLabel = 'pass' | 'fail' | 'warn' | 'skip';

export function createAgentVerdict(params: {
  agentId: string;
  agentName?: string;
  verdict: VerdictLabel;
  confidenceScore?: number;
  confidence?: number;
  issues?: Issue[];
  evidence?: Evidence[];
  correctiveHints?: string[];
  latencyMs?: number;
  status?: AgentVerdict['status'];
  findings?: Finding[];
  correctionApplied?: boolean;
}): AgentVerdict {
  const {
    agentId,
    agentName,
    verdict,
    confidenceScore,
    confidence,
    issues,
    evidence,
    correctiveHints,
    latencyMs,
    status,
    findings,
    correctionApplied,
  } = params;

  const score = typeof confidenceScore === 'number' ? confidenceScore : typeof confidence === 'number' ? confidence : 0;

  return {
    agentId,
    agentName,
    verdict,
    confidenceScore: Math.max(0, Math.min(1, score || 0)),
    confidence: Math.max(0, Math.min(1, score || 0)),
    issues: issues || [],
    evidence: evidence || [],
    correctiveHints: correctiveHints || [],
    latencyMs: typeof latencyMs === 'number' ? latencyMs : 0,
    status: status || (verdict === 'pass' ? 'passed' : verdict === 'fail' ? 'failed' : 'warning'),
    findings: findings || [],
    correctionApplied: !!correctionApplied,
  } as AgentVerdict;
}
