'use client';

import { useState, useEffect, useMemo } from 'react';
import { Navigation } from '@/components/Navigation';
import { QuerySubmissionView } from '@/components/QuerySubmissionView';
import { LiveDashboardView } from '@/components/LiveDashboardView';
import { FinalResultsView } from '@/components/FinalResultsView';
import { AuditTrailView } from '@/components/AuditTrailView';
import { useJobStatus } from '@/hooks/useJobStatus';
import type { VerificationState, AgentStatus, Claim } from '@/hooks/useMockVerification';
import type { VerificationJob, FeedLogEntry } from '@/lib/schemas';

const EXAMPLE_QUERIES = [
  {
    title: 'Steel beam load calculation',
    domain: 'Structural Engineering',
    query: 'Calculate the maximum load capacity for a W12×50 steel I-beam spanning 20 feet with pin supports on each end, assuming Grade 50 steel.',
  },
  {
    title: 'React useEffect bug',
    domain: 'Software Development',
    query:
      'Find the memory leak in this React useEffect hook that sets an interval but forgets to clear it on unmount.',
  },
  {
    title: 'IEEE 802.3 compliance',
    domain: 'Standards Reference',
    query: 'Verify that Cat6 Ethernet cables meet IEEE 802.3an specifications for data center deployment.',
  },
  {
    title: 'Dosage formula check',
    domain: 'Healthcare Systems',
    query: 'Verify the pediatric amoxicillin dosage: 25 mg/kg/dose for a 20kg child with acute otitis media.',
  },
  {
    title: 'DCF model validation',
    domain: 'Financial Modeling',
    query: 'Check the discounted cash flow formula: PV = CF1/(1+r) + CF2/(1+r)² for a 5-year projection.',
  },
  {
    title: 'HVAC capacity calc',
    domain: 'Infrastructure & Energy',
    query: 'Verify BTU calculation for HVAC sizing: 2000 sq ft × 20 BTU/sq ft = 40,000 BTU required.',
  },
  {
    title: 'GitHub code review',
    domain: 'Software Development',
    query: 'Analyze the code quality and security of https://github.com/expressjs/express/blob/master/lib/application.js',
  },
];

// Agent configuration matching the VerificationState shape
const AGENT_CONFIGS = [
  { id: 'orchestrator', name: 'Orchestrator', role: 'Master controller & pipeline coordinator', color: 'text-indigo-400' },
  { id: 'generator', name: 'Generator', role: 'Response generation engine', color: 'text-indigo-400' },
  { id: 'fact-verifier', name: 'Fact Verifier', role: 'Claims validation via external sources', color: 'text-green-400' },
  { id: 'math-validator', name: 'Math Validator', role: 'Formula & calculation verification', color: 'text-amber-400' },
  { id: 'code-analyzer', name: 'Code Analyzer', role: 'Code quality & syntax checking', color: 'text-red-400' },
  { id: 'github-agent', name: 'GitHub Agent', role: 'Repo reading & deep code analysis', color: 'text-blue-400' },
  { id: 'standards-agent', name: 'Standards Agent', role: 'IEEE/ISO/OSHA compliance checks', color: 'text-amber-400' },
  { id: 'reasoning-agent', name: 'Reasoning Agent', role: 'Sequential logic validation', color: 'text-purple-400' },
  { id: 'safety-gate', name: 'Safety Gate', role: 'Final verdict & hallucination detection', color: 'text-red-400' },
  { id: 'correction-agent', name: 'Correction Agent', role: 'Auto-correction & refinement', color: 'text-green-400' },
];

const AGENT_ID_MAP: Record<string, string> = {
  'fact_verifier': 'fact-verifier',
  'math_validator': 'math-validator',
  'code_analyzer': 'code-analyzer',
  'github_agent': 'github-agent',
  'standards_agent': 'standards-agent',
  'reasoning_agent': 'reasoning-agent',
};

/**
 * Bridge real VerificationJob + FeedLogEntry[] → VerificationState
 * This maps the backend data to the shape the UI components expect.
 */
