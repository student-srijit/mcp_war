/**
 * GitHub Agent — Reads code from GitHub repos for verification
 * Capabilities:
 * - Parse GitHub URLs from queries
 * - Read repo structure and individual files
 * - Analyze code quality using LLM + real execution
 * - Search GitHub for similar code patterns
 */

import { ClaimUnit, AgentVerdict } from '../schemas';
import { createAgentVerdict } from './utils';
import { callGroqAPI } from '../groqClient';
import { githubClient, extractGitHubUrls, parseGitHubUrl } from '../githubClient';
import { executeCode, detectLanguage } from '../judge0Client';

const GITHUB_ANALYSIS_PROMPT = `You are an expert code reviewer analyzing code from a GitHub repository.

Analyze the code for:
1. **Code quality** — readability, maintainability, architecture
2. **Security vulnerabilities** — injection, XSS, secrets exposure, unsafe operations
3. **Best practices** — error handling, typing, documentation
4. **Performance issues** — N+1 queries, memory leaks, blocking calls
5. **Dependency risks** — outdated packages, known CVEs

Return JSON:
{
  "overallQuality": "excellent|good|acceptable|poor",
  "securityScore": 0.0-1.0,
  "issues": [
    { "severity": "critical|major|minor", "description": "...", "file": "...", "suggestedFix": "..." }
  ],
  "summary": "2-3 sentence summary of code quality"
}`;

export async function analyzeGitHub(
  claims: ClaimUnit[],
  query: string
): Promise<AgentVerdict> {
  const startTime = Date.now();

  // Extract GitHub URLs from claims AND original query
  const allText = query + ' ' + claims.map(c => c.content).join(' ');
  const urls = extractGitHubUrls(allText);
  const githubClaims = claims.filter(c => c.claimType === 'github' || c.githubUrl);

  // Also check for GitHub URLs in claim content
  for (const claim of claims) {
    const claimUrls = extractGitHubUrls(claim.content);
    urls.push(...claimUrls);
  }

  const uniqueUrls = [...new Set(urls)];

  if (uniqueUrls.length === 0 && githubClaims.length === 0) {
    return createAgentVerdict({
      agentId: 'github_agent',
      agentName: 'GitHubAgent',
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

  for (const url of uniqueUrls) {
    const parsed = parseGitHubUrl(url);
    if (!parsed) continue;

    const claimId = githubClaims[0]?.claimId || claims[0]?.claimId || 'github-0';

    try {
      // Get repo info
      const repoInfo = await githubClient.getRepoInfo(parsed.owner, parsed.repo);
      if (repoInfo) {
        evidence.push({
          claimId,
          sourceUrl: repoInfo.url,
          excerpt: `Repository: ${repoInfo.fullName} | ⭐ ${repoInfo.stars} | Language: ${repoInfo.language} | ${repoInfo.description}`,
          supports: true,
        });
      }

      // If a specific file path is given, read and analyze it
      if (parsed.path) {
        const file = await githubClient.readFile(parsed.owner, parsed.repo, parsed.path, parsed.branch);
        if (file) {
          evidence.push({
            claimId,
            sourceUrl: file.url,
            excerpt: `File: ${file.path} (${file.size} bytes, ${file.language || 'unknown'})`,
            supports: true,
          });

          // Analyze the code with LLM
          const codeSnippet = file.content.slice(0, 4000);
          try {
            const analysis = await callGroqAPI(
              GITHUB_ANALYSIS_PROMPT,
              `Repository: ${parsed.owner}/${parsed.repo}\nFile: ${file.path}\nLanguage: ${file.language || 'unknown'}\n\nCode:\n\`\`\`\n${codeSnippet}\n\`\`\``,
              0.1,
              2000
            );

            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);
              const codeIssues = Array.isArray(result.issues) ? result.issues : [];

              for (const issue of codeIssues) {
                issues.push({
                  claimId,
                  description: `[${issue.file || file.path}] ${issue.description}`,
                  severity: issue.severity || 'minor',
                });
                if (issue.suggestedFix) {
                  correctiveHints.push(`${file.path}: ${issue.suggestedFix}`);
                }
              }

              evidence.push({
                claimId,
                sourceUrl: file.url,
                excerpt: `Analysis: ${result.summary || `Quality: ${result.overallQuality}`} | Security: ${((result.securityScore || 0.8) * 100).toFixed(0)}%`,
                supports: codeIssues.filter((i: any) => i.severity === 'critical').length === 0,
              });
            }
          } catch (analysisError) {
            console.error('[GitHub Agent] LLM analysis error:', analysisError);
          }

          // Try to execute code if it's a runnable file
          if (file.language && ['python', 'javascript', 'typescript'].includes(file.language)) {
            try {
              // Only execute small, self-contained scripts
              if (file.size < 2000 && !file.content.includes('import ') && !file.content.includes('require(')) {
                const execResult = await executeCode(file.content, file.language);
                evidence.push({
                  claimId,
                  sourceUrl: file.url,
                  excerpt: execResult.success
                    ? `Execution: ✅ Code runs successfully (${execResult.engine}) | Output: ${execResult.stdout.slice(0, 200)}`
                    : `Execution: ❌ Runtime error | ${execResult.stderr.slice(0, 200)}`,
                  supports: execResult.success,
                });
                if (!execResult.success) {
                  issues.push({
                    claimId,
                    description: `Code execution failed: ${execResult.stderr.slice(0, 200)}`,
                    severity: 'major',
                  });
                }
              }
            } catch (execError) {
              // Code execution is optional, don't fail the agent
            }
          }
        } else {
          issues.push({
            claimId,
            description: `Could not read file: ${parsed.path} from ${parsed.owner}/${parsed.repo}`,
            severity: 'major',
          });
        }
      } else {
        // No specific file — get repo tree overview
        const tree = await githubClient.getRepoTree(parsed.owner, parsed.repo);
        if (tree.length > 0) {
          const sourceFiles = tree.filter(f => f.type === 'blob').slice(0, 20);
          evidence.push({
            claimId,
            sourceUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
            excerpt: `Repo structure: ${tree.length} items | Key files: ${sourceFiles.map(f => f.path).slice(0, 5).join(', ')}`,
            supports: true,
          });
        }
      }
    } catch (error) {
      console.error(`[GitHub Agent] Error processing ${url}:`, error);
      issues.push({
        claimId,
        description: `GitHub API error for ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'minor',
      });
    }
  }

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const majorCount = issues.filter(i => i.severity === 'major').length;
  const score = issues.length === 0
    ? 0.95
    : Math.max(0.3, 1.0 - criticalCount * 0.3 - majorCount * 0.15);

  return createAgentVerdict({
    agentId: 'github_agent',
    agentName: 'GitHubAgent',
    verdict: criticalCount > 0 ? 'fail' : issues.length > 0 ? 'warn' : 'pass',
    confidenceScore: Math.max(0, Math.min(1, score)),
    issues,
    evidence,
    correctiveHints,
    latencyMs: Date.now() - startTime,
    findings: issues.map(i => ({ severity: i.severity, issue: i.description })),
    correctionApplied: false,
  });
}
