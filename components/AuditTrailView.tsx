'use client';

import { useState } from 'react';
import type { VerificationState } from '@/hooks/useMockVerification';
import { ChevronDown, Download, Filter } from 'lucide-react';

interface AuditTrailViewProps {
  state: VerificationState;
}

export function AuditTrailView({ state }: AuditTrailViewProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Build timeline from REAL feed logs
  const filteredLogs = state.feedLog.filter((log) => {
    const matchesAgent = agentFilter === 'all' || log.agent === agentFilter;
    const matchesSearch = searchQuery === '' ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.agent.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAgent && matchesSearch;
  });

  // Get unique agent names for filter
  const uniqueAgents = [...new Set(state.feedLog.map(l => l.agent))];

  // Build claim table from real claims data
  const claimTableData = state.claims.map((claim) => ({
    id: claim.id,
    type: claim.type,
    content: claim.content,
    factStatus: claim.factResult?.status || '—',
    mathStatus: claim.mathResult?.status || '—',
    codeStatus: claim.codeResult?.status || '—',
    standardStatus: claim.standardResult?.status || '—',
    reasoningStatus: claim.reasoningResult?.status || '—',
    finalStatus:
      claim.factResult?.status ||
      claim.mathResult?.status ||
      claim.codeResult?.status ||
      claim.standardResult?.status ||
      claim.reasoningResult?.status ||
      'verified',
    factEvidence: claim.factResult?.evidence || '',
    factSource: claim.factResult?.source || '',
    mathFormula: claim.mathResult?.formula || '',
    mathResult: claim.mathResult?.result || '',
    codeIssues: claim.codeResult?.issues || [],
    standardRef: claim.standardResult?.standard || '',
  }));

  const getStatusColor = (status: string) => {
    if (status === 'verified')
      return 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]';
    if (status === 'uncertain')
      return 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]';
    if (status === 'flagged')
      return 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]';
    return 'bg-[#6b7280]/20 text-[#9ca3af] border border-[#6b7280]';
  };

  const getLogTypeColor = (agent: string) => {
    const colors: Record<string, string> = {
      'ORCHESTRATOR': 'text-indigo-400',
      'GENERATOR': 'text-indigo-300',
      'FACT_VERIFIER': 'text-green-400',
      'MATH_VALIDATOR': 'text-amber-400',
      'CODE_ANALYZER': 'text-red-400',
      'STANDARDS_AGENT': 'text-amber-300',
      'REASONING_AGENT': 'text-purple-400',
      'SAFETY_GATE': 'text-red-300',
      'CORRECTION_AGENT': 'text-green-300',
      'SYSTEM': 'text-[#9ca3af]',
    };
    return colors[agent] || 'text-[#9ca3af]';
  };

  const handleDownloadAudit = () => {
    const report = {
      reportType: 'VERITAS Verification Audit Report',
      generatedAt: new Date().toISOString(),
      jobId: state.jobId,
      query: state.query,
      domain: state.domain,
      verdict: state.finalVerdict,
      compositeScore: state.finalScore,
      elapsedSeconds: state.elapsedSeconds,
      claims: state.claims,
      agents: state.agents.filter(a => a.confidence !== null).map(a => ({
        name: a.name,
        status: a.status,
        confidence: a.confidence,
        latency: a.latency,
        finding: a.finding,
      })),
      evidenceChain: state.evidenceChain,
      feedLog: state.feedLog,
      verdictScores: state.verdictScores,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veritas-audit-${state.jobId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pt-20 pb-16 px-6 md:px-8 min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="mb-12 pb-6 border-b border-[#1f2937]">
        <h2 className="text-3xl font-bold text-white mb-4">Audit Trail</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-mono text-[#9ca3af] uppercase mb-1">Job ID</p>
            <p className="font-mono text-[#4f46e5]">{state.jobId}</p>
          </div>
          <div>
            <p className="text-xs font-mono text-[#9ca3af] uppercase mb-1">Domain</p>
            <p className="text-white">{state.domain}</p>
          </div>
          <div>
            <p className="text-xs font-mono text-[#9ca3af] uppercase mb-1">Verdict</p>
            <p className={`font-bold ${state.finalVerdict === 'APPROVED' ? 'text-[#10b981]' : state.finalVerdict === 'WARNING' ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
              {state.finalVerdict} ({(state.finalScore * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-xs font-mono text-[#9ca3af] uppercase mb-1">Duration</p>
            <p className="font-mono text-[#9ca3af]">{state.elapsedSeconds.toFixed(1)}s</p>
          </div>
        </div>
      </div>

      {/* Feed Log Timeline (REAL DATA) */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h3 className="text-sm font-mono uppercase tracking-wider text-[#9ca3af]">
            Pipeline Timeline ({filteredLogs.length} events)
          </h3>
          <div className="flex gap-3">
            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="px-3 py-1.5 bg-[#111827] border border-[#1f2937] rounded-lg text-xs text-white font-mono placeholder-[#6b7280] focus:border-[#4f46e5] focus:outline-none w-48"
            />
            {/* Agent filter */}
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#111827] border border-[#1f2937] rounded-lg text-xs text-white font-mono focus:border-[#4f46e5] focus:outline-none"
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map(agent => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto border border-[#1f2937] rounded-lg bg-[#0a0a0f] p-4">
          {filteredLogs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-3 py-1.5 text-xs font-mono hover:bg-[#111827]/50 px-2 rounded transition">
              <span className="text-[#6b7280] flex-shrink-0 w-20">{log.timestamp}</span>
              <span className={`${getLogTypeColor(log.agent)} flex-shrink-0 w-28 font-bold`}>{log.agent}</span>
              <span className="text-[#9ca3af]">→</span>
              <span className="text-[#d1d5db] flex-1">{log.message}</span>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <p className="text-[#6b7280] text-xs text-center py-4">No matching log entries</p>
          )}
        </div>
      </div>

      {/* Raw Claim Map Table (REAL DATA) */}
      <div className="mb-12">
        <h3 className="text-sm font-mono uppercase tracking-wider text-[#9ca3af] mb-4">
          Raw Claim Map ({claimTableData.length} claims)
        </h3>
        <div className="overflow-x-auto border border-[#1f2937] rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1f2937] bg-[#111827]">
                <th className="text-left p-3 text-[#9ca3af] font-mono">ID</th>
                <th className="text-left p-3 text-[#9ca3af] font-mono">Type</th>
                <th className="text-left p-3 text-[#9ca3af] font-mono">Content</th>
                <th className="text-left p-3 text-[#9ca3af] font-mono">Fact</th>
                <th className="text-left p-3 text-[#9ca3af] font-mono">Math</th>
                <th className="text-left p-3 text-[#9ca3af] font-mono">Code</th>
                <th className="text-left p-3 text-[#9ca3af] font-mono">Standards</th>
                <th className="text-left p-3 text-[#9ca3af] font-mono">Status</th>
              </tr>
            </thead>
            <tbody>
              {claimTableData.map((claim, idx) => (
                <tr
                  key={claim.id}
                  className="border-b border-[#1f2937] hover:bg-[#111827] cursor-pointer transition"
                  onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                >
                  <td className="p-3 font-mono text-[#4f46e5]">{claim.id}</td>
                  <td className="p-3 text-[#9ca3af]">{claim.type}</td>
                  <td className="p-3 text-[#9ca3af] max-w-xs truncate">{claim.content}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-mono ${getStatusColor(claim.factStatus)}`}>
                      {claim.factStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-mono ${getStatusColor(claim.mathStatus)}`}>
                      {claim.mathStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-mono ${getStatusColor(claim.codeStatus)}`}>
                      {claim.codeStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-mono ${getStatusColor(claim.standardStatus)}`}>
                      {claim.standardStatus}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-mono ${getStatusColor(claim.finalStatus)}`}>
                      {claim.finalStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expandable Row Details */}
        {expandedRow !== null && claimTableData[expandedRow] && (
          <div className="mt-4 p-6 rounded-lg border border-[#1f2937] bg-[#111827]">
            <h4 className="font-bold text-white mb-4">
              Claim {claimTableData[expandedRow].id} Details
            </h4>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[#9ca3af] font-mono text-xs uppercase mb-1">Full Content</p>
                <p className="text-white">{claimTableData[expandedRow].content}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {claimTableData[expandedRow].factStatus !== '—' && (
                  <div>
                    <p className="text-[#9ca3af] font-mono text-xs uppercase mb-1">Fact Verification</p>
                    <p className="text-white">
                      Source: {claimTableData[expandedRow].factSource || 'N/A'} · Status:{' '}
                      <span className={claimTableData[expandedRow].factStatus === 'verified' ? 'text-[#10b981]' : 'text-[#f59e0b]'}>
                        {claimTableData[expandedRow].factStatus}
                      </span>
                    </p>
                    {claimTableData[expandedRow].factEvidence && (
                      <p className="text-xs text-[#6b7280] mt-1">{claimTableData[expandedRow].factEvidence}</p>
                    )}
                  </div>
                )}
                {claimTableData[expandedRow].mathStatus !== '—' && (
                  <div>
                    <p className="text-[#9ca3af] font-mono text-xs uppercase mb-1">Math Validation</p>
                    <p className="text-white">
                      Formula: {claimTableData[expandedRow].mathFormula || 'N/A'} · Result:{' '}
                      <span className="text-[#10b981]">{claimTableData[expandedRow].mathResult}</span>
                    </p>
                  </div>
                )}
                {claimTableData[expandedRow].codeIssues.length > 0 && (
                  <div>
                    <p className="text-[#9ca3af] font-mono text-xs uppercase mb-1">Code Issues</p>
                    <ul className="space-y-1">
                      {claimTableData[expandedRow].codeIssues.map((issue: string, i: number) => (
                        <li key={i} className="text-xs text-[#ef4444]">• {issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {claimTableData[expandedRow].standardStatus !== '—' && (
                  <div>
                    <p className="text-[#9ca3af] font-mono text-xs uppercase mb-1">Standards Reference</p>
                    <p className="text-white">{claimTableData[expandedRow].standardRef}</p>
                  </div>
                )}
              </div>
              {/* Evidence for this claim from evidence chain */}
              <div>
                <p className="text-[#9ca3af] font-mono text-xs uppercase mb-1">Related Evidence</p>
                <div className="space-y-1">
                  {state.evidenceChain
                    .filter(ev => ev.claim.toLowerCase().includes(claimTableData[expandedRow].content.slice(0, 30).toLowerCase()))
                    .map((ev, i) => (
                      <p key={i} className="text-xs text-[#6b7280]">
                        [{ev.source}] {ev.supports ? '✓' : '✗'} {ev.claim.slice(0, 80)}
                        {ev.url && <a href={ev.url} className="text-[#4f46e5] ml-2" target="_blank" rel="noopener noreferrer">→ source</a>}
                      </p>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Download Button (WORKING) */}
      <button
        onClick={handleDownloadAudit}
        className="flex items-center gap-2 px-6 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold rounded-lg text-sm transition shadow-lg hover:shadow-indigo-500/30"
      >
        <Download className="w-4 h-4" />
        Download Audit Report (JSON)
      </button>
    </div>
  );
}
