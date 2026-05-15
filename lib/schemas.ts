// Core data models for VERITAS verification system

export interface ClaimUnit {
  claimId: string;
  claimType: 'factual' | 'mathematical' | 'code' | 'standard_citation' | 'reasoning';
  content: string;
  language?: string; // for code blocks
  context?: string;
  position?: number;
  domain?: string;
  severity?: 'critical' | 'major' | 'minor';
}

export interface Issue {
  claimId: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface Evidence {
  claimId: string;
  sourceUrl: string;
  excerpt: string;
  supports: boolean;
}

export interface AgentVerdict {
  agentId: string;
  agentName?: string;
  verdict: 'pass' | 'fail' | 'warn' | 'skip';
  confidenceScore: number; // 0.0 - 1.0
  confidence?: number; // alias for confidenceScore
  issues: Issue[];
  evidence: Evidence[];
  correctiveHints: string[];
  latencyMs: number;
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  findings?: Finding[];
  correctionApplied?: boolean;
}

export interface Finding {
  severity: 'critical' | 'major' | 'minor';
  issue: string;
  evidence?: string;
  suggestedFix?: string;
}

export interface EvidenceItem {
  id: string;
  source: 'Wikipedia' | 'arXiv' | 'YouCom' | 'Wolfram' | 'GitHub' | 'StandardsDB';
  claimId: string;
  supportVerdict: 'supports' | 'contradicts' | 'neutral';
  title: string;
  url: string;
  excerpt: string;
}

export interface VerificationJob {
  jobId: string;
  query: string;
  domain: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  claims: ClaimUnit[];
  agentVerdicts: AgentVerdict[];
  evidence: EvidenceItem[];
  compositeScore: number; // 0.0 - 1.0
  verdict: 'APPROVED' | 'WARNING' | 'REJECTED' | 'ESCALATED';
  retryCount?: number;
  pipelineSteps: PipelineStep[];
}

export interface PipelineStep {
  stepId: string;
  stepName: string;
  agentName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  duration?: number; // ms
  input?: string;
  output?: string;
}

export interface FeedLogEntry {
  timestamp: number; // seconds.milliseconds
  agentName: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface DomainWeights {
  [key: string]: number;
}
