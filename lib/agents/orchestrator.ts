import { VerificationJob, AgentVerdict, FeedLogEntry } from '../schemas';
import { generateClaims } from './generator';
import { verifyFactualClaims } from './factVerifier';
import { validateMathClaims } from './mathValidator';
import { analyzeCodeClaims } from './codeAnalyzer';
import { performReasoning } from './reasoningAgent';
import { verifyStandardsClaims } from './standardsAgent';
import { analyzeGitHub } from './githubAgent';
import { calculateCompositeScore, determineVerdict } from './safetyGate';
import { runCorrectionAgent } from './correctionAgent';
import { createAgentVerdict } from './utils';
import { JobManager, broadcastFeedLog } from '../jobManager';
import { mcpSequentialThinking } from '../mcpServers';

function emitLog(jobId: string, agentName: string, message: string, type: FeedLogEntry['type']) {
  const entry: FeedLogEntry = {
    timestamp: Date.now() / 1000,
    agentName,
    message,
    type,
  };
  JobManager.addFeedLog(jobId, entry);
  broadcastFeedLog(jobId, entry);
}

export async function runVerificationPipeline(job: VerificationJob) {
  try {
    JobManager.updateJob(job.jobId, { status: 'running', startedAt: Date.now() });
    emitLog(job.jobId, 'ORCHESTRATOR', `Pipeline started for domain: ${job.domain}`, 'info');

    // ── Stage 1: Generate claims via Groq ──
    emitLog(job.jobId, 'GENERATOR', 'Starting claim extraction via Groq LLM...', 'info');

    let claims = await generateClaims(job.query, job.domain);
    job.claims = claims;
    JobManager.updateJob(job.jobId, { claims });

    const typeCounts = {
      factual: claims.filter(c => c.claimType === 'factual').length,
      mathematical: claims.filter(c => c.claimType === 'mathematical').length,
      code: claims.filter(c => c.claimType === 'code').length,
      standard: claims.filter(c => c.claimType === 'standard_citation').length,
      reasoning: claims.filter(c => c.claimType === 'reasoning').length,
    };

    emitLog(job.jobId, 'GENERATOR',
      `Extracted ${claims.length} claims (${typeCounts.factual} factual, ${typeCounts.mathematical} math, ${typeCounts.code} code, ${typeCounts.standard} standards, ${typeCounts.reasoning} reasoning)`,
      'success'
    );

    // ── MCP Sequential Thinking: Build execution plan ──
    const thinkingChain = mcpSequentialThinking.buildThinkingChain(claims);
    emitLog(job.jobId, 'ORCHESTRATOR',
      `Execution plan: ${thinkingChain.steps.length} steps, ${thinkingChain.dependencies.length} dependencies`,
      'info'
    );

    // ── Stage 2: Parallel verification agents ──
    emitLog(job.jobId, 'ORCHESTRATOR', 'Starting parallel verification (5 agents)...', 'info');

    // Launch ALL verification agents in parallel
    const [factResult, mathResult, codeResult, reasoningResult, standardsResult, githubResult] = await Promise.allSettled([
      (async () => {
        emitLog(job.jobId, 'FACT_VERIFIER', 'Searching Wikipedia, arXiv, OpenAlex...', 'info');
        const result = await verifyFactualClaims(claims);
        emitLog(job.jobId, 'FACT_VERIFIER',
          `Completed: ${result.verdict} (${(result.confidenceScore * 100).toFixed(0)}%) — ${result.evidence.length} sources found`,
          result.verdict === 'pass' ? 'success' : result.verdict === 'fail' ? 'error' : 'warning'
        );
        return result;
      })(),
      (async () => {
        emitLog(job.jobId, 'MATH_VALIDATOR', 'Validating mathematical claims via Groq...', 'info');
        const result = await validateMathClaims(claims);
        emitLog(job.jobId, 'MATH_VALIDATOR',
          `Completed: ${result.verdict} (${(result.confidenceScore * 100).toFixed(0)}%) — ${result.issues.length} issues`,
          result.verdict === 'pass' ? 'success' : result.verdict === 'fail' ? 'error' : 'warning'
        );
        return result;
      })(),
      (async () => {
        emitLog(job.jobId, 'CODE_ANALYZER', 'Analyzing code claims via Groq...', 'info');
        const result = await analyzeCodeClaims(claims);
        emitLog(job.jobId, 'CODE_ANALYZER',
          `Completed: ${result.verdict} (${(result.confidenceScore * 100).toFixed(0)}%) — ${result.issues.length} issues`,
          result.verdict === 'pass' ? 'success' : result.verdict === 'fail' ? 'error' : 'warning'
        );
        return result;
      })(),
      (async () => {
        emitLog(job.jobId, 'REASONING_AGENT', 'Performing chain-of-thought analysis via Groq...', 'info');
        const result = await performReasoning(claims, job.query);
        emitLog(job.jobId, 'REASONING_AGENT',
          `Completed: ${result.verdict} (${(result.confidenceScore * 100).toFixed(0)}%) — ${result.issues.length} issues`,
          result.verdict === 'pass' ? 'success' : result.verdict === 'fail' ? 'error' : 'warning'
        );
        return result;
      })(),
      (async () => {
        emitLog(job.jobId, 'STANDARDS_AGENT', 'Verifying standards compliance...', 'info');
        const result = await verifyStandardsClaims(claims);
        emitLog(job.jobId, 'STANDARDS_AGENT',
          `Completed: ${result.verdict} (${(result.confidenceScore * 100).toFixed(0)}%) — ${result.evidence.length} standards checked`,
          result.verdict === 'pass' ? 'success' : result.verdict === 'fail' ? 'error' : 'warning'
        );
        return result;
      })(),
      (async () => {
        emitLog(job.jobId, 'GITHUB_AGENT', 'Analyzing GitHub repositories and code...', 'info');
        const result = await analyzeGitHub(claims, job.query);
        if (result.verdict !== 'skip') {
          emitLog(job.jobId, 'GITHUB_AGENT',
            `Completed: ${result.verdict} (${(result.confidenceScore * 100).toFixed(0)}%) — ${result.issues.length} issues`,
            result.verdict === 'pass' ? 'success' : result.verdict === 'fail' ? 'error' : 'warning'
          );
        }
        return result;
      })(),
    ]);

    // Collect verdicts from settled promises
    const allVerdicts: AgentVerdict[] = [];

    const extractVerdict = (result: PromiseSettledResult<AgentVerdict>, agentId: string, agentName: string): AgentVerdict => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`[VERITAS] ${agentName} failed:`, result.reason);
        emitLog(job.jobId, agentName.toUpperCase(), `Agent error: ${result.reason?.message || 'Unknown error'}`, 'error');
        return createAgentVerdict({
          agentId,
          agentName,
          verdict: 'warn',
          confidenceScore: 0.5,
          issues: [{ claimId: 'system', description: `Agent error: ${result.reason?.message || 'Unknown'}`, severity: 'major' }],
          evidence: [],
          correctiveHints: [`${agentName} encountered an error and could not complete verification`],
          latencyMs: 0,
        });
      }
    };

    allVerdicts.push(extractVerdict(factResult, 'fact_verifier', 'FactVerifier'));
    allVerdicts.push(extractVerdict(mathResult, 'math_validator', 'MathValidator'));
    allVerdicts.push(extractVerdict(codeResult, 'code_analyzer', 'CodeAnalyzer'));
    allVerdicts.push(extractVerdict(reasoningResult, 'reasoning_agent', 'ReasoningAgent'));
    allVerdicts.push(extractVerdict(standardsResult, 'standards_agent', 'StandardsAgent'));
    allVerdicts.push(extractVerdict(githubResult, 'github_agent', 'GitHubAgent'));

    // Collect evidence from all agents
    for (const v of allVerdicts) {
      for (const ev of v.evidence) {
        job.evidence.push({
          id: `ev-${Math.random().toString(36).slice(2, 8)}`,
          source: v.agentId === 'fact_verifier' ? 'Wikipedia'
            : v.agentId === 'standards_agent' ? 'StandardsDB'
            : v.agentId === 'code_analyzer' ? 'GitHub'
            : 'arXiv',
          claimId: ev.claimId,
          supportVerdict: ev.supports ? 'supports' : 'contradicts',
          title: ev.excerpt.slice(0, 100),
          url: ev.sourceUrl,
          excerpt: ev.excerpt,
        });
      }
    }

    job.agentVerdicts = allVerdicts;
    JobManager.updateJob(job.jobId, { agentVerdicts: allVerdicts, evidence: job.evidence });

    // ── Stage 3: Safety Gate — Score aggregation ──
    emitLog(job.jobId, 'SAFETY_GATE', 'Aggregating verdicts and calculating composite score...', 'info');

    let retryCount = 0;
    let finalScore = calculateCompositeScore(allVerdicts, job.domain);
    let finalVerdict = determineVerdict(finalScore);

    emitLog(job.jobId, 'SAFETY_GATE',
      `Verdict: ${finalVerdict} (${(finalScore * 100).toFixed(1)}%)`,
      finalVerdict === 'APPROVED' ? 'success' : finalVerdict === 'WARNING' ? 'warning' : 'error'
    );

    // ── Stage 4: Correction Loop (if REJECTED) ──
    let currentVerdicts = [...allVerdicts];

    while (finalVerdict === 'REJECTED' && retryCount < 3) {
      retryCount++;
      emitLog(job.jobId, 'CORRECTION_AGENT', `Initiating correction cycle ${retryCount}/3...`, 'info');

      const correctionResult = await runCorrectionAgent(job, currentVerdicts);

      if (correctionResult.escalated) {
        emitLog(job.jobId, 'CORRECTION_AGENT', 'Max retries exceeded — escalating to human review', 'error');
        finalVerdict = 'ESCALATED' as any;
        break;
      }

      // Update claims with corrected version
      claims = correctionResult.correctedClaims;
      job.claims = claims;
      job.retryCount = correctionResult.retryCount;

      emitLog(job.jobId, 'ORCHESTRATOR', `Re-running verification on corrected response (Retry ${retryCount}/3)...`, 'info');

      // Re-run ALL agents in parallel with corrected claims
      const [reFact, reMath, reCode, reReasoning, reStandards, reGithub] = await Promise.allSettled([
        verifyFactualClaims(claims),
        validateMathClaims(claims),
        analyzeCodeClaims(claims),
        performReasoning(claims, job.query),
        verifyStandardsClaims(claims),
        analyzeGitHub(claims, job.query),
      ]);

      currentVerdicts = [
        extractVerdict(reFact, 'fact_verifier', 'FactVerifier'),
        extractVerdict(reMath, 'math_validator', 'MathValidator'),
        extractVerdict(reCode, 'code_analyzer', 'CodeAnalyzer'),
        extractVerdict(reReasoning, 'reasoning_agent', 'ReasoningAgent'),
        extractVerdict(reStandards, 'standards_agent', 'StandardsAgent'),
        extractVerdict(reGithub, 'github_agent', 'GitHubAgent'),
      ];

      // Mark correction applied
      currentVerdicts.forEach(v => { (v as any).correctionApplied = true; });

      finalScore = calculateCompositeScore(currentVerdicts, job.domain);
      finalVerdict = determineVerdict(finalScore);

      emitLog(job.jobId, 'SAFETY_GATE',
        `Re-scored: ${finalVerdict} (${(finalScore * 100).toFixed(1)}%) after correction ${retryCount}`,
        finalVerdict === 'APPROVED' ? 'success' : finalVerdict === 'WARNING' ? 'warning' : 'error'
      );
    }

    // ── Stage 5: Finalize ──
    job.compositeScore = finalScore;
    job.verdict = finalVerdict as any;
    job.retryCount = retryCount;
    job.agentVerdicts = currentVerdicts;

    JobManager.updateJob(job.jobId, {
      status: 'completed',
      completedAt: Date.now(),
      compositeScore: finalScore,
      verdict: finalVerdict as any,
      retryCount,
      agentVerdicts: currentVerdicts,
      claims,
      evidence: job.evidence,
    });

    emitLog(job.jobId, 'ORCHESTRATOR',
      `Pipeline completed${retryCount > 0 ? ` after ${retryCount} correction cycle(s)` : ''} — ${finalVerdict} (${(finalScore * 100).toFixed(1)}%)`,
      'success'
    );

  } catch (error) {
    console.error('[VERITAS] Pipeline error:', error);
    JobManager.updateJob(job.jobId, { status: 'failed' });
    emitLog(job.jobId, 'ORCHESTRATOR',
      `Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    );
  }
}
