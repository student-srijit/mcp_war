import { AgentVerdict, DomainWeights } from '../schemas';
import domainWeights from '../domainWeights.json';

const DEFAULT_DOMAIN_WEIGHTS: DomainWeights = (domainWeights as any).domains || {};
const THRESHOLDS = (domainWeights as any).thresholds || { approved: 0.85, warning: 0.6 };

function normalizeAgentKey(agentId: string | undefined | null): string {
  if (!agentId) return '';
  return agentId.replace(/-/g, '_').toLowerCase();
}

export function calculateCompositeScore(
  verdicts: AgentVerdict[],
  domain: string
): number {
  const weights =
    (DEFAULT_DOMAIN_WEIGHTS as Record<string, Record<string, number>>)[domain] ||
    (DEFAULT_DOMAIN_WEIGHTS as Record<string, Record<string, number>>)['General Technical'] || {};

  let totalScore = 0;
  let totalWeight = 0;

  for (const verdict of verdicts || []) {
    if (!verdict) continue;
    if (verdict.verdict === 'skip') continue;

    const key = normalizeAgentKey(verdict.agentId);
    const rawWeight = (weights as any)[key];
    const agentWeight = typeof rawWeight === 'number' && rawWeight > 0 ? rawWeight : 0;
    if (agentWeight <= 0) continue;

    const score = typeof verdict.confidenceScore === 'number' && !Number.isNaN(verdict.confidenceScore) ? verdict.confidenceScore : (typeof verdict.confidence === 'number' ? verdict.confidence : 0);
    const clampedScore = Math.max(0, Math.min(1, score));

    totalScore += clampedScore * agentWeight;
    totalWeight += agentWeight;
  }

  if (totalWeight > 0) {
    const composite = totalScore / totalWeight;
    return Math.max(0, Math.min(1, composite));
  }

  // No weights applicable — fallback to neutral score 0.5
  return 0.5;
}

export function determineVerdict(
  compositeScore: number
): 'APPROVED' | 'WARNING' | 'REJECTED' {
  const approved = typeof THRESHOLDS.approved === 'number' ? THRESHOLDS.approved : 0.85;
  const warning = typeof THRESHOLDS.warning === 'number' ? THRESHOLDS.warning : 0.6;

  if (compositeScore >= approved) return 'APPROVED';
  if (compositeScore >= warning) return 'WARNING';
  return 'REJECTED';
}

export function getAgentColor(agentName: string): string {
  const colorMap: Record<string, string> = {
    Generator: 'indigo',
    Orchestrator: 'indigo',
    FactVerifier: 'green',
    CorrectionAgent: 'green',
    MathValidator: 'amber',
    StandardsAgent: 'amber',
    CodeAnalyzer: 'red',
    SafetyGate: 'red',
    ReasoningAgent: 'purple',
  };
  return colorMap[agentName] || 'gray';
}
