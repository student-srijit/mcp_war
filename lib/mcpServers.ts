/**
 * MCP (Model Context Protocol) Server Implementations
 * 
 * These implement the MCP-ready architecture described in the spec:
 * - @mcp/filesystem — File writing for claims and reports
 * - @mcp/fetch — Standards fetching and web verification
 * - @mcp/memory — Fact caching for repeated queries
 * - @mcp/sequential-thinking — Reasoning scaffolding
 * - @mcp/github — Package validation for code claims
 * - @mcp/youcom-search — Extended fact verification via you.com
 */

import { ClaimUnit, EvidenceItem } from './schemas';

// ==========================================
// @mcp/memory — In-memory fact cache
// ==========================================
const factCache = new Map<string, { result: unknown; timestamp: number; ttlMs: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const mcpMemory = {
  /** Store a fact verification result in cache */
  set(key: string, value: unknown, ttlMs: number = CACHE_TTL_MS): void {
    factCache.set(key, { result: value, timestamp: Date.now(), ttlMs });
  },

  /** Retrieve a cached fact, returns null if expired or missing */
  get(key: string): unknown | null {
    const entry = factCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      factCache.delete(key);
      return null;
    }
    return entry.result;
  },

  /** Check if key exists and is not expired */
  has(key: string): boolean {
    return this.get(key) !== null;
  },

  /** Clear all cached facts */
  clear(): void {
    factCache.clear();
  },

  /** Get cache stats */
  stats(): { size: number; keys: string[] } {
    // Cleanup expired entries
    for (const [key, entry] of factCache.entries()) {
      if (Date.now() - entry.timestamp > entry.ttlMs) {
        factCache.delete(key);
      }
    }
    return { size: factCache.size, keys: Array.from(factCache.keys()) };
  },
};

// ==========================================
// @mcp/fetch — Web fetching for verification
// ==========================================
export const mcpFetch = {
  /** Fetch a URL and return text content */
  async fetchText(url: string, timeoutMs: number = 10000): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VERITAS-Agent/1.0 (Technical Verification System)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  },

  /** Fetch JSON from a URL */
  async fetchJSON(url: string, timeoutMs: number = 10000): Promise<unknown> {
    const text = await this.fetchText(url, timeoutMs);
    return JSON.parse(text);
  },

  /** Search Wikipedia API */
  async searchWikipedia(query: string): Promise<{ found: boolean; snippet: string; url: string; title: string }> {
    // Check cache first
    const cacheKey = `wiki:${query}`;
    const cached = mcpMemory.get(cacheKey);
    if (cached) return cached as any;

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&format=json&origin=*&srlimit=3`;
      const data = await this.fetchJSON(url) as any;

      if (data.query?.search?.[0]) {
        const result = {
          found: true,
          snippet: data.query.search[0].snippet?.replace(/<[^>]*>/g, '') || '',
          url: `https://en.wikipedia.org/wiki/${data.query.search[0].title.replace(/ /g, '_')}`,
          title: data.query.search[0].title,
        };
        mcpMemory.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.error('[MCP/fetch] Wikipedia search error:', error);
    }

    return { found: false, snippet: '', url: '', title: '' };
  },

  /** Search arXiv API */
  async searchArXiv(query: string): Promise<{ found: boolean; title: string; url: string; authors: string }> {
    const cacheKey = `arxiv:${query}`;
    const cached = mcpMemory.get(cacheKey);
    if (cached) return cached as any;

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&max_results=1&sortBy=relevance&sortOrder=descending`;
      const text = await this.fetchText(url, 15000);

      const titleMatch = text.match(/<title>([^<]+)<\/title>/g);
      const idMatch = text.match(/<id>http:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);
      const authorMatch = text.match(/<name>([^<]+)<\/name>/);

      // Skip the feed title (first match)
      const paperTitle = titleMatch && titleMatch.length > 1
        ? titleMatch[1].replace(/<\/?title>/g, '').trim()
        : null;

      if (paperTitle && idMatch) {
        const result = {
          found: true,
          title: paperTitle,
          url: `https://arxiv.org/abs/${idMatch[1]}`,
          authors: authorMatch ? authorMatch[1] : 'Unknown',
        };
        mcpMemory.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.error('[MCP/fetch] arXiv search error:', error);
    }

    return { found: false, title: '', url: '', authors: '' };
  },

  /** Search OpenAlex API for academic papers */
  async searchOpenAlex(query: string): Promise<{ found: boolean; title: string; url: string; doi: string }> {
    const cacheKey = `openalex:${query}`;
    const cached = mcpMemory.get(cacheKey);
    if (cached) return cached as any;

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://api.openalex.org/works?search=${encodedQuery}&per_page=1`;
      const data = await this.fetchJSON(url) as any;

      if (data.results?.[0]) {
        const work = data.results[0];
        const result = {
          found: true,
          title: work.title || '',
          url: work.id || '',
          doi: work.doi || '',
        };
        mcpMemory.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.error('[MCP/fetch] OpenAlex search error:', error);
    }

    return { found: false, title: '', url: '', doi: '' };
  },
};

