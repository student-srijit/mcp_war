// Core data models for VERITAS verification system

export interface ClaimUnit {
  claimId: string;
  claimType: 'factual' | 'mathematical' | 'code' | 'standard_citation' | 'reasoning' | 'github';
  content: string;
  language?: string; // for code blocks
  context?: string;
  position?: number;
  domain?: string;
  severity?: 'critical' | 'major' | 'minor';
  githubUrl?: string; // for GitHub code claims
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
  source: 'Wikipedia' | 'arXiv' | 'YouCom' | 'Wolfram' | 'GitHub' | 'StandardsDB' | 'Google' | 'StackOverflow' | 'Judge0' | 'HuggingFace' | 'GoogleScholar' | 'OpenAlex';
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
  activeTools?: string[]; // Tools that are active for this job
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

// GitHub-specific types
export interface GitHubAnalysis {
  repoInfo?: {
    name: string;
    language: string;
    stars: number;
    description: string;
  };
  filesAnalyzed: number;
  findings: Finding[];
  codeQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
  securityIssues: number;
}

// Tool status for the /api/tools endpoint
export interface ToolStatus {
  name: string;
  envVar: string;
  configured: boolean;
  description: string;
  freeLimit: string;
  signupUrl: string;
}
