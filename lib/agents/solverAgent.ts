import { callGroqAPI } from '../groqClient';

export async function generateInitialSolution(query: string, domain: string): Promise<string> {
  const systemPrompt = `You are a world-class expert Primary Responder AI acting as a "Solver Agent" in the domain of ${domain}.
The user is asking you to calculate, code, solve, or explain something.
Provide a highly accurate, professional, and detailed response. 
Show your work (e.g., math formulas, code blocks, or logical steps).
Your response will later be fact-checked and verified by a swarm of 9 other expert AIs, so ensure extreme precision and correctness.`;

  try {
    // We give it a high max_tokens to generate a full answer
    const response = await callGroqAPI(systemPrompt, query, 0.2, 2500);
    return response.trim();
  } catch (error) {
    console.error('[VERITAS] Solver agent error:', error);
    throw new Error('Failed to generate initial solution.');
  }
}
