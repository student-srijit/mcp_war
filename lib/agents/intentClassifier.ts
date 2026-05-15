import { callGroqAPI } from '../groqClient';

export async function detectIntent(query: string): Promise<'GENERATE' | 'VERIFY'> {
  const systemPrompt = `You are an intent classification expert for an AI system.
Analyze the user query and determine if the user wants the AI to GENERATE a new answer/solution, or VERIFY an existing piece of text.

Rules:
- If the query asks to "calculate", "solve", "write", "code", "explain", "find the bug", or "how to" -> return GENERATE.
- If the query asks to "verify", "validate", "check if true", "review this statement", or provides a statement of fact to be checked -> return VERIFY.

Return EXACTLY one word: GENERATE or VERIFY.`;

  try {
    const response = await callGroqAPI(systemPrompt, query, 0.1, 10);
    const intent = response.trim().toUpperCase();
    if (intent.includes('GENERATE')) return 'GENERATE';
    if (intent.includes('VERIFY')) return 'VERIFY';
    
    // Default to GENERATE if ambiguous
    return 'GENERATE';
  } catch (error) {
    console.error('[VERITAS] Intent classification error:', error);
    // Safe fallback
    return 'GENERATE';
  }
}
