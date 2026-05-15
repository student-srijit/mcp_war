/**
 * Judge0 / Piston Client — Real Code Execution Sandbox
 * Judge0 via RapidAPI (free tier) or Piston (100% free, no key)
 * Env: JUDGE0_API_KEY, JUDGE0_USE_PISTON=true
 */

const PISTON_API = 'https://emkc.org/api/v2/piston';
const JUDGE0_RAPIDAPI = 'https://judge0-ce.p.rapidapi.com';

// Piston language version map (common languages)
const PISTON_LANGS: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  c: { language: 'c', version: '10.2.0' },
  cpp: { language: 'c++', version: '10.2.0' },
  java: { language: 'java', version: '15.0.2' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' },
  ruby: { language: 'ruby', version: '3.0.1' },
  php: { language: 'php', version: '8.2.3' },
  bash: { language: 'bash', version: '5.2.0' },
  csharp: { language: 'csharp', version: '6.12.0' },
};

// Judge0 language ID map
const JUDGE0_LANG_IDS: Record<string, number> = {
  python: 71, javascript: 63, typescript: 74, c: 50, cpp: 54,
  java: 62, go: 60, rust: 73, ruby: 72, php: 68, bash: 46, csharp: 51,
};

export interface CodeExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  compilationError?: string;
  executionTime?: string;
  memoryUsed?: string;
  engine: 'piston' | 'judge0' | 'none';
}

function usePiston(): boolean {
  return (process.env.JUDGE0_USE_PISTON || 'true').toLowerCase() === 'true' || !process.env.JUDGE0_API_KEY;
}

/**
 * Execute code via Piston (free, no key)
 */
async function executePiston(code: string, language: string): Promise<CodeExecutionResult> {
  const lang = PISTON_LANGS[language.toLowerCase()];
  if (!lang) {
    return { success: false, stdout: '', stderr: `Unsupported language: ${language}`, exitCode: null, engine: 'piston' };
  }

  try {
    const res = await fetch(`${PISTON_API}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: lang.language,
        version: lang.version,
        files: [{ name: `main.${language}`, content: code }],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 10000,
      }),
    });

    if (!res.ok) {
      return { success: false, stdout: '', stderr: `Piston API error: ${res.status}`, exitCode: null, engine: 'piston' };
    }

    const data = await res.json();
    const run = data.run || {};
    const compile = data.compile || {};

    return {
      success: (run.code === 0 || run.code === null) && !compile.stderr,
      stdout: (run.stdout || '').slice(0, 5000),
      stderr: (run.stderr || compile.stderr || '').slice(0, 2000),
      exitCode: run.code ?? null,
      compilationError: compile.stderr || undefined,
      executionTime: undefined,
      memoryUsed: undefined,
      engine: 'piston',
    };
  } catch (error) {
    console.error('[Piston] execution error:', error);
    return { success: false, stdout: '', stderr: `Piston error: ${error}`, exitCode: null, engine: 'piston' };
  }
}

/**
 * Execute code via Judge0 (RapidAPI free tier)
 */
async function executeJudge0(code: string, language: string): Promise<CodeExecutionResult> {
  const langId = JUDGE0_LANG_IDS[language.toLowerCase()];
  if (!langId || !process.env.JUDGE0_API_KEY) {
    return { success: false, stdout: '', stderr: 'Judge0 not configured or unsupported language', exitCode: null, engine: 'judge0' };
  }

  try {
    // Submit
    const submitRes = await fetch(`${JUDGE0_RAPIDAPI}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
        'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
      },
      body: JSON.stringify({
        source_code: Buffer.from(code).toString('base64'),
        language_id: langId,
        stdin: '',
        cpu_time_limit: 5,
        wall_time_limit: 10,
        memory_limit: 128000,
      }),
    });

    if (!submitRes.ok) {
      return { success: false, stdout: '', stderr: `Judge0 error: ${submitRes.status}`, exitCode: null, engine: 'judge0' };
    }

    const data = await submitRes.json();

    const decode = (b64: string | null) => b64 ? Buffer.from(b64, 'base64').toString('utf-8') : '';
    const stdout = decode(data.stdout).slice(0, 5000);
    const stderr = decode(data.stderr).slice(0, 2000);
    const compileErr = decode(data.compile_output).slice(0, 2000);

    return {
      success: data.status?.id === 3, // 3 = Accepted
      stdout,
      stderr: stderr || compileErr,
      exitCode: data.exit_code ?? null,
      compilationError: compileErr || undefined,
      executionTime: data.time ? `${data.time}s` : undefined,
      memoryUsed: data.memory ? `${(data.memory / 1024).toFixed(1)} MB` : undefined,
      engine: 'judge0',
    };
  } catch (error) {
    console.error('[Judge0] execution error:', error);
    return { success: false, stdout: '', stderr: `Judge0 error: ${error}`, exitCode: null, engine: 'judge0' };
  }
}

/**
 * Execute code — auto-selects Piston or Judge0
 */
export async function executeCode(code: string, language: string): Promise<CodeExecutionResult> {
  // Sanitize: don't execute dangerous code
  const dangerousPatterns = [
    /rm\s+-rf/i, /format\s+c:/i, /del\s+\/s/i,
    /os\.system/i, /subprocess/i, /child_process/i,
    /while\s*\(\s*true\s*\)/i, /for\s*\(\s*;\s*;\s*\)/i,
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      return { success: false, stdout: '', stderr: 'Code rejected: potentially dangerous operation detected', exitCode: null, engine: 'none' };
    }
  }

  if (usePiston()) {
    return executePiston(code, language);
  }
  return executeJudge0(code, language);
}

/**
 * Detect programming language from code content
 */
export function detectLanguage(code: string): string {
  if (/^(def |import |from |class \w+:|print\s*\()/.test(code)) return 'python';
  if (/\b(const|let|var)\b.*=|function\s+\w+|=>\s*{/.test(code)) return 'javascript';
  if (/:\s*(string|number|boolean|void)|interface\s+\w+/.test(code)) return 'typescript';
  if (/#include\s*</.test(code)) return code.includes('cout') || code.includes('std::') ? 'cpp' : 'c';
  if (/public\s+static\s+void\s+main/.test(code)) return 'java';
  if (/^package\s+main|func\s+main/.test(code)) return 'go';
  if (/fn\s+main|let\s+mut\s+/.test(code)) return 'rust';
  return 'python'; // default
}

export const judge0Client = { execute: executeCode, detectLanguage };
