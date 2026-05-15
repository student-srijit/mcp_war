'use client';

import { useState, useCallback, useRef } from 'react';

export interface Claim {
  id: string;
  type: 'factual' | 'mathematical' | 'code' | 'standard';
  content: string;
  factResult?: { status: 'verified' | 'uncertain' | 'flagged'; source: string; evidence: string };
  mathResult?: { status: 'verified' | 'uncertain' | 'flagged'; formula: string; result: string };
  codeResult?: { status: 'verified' | 'uncertain' | 'flagged'; issues: string[] };
  standardResult?: { status: 'verified' | 'uncertain' | 'flagged'; standard: string };
  reasoningResult?: { status: 'verified' | 'uncertain' | 'flagged'; reasoning: string };
}

export interface AgentStatus {
  id: string;
  name: string;
  role: string;
  status: 'waiting' | 'running' | 'passed' | 'failed';
  latency: string | null;
  finding: string | null;
  confidence: number | null;
  colorClass: string;
}

export interface VerificationState {
  jobId: string;
  query: string;
  domain: string;
  status: 'idle' | 'running' | 'completed';
  elapsedSeconds: number;
  agents: AgentStatus[];
  claims: Claim[];
  responseText: string;
  feedLog: { timestamp: string; agent: string; message: string }[];
  finalScore: number;
  finalVerdict: 'APPROVED' | 'WARNING' | 'REJECTED';
  verdictScores: { [key: string]: number };
  evidenceChain: { source: string; claim: string; supports: boolean; url: string; agent: string }[];
}

const AGENTS = [
  { id: 'orchestrator', name: 'Orchestrator', role: 'Master controller & pipeline coordinator', color: 'text-indigo-400' },
  { id: 'generator', name: 'Generator', role: 'Response generation engine', color: 'text-indigo-400' },
  { id: 'fact-verifier', name: 'Fact Verifier', role: 'Claims validation via external sources', color: 'text-green-400' },
  { id: 'math-validator', name: 'Math Validator', role: 'Formula & calculation verification', color: 'text-amber-400' },
  { id: 'code-analyzer', name: 'Code Analyzer', role: 'Code quality & syntax checking', color: 'text-red-400' },
  { id: 'standards-agent', name: 'Standards Agent', role: 'IEEE/ISO/OSHA compliance checks', color: 'text-amber-400' },
  { id: 'reasoning-agent', name: 'Reasoning Agent', role: 'Sequential logic validation', color: 'text-purple-400' },
  { id: 'safety-gate', name: 'Safety Gate', role: 'Final verdict & hallucination detection', color: 'text-red-400' },
  { id: 'correction-agent', name: 'Correction Agent', role: 'Auto-correction & refinement', color: 'text-green-400' },
];

const EXAMPLE_QUERIES = [
  {
    title: 'Steel beam load calculation',
    domain: 'Structural Engineering',
    query: 'Calculate max load for W12×50 beam, 20ft span under uniform load, considering moment of inertia and yield strength of A36 steel.',
  },
  {
    title: 'React useEffect bug',
    domain: 'Software Development',
    query: 'Find the memory leak in this useEffect hook: useEffect(() => { const handler = () => console.log("event"); window.addEventListener("resize", handler); }, [])',
  },
  {
    title: 'IEEE 802.3 compliance',
    domain: 'Standards Reference',
    query: 'Verify Ethernet cable spec for data center use: Cat6A unshielded twisted pair, 568B wiring standard, max 100m run distance.',
  },
  {
    title: 'Dosage formula check',
    domain: 'Healthcare Systems',
    query: 'Verify pediatric amoxicillin dosage calculation: 50 mg/kg/day for 6-year-old (22kg) with acute otitis media.',
  },
  {
    title: 'DCF model validation',
    domain: 'Financial Modeling',
    query: 'Check discounted cash flow formula accuracy: NPV = Σ(CF_t / (1+r)^t) with WACC of 8% and 5-year projection.',
  },
  {
    title: 'HVAC capacity calc',
    domain: 'Infrastructure & Energy',
    query: 'Verify BTU calculation for 2000 sq ft space: Rule of thumb 20 BTU/sq ft, accounting for climate zone 4 and R-19 insulation.',
  },
];

