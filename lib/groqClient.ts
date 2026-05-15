import Groq from 'groq-sdk';

let groqInstance: Groq | null = null;

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

export async function callGroqAPI(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.7,
  maxTokens: number = 2000
): Promise<string> {
  const groq = initGroqClient();

  try {
    const chatCompletion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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

    return content;
  } catch (error: any) {
    // Handle rate limiting gracefully
    if (error?.status === 429) {
      console.warn('[VERITAS] Groq rate limit hit, retrying in 2s...');
      await new Promise((r) => setTimeout(r, 2000));
      return callGroqAPI(systemPrompt, userPrompt, temperature, maxTokens);
    }
    console.error('[VERITAS] Groq API error:', error?.message || error);
    throw error;
  }
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