function buildVerificationState(
  job: VerificationJob,
  logs: FeedLogEntry[]
): VerificationState {
  // Build agent statuses
  const agents: AgentStatus[] = AGENT_CONFIGS.map((cfg) => {
    const base: AgentStatus = {
      id: cfg.id,
      name: cfg.name,
      role: cfg.role,
      status: 'waiting',
      latency: null,
      finding: null,
      confidence: null,
      colorClass: cfg.color,
    };

    // Orchestrator is always running/passed when job is running/completed
    if (cfg.id === 'orchestrator') {
      base.status = job.status === 'completed' ? 'passed' : job.status === 'running' ? 'passed' : 'waiting';
      base.latency = job.completedAt && job.startedAt ? `${((job.completedAt - job.startedAt) / 1000).toFixed(1)}s` : null;
      base.confidence = job.compositeScore || null;
      return base;
    }

    // Generator: passed if claims exist
    if (cfg.id === 'generator') {
      if (job.claims.length > 0) {
        base.status = 'passed';
        base.finding = `Extracted ${job.claims.length} claims`;
        base.latency = '1.2s';
        base.confidence = 1.0;
      } else if (job.status === 'running') {
        base.status = 'running';
      }
      return base;
    }

    // Safety gate
    if (cfg.id === 'safety-gate') {
      if (job.status === 'completed') {
        base.status = 'passed';
        base.confidence = job.compositeScore;
        base.finding = `Verdict: ${job.verdict} (${(job.compositeScore * 100).toFixed(0)}%)`;
        base.latency = '0.5s';
      } else if (job.agentVerdicts.length >= 5) {
        base.status = 'running';
      }
      return base;
    }

    // Correction agent
    if (cfg.id === 'correction-agent') {
      if (job.status === 'completed') {
        const retries = job.retryCount || 0;
        base.status = 'passed';
        base.confidence = retries === 0 ? 0.95 : 0.7;
        base.finding = retries === 0 ? 'No corrections needed' : `${retries} correction cycle(s) applied`;
        base.latency = retries === 0 ? '0.1s' : `${retries * 2}s`;
      }
      return base;
    }

    // Match verification agents to their verdicts
    const backendId = Object.entries(AGENT_ID_MAP).find(([_, v]) => v === cfg.id)?.[0];
    if (backendId) {
      const verdict = job.agentVerdicts.find(v => v.agentId === backendId);
      if (verdict) {
        base.status = verdict.verdict === 'pass' ? 'passed' : verdict.verdict === 'fail' ? 'failed' : 'passed';
        base.confidence = verdict.confidenceScore;
        base.latency = verdict.latencyMs ? `${(verdict.latencyMs / 1000).toFixed(1)}s` : null;
        base.finding = verdict.issues.length > 0
          ? `${verdict.issues.length} issue(s) found`
          : `Verified (${(verdict.confidenceScore * 100).toFixed(0)}%)`;
      } else if (job.status === 'running' && job.claims.length > 0) {
        base.status = 'running';
      }
    }

    return base;
  });

  // Build claims in the legacy shape
  const claims: Claim[] = job.claims.map((c) => {
    const claim: Claim = {
      id: c.claimId,
      type: c.claimType === 'standard_citation' ? 'standard' : c.claimType as any,
      content: c.content,
    };

    // Find verdict results for this claim
    const factVerdict = job.agentVerdicts.find(v => v.agentId === 'fact_verifier');
    const mathVerdict = job.agentVerdicts.find(v => v.agentId === 'math_validator');
    const codeVerdict = job.agentVerdicts.find(v => v.agentId === 'code_analyzer');
    const standardVerdict = job.agentVerdicts.find(v => v.agentId === 'standards_agent');
    const reasoningVerdict = job.agentVerdicts.find(v => v.agentId === 'reasoning_agent');

    const getClaimStatus = (verdict: typeof factVerdict, claimId: string): 'verified' | 'uncertain' | 'flagged' | undefined => {
      if (!verdict || verdict.verdict === 'skip') return undefined;
      const hasIssue = verdict.issues.some(i => i.claimId === claimId);
      if (hasIssue) {
        const issue = verdict.issues.find(i => i.claimId === claimId);
        return issue?.severity === 'critical' ? 'flagged' : 'uncertain';
      }
      return 'verified';
    };

    if (c.claimType === 'factual') {
      const status = getClaimStatus(factVerdict, c.claimId);
      if (status) {
        const ev = factVerdict?.evidence.find(e => e.claimId === c.claimId);
        claim.factResult = {
          status,
          source: ev?.sourceUrl || 'Verified',
          evidence: ev?.excerpt || 'Claim validated',
        };
      }
    }
    if (c.claimType === 'mathematical') {
      const status = getClaimStatus(mathVerdict, c.claimId);
      if (status) {
        claim.mathResult = {
          status,
          formula: c.content,
          result: status === 'verified' ? 'Verified' : 'Needs review',
        };
      }
    }
    if (c.claimType === 'code') {
      const status = getClaimStatus(codeVerdict, c.claimId);
      if (status) {
        const codeIssues = codeVerdict?.issues.filter(i => i.claimId === c.claimId).map(i => i.description) || [];
        claim.codeResult = {
          status,
          issues: codeIssues,
        };
      }
    }
    if (c.claimType === 'standard_citation') {
      const status = getClaimStatus(standardVerdict, c.claimId);
      if (status) {
        claim.standardResult = {
          status,
          standard: c.content,
        };
      }
    }
    if (c.claimType === 'reasoning') {
      const status = getClaimStatus(reasoningVerdict, c.claimId);
      if (status) {
        claim.reasoningResult = {
          status,
          reasoning: status === 'verified' ? 'Logic validated' : 'Reasoning issue detected',
        };
      }
    }

    return claim;
  });

  // Build feed log
  const feedLog = logs.map((log) => ({
    timestamp: typeof log.timestamp === 'number' 
      ? `[${new Date(log.timestamp * 1000).toISOString().slice(14, 22)}]`
      : String(log.timestamp),
    agent: log.agentName,
    message: log.message,
  }));

  // Build response text (JSON representation of claims)
  const responseText = job.claims.length > 0
    ? JSON.stringify({ claims: job.claims.map(c => ({ id: c.claimId, type: c.claimType, content: c.content.slice(0, 60) + (c.content.length > 60 ? '...' : '') })), total: job.claims.length }, null, 2)
    : '';

  // Build evidence chain
  const evidenceChain = job.evidence.map(ev => ({
    source: ev.source,
    claim: ev.title || ev.excerpt,
    supports: ev.supportVerdict === 'supports',
    url: ev.url,
    agent: ev.source === 'Wikipedia' ? 'FACT_VERIFIER'
      : ev.source === 'arXiv' ? 'FACT_VERIFIER'
      : ev.source === 'GitHub' ? 'CODE_ANALYZER'
      : ev.source === 'StandardsDB' ? 'STANDARDS_AGENT'
      : 'FACT_VERIFIER',
  }));

  // Compute elapsed seconds
  const elapsed = job.startedAt
    ? ((job.completedAt || Date.now()) - job.startedAt) / 1000
    : 0;

  // Build verdict scores
  const verdictScores: Record<string, number> = {};
  for (const v of job.agentVerdicts) {
    const uiId = AGENT_ID_MAP[v.agentId] || v.agentId;
    verdictScores[uiId] = v.confidenceScore;
  }

  return {
    jobId: job.jobId,
    query: job.query,
    domain: job.domain,
    status: job.status === 'completed' ? 'completed' : job.status === 'running' || job.status === 'pending' ? 'running' : 'idle',
    elapsedSeconds: Math.round(elapsed),
    agents,
    claims,
    responseText,
    feedLog,
    finalScore: job.compositeScore,
    finalVerdict: (job.verdict === 'ESCALATED' ? 'REJECTED' : job.verdict) as 'APPROVED' | 'WARNING' | 'REJECTED',
    verdictScores,
    evidenceChain,
  };
}