const generateMockResponse = (query: string, domain: string): Claim[] => {
  const claimTypes = ['factual', 'mathematical', 'code', 'standard'];
  const claims: Claim[] = [];

  if (domain.includes('Structural')) {
    claims.push(
      {
        id: 'c1',
        type: 'mathematical',
        content: 'W12×50 beam section modulus is 394 in³',
        mathResult: { status: 'verified', formula: 'S = I/c', result: '394 in³' },
      },
      {
        id: 'c2',
        type: 'standard',
        content: 'A36 steel yield strength is 36 ksi',
        standardResult: { status: 'verified', standard: 'ASTM A36', },
      },
      {
        id: 'c3',
        type: 'mathematical',
        content: 'Max bending moment for 20ft span: M = (wL²)/8',
        mathResult: { status: 'verified', formula: 'M = (wL²)/8', result: 'w=4kip/ft → M=200 kip-ft' },
      }
    );
  } else if (domain.includes('Software')) {
    claims.push(
      {
        id: 'c1',
        type: 'code',
        content: 'addEventListener without cleanup causes memory leak',
        codeResult: { status: 'flagged', issues: ['Event listener not removed on unmount'] },
      },
      {
        id: 'c2',
        type: 'code',
        content: 'Empty dependency array [] means hook runs once on mount',
        codeResult: { status: 'verified', issues: [] },
      },
      {
        id: 'c3',
        type: 'code',
        content: 'Fix requires return cleanup function: return () => window.removeEventListener(...)',
        codeResult: { status: 'verified', issues: [] },
      }
    );
  } else if (domain.includes('Healthcare')) {
    claims.push(
      {
        id: 'c1',
        type: 'mathematical',
        content: 'Pediatric dose = 50 mg/kg × 22 kg = 1100 mg/day',
        mathResult: { status: 'verified', formula: 'dose = weight × dose/kg', result: '1100 mg' },
      },
      {
        id: 'c2',
        type: 'standard',
        content: 'Amoxicillin typical dosing is 25-50 mg/kg/day divided in 3 doses',
        standardResult: { status: 'verified', standard: 'FDA Pediatric Dosing' },
      },
      {
        id: 'c3',
        type: 'factual',
        content: 'For acute otitis media, standard treatment is 7-10 days',
        factResult: { status: 'verified', source: 'CDC Guidelines', evidence: 'Acute otitis media treatment duration' },
      }
    );
  } else {
    claims.push(
      {
        id: 'c1',
        type: 'factual',
        content: 'Primary claim being evaluated',
        factResult: { status: 'verified', source: 'Verified', evidence: 'Claim validated' },
      },
      {
        id: 'c2',
        type: 'mathematical',
        content: 'Numerical calculation referenced',
        mathResult: { status: 'verified', formula: 'Standard formula', result: 'Calculated' },
      }
    );
  }

  return claims;
};

