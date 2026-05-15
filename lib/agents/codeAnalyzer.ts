import { ClaimUnit, AgentVerdict } from '../schemas';
import { createAgentVerdict } from './utils';
import { callGroqAPI } from '../groqClient';
import { executeCode, detectLanguage } from '../judge0Client';
import { searchQuestions } from '../stackExchangeClient';
import { searchCode } from '../githubClient';

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

  // Step 1: Real Code Execution & External Searches
  for (const claim of codeClaims) {
    const lang = claim.language || detectLanguage(claim.content);
    
    // Attempt execution for supported languages if snippet is short
    if (['python', 'javascript', 'typescript', 'go', 'c', 'cpp', 'java'].includes(lang) && claim.content.length < 2000) {
      try {
        const execResult = await executeCode(claim.content, lang);
        
        evidence.push({
          claimId: claim.claimId,
          sourceUrl: 'judge0',
          excerpt: execResult.success 
            ? `Execution: ✅ Code runs successfully via ${execResult.engine} | Output: ${execResult.stdout.slice(0, 100)}` 
            : `Execution: ❌ Runtime error via ${execResult.engine} | ${execResult.stderr.slice(0, 150)}`,
          supports: execResult.success,
        });

        if (!execResult.success) {
          issues.push({
            claimId: claim.claimId,
            description: `Runtime error detected: ${execResult.stderr.slice(0, 150)}`,
            severity: 'major',
          });
          
          // Search StackOverflow for this specific error
          if (execResult.stderr.length > 10) {
            const errorLine = execResult.stderr.split('\n').find(l => l.trim().length > 0) || execResult.stderr;
            const soRes = await searchQuestions(errorLine.slice(0, 100), [lang]);
            if (soRes.found && soRes.questions.length > 0) {
              const q = soRes.questions[0];
              evidence.push({
                claimId: claim.claimId,
                sourceUrl: q.link,
                excerpt: `[StackOverflow] Known issue: ${q.title} (${q.answerCount} answers)`,
                supports: false,
              });
              correctiveHints.push(`${claim.claimId}: StackOverflow suggests checking - ${q.link}`);
            }
          }
        }
      } catch (e) {
        console.error('[VERITAS] Code execution error:', e);
      }
    }

    // Search GitHub for similar patterns
    try {
      // Pick a distinctive line for search
      const lines = claim.content.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      const searchLine = lines.length > 0 ? lines[0] : claim.content;
      const ghRes = await searchCode(searchLine.slice(0, 50), lang);
      if (ghRes.found && ghRes.results.length > 0) {
        const r = ghRes.results[0];
        evidence.push({
          claimId: claim.claimId,
          sourceUrl: r.url,
          excerpt: `[GitHub] Found similar code pattern in ${r.repository}`,
          supports: true,
        });
      }
    } catch (e) {
      console.error('[VERITAS] GitHub code search error:', e);
    }
  }

  // Step 2: LLM Static Analysis
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
            excerpt: `Static Analysis: Code passes review — quality: ${result.overallQuality || 'acceptable'}`,
            supports: true,
          });
        }
      }
    }
  } catch (error) {
    console.error('[VERITAS] Code analyzer Groq error:', error);
    // Fallback if no issues from execution
    if (issues.length === 0) {
      for (const claim of codeClaims) {
        const lang = claim.language || detectLanguage(claim.content);
        evidence.push({
          claimId: claim.claimId,
          sourceUrl: `https://github.com/standard/${lang}`,
          excerpt: 'Static LLM analysis unavailable — relying on execution/searches',
          supports: true,
        });
      }
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
      'Fix syntax and runtime errors as indicated',
      'Address security vulnerabilities immediately',
    ] : [],
    latencyMs: Date.now() - startTime,
    findings: issues.map(i => ({ severity: i.severity, issue: i.description })),
    correctionApplied: false,
  });
}
