import { AgentVerdict, ClaimUnit } from '../schemas';
import { createAgentVerdict } from './utils';
import { callGroqAPI } from '../groqClient';

// Comprehensive local standards database
const STANDARDS_DATABASE: Record<string, { title: string; url: string; clauses: Record<string, string> }> = {
  'IEEE 802.3': {
    title: 'IEEE Standard for Ethernet',
    url: 'https://standards.ieee.org/standard/802_3-2022.html',
    clauses: {
      '802.3an': '10GBASE-T — Cat6A specifications, 500 MHz bandwidth',
      '802.3i': '10BASE-T — Basic twisted pair requirements',
      '802.3u': '100BASE-TX — Fast Ethernet over Cat5',
      '802.3ab': '1000BASE-T — Gigabit over Cat5e/6',
      '802.3ae': '10 Gigabit Ethernet fiber specifications',
    },
  },
  'IEEE 754': {
    title: 'IEEE Standard for Floating-Point Arithmetic',
    url: 'https://standards.ieee.org/standard/754-2019.html',
    clauses: {
      'single': 'Single precision — 32-bit, 1 sign, 8 exponent, 23 mantissa',
      'double': 'Double precision — 64-bit, 1 sign, 11 exponent, 52 mantissa',
      'half': 'Half precision — 16-bit format',
    },
  },
  'IEEE 802.11': {
    title: 'IEEE Standard for WLAN (Wi-Fi)',
    url: 'https://standards.ieee.org/standard/802_11-2020.html',
    clauses: {
      '802.11ax': 'Wi-Fi 6 — OFDMA, MU-MIMO, 9.6 Gbps',
      '802.11ac': 'Wi-Fi 5 — 5 GHz, 6.93 Gbps theoretical',
    },
  },
  'ISO 9001': {
    title: 'Quality Management Systems — Requirements',
    url: 'https://www.iso.org/standard/62085.html',
    clauses: {
      '4': 'Context of the organization',
      '5': 'Leadership',
      '6': 'Planning',
      '7': 'Support',
      '8': 'Operation',
      '9': 'Performance evaluation',
      '10': 'Improvement',
    },
  },
  'ISO 27001': {
    title: 'Information Security Management Systems',
    url: 'https://www.iso.org/standard/27001',
    clauses: {},
  },
  'ISO 14001': {
    title: 'Environmental Management Systems',
    url: 'https://www.iso.org/standard/60857.html',
    clauses: {},
  },
  'OSHA 1910': {
    title: 'OSHA General Industry Standards',
    url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910',
    clauses: {
      '1910.1450': 'Occupational exposure to hazardous chemicals in laboratories',
      '1910.134': 'Respiratory protection',
      '1910.147': 'Control of hazardous energy (lockout/tagout)',
      '1910.1200': 'Hazard communication',
    },
  },
  'NFPA 70': {
    title: 'National Electrical Code (NEC)',
    url: 'https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=70',
    clauses: {
      'article_110': 'General requirements for electrical installations',
      'article_210': 'Branch circuits',
      'article_250': 'Grounding and bonding',
      'article_300': 'Wiring methods',
    },
  },
  'NFPA 72': {
    title: 'National Fire Alarm and Signaling Code',
    url: 'https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=72',
    clauses: {},
  },
  'ASCE 7': {
    title: 'Minimum Design Loads and Associated Criteria for Buildings',
    url: 'https://www.asce.org/publications-and-news/asce-7',
    clauses: {
      'ch11-22': 'Seismic design criteria',
      'ch26-31': 'Wind load design requirements',
      'ch7': 'Snow loads',
      'ch4': 'Live loads',
    },
  },
  'ACI 318': {
    title: 'Building Code Requirements for Structural Concrete',
    url: 'https://www.concrete.org/store/productdetail.aspx?ItemID=318U22',
    clauses: {},
  },
  'AISC 360': {
    title: 'Specification for Structural Steel Buildings',
    url: 'https://www.aisc.org/360',
    clauses: {},
  },
  'ASTM A36': {
    title: 'Standard Specification for Carbon Structural Steel',
    url: 'https://www.astm.org/a0036_a0036m-19.html',
    clauses: {
      'yield': 'Minimum yield strength: 36 ksi (250 MPa)',
      'tensile': 'Tensile strength: 58-80 ksi (400-550 MPa)',
    },
  },
};

