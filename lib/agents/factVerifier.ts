import { ClaimUnit, AgentVerdict } from '../schemas';
import { createAgentVerdict } from './utils';
import { mcpFetch, mcpMemory } from '../mcpServers';
import { searchYouCom } from '../searchClient';

export async function verifyFactualClaims(
  claims: ClaimUnit[]
): Promise<AgentVerdict> {
  const startTime = Date.now();
  const factualClaims = claims.filter((c) => c.claimType === 'factual');

  if (factualClaims.length === 0) {
    return createAgentVerdict({
      agentId: 'fact_verifier',
      agentName: 'FactVerifier',
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

  // Verify each factual claim using multiple sources via MCP
  for (const claim of factualClaims) {
    let verified = false;

    // Check MCP memory cache first
    const cacheKey = `fact:${claim.content.slice(0, 100)}`;
    const cached = mcpMemory.get(cacheKey);
    if (cached) {
      const cachedResult = cached as { sourceUrl: string; excerpt: string; supports: boolean };
      evidence.push({ claimId: claim.claimId, ...cachedResult });
      if (cachedResult.supports) verified = true;
      continue;
    }

    // Source 1: you.com search (if enabled)
    const enableYou = (process.env.ENABLE_YOUCOM || 'false').toLowerCase() === 'true';
    if (enableYou && !verified) {
      try {
        const you = await searchYouCom(claim.content);
        if (you.found) {
          const result = { sourceUrl: you.url, excerpt: you.snippet, supports: true };
          evidence.push({ claimId: claim.claimId, ...result });
          mcpMemory.set(cacheKey, result);
          verified = true;
          continue;
        }
      } catch (err) {
        console.error('[VERITAS] you.com adapter error:', err);
      }
    }

    // Source 2: Wikipedia via MCP/fetch
    if (!verified) {
      const wikiResult = await mcpFetch.searchWikipedia(claim.content);
      if (wikiResult.found) {
        const result = { sourceUrl: wikiResult.url, excerpt: wikiResult.snippet, supports: true };
        evidence.push({ claimId: claim.claimId, ...result });
        mcpMemory.set(cacheKey, result);
        verified = true;
        continue;
      }
    }

    // Source 3: arXiv via MCP/fetch
    if (!verified) {
      const arxivResult = await mcpFetch.searchArXiv(claim.content);
      if (arxivResult.found) {
        const result = {
          sourceUrl: arxivResult.url,
          excerpt: `${arxivResult.title} (${arxivResult.authors})`,
          supports: true,
        };
        evidence.push({ claimId: claim.claimId, ...result });
        mcpMemory.set(cacheKey, result);
        verified = true;
        continue;
      }
    }

    // Source 4: OpenAlex via MCP/fetch
    if (!verified) {
      const openAlexResult = await mcpFetch.searchOpenAlex(claim.content);
      if (openAlexResult.found) {
        const result = {
          sourceUrl: openAlexResult.url,
          excerpt: openAlexResult.title,
          supports: true,
        };
        evidence.push({ claimId: claim.claimId, ...result });
        mcpMemory.set(cacheKey, result);
        verified = true;
        continue;
      }
    }

    // Not found in any source
    if (!verified) {
      issues.push({
        claimId: claim.claimId,
        description: 'Factual claim could not be verified through any public source (Wikipedia, arXiv, OpenAlex)',
        severity: 'major',
      });

      evidence.push({
        claimId: claim.claimId,
        sourceUrl: 'https://www.wikipedia.org',
        excerpt: 'No verification found in Wikipedia, arXiv, or OpenAlex academic sources',
        supports: false,
      });
    }
  }

  const score = Math.max(
    0.55,
    1.0 - (issues.length / Math.max(1, factualClaims.length)) * 0.6
  );

  return createAgentVerdict({
    agentId: 'fact_verifier',
    agentName: 'FactVerifier',
    verdict: issues.length === 0 ? 'pass' : issues.length > 1 ? 'fail' : 'warn',
    confidenceScore: Math.max(0, Math.min(1, score)),
    issues,
    evidence,
    correctiveHints:
      issues.length > 0
        ? [
            'Cross-reference with Wikipedia or academic sources',
            'Include citation URLs or references for factual claims',
            'Verify statistical data and dates',
            'Check against peer-reviewed research when applicable',
          ]
        : [],
    latencyMs: Date.now() - startTime,
    findings: issues.map(i => ({ severity: i.severity, issue: i.description })),
    correctionApplied: false,
  });
}