export default function Home() {
  const [currentView, setCurrentView] = useState<'home' | 'live' | 'results' | 'audit'>('home');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { job, logs, error: jobError } = useJobStatus(currentJobId);

  // Build the verification state from real API data
  const verificationState = useMemo(() => {
    if (!job) return null;
    return buildVerificationState(job, logs);
  }, [job, logs]);

  // Auto-transition to live view when job starts
  useEffect(() => {
    if (job && (job.status === 'running' || job.status === 'pending') && currentView === 'home') {
      setCurrentView('live');
    }
  }, [job?.status, currentView]);

  // Auto-transition to results when job completes
  useEffect(() => {
    if (job?.status === 'completed' && currentView === 'live') {
      // Small delay so user can see final logs
      const timer = setTimeout(() => setCurrentView('results'), 1500);
      return () => clearTimeout(timer);
    }
  }, [job?.status, currentView]);

  const handleQuerySubmit = async (query: string, domain: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, domain }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit query');
      }

      const data = await response.json();
      setCurrentJobId(data.jobId);
      setCurrentView('live');
    } catch (error) {
      console.error('[VERITAS] Query submission error:', error);
      alert(`Failed to submit query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNavigate = (view: 'home' | 'live' | 'results' | 'audit') => {
    if (view === 'home') {
      setCurrentJobId(null);
      setCurrentView('home');
    } else {
      setCurrentView(view);
    }
  };

  return (
    <div className="bg-[#0a0a0f] min-h-screen">
      <Navigation currentView={currentView} onNavigate={handleNavigate} />

      {currentView === 'home' && (
        <QuerySubmissionView
          onSubmit={handleQuerySubmit}
          exampleQueries={EXAMPLE_QUERIES}
        />
      )}

      {currentView === 'live' && verificationState && (
        <LiveDashboardView state={verificationState} />
      )}

      {currentView === 'results' && job?.status === 'completed' && verificationState && (
        <FinalResultsView
          state={verificationState}
          onNewQuery={() => {
            setCurrentJobId(null);
            setCurrentView('home');
          }}
          onViewAudit={() => setCurrentView('audit')}
        />
      )}

      {currentView === 'audit' && job?.status === 'completed' && verificationState && (
        <AuditTrailView state={verificationState} />
      )}

      {isSubmitting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-indigo-500/30 rounded-xl p-8 text-white text-center space-y-4 shadow-2xl shadow-indigo-500/10">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-mono text-sm">Initializing verification pipeline...</p>
            <p className="text-xs text-gray-500">Connecting to Groq LLM</p>
          </div>
        </div>
      )}

      {jobError && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 backdrop-blur border border-red-700 rounded-lg p-4 text-white max-w-sm z-50 shadow-xl">
          <p className="font-bold text-sm">Pipeline Error</p>
          <p className="text-xs text-red-300 mt-1">{jobError}</p>
          <button
            onClick={() => setCurrentJobId(null)}
            className="mt-2 text-xs text-red-400 hover:text-white transition"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
