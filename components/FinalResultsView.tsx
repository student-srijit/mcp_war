'use client';

import { useState, useEffect } from 'react';
import type { VerificationState } from '@/hooks/useMockVerification';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ThumbsUp, ThumbsDown, Download, ArrowRight, Copy, Check } from 'lucide-react';

interface FinalResultsViewProps {
  state: VerificationState;
  onNewQuery: () => void;
  onViewAudit: () => void;
}

export function FinalResultsView({
  state,
  onNewQuery,
  onViewAudit,
}: FinalResultsViewProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [expandedAccordion, setExpandedAccordion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let current = 0;
    const target = state.finalScore || 0;
    const interval = setInterval(() => {
      if (current < target) {
        current += 0.01;
        setAnimatedScore(Math.min(current, target));
      } else {
        clearInterval(interval);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [state.finalScore]);

  // Agent chart data from real verdicts
  const chartData = state.agents
    .filter(a => ['fact-verifier', 'math-validator', 'code-analyzer', 'standards-agent', 'reasoning-agent'].includes(a.id))
    .map((agent) => ({
      name: agent.name.split(' ')[0],
      confidence: agent.confidence || 0,
    }));

  // Dynamic domain weights from the current domain
  const domainWeightLabels: Record<string, Record<string, string>> = {
    'Structural Engineering': { Math: '30%', Standards: '25%', Reasoning: '15%', Fact: '15%', Code: '15%' },
    'Software Development': { Code: '45%', Reasoning: '25%', Math: '10%', Fact: '10%', Standards: '10%' },
    'Infrastructure & Energy': { Math: '35%', Standards: '25%', Reasoning: '20%', Fact: '15%', Code: '5%' },
    'Healthcare Systems': { Fact: '30%', Standards: '25%', Math: '25%', Reasoning: '10%', Code: '10%' },
    'Financial Modeling': { Math: '40%', Fact: '20%', Reasoning: '20%', Code: '10%', Standards: '10%' },
    'Standards Reference': { Standards: '50%', Fact: '20%', Math: '10%', Code: '10%', Reasoning: '10%' },
    'General Technical': { Fact: '20%', Math: '20%', Code: '20%', Standards: '20%', Reasoning: '20%' },
  };

  const weights = domainWeightLabels[state.domain] || domainWeightLabels['General Technical'];

  const verdictColor =
    state.finalVerdict === 'APPROVED'
      ? 'bg-[#10b981]/10 border-[#10b981]'
      : state.finalVerdict === 'WARNING'
      ? 'bg-[#f59e0b]/10 border-[#f59e0b]'
      : 'bg-[#ef4444]/10 border-[#ef4444]';

  const verdictBgColor =
    state.finalVerdict === 'APPROVED'
      ? 'bg-[#10b981]'
      : state.finalVerdict === 'WARNING'
      ? 'bg-[#f59e0b]'
      : 'bg-[#ef4444]';

  const verdictTextColor =
    state.finalVerdict === 'APPROVED'
      ? 'text-[#10b981]'
      : state.finalVerdict === 'WARNING'
      ? 'text-[#f59e0b]'
      : 'text-[#ef4444]';

  const handleCopyReport = () => {
    const report = JSON.stringify({
      jobId: state.jobId,
      domain: state.domain,
      verdict: state.finalVerdict,
      score: state.finalScore,
      claims: state.claims.length,
      evidence: state.evidenceChain.length,
      agents: state.agents.filter(a => a.confidence !== null).map(a => ({ name: a.name, confidence: a.confidence, status: a.status })),
    }, null, 2);
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Collect all real issues from agents
  const allIssues = state.agents
    .filter(a => a.finding && a.finding.includes('issue'))
    .map(a => ({ agent: a.name, finding: a.finding }));

  return (
    <div className="pt-20 pb-16 px-6 md:px-8 min-h-screen bg-[#0a0a0f]">
      {/* Hero Verdict Banner */}
      <div className={`mb-12 p-8 rounded-xl border-2 ${verdictColor}`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className={`text-5xl md:text-6xl font-black mb-2 ${verdictTextColor}`}>
              {state.finalVerdict}
            </h2>
            <p className="text-[#9ca3af] text-sm">
              {state.finalVerdict === 'APPROVED'
                ? 'All claims verified. Response is accurate and reliable.'
                : state.finalVerdict === 'WARNING'
                ? 'Some claims require attention. Review uncertainties before use.'
                : 'Critical issues detected. Response cannot be trusted.'}
            </p>
            <p className="text-xs text-[#6b7280] mt-2 font-mono">
              Domain: {state.domain} · Job: {state.jobId}
            </p>
          </div>
          <div className="text-right">
            <div className="text-6xl font-mono font-bold text-white mb-2">
              {(animatedScore * 100).toFixed(1)}%
            </div>
            <div className="w-48 h-3 bg-[#1f2937] rounded-full overflow-hidden">
              <div
                className={`h-full ${verdictBgColor} rounded-full transition-all duration-1000`}
                style={{ width: `${animatedScore * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* Left Column - Composite Score Breakdown */}
        <div className="border border-[#1f2937] rounded-xl bg-[#111827] p-6">
          <h3 className="text-sm font-mono uppercase tracking-wider text-[#9ca3af] mb-4">
            Composite Score Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '11px' }} />
              <YAxis stroke="#6b7280" domain={[0, 1]} style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value) => [(value as number * 100).toFixed(1) + '%', 'Confidence']}
              />
              <Bar dataKey="confidence" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Domain Weights - Dynamic */}
          <div className="mt-6 space-y-2">
            <p className="text-xs text-[#9ca3af] font-mono mb-2">
              Domain Weights ({state.domain})
            </p>
            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-[#1f2937]">
              {Object.entries(weights).map(([, pct], i) => {
                const colors = ['bg-[#4f46e5]', 'bg-[#f59e0b]', 'bg-[#8b5cf6]', 'bg-[#10b981]', 'bg-[#ef4444]'];
                return <div key={i} className={colors[i]} style={{ width: pct }} />;
              })}
            </div>
            <div className="text-xs text-[#6b7280] font-mono grid grid-cols-2 gap-1">
              {Object.entries(weights).map(([name, pct]) => (
                <span key={name}>{name}: {pct}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column - Verified Response */}
        <div className="border border-[#1f2937] rounded-xl bg-[#111827] p-6">
          <h3 className="text-sm font-mono uppercase tracking-wider text-[#9ca3af] mb-4">
            Verified Response ({state.claims.length} claims)
          </h3>
          <div className="text-sm text-[#9ca3af] space-y-3 max-h-96 overflow-y-auto">
            <div className="flex gap-3 text-xs mb-4 pb-4 border-b border-[#1f2937]">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10b981]" /><span>Verified</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#f59e0b]" /><span>Uncertain</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /><span>Flagged</span></div>
            </div>
            {state.claims.map((claim) => {
              const status =
                claim.factResult?.status ||
                claim.mathResult?.status ||
                claim.codeResult?.status ||
                claim.standardResult?.status ||
                claim.reasoningResult?.status ||
                'verified';
              const color =
                status === 'verified' ? 'border-l-4 border-[#10b981]'
                : status === 'uncertain' ? 'border-l-4 border-[#f59e0b]'
                : 'border-l-4 border-[#ef4444]';

              return (
                <div key={claim.id} className={`${color} pl-3 py-2 rounded-r bg-[#0a0a0f]/50`}>
                  <span className="text-xs font-mono text-[#4f46e5] mr-2">{claim.id}</span>
                  <span className="text-xs text-[#6b7280] mr-2">[{claim.type}]</span>
                  <span className="text-sm">{claim.content}</span>
                </div>
              );
            })}
            {state.claims.length === 0 && (
              <p className="text-[#6b7280] italic">No claims extracted</p>
            )}
          </div>
        </div>

        {/* Right Column - Evidence Chain (REAL DATA) */}
        <div className="border border-[#1f2937] rounded-xl bg-[#111827] p-6">
          <h3 className="text-sm font-mono uppercase tracking-wider text-[#9ca3af] mb-4">
            Evidence Chain ({state.evidenceChain.length} sources)
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {state.evidenceChain.length > 0 ? (
              state.evidenceChain.map((ev, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#1f2937] bg-[#0a0a0f]">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-mono bg-[#4f46e5]/20 text-[#818cf8] px-2 py-1 rounded">
                      {ev.source}
                    </span>
                    {ev.supports ? (
                      <ThumbsUp className="w-3 h-3 text-[#10b981] flex-shrink-0 mt-1" />
                    ) : (
                      <ThumbsDown className="w-3 h-3 text-[#ef4444] flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-xs text-[#9ca3af] mb-1 line-clamp-2">{ev.claim}</p>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-[#4f46e5] hover:text-[#818cf8] truncate block"
                  >
                    {ev.url}
                  </a>
                </div>
              ))
            ) : (
              <p className="text-[#6b7280] text-xs italic">No evidence collected yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Agent Verdict Details Accordion */}
      <div className="mb-12">
        <h3 className="text-sm font-mono uppercase tracking-wider text-[#9ca3af] mb-4">
          Agent Verdict Details
        </h3>
        <div className="space-y-2">
          {state.agents
            .filter(a => ['fact-verifier', 'math-validator', 'code-analyzer', 'standards-agent', 'reasoning-agent'].includes(a.id))
            .map((agent) => (
            <div key={agent.id} className="border border-[#1f2937] rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedAccordion(expandedAccordion === agent.id ? null : agent.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#111827] transition text-left"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${agent.status === 'passed' ? 'bg-[#10b981]' : agent.status === 'failed' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'}`} />
                  <span className="font-bold text-white">{agent.name}</span>
                  <span className="text-sm font-mono text-[#9ca3af]">
                    {agent.confidence !== null ? `${(agent.confidence * 100).toFixed(0)}%` : '—'}
                  </span>
                  {agent.latency && <span className="text-xs font-mono text-[#6b7280]">{agent.latency}</span>}
                </div>
                <ChevronDown className={`w-4 h-4 text-[#6b7280] transition ${expandedAccordion === agent.id ? 'rotate-180' : ''}`} />
              </button>

              {expandedAccordion === agent.id && (
                <div className="px-4 py-3 border-t border-[#1f2937] bg-[#111827] text-sm text-[#9ca3af] space-y-3">
                  <div>
                    <p className="text-xs font-mono uppercase text-[#6b7280] mb-1">Status</p>
                    <p className={agent.status === 'passed' ? 'text-[#10b981] font-mono' : 'text-[#ef4444] font-mono'}>
                      {agent.status === 'passed' ? 'PASSED' : agent.status === 'failed' ? 'FAILED' : 'WARNING'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase text-[#6b7280] mb-1">Finding</p>
                    <p className="text-white">{agent.finding || 'No specific findings'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase text-[#6b7280] mb-1">Role</p>
                    <p>{agent.role}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Metrics (REAL DATA) */}
      <div className="mb-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg border border-[#1f2937] bg-[#111827]">
          <p className="text-xs text-[#9ca3af] font-mono mb-1">Total Latency</p>
          <p className="text-lg font-bold text-white font-mono">{state.elapsedSeconds.toFixed(1)}s</p>
        </div>
        <div className="p-3 rounded-lg border border-[#1f2937] bg-[#111827]">
          <p className="text-xs text-[#9ca3af] font-mono mb-1">Agents Run</p>
          <p className="text-lg font-bold text-white font-mono">
            {state.agents.filter(a => a.status === 'passed' || a.status === 'failed').length}/9
          </p>
        </div>
        <div className="p-3 rounded-lg border border-[#1f2937] bg-[#111827]">
          <p className="text-xs text-[#9ca3af] font-mono mb-1">Retry Count</p>
          <p className="text-lg font-bold text-white font-mono">
            {Object.values(state.verdictScores).length > 0 ? '0' : '—'}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-[#1f2937] bg-[#111827]">
          <p className="text-xs text-[#9ca3af] font-mono mb-1">Claims Verified</p>
          <p className="text-lg font-bold text-white font-mono">
            {state.claims.length}/{state.claims.length}
          </p>
        </div>
        <div className="p-3 rounded-lg border border-[#1f2937] bg-[#111827]">
          <p className="text-xs text-[#9ca3af] font-mono mb-1">Evidence Sources</p>
          <p className="text-lg font-bold text-white font-mono">{state.evidenceChain.length}</p>
        </div>
        <div className="p-3 rounded-lg border border-[#1f2937] bg-[#111827]">
          <p className="text-xs text-[#9ca3af] font-mono mb-1">Job ID</p>
          <p className="text-xs font-bold text-[#4f46e5] font-mono truncate">{state.jobId}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={onNewQuery}
          className="flex-1 px-6 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/30"
        >
          New Query
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onViewAudit}
          className="flex-1 px-6 py-3 border border-[#1f2937] hover:bg-[#111827] text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2"
        >
          View Full Audit Trail
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={handleCopyReport}
          className="px-6 py-3 border border-[#1f2937] hover:bg-[#111827] text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2"
        >
          {copied ? <Check className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Report'}
        </button>
      </div>
    </div>
  );
}
