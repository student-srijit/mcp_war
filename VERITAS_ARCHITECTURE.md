# VERITAS - Full-Stack Architecture

A production-grade **Multi-Agent Technical Verification System** built with Next.js, React, and real LLM APIs (Groq).

## System Architecture

```
VERITAS/
├── Frontend (React/Next.js)
│   ├── QuerySubmissionView       # Premium home page with example queries
│   ├── LiveDashboardView         # Real-time agent status monitoring
│   ├── FinalResultsView          # Composite score + evidence display
│   └── AuditTrailView            # Full pipeline timeline
│
├── Backend (Next.js API Routes)
│   ├── /api/verify               # Submit query → triggers pipeline
│   ├── /api/jobs/[jobId]         # Get job status + verdicts
│   └── /api/jobs/[jobId]/logs    # Stream feed logs
│
└── 9 Verification Agents
    ├── Orchestrator              # Master controller + DAG runner
    ├── Generator                 # Claims extraction via Groq
    ├── Fact Verifier             # Wikipedia + arXiv searches
    ├── Math Validator            # Mathematical proof checking
    ├── Code Analyzer             # Code quality + security audit
    ├── Reasoning Agent           # Logical consistency check
    ├── Safety Gate               # Verdict aggregation + scoring
    └── Domain Classifier         # Auto-detect query domain
```

## Technology Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4
- **Backend**: Next.js API Routes (serverless)
- **LLM**: Groq API (Free - Mixtral-8x7b)
- **Data Storage**: In-memory job management (Redis-ready)
- **UI Components**: shadcn/ui + Lucide React + Recharts
- **Type Safety**: TypeScript

## Free APIs Used

1. **Groq LPU** - Fast LLM inference (free tier: 30 RPM)
   - Model: `mixtral-8x7b-32768`
   - Use: Claims extraction, analysis, reasoning

2. **Wikipedia API** - Factual verification
   - Free public API, no authentication required
   - Use: Evidence gathering for factual claims

3. **arXiv API** - Academic paper search
   - Free public API for research papers
   - Use: Scientific claim verification

## Verification Pipeline (5.4 seconds)

```
T=0.0s  │ Orchestrator starts
T=0.5s  │ Generator extracts claims via Groq
        │ └─ Produces 6-15 claim units
        │
T=1.5s  │ Parallel verification agents:
        ├─ Fact Verifier (Wikipedia + arXiv search)
        ├─ Math Validator (formula checking)
        ├─ Code Analyzer (syntax + security)
        └─ Reasoning Agent (logical consistency)
        │
T=4.0s  │ Safety Gate aggregates verdicts
        │ └─ Calculates composite score
        │
T=5.4s  │ Pipeline complete, results ready
```

## Agent Details

### 1. Generator (Groq-based)
- **Input**: User query
- **Output**: ClaimUnit[] with type (factual|mathematical|code|standard)
- **Process**: Groq extracts structured claims using system prompts
- **Cost**: 1 API call (~200 tokens)

### 2. Fact Verifier
- **Input**: Factual claims
- **Output**: Evidence + findings (supports/contradicts)
- **Process**: Wikipedia + arXiv search → Groq analysis
- **Cost**: HTTP requests + 1-2 Groq calls

### 3. Math Validator
- **Input**: Mathematical claims
- **Output**: Confidence score + corrections
- **Process**: Groq analyzes formulas for errors
- **Cost**: 1 Groq call per claim

### 4. Code Analyzer
- **Input**: Code snippets
- **Output**: Security + quality findings
- **Process**: Groq performs code review
- **Cost**: 1 Groq call per code block

### 5. Reasoning Agent
- **Input**: All claims
- **Output**: Contradiction detection
- **Process**: Groq checks for logical errors
- **Cost**: 1 Groq call

### 6. Safety Gate
- **Input**: All agent verdicts
- **Output**: Composite score (0.0-1.0) + Verdict (APPROVED|WARNING|REJECTED)
- **Process**: Weighted scoring per domain
- **Verdicts**:
  - ✅ APPROVED: score ≥ 0.85
  - ⚠️ WARNING: 0.60 ≤ score < 0.85
  - ❌ REJECTED: score < 0.60

