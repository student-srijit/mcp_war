/**
 * Wolfram Alpha Client — Real Math Computation
 * Signup: https://developer.wolframalpha.com/access | Free: 2,000 queries/mo
 * Env: WOLFRAM_APP_ID
 */

const WOLFRAM_API = 'https://api.wolframalpha.com/v2';
const WOLFRAM_SHORT = 'https://api.wolframalpha.com/v1/result';

function isWolframConfigured(): boolean {
  return !!process.env.WOLFRAM_APP_ID;
}

export interface WolframResult {
  success: boolean;
  input: string;
  result: string;
  pods: { title: string; text: string }[];
  error?: string;
}

/**
 * Get a short plain-text answer from Wolfram Alpha
 */
export async function computeShort(query: string): Promise<{ success: boolean; result: string }> {
  if (!isWolframConfigured()) {
    return { success: false, result: 'Wolfram Alpha not configured' };
  }

  try {
    const url = `${WOLFRAM_SHORT}?appid=${process.env.WOLFRAM_APP_ID}&i=${encodeURIComponent(query)}&timeout=10`;
    const res = await fetch(url);

    if (!res.ok) {
      return { success: false, result: `Wolfram API error: ${res.status}` };
    }

    const text = await res.text();
    return { success: true, result: text.slice(0, 1000) };
  } catch (error) {
    console.error('[Wolfram] computeShort error:', error);
    return { success: false, result: 'Wolfram computation failed' };
  }
}

/**
 * Get full computation result with multiple pods
 */
export async function computeFull(query: string): Promise<WolframResult> {
  if (!isWolframConfigured()) {
    return { success: false, input: query, result: '', pods: [], error: 'Wolfram Alpha not configured' };
  }

  try {
    const url = `${WOLFRAM_API}/query?appid=${process.env.WOLFRAM_APP_ID}&input=${encodeURIComponent(query)}&output=json&format=plaintext&podtimeout=8`;
    const res = await fetch(url);

    if (!res.ok) {
      return { success: false, input: query, result: '', pods: [], error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const qr = data.queryresult;

    if (!qr || !qr.success) {
      return { success: false, input: query, result: '', pods: [], error: qr?.error?.msg || 'No result' };
    }

    const pods = (qr.pods || []).map((pod: any) => ({
      title: pod.title || '',
      text: (pod.subpods || []).map((sp: any) => sp.plaintext || '').filter(Boolean).join('\n'),
    })).filter((p: any) => p.text);

    // The "Result" or "Decimal approximation" pod is typically the answer
    const resultPod = pods.find((p: any) => p.title === 'Result' || p.title === 'Decimal approximation' || p.title === 'Exact result');
    const result = resultPod?.text || pods[1]?.text || pods[0]?.text || '';

    return { success: true, input: query, result, pods };
  } catch (error) {
    console.error('[Wolfram] computeFull error:', error);
    return { success: false, input: query, result: '', pods: [], error: String(error) };
  }
}

/**
 * Verify a mathematical expression by computing it
 */
export async function verifyMath(expression: string): Promise<{
  verified: boolean;
  computedResult: string;
  details: string;
}> {
  const result = await computeShort(expression);
  if (result.success) {
    return { verified: true, computedResult: result.result, details: `Wolfram Alpha computed: ${result.result}` };
  }
  // Fallback to full query
  const fullResult = await computeFull(expression);
  if (fullResult.success) {
    return { verified: true, computedResult: fullResult.result, details: fullResult.pods.map(p => `${p.title}: ${p.text}`).join(' | ') };
  }
  return { verified: false, computedResult: '', details: fullResult.error || 'Computation failed' };
}

export const wolframClient = { isConfigured: isWolframConfigured, computeShort, computeFull, verifyMath };
