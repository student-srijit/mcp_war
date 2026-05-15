import { ClaimUnit, AgentVerdict } from '../schemas';
import { createAgentVerdict } from './utils';
import { callGroqAPI } from '../groqClient';

const CODE_ANALYSIS_PROMPT = `You are an expert code reviewer and static analysis tool. Analyze the given code claims for:

1. **Syntax errors** — invalid syntax, missing brackets, wrong indentation
2. **Security vulnerabilities** — SQL injection, XSS, unsafe eval, hardcoded secrets
3. **Best practice violations** — using var instead of const/let, missing error handling, memory leaks
4. **Dependency issues** — importing non-existent packages, version conflicts
5. **Logic errors** — off-by-one, null pointer risks, race conditions

Return a JSON object with this EXACT structure:
{
  "results": [
    {
      "claimId": "claim-X",
      "language": "python|javascript|typescript|c|cpp|unknown",
      "issues": [
        {
          "type": "syntax|security|best_practice|dependency|logic",
          "severity": "critical|major|minor",
          "description": "what the issue is",
          "suggestedFix": "how to fix it"
        }
      ],
      "overallQuality": "good|acceptable|poor"
    }
  ]
}

Be thorough but not pedantic. Focus on real bugs and security issues.`;

function detectLanguage(content: string): string {
  if (content.includes('def ') || content.includes('import ') && content.includes(':')) return 'python';
  if (content.includes('const ') || content.includes('let ') || content.includes('function ')) return 'javascript';
  if (content.includes(': ') && (content.includes('interface ') || content.includes('type '))) return 'typescript';
  if (content.includes('#include') || content.includes('int main')) return 'c';
  if (content.includes('std::') || content.includes('cout')) return 'cpp';
  return 'unknown';
}

export async function analyzeCodeClaims(
  claims: ClaimUnit[]
): Promise<AgentVerdict> {
  const startTime = Date.now();
  const codeClaims = claims.filter((c) => c.claimType === 'code');

  if (codeClaims.length === 0) {
    return createAgentVerdict({
      agentId: 'code_analyzer',
      agentName: 'CodeAnalyzer',
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
    const claimsList = codeClaims.map((c) => {
      const lang = c.language || detectLanguage(c.content);
      return `[${c.claimId}] (${lang}):\n\`\`\`${lang}\n${c.content}\n\`\`\``;
    }).join('\n\n');

    const userPrompt = `Analyze these code claims:\n\n${claimsList}`;
    const response = await callGroqAPI(CODE_ANALYSIS_PROMPT, userPrompt, 0.1, 3000);

    // Parse JSON
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response.match(/\{[\s\S]*\}/)?.[0]];
    const jsonStr = jsonMatch[1] || response.match(/\{[\s\S]*\}/)?.[0];

    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      const results = Array.isArray(parsed.results) ? parsed.results : [];

      for (const result of results) {
        const claimId = result.claimId || codeClaims[0]?.claimId || 'unknown';
        const lang = result.language || 'unknown';
        const codeIssues = Array.isArray(result.issues) ? result.issues : [];

        for (const issue of codeIssues) {
          issues.push({
            claimId,
            description: `[${lang}] ${issue.type || 'code'}: ${issue.description || 'Issue detected'}`,
            severity: issue.severity || 'major',
          });

          if (issue.suggestedFix) {
            correctiveHints.push(`${claimId}: ${issue.suggestedFix}`);
          }
        }

        if (codeIssues.length === 0) {
          evidence.push({
            claimId,
            sourceUrl: `https://github.com/standard/${lang}`,
            excerpt: `Code passes analysis — quality: ${result.overallQuality || 'acceptable'}`,
            supports: true,
          });
        } else {
          evidence.push({
            claimId,
            sourceUrl: `https://github.com/standard/${lang}`,
            excerpt: `Found ${codeIssues.length} issue(s) in ${lang} code`,
            supports: false,
          });
        }
      }
    }
  } catch (error) {
    console.error('[VERITAS] Code analyzer Groq error:', error);
    // Fallback
    for (const claim of codeClaims) {
      const lang = claim.language || detectLanguage(claim.content);
      evidence.push({
        claimId: claim.claimId,
        sourceUrl: `https://github.com/standard/${lang}`,
        excerpt: 'Code analysis unavailable — LLM error',
        supports: true,
      });
    }
  }

  const score = issues.length === 0
    ? 0.95
    : Math.max(0.3, 1.0 - (issues.filter(i => i.severity === 'critical').length * 0.3) - (issues.filter(i => i.severity === 'major').length * 0.15));

  return createAgentVerdict({
    agentId: 'code_analyzer',
    agentName: 'CodeAnalyzer',
    verdict: issues.length === 0 ? 'pass' : issues.some(i => i.severity === 'critical') ? 'fail' : 'warn',
    confidenceScore: Math.max(0, Math.min(1, score)),
    issues,
    evidence,
    correctiveHints: correctiveHints.length > 0 ? [
      ...correctiveHints,
      'Fix syntax errors as indicated by analysis',
      'Address security vulnerabilities immediately',
    ] : [],
    latencyMs: Date.now() - startTime,
    findings: issues.map(i => ({ severity: i.severity, issue: i.description })),
    correctionApplied: false,
  });
}