// ==========================================
// @mcp/github — Package validation
// ==========================================
export const mcpGithub = {
  /** Check if an npm package exists */
  async checkNpmPackage(packageName: string): Promise<{ exists: boolean; version: string; description: string }> {
    const cacheKey = `npm:${packageName}`;
    const cached = mcpMemory.get(cacheKey);
    if (cached) return cached as any;

    try {
      const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
      const data = await mcpFetch.fetchJSON(url) as any;

      if (data.name) {
        const result = {
          exists: true,
          version: data.version || 'unknown',
          description: data.description || '',
        };
        mcpMemory.set(cacheKey, result, 30 * 60 * 1000); // 30 min cache for packages
        return result;
      }
    } catch (error) {
      // Package not found or API error
    }

    return { exists: false, version: '', description: '' };
  },

  /** Check if a PyPI package exists */
  async checkPyPIPackage(packageName: string): Promise<{ exists: boolean; version: string; description: string }> {
    const cacheKey = `pypi:${packageName}`;
    const cached = mcpMemory.get(cacheKey);
    if (cached) return cached as any;

    try {
      const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
      const data = await mcpFetch.fetchJSON(url) as any;

      if (data.info?.name) {
        const result = {
          exists: true,
          version: data.info.version || 'unknown',
          description: data.info.summary || '',
        };
        mcpMemory.set(cacheKey, result, 30 * 60 * 1000);
        return result;
      }
    } catch (error) {
      // Package not found
    }

    return { exists: false, version: '', description: '' };
  },
};

// ==========================================
// @mcp/filesystem — Report/claim file writing
// ==========================================
export const mcpFilesystem = {
  /** Generate a JSON audit report from verification data */
  generateAuditReport(jobData: {
    jobId: string;
    query: string;
    domain: string;
    claims: ClaimUnit[];
    evidence: EvidenceItem[];
    compositeScore: number;
    verdict: string;
    retryCount: number;
    agentVerdicts: unknown[];
    feedLogs: unknown[];
  }): string {
    return JSON.stringify({
      reportType: 'VERITAS Verification Audit Report',
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      ...jobData,
    }, null, 2);
  },

  /** Generate a claims manifest */
  generateClaimsManifest(claims: ClaimUnit[]): string {
    return JSON.stringify({
      type: 'Claims Manifest',
      generatedAt: new Date().toISOString(),
      totalClaims: claims.length,
      byType: {
        factual: claims.filter(c => c.claimType === 'factual').length,
        mathematical: claims.filter(c => c.claimType === 'mathematical').length,
        code: claims.filter(c => c.claimType === 'code').length,
        standard_citation: claims.filter(c => c.claimType === 'standard_citation').length,
        reasoning: claims.filter(c => c.claimType === 'reasoning').length,
      },
      claims,
    }, null, 2);
  },
};

// ==========================================
// @mcp/sequential-thinking — Reasoning scaffolding
// ==========================================
export const mcpSequentialThinking = {
  /** Create a structured thinking chain for complex claims */
  buildThinkingChain(claims: ClaimUnit[]): {
    steps: { step: number; action: string; targets: string[] }[];
    dependencies: { from: string; to: string }[];
  } {
    const steps: { step: number; action: string; targets: string[] }[] = [];
    const dependencies: { from: string; to: string }[] = [];

    // Step 1: Extract and classify
    steps.push({
      step: 1,
      action: 'classify_claims',
      targets: claims.map(c => c.claimId),
    });

    // Step 2: Verify factual claims first (they inform other checks)
    const factualIds = claims.filter(c => c.claimType === 'factual').map(c => c.claimId);
    if (factualIds.length > 0) {
      steps.push({ step: 2, action: 'verify_facts', targets: factualIds });
    }

    // Step 3: Validate math (may depend on factual claims)
    const mathIds = claims.filter(c => c.claimType === 'mathematical').map(c => c.claimId);
    if (mathIds.length > 0) {
      steps.push({ step: 3, action: 'validate_math', targets: mathIds });
      if (factualIds.length > 0) {
        dependencies.push({ from: 'verify_facts', to: 'validate_math' });
      }
    }

    // Step 4: Analyze code
    const codeIds = claims.filter(c => c.claimType === 'code').map(c => c.claimId);
    if (codeIds.length > 0) {
      steps.push({ step: 4, action: 'analyze_code', targets: codeIds });
    }

    // Step 5: Check standards
    const standardIds = claims.filter(c => c.claimType === 'standard_citation').map(c => c.claimId);
    if (standardIds.length > 0) {
      steps.push({ step: 5, action: 'verify_standards', targets: standardIds });
    }

    // Step 6: Reasoning check (depends on all others)
    steps.push({
      step: 6,
      action: 'check_reasoning',
      targets: claims.map(c => c.claimId),
    });

    // Step 7: Aggregate and score
    steps.push({
      step: 7,
      action: 'safety_gate',
      targets: ['all'],
    });

    return { steps, dependencies };
  },
};
