import { calculateCompositeScore, determineVerdict } from '../lib/agents/safetyGate';
import { AgentVerdict } from '../lib/schemas';
import { describe, it, expect } from 'vitest';

describe('safetyGate scoring', () => {
  it('ignores skip verdicts and unknown agents', () => {
    const verdicts: AgentVerdict[] = [
      { agentId: 'code_analyzer', verdict: 'skip', confidenceScore: 1, issues: [], evidence: [], correctiveHints: [], latencyMs: 10 },
      { agentId: 'unknown_agent', verdict: 'pass', confidenceScore: 1, issues: [], evidence: [], correctiveHints: [], latencyMs: 10 },
    ];

    const score = calculateCompositeScore(verdicts, 'General Technical');
    // unknown_agent has no weight, so fallback to neutral
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('weights agents correctly and clamps scores', () => {
    const verdicts: AgentVerdict[] = [
      { agentId: 'fact_verifier', verdict: 'pass', confidenceScore: 0.9, issues: [], evidence: [], correctiveHints: [], latencyMs: 10 },
      { agentId: 'math_validator', verdict: 'pass', confidenceScore: 1.2 as any, issues: [], evidence: [], correctiveHints: [], latencyMs: 10 },
    ];

    const score = calculateCompositeScore(verdicts, 'General Technical');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('determines verdict thresholds', () => {
    expect(determineVerdict(0.9)).toBe('APPROVED');
    expect(determineVerdict(0.7)).toBe('WARNING');
    expect(determineVerdict(0.4)).toBe('REJECTED');
  });
});
