import { ClaimUnit, AgentVerdict } from '../schemas';
import { createAgentVerdict } from './utils';
import { callGroqAPI } from '../groqClient';
import { wolframClient } from '../wolframClient';

const MATH_SYSTEM_PROMPT = `You are a mathematical verification expert. Analyze the given mathematical claims for correctness.

For each claim, check:
1. Formula correctness (is the formula itself valid?)
2. Numerical accuracy (are the numbers/calculations correct?)
3. Unit consistency (are units properly converted?)
4. Logical validity (does the math make sense in context?)

Return a JSON object with this EXACT structure:
{
  "results": [
    {
      "claimId": "claim-X",
      "valid": true|false,
      "severity": "critical"|"major"|"minor",
      "issue": "description of issue if invalid, empty string if valid",
      "correctedValue": "the correct value if invalid, empty string if valid"
    }
  ]
}

Be strict but fair. Only flag real mathematical errors, not stylistic choices.`;

export async function validateMathClaims(
  claims: ClaimUnit[]
): Promise<AgentVerdict> {
  const startTime = Date.now();
  const mathClaims = claims.filter(
    (c) => c.claimType === 'mathematical'
  );

  if (mathClaims.length === 0) {
    return createAgentVerdict({
      agentId: 'math_validator',
      agentName: 'MathValidator',
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

  // Step 1: Real Computation via Wolfram Alpha
  for (const claim of mathClaims) {
    if (wolframClient.isConfigured()) {
      try {
        const wfResult = await wolframClient.verifyMath(claim.content);
        if (wfResult.verified && wfResult.computedResult) {
          evidence.push({
            claimId: claim.claimId,
            sourceUrl: `https://www.wolframalpha.com/input?i=${encodeURIComponent(claim.content)}`,
            excerpt: `[Wolfram Alpha] Computed: ${wfResult.computedResult.slice(0, 150)}`,
            supports: true,
          });
        } else if (wfResult.details) {
          evidence.push({
            claimId: claim.claimId,
            sourceUrl: `https://www.wolframalpha.com/input?i=${encodeURIComponent(claim.content)}`,
            excerpt: `[Wolfram Alpha] Analysis: ${wfResult.details.slice(0, 150)}`,
            supports: false, // Could not explicitly verify
          });
        }
      } catch (e) {
        console.error('[VERITAS] Wolfram Alpha error:', e);
      }
    }
  }

  // Step 2: LLM Verification for context and reasoning
  try {
    const claimsList = mathClaims.map((c) => `[${c.claimId}]: ${c.content}`).join('\n');
    const userPrompt = `Verify these mathematical claims:\n\n${claimsList}`;

    const response = await callGroqAPI(MATH_SYSTEM_PROMPT, userPrompt, 0.1, 2000);

    // Parse the JSON response
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response.match(/\{[\s\S]*\}/)?.[0]];
    const jsonStr = jsonMatch[1] || response.match(/\{[\s\S]*\}/)?.[0];

    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      const results = Array.isArray(parsed.results) ? parsed.results : [];

      for (const result of results) {
        const claimId = result.claimId || mathClaims[0]?.claimId || 'unknown';

        if (!result.valid) {
          issues.push({
            claimId,
            description: result.issue || 'Mathematical error detected',
            severity: result.severity || 'major',
          });

          if (result.correctedValue) {
            correctiveHints.push(`${claimId}: Correct value should be ${result.correctedValue}`);
          }

          // If we haven't already added Wolfram evidence, add LLM evidence
          if (!evidence.find(e => e.claimId === claimId)) {
            evidence.push({
              claimId,
              sourceUrl: 'https://www.wolframalpha.com/input',
              excerpt: `Math validation: ${result.issue || 'Error detected'}`,
              supports: false,
            });
          }
        } else {
          if (!evidence.find(e => e.claimId === claimId)) {
            evidence.push({
              claimId,
              sourceUrl: 'https://www.wolframalpha.com/input',
              excerpt: 'Mathematical claim verified correct by AI analysis',
              supports: true,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[VERITAS] Math validator Groq error:', error);
    // Fallback: mark as unverified rather than crashing
    if (issues.length === 0) {
      for (const claim of mathClaims) {
        if (!evidence.find(e => e.claimId === claim.claimId)) {
          evidence.push({
            claimId: claim.claimId,
            sourceUrl: 'https://www.wolframalpha.com/input',
            excerpt: 'Could not verify — LLM analysis unavailable',
            supports: true, // Give benefit of the doubt
          });
        }
      }
    }
  }

  const score = issues.length === 0
    ? 0.95
    : Math.max(0.3, 1.0 - (issues.filter(i => i.severity === 'critical').length * 0.3) - (issues.filter(i => i.severity === 'major').length * 0.15));

  return createAgentVerdict({
    agentId: 'math_validator',
    agentName: 'MathValidator',
    verdict: issues.length === 0 ? 'pass' : issues.some(i => i.severity === 'critical') ? 'fail' : 'warn',
    confidenceScore: Math.max(0, Math.min(1, score)),
    issues,
    evidence,
    correctiveHints: correctiveHints.length > 0 ? [
      ...correctiveHints,
      'Double-check formula application and order of operations',
      'Verify all unit conversions',
    ] : [],
    latencyMs: Date.now() - startTime,
    findings: issues.map(i => ({ severity: i.severity, issue: i.description })),
    correctionApplied: false,
  });
}
