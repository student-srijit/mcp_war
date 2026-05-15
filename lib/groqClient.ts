import Groq from 'groq-sdk';

let groqInstance: Groq | null = null;

/**
 * Get the configured model from env, with smart fallback chain.
 * No more hardcoded model names!
 */
const MODEL_FALLBACK_CHAIN = [
  () => process.env.GROQ_MODEL || '',
  () => 'llama-3.3-70b-versatile',
  () => 'llama-3.1-8b-instant',
  () => 'gemma2-9b-it',
];

function getDefaultModel(): string {
  const envModel = process.env.GROQ_MODEL;
  return envModel && envModel.length > 0 ? envModel : 'llama-3.3-70b-versatile';
}

export function initGroqClient(): Groq {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set. Get a free key at https://console.groq.com/keys');
    }
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
}

/**
 * Exponential backoff delay
 */
function backoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 16000);
}

/**
 * Call Groq API with multi-model fallback and exponential backoff.
 * If the primary model fails, automatically tries the next model in the chain.
 */
export async function callGroqAPI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<string> {
  const groq = initGroqClient();
  const primaryModel = getDefaultModel();
  const modelsToTry = [primaryModel, ...MODEL_FALLBACK_CHAIN.map(fn => fn()).filter(m => m && m !== primaryModel)];
  // Deduplicate
  const uniqueModels = [...new Set(modelsToTry)].filter(Boolean);

  let lastError: any = null;

  for (const model of uniqueModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        });

        const content = chatCompletion.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('No content in Groq response');
        }

        // Log token usage for monitoring
        const usage = chatCompletion.usage;
        if (usage) {
          console.log(`[VERITAS] Groq ${model}: ${usage.prompt_tokens}→${usage.completion_tokens} tokens`);
        }

        return content;
      } catch (error: any) {
        lastError = error;

        // Rate limit — backoff and retry same model
        if (error?.status === 429) {
          const delay = backoffDelay(attempt);
          console.warn(`[VERITAS] Groq rate limit on ${model}, backoff ${delay}ms (attempt ${attempt + 1}/3)`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        // Model not found or other 4xx — try next model
        if (error?.status === 404 || error?.status === 400) {
          console.warn(`[VERITAS] Model ${model} unavailable, trying next fallback...`);
          break;
        }

        // Server error — retry with backoff
        if (error?.status >= 500) {
          const delay = backoffDelay(attempt);
          console.warn(`[VERITAS] Groq server error on ${model}, retry in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        // Unknown error — try next model
        console.error(`[VERITAS] Groq ${model} error:`, error?.message || error);
        break;
      }
    }
  }

  console.error('[VERITAS] All Groq models exhausted. Last error:', lastError?.message || lastError);
  throw lastError || new Error('All Groq models failed');
}

export async function parseJSONFromGroq(
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const response = await callGroqAPI(systemPrompt, userPrompt, 0.2, 4000);

  // Try to extract JSON from response - handle both clean JSON and markdown-wrapped JSON
  const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  const rawJsonMatch = response.match(/\{[\s\S]*\}/);

  const jsonStr = jsonBlockMatch ? jsonBlockMatch[1].trim() : rawJsonMatch ? rawJsonMatch[0] : null;

  if (!jsonStr) {
    console.error('[VERITAS] Could not extract JSON from Groq response:', response.slice(0, 300));
    throw new Error('Could not parse JSON from Groq response');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('[VERITAS] JSON parse error:', parseError, 'Raw:', jsonStr.slice(0, 300));
    throw new Error('Invalid JSON in Groq response');
  }
}
