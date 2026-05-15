import { ClaimUnit, AgentVerdict } from '../schemas';
import { createAgentVerdict } from './utils';
import { mcpFetch, mcpMemory } from '../mcpServers';
import { searchYouCom } from '../searchClient';
import { googleSearch, googleScholar } from '../serperClient';
import { searchQuestions } from '../stackExchangeClient';
import { embeddingsClient } from '../embeddingsClient';

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

    // Source 2: Google Search via Serper (NEW)
    if (!verified) {
      try {
        const google = await googleSearch(claim.content, 3);
        if (google.found && google.results.length > 0) {
          const top = google.results[0];
          // Use answer box if available for direct answers
          const snippet = google.answerBox?.answer || google.answerBox?.snippet || top.snippet;
          const result = { sourceUrl: top.link, excerpt: `[Google] ${snippet}`, supports: true };
          evidence.push({ claimId: claim.claimId, ...result });
          mcpMemory.set(cacheKey, result);
          verified = true;

          // If we have embeddings, score the relevance
          if (embeddingsClient.isConfigured()) {
            try {
              const similarity = await embeddingsClient.semanticSimilarity(claim.content, snippet);
              if (similarity < 0.4) {
                // Low relevance — mark as uncertain rather than verified
                evidence[evidence.length - 1].supports = false;
                evidence[evidence.length - 1].excerpt += ` (relevance: ${(similarity * 100).toFixed(0)}% — low match)`;
                verified = false;
              }
            } catch { /* embeddings are optional */ }
          }
          if (verified) continue;
        }
      } catch (err) {
        console.error('[VERITAS] Serper search error:', err);
      }
    }

    // Source 3: Wikipedia via MCP/fetch
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

    // Source 4: arXiv via MCP/fetch
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

    // Source 5: Google Scholar via Serper (NEW — for academic claims)
    if (!verified) {
      try {
        const scholar = await googleScholar(claim.content, 2);
        if (scholar.found && scholar.papers.length > 0) {
          const paper = scholar.papers[0];
          const result = {
            sourceUrl: paper.link,
            excerpt: `[Scholar] ${paper.title}${paper.year ? ` (${paper.year})` : ''}${paper.citedBy ? ` — ${paper.citedBy} citations` : ''}`,
            supports: true,
          };
          evidence.push({ claimId: claim.claimId, ...result });
          mcpMemory.set(cacheKey, result);
          verified = true;
          continue;
        }
      } catch (err) {
        console.error('[VERITAS] Scholar search error:', err);
      }
    }

    // Source 6: OpenAlex via MCP/fetch
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

    // Source 7: StackOverflow (NEW — for technical claims)
    if (!verified) {
      try {
        const so = await searchQuestions(claim.content);
        if (so.found && so.questions.length > 0) {
          const q = so.questions[0];
          if (q.isAnswered && q.score > 0) {
            const result = {
              sourceUrl: q.link,
              excerpt: `[StackOverflow] ${q.title} (score: ${q.score}, ${q.answerCount} answers)`,
              supports: true,
            };
            evidence.push({ claimId: claim.claimId, ...result });
            mcpMemory.set(cacheKey, result);
            verified = true;
            continue;
          }
        }
      } catch (err) {
        console.error('[VERITAS] StackOverflow search error:', err);
      }
    }

    // Not found in any source
    if (!verified) {
      issues.push({
        claimId: claim.claimId,
        description: 'Factual claim could not be verified through any source (Google, Wikipedia, arXiv, Scholar, OpenAlex, StackOverflow)',
        severity: 'major',
      });
      evidence.push({
        claimId: claim.claimId,
        sourceUrl: 'https://www.wikipedia.org',
        excerpt: 'No verification found across 7 search sources',
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