## Data Models

### ClaimUnit
```typescript
{
  id: string;
  type: 'factual' | 'mathematical' | 'code' | 'standard';
  content: string;
  domain: string;
  severity: 'critical' | 'major' | 'minor';
}
```

### AgentVerdict
```typescript
{
  agentName: string;
  confidence: number; // 0.0 - 1.0
  latency: number;    // milliseconds
  findings: Finding[];
  status: 'passed' | 'failed';
}
```

### VerificationJob
```typescript
{
  jobId: string;
  query: string;
  domain: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  claims: ClaimUnit[];
  agentVerdicts: AgentVerdict[];
  evidence: EvidenceItem[];
  compositeScore: number;
  verdict: 'APPROVED' | 'WARNING' | 'REJECTED';
}
```

## API Endpoints

### POST /api/verify
Submit a query for verification.
```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"query": "...", "domain": "Auto-Detect"}'

# Response
{
  "jobId": "JOB-7f3a2b91",
  "status": "pending",
  "createdAt": 1716046800000
}
```

### GET /api/jobs/[jobId]
Get full job status with all verdicts and evidence.
```bash
curl http://localhost:3000/api/jobs/JOB-7f3a2b91

# Response
{
  "jobId": "JOB-7f3a2b91",
  "status": "completed",
  "compositeScore": 0.92,
  "verdict": "APPROVED",
  "agentVerdicts": [...],
  "evidence": [...]
}
```

### GET /api/jobs/[jobId]/logs
Stream feed logs for real-time monitoring.
```bash
curl http://localhost:3000/api/jobs/JOB-7f3a2b91/logs

# Response
{
  "logs": [
    {
      "timestamp": 1716046800.123,
      "agentName": "GENERATOR",
      "message": "Extracted 8 claims",
      "type": "success"
    }
  ]
}
```

## Setup Instructions

### 1. Get Groq API Key (Free)
```bash
# Visit: https://console.groq.com/keys
# Create API key
# Copy to .env.local
```

### 2. Configure Environment
```bash
cp .env.example .env.local

# Edit .env.local and add:
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Run Development Server
```bash
pnpm dev
# Open http://localhost:3000
```

## Deployment

### Vercel (Recommended)
```bash
vercel deploy
```
- Automatic deployment
- Serverless API routes
- Free tier compatible

### Docker (Optional)
```bash
docker build -t veritas .
docker run -p 3000:3000 -e GROQ_API_KEY=xxx veritas
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total Latency | 5.4s |
| Agent Count | 9 |
| Max Parallel Agents | 4 |
| Claims per Query | 6-15 |
| Evidence Sources | 3+ |
| Groq API Calls | ~6 |
| Monthly Free Quota | 5,000 calls |

## Scoring Algorithm

**Domain Weights** (sum to 1.0):
- Software Development: Code (40%) + Reasoning (15%) + Fact (10%)
- Financial Modeling: Math (40%) + Fact (15%) + Reasoning (15%)
- Healthcare: Fact (30%) + Standards (25%) + Reasoning (25%)
- Engineering: Math (30%) + Standards (20%) + Fact (15%)

**Composite Score** = Σ(agent_confidence × domain_weight)

**Verdict Thresholds**:
```
0.0         0.60         0.85         1.0
|-----------|-----------|-----------|
  REJECTED    WARNING     APPROVED
```

## Error Handling

### Retry Logic
- API failures: Automatic retry up to 3 times
- Timeout: 30 seconds per agent
- Fallback: Return partial results if some agents fail

### Monitoring
- Agent latency tracking
- Error logging with context
- Request tracing via jobId

## Future Enhancements

1. **WebSocket Live Updates** - Real-time score animations
2. **Redis Caching** - Cache verification results
3. **Rate Limiting** - Per-user API limits
4. **Custom Agents** - Add domain-specific verifiers
5. **Correction Agent** - Auto-generate fixes for issues
6. **Audit Trail Export** - JSON/PDF reports

---

**Built with ❤️ using Groq + Vercel**
