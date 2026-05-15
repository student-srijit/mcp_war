import { parseJSONFromGroq } from '../groqClient';
import { ClaimUnit } from '../schemas';

export async function generateClaims(
  query: string,
  domain: string,
  options?: {
    systemPromptOverride?: string;
  }
): Promise<ClaimUnit[]> {
  const systemPrompt =
    options?.systemPromptOverride ??
    `You are a technical claim extraction expert. Analyze the query and extract all distinct claims.
For each claim, classify it as one of: factual, mathematical, code, standard_citation, reasoning.
Return valid JSON with this exact structure:
{
  "claims": [
    {"type": "factual|mathematical|code|standard_citation|reasoning", "content": "claim text", "severity": "critical|major|minor"}
  ]
}`;

  const userPrompt = `Domain: ${domain}\nText:\n${query}\n\nExtract all technical claims from this text. Ensure output is pure JSON.`;

  let result;
  try {
    result = await parseJSONFromGroq(systemPrompt, userPrompt);
  } catch (error) {
    console.warn('[VERITAS] Failed to parse claims JSON, using fallback claim extraction.', error);
    result = {
      claims: [
        { type: "factual", content: query.slice(0, 500) + (query.length > 500 ? "..." : ""), severity: "major" }
      ]
    };
  }

  // Safely extract claims array
  const claimsArray = Array.isArray(result.claims) ? result.claims : [];

  return claimsArray
    .slice(0, 15) // Max 15 claims per query
    .map((claim: any, idx: number) => ({
      claimId: `claim-${idx + 1}`,
      claimType: (claim.type || 'factual') as 'factual' | 'mathematical' | 'code' | 'standard_citation' | 'reasoning',
      content: claim.content || '',
      domain,
      severity: claim.severity || 'minor',
      position: idx,
    }))
    .filter((claim) => claim.content.length > 0);
}