export const useMockVerification = () => {
  const [state, setState] = useState<VerificationState>({
    jobId: `JOB-${Math.random().toString(16).slice(2, 10)}`,
    query: '',
    domain: 'Auto-Detect',
    status: 'idle',
    elapsedSeconds: 0,
    agents: AGENTS.map((a) => ({
      ...a,
      status: 'waiting',
      latency: null,
      finding: null,
      confidence: null,
    })),
    claims: [],
    responseText: '',
    feedLog: [],
    finalScore: 0,
    finalVerdict: 'APPROVED',
    verdictScores: {},
    evidenceChain: [],
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const agentTimersRef = useRef<NodeJS.Timeout[]>([]);

  const startVerification = useCallback((query: string, domain: string) => {
    const jobId = `JOB-${Math.random().toString(16).slice(2, 10)}`;
    const claims = generateMockResponse(query, domain);

    setState((prev) => ({
      ...prev,
      jobId,
      query,
      domain,
      status: 'running',
      elapsedSeconds: 0,
      claims,
      responseText: '',
      feedLog: [{ timestamp: '[00:00.0]', agent: 'SYSTEM', message: 'Pipeline initialized' }],
      agents: prev.agents.map((a) => ({ ...a, status: 'waiting', latency: null, finding: null })),
      verdictScores: {},
    }));

    // Timer for elapsed seconds
    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed += 1;
      setState((prev) => ({ ...prev, elapsedSeconds: elapsed }));
    }, 1000);

    // Orchestrator at 0s
    agentTimersRef.current.push(
      setTimeout(() => {
        setState((prev) => {
          const agents = [...prev.agents];
          agents[0].status = 'running';
          return { ...prev, agents };
        });
      }, 0)
    );

    // Generator at 0.5s (runs for 1s)
    agentTimersRef.current.push(
      setTimeout(() => {
        setState((prev) => {
          const agents = [...prev.agents];
          agents[0].status = 'passed';
          agents[0].latency = '0.3s';
          agents[1].status = 'running';
          return {
            ...prev,
            agents,
            feedLog: [
              ...prev.feedLog,
              { timestamp: '[00:00.5]', agent: 'ORCHESTRATOR', message: 'Pipeline sequence initiated' },
            ],
          };
        });
      }, 500)
    );

    // Generator completes, response streaming
    agentTimersRef.current.push(
      setTimeout(() => {
        const responseSnippets = [
          '{\n  "claims": [\n',
          '    {\n      "id": "c1",\n',
          '      "type": "' + claims[0].type + '",\n',
          '      "content": "' + claims[0].content.slice(0, 30) + '...",\n',
          '      "status": "verified"\n',
          '    },\n',
          '    ...\n',
          '  ],\n',
          '  "claimCount": ' + claims.length + '\n',
          '}',
        ];

        let charIndex = 0;
        const streamChar = () => {
          if (charIndex < responseSnippets.join('').length) {
            const fullText = responseSnippets.join('');
            setState((prev) => ({
              ...prev,
              responseText: fullText.slice(0, charIndex + 1),
            }));
            charIndex++;
            setTimeout(streamChar, 20);
          }
        };
        streamChar();

        setState((prev) => {
          const agents = [...prev.agents];
          agents[1].status = 'passed';
          agents[1].latency = '1.2s';
          agents[1].finding = `Produced ${claims.length} claim units`;
          return {
            ...prev,
            agents,
            feedLog: [
              ...prev.feedLog,
              { timestamp: '[00:01.2]', agent: 'GENERATOR', message: `Produced ${claims.length} claim units (3 factual, 2 mathematical, 2 code, 1 standard)` },
            ],
          };
        });
      }, 1500)
    );

    // Parallel verification agents start at 1.5s
    const verifyAgentConfigs = [
      { idx: 2, name: 'FACT_VERIFIER', delay: 1500, duration: 1.5 },
      { idx: 3, name: 'MATH_VALIDATOR', delay: 1500, duration: 1.8 },
      { idx: 4, name: 'CODE_ANALYZER', delay: 1500, duration: 1.3 },
      { idx: 5, name: 'STANDARDS_AGENT', delay: 1500, duration: 1.6 },
      { idx: 6, name: 'REASONING_AGENT', delay: 1500, duration: 1.4 },
    ];

    verifyAgentConfigs.forEach(({ idx, name, delay, duration }) => {
      // Start running
      agentTimersRef.current.push(
        setTimeout(() => {
          setState((prev) => {
            const agents = [...prev.agents];
            agents[idx].status = 'running';
            return { ...prev, agents };
          });
        }, delay)
      );

      // Complete
      agentTimersRef.current.push(
        setTimeout(() => {
          const findings = [
            '3 claims verified, 1 uncertain',
            'All formulas correct',
            '2 code issues detected',
            'Standards compliant',
            'Logic chain valid',
          ];
          const scores = [0.92, 0.88, 0.85, 0.90, 0.89];

          setState((prev) => {
            const agents = [...prev.agents];
            agents[idx].status = 'passed';
            agents[idx].latency = duration.toFixed(1) + 's';
            agents[idx].finding = findings[idx - 2];
            agents[idx].confidence = scores[idx - 2];
            const newVerdicts = { ...prev.verdictScores };
            newVerdicts[agents[idx].id] = scores[idx - 2];
            return {
              ...prev,
              agents,
              verdictScores: newVerdicts,
              feedLog: [
                ...prev.feedLog,
                { timestamp: `[00:${(delay / 1000 + duration).toFixed(1)}]`, agent: name, message: findings[idx - 2] },
              ],
            };
          });
        }, delay + duration * 1000)
      );
    });

    // Safety Gate at 4s
    agentTimersRef.current.push(
      setTimeout(() => {
        setState((prev) => {
          const agents = [...prev.agents];
          agents[7].status = 'running';
          return { ...prev, agents };
        });
      }, 4000)
    );

    agentTimersRef.current.push(
      setTimeout(() => {
        setState((prev) => {
          const agents = [...prev.agents];
          agents[7].status = 'passed';
          agents[7].latency = '0.8s';
          agents[7].finding = 'No hallucinations detected';
          agents[7].confidence = 0.94;
          const newVerdicts = { ...prev.verdictScores };
          newVerdicts['safety-gate'] = 0.94;
          return {
            ...prev,
            agents,
            verdictScores: newVerdicts,
            feedLog: [
              ...prev.feedLog,
              { timestamp: '[00:04.8]', agent: 'SAFETY_GATE', message: 'No critical hallucinations detected. Confidence: 94%' },
            ],
          };
        });
      }, 4800)
    );

    // Correction Agent at 4.9s
    agentTimersRef.current.push(
      setTimeout(() => {
        setState((prev) => {
          const agents = [...prev.agents];
          agents[8].status = 'running';
          return { ...prev, agents };
        });
      }, 4900)
    );

    agentTimersRef.current.push(
      setTimeout(() => {
        setState((prev) => {
          const agents = [...prev.agents];
          agents[8].status = 'passed';
          agents[8].latency = '0.5s';
          agents[8].finding = 'No corrections needed';
          agents[8].confidence = 0.91;
          const newVerdicts = { ...prev.verdictScores };
          newVerdicts['correction-agent'] = 0.91;
          
          // Calculate final score
          const allScores = Object.values({ ...newVerdicts, 'correction-agent': 0.91 });
          const finalScore = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0.85;
          const verdict = finalScore >= 0.85 ? 'APPROVED' : finalScore >= 0.60 ? 'WARNING' : 'REJECTED';

          return {
            ...prev,
            agents,
            verdictScores: newVerdicts,
            status: 'completed',
            finalScore,
            finalVerdict: verdict,
            feedLog: [
              ...prev.feedLog,
              { timestamp: '[00:05.4]', agent: 'CORRECTION_AGENT', message: 'Response is accurate and requires no modifications' },
              { timestamp: '[00:05.4]', agent: 'SYSTEM', message: `Final verdict: ${verdict} (Score: ${finalScore.toFixed(2)})` },
            ],
          };
        });
      }, 5400)
    );
  }, []);

  const stopVerification = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    agentTimersRef.current.forEach((t) => clearTimeout(t));
    agentTimersRef.current = [];
    setState((prev) => ({ ...prev, status: 'idle', elapsedSeconds: 0 }));
  }, []);

  return {
    state,
    startVerification,
    stopVerification,
    exampleQueries: EXAMPLE_QUERIES,
  };
};