function extractStandardCitations(content: string): string[] {
  const citations: string[] = [];
  const standardPatterns = [
    /IEEE\s+[\d.]+[a-z]*/gi,
    /ISO\s+[\d.]+/gi,
    /OSHA\s+[\d.]+/gi,
    /NFPA\s+\d+/gi,
    /ASCE\s+\d+/gi,
    /ACI\s+\d+/gi,
    /AISC\s+\d+/gi,
    /ASTM\s+[A-Z]\d+/gi,
    /IEC\s+\d+/gi,
    /ANSI\s+[\w.]+/gi,
  ];

  for (const pattern of standardPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      citations.push(...matches);
    }
  }

  return [...new Set(citations)];
}

function lookupStandard(citationText: string): {
  found: boolean;
  standard: string;
  title: string;
  url: string;
  message: string;
} {
  const normalized = citationText.toUpperCase().trim();

  for (const [key, standard] of Object.entries(STANDARDS_DATABASE)) {
    if (normalized.includes(key.toUpperCase()) || key.toUpperCase().includes(normalized.split(' ').slice(0, 2).join(' '))) {
      return {
        found: true,
        standard: key,
        title: standard.title,
        url: standard.url,
        message: `Verified: ${standard.title}`,
      };
    }
  }

  return {
    found: false,
    standard: citationText,
    title: '',
    url: '',
    message: `Unknown standard: ${citationText}`,
  };
}

export async function verifyStandardsClaims(
  claims: ClaimUnit[]
): Promise<AgentVerdict> {
  const startTime = Date.now();

  const standardClaims = claims.filter((c) => c.claimType === 'standard_citation');

  if (standardClaims.length === 0) {
    return createAgentVerdict({
      agentId: 'standards_agent',
      agentName: 'StandardsAgent',
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
  const unknownCitations: string[] = [];

  for (const claim of standardClaims) {
    const citations = extractStandardCitations(claim.content);

    if (citations.length === 0) {
      // No standard reference found in claim text — use Groq to verify
      unknownCitations.push(claim.content);
      continue;
    }

    for (const citation of citations) {
      const lookup = lookupStandard(citation);

      if (lookup.found) {
        evidence.push({
          claimId: claim.claimId,
          sourceUrl: lookup.url,
          excerpt: `${lookup.message} (${lookup.title})`,
          supports: true,
        });
      } else {
        unknownCitations.push(citation);
        issues.push({
          claimId: claim.claimId,
          description: lookup.message,
          severity: 'major',
        });
      }
    }
  }

  // Use Groq to verify unknown standards
  if (unknownCitations.length > 0) {
    try {
      const systemPrompt = `You are a technical standards expert. Verify whether these standards citations are real and correct.
Return JSON: { "results": [{ "citation": "...", "valid": true|false, "fullName": "...", "note": "..." }] }`;
      const userPrompt = `Verify these standards references:\n${unknownCitations.join('\n')}`;
      const response = await callGroqAPI(systemPrompt, userPrompt, 0.1, 1500);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const results = Array.isArray(parsed.results) ? parsed.results : [];
        for (const result of results) {
          if (result.valid) {
            evidence.push({
              claimId: standardClaims[0]?.claimId || 'unknown',
              sourceUrl: `https://standards.ieee.org/search?q=${encodeURIComponent(result.citation || '')}`,
              excerpt: `Verified via AI: ${result.fullName || result.citation}`,
              supports: true,
            });
            // Remove from issues if it was added
            const idx = issues.findIndex(i => i.description.includes(result.citation));
            if (idx !== -1) issues.splice(idx, 1);
          }
        }
      }
    } catch (error) {
      console.error('[VERITAS] Standards agent Groq error:', error);
      correctiveHints.push('Some standards could not be verified via AI — manual review recommended');
    }
  }

  const score = issues.length === 0
    ? 0.95
    : Math.max(0.5, 1.0 - issues.length / Math.max(1, standardClaims.length) * 0.4);

  return createAgentVerdict({
    agentId: 'standards_agent',
    agentName: 'StandardsAgent',
    verdict: issues.length === 0 ? 'pass' : issues.length > 2 ? 'fail' : 'warn',
    confidenceScore: Math.max(0, Math.min(1, score)),
    issues,
    evidence,
    correctiveHints: issues.length > 0 ? [
      ...correctiveHints,
      'Verify standards citations against official IEEE/ISO/OSHA databases',
      'Include full standard number and clause reference',
    ] : correctiveHints,
    latencyMs: Date.now() - startTime,
    findings: issues.map(i => ({ severity: i.severity, issue: i.description })),
    correctionApplied: false,
  });
}
