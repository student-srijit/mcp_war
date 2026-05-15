'use client';

import { useEffect, useRef, useState } from 'react';
import type { VerificationState, AgentStatus } from '@/hooks/useMockVerification';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface LiveDashboardViewProps {
  state: VerificationState;
}

export function LiveDashboardView({ state }: LiveDashboardViewProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [displayedChars, setDisplayedChars] = useState(0);

  useEffect(() => {
    if (feedRef.current) {
      setTimeout(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [state.feedLog]);

  useEffect(() => {
    setDisplayedChars(0);
    let timer: NodeJS.Timeout;
    const interval = () => {
      setDisplayedChars((prev) => {
        if (prev < state.responseText.length) {
          timer = setTimeout(() => {
            interval();
          }, 20);
          return prev + 1;
        }
        return prev;
      });
    };
    interval();
    return () => clearTimeout(timer);
  }, [state.responseText]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getAgentColor = (agent: AgentStatus): string => {
    if (agent.status === 'passed') return 'text-[#10b981]';
    if (agent.status === 'failed') return 'text-[#ef4444]';
    if (agent.status === 'running') return agent.colorClass;
    return 'text-[#6b7280]';
  };

  const syntaxHighlight = (text: string) => {
    // Simple syntax highlighting
    return text
      .replace(/("[\w-]+")(\s*:)/g, '<span class="text-[#4f46e5]">$1</span>$2')
      .replace(/(:?\s*"[^"]*")/g, '<span class="text-[#10b981]">$1</span>')
      .replace(/:\s*(\d+)/g, ': <span class="text-[#f59e0b]">$1</span>')
      .replace(/true|false|null/g, '<span class="text-[#f59e0b]">$&</span>');
  };

  return (
    <div className="pt-20 pb-8 px-6 md:px-8 min-h-screen bg-[#0a0a0f]">
      {/* Top Bar */}
      <div className="mb-6 pb-4 border-b border-[#1f2937] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-[#4f46e5]">
              {state.jobId}
            </span>
            <span className="px-2 py-1 text-xs font-mono rounded bg-[#1f2937] text-[#9ca3af]">
              {state.domain}
            </span>
          </div>
          <p className="text-[#9ca3af] text-sm line-clamp-1">
            {state.query}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="font-mono text-lg font-bold text-white">
              {formatTime(state.elapsedSeconds)}
            </div>
            <p className="text-xs text-[#9ca3af]">elapsed</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse-dot" />
            <span className="text-sm text-[#9ca3af]">Pipeline Running...</span>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout on Desktop, Stack on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-6">
        {/* Left Column - Agent Status Panel */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-[#9ca3af] mb-4">
            Agent Status
          </h3>
          {state.agents.map((agent) => (
            <div
              key={agent.id}
              className={`p-3 rounded border transition ${
                agent.status === 'running'
                  ? 'border-[#4f46e5] bg-[#4f46e5]/5'
                  : 'border-[#1f2937] bg-[#111827]'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status Dot */}
                <div className="flex-shrink-0 mt-1">
                  {agent.status === 'waiting' && (
                    <div className="w-3 h-3 rounded-full border border-[#6b7280]" />
                  )}
                  {agent.status === 'running' && (
                    <div
                      className={`w-3 h-3 rounded-full animate-pulse-dot ${agent.colorClass}`}
                    />
                  )}
                  {agent.status === 'passed' && (
                    <CheckCircle2 className="w-4 h-4 text-[#10b981] flex-shrink-0" />
                  )}
                  {agent.status === 'failed' && (
                    <XCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-white">
                    {agent.name}
                  </h4>
                  <p className="text-xs text-[#9ca3af] mb-1">
                    {agent.role}
                  </p>
                  {agent.finding && (
                    <p className="text-xs text-[#10b981] font-mono">
                      {agent.finding}
                    </p>
                  )}
                </div>

                {/* Latency */}
                {agent.latency && (
                  <div className="flex-shrink-0">
                    <span className="text-xs font-mono text-[#9ca3af]">
                      {agent.latency}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {agent.status === 'running' && (
                <div className="mt-2 h-1 w-full bg-[#1f2937] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#4f46e5] animate-fill-bar"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Column - Three Stacked Panels */}
        <div className="space-y-6">
          {/* Panel A - Response Being Generated */}
          <div className="border border-[#1f2937] rounded bg-[#111827] p-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#9ca3af] mb-3">
              Response Being Generated
            </h3>
            <div className="bg-[#0a0a0f] rounded p-3 overflow-auto max-h-40">
              <pre className="font-mono text-xs whitespace-pre-wrap break-words">
                <code
                  dangerouslySetInnerHTML={{
                    __html: syntaxHighlight(
                      state.responseText.slice(0, displayedChars)
                    ),
                  }}
                  className="text-[#9ca3af]"
                />
                {displayedChars < state.responseText.length && (
                  <span className="animate-pulse">_</span>
                )}
              </pre>
            </div>
          </div>

          {/* Panel B - Verification Feed */}
          <div className="border border-[#1f2937] rounded bg-[#111827] p-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#9ca3af] mb-3">
              Verification Feed
            </h3>
            <div
              ref={feedRef}
              className="bg-[#0a0a0f] rounded p-3 max-h-40 overflow-y-auto space-y-1"
            >
              {state.feedLog.map((log, idx) => (
                <div
                  key={idx}
                  className="text-xs font-mono animate-scroll-down"
                >
                  <span className="text-[#6b7280]">{log.timestamp}</span>
                  <span className={`${
                    log.agent === 'SYSTEM'
                      ? 'text-[#9ca3af]'
                      : 'text-[#4f46e5]'
                  } ml-2`}>
                    {log.agent}
                  </span>
                  <span className="text-[#9ca3af] ml-2">→</span>
                  <span className="text-[#9ca3af] ml-2">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel C - Verdict Preview */}
          <div className="border border-[#1f2937] rounded bg-[#111827] p-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#9ca3af] mb-3">
              Verdict Preview
            </h3>
            <div className="flex gap-2 flex-wrap">
              {state.agents.slice(1, 6).map((agent) => (
                <div
                  key={agent.id}
                  className="px-3 py-2 rounded border border-[#1f2937] text-xs font-mono"
                >
                  <span className="text-[#9ca3af]">{agent.name.slice(0, 6)}</span>
                  <span className="text-[#4f46e5] ml-2 font-bold">
                    {agent.confidence !== null
                      ? `${(agent.confidence * 100).toFixed(0)}%`
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
