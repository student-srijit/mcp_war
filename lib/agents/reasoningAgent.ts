import { ClaimUnit, AgentVerdict } from '../schemas';
import { createAgentVerdict } from './utils';
import { callGroqAPI } from '../groqClient';

const REASONING_SYSTEM_PROMPT = `You are a logical reasoning expert. Perform a thorough chain-of-thought analysis on the given claims.

Check for:
1. **Contradictions** — Do any claims directly contradict each other?
2. **Logical fallacies** — Hasty generalization, false dichotomy, circular reasoning, appeal to authority, straw man, ad hominem
3. **Unsupported assumptions** — Claims stated as fact without evidence
4. **Causal errors** — Confusing correlation with causation
5. **Coherence** — Does the overall argument flow logically?

Return a JSON object with this EXACT structure:
{
  "coherenceScore": 0.0-1.0,
  "issues": [
    {
      "type": "contradiction|fallacy|assumption|causal_error|incoherence",
      "claimIds": ["claim-X", "claim-Y"],
      "severity": "critical|major|minor",
      "description": "what the issue is",
      "reasoning": "step-by-step explanation of why this is an issue"
    }
  ],
  "chainOfThought": "Your overall reasoning assessment in 2-3 sentences"
}

Think step by step. Be thorough but fair — only flag genuine reasoning problems.`;

export async function performReasoning(
  claims: ClaimUnit[],
  originalQuery: string
): Promise<AgentVerdict> {
  const startTime = Date.now();

  if (claims.length === 0) {
    return createAgentVerdict({
      agentId: 'reasoning_agent',
      agentName: 'ReasoningAgent',
      verdict: 'skip',
      confidenceScore: 1.0,
      issues: [],
      evidence: [],
      correctiveHints: [],
      latencyMs: Date.now() - startTime,
    });
  }

  const issues: { claimId: string; description: string; severity: 'critical' | 'major' | 'minor' }[] = [];
  const evidence: { claimId: string; sourceUrl: string; excerpt: string; supports: boolean }[] = [];
  const correctiveHints: string[] = [];

  try {
    const claimsList = claims.map((c) => `[${c.claimId}] (${c.claimType}): ${c.content}`).join('\n');
    const userPrompt = `Original query: ${originalQuery}\n\nClaims to analyze for logical consistency:\n\n${claimsList}`;

    const response = await callGroqAPI(REASONING_SYSTEM_PROMPT, userPrompt, 0.2, 2500);

    // Parse JSON
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response.match(/\{[\s\S]*\}/)?.[0]];
    const jsonStr = jsonMatch[1] || response.match(/\{[\s\S]*\}/)?.[0];

    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      const foundIssues = Array.isArray(parsed.issues) ? parsed.issues : [];

      for (const issue of foundIssues) {
        const primaryClaimId = Array.isArray(issue.claimIds) && issue.claimIds[0]
          ? issue.claimIds[0]
          : claims[0]?.claimId || 'unknown';

        issues.push({
          claimId: primaryClaimId,
          description: `[${issue.type || 'reasoning'}] ${issue.description || 'Reasoning issue detected'}`,
          severity: issue.severity || 'major',
        });

        if (issue.reasoning) {
          correctiveHints.push(`${primaryClaimId}: ${issue.reasoning}`);
        }
      }

      // Add chain-of-thought as evidence
      if (parsed.chainOfThought) {
        evidence.push({
          claimId: claims[0]?.claimId || 'overall',
          sourceUrl: 'internal-reasoning-engine',
          excerpt: parsed.chainOfThought,
          supports: foundIssues.length === 0,
        });
      }

      // Use the LLM's coherence score if available
      if (typeof parsed.coherenceScore === 'number') {
        const coherence = Math.max(0, Math.min(1, parsed.coherenceScore));
        if (coherence >= 0.8 && issues.length === 0) {
          evidence.push({
            claimId: claims[0]?.claimId || 'overall',
            sourceUrl: 'internal-reasoning-engine',
            excerpt: `Chain-of-thought analysis: coherence score ${(coherence * 100).toFixed(0)}%`,
            supports: true,
          });
        }
      }
    }
  } catch (error) {
    console.error('[VERITAS] Reasoning agent Groq error:', error);
    // Fallback: basic heuristic checks
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const c1 = claims[i].content.toLowerCase();
        const c2 = claims[j].content.toLowerCase();
        if ((c1.includes('always') && c2.includes('never')) ||
            (c1.includes('increase') && c2.includes('decrease'))) {
          issues.push({
            claimId: claims[i].claimId,
            description: `Potential contradiction between ${claims[i].claimId} and ${claims[j].claimId}`,
            severity: 'major',
          });
        }
      }
    }

    evidence.push({
      claimId: claims[0]?.claimId || 'overall',
      sourceUrl: 'internal-reasoning-engine',
      excerpt: 'Reasoning analysis performed with heuristic fallback (LLM unavailable)',
      supports: issues.length === 0,
    });
  }

  const score = issues.length === 0
    ? 0.95
    : Math.max(0.4, 1.0 - (issues.filter(i => i.severity === 'critical').length * 0.25) - (issues.filter(i => i.severity === 'major').length * 0.15));

  return createAgentVerdict({
    agentId: 'reasoning_agent',
    agentName: 'ReasoningAgent',
    verdict: issues.length === 0 ? 'pass' : issues.some(i => i.severity === 'critical') ? 'fail' : 'warn',
    confidenceScore: Math.max(0, Math.min(1, score)),
    issues,
    evidence,
    correctiveHints: correctiveHints.length > 0 ? [
      ...correctiveHints,
      'Review logical flow and argument structure',
      'Ensure all assumptions are explicitly stated',
    ] : [],
    latencyMs: Date.now() - startTime,
    findings: issues.map(i => ({ severity: i.severity, issue: i.description })),
    correctionApplied: false,
  });
}
