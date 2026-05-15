import { callGroqAPI } from '../groqClient';

export async function classifyDomain(
  query: string,
  suggestedDomain: string
): Promise<string> {
  if (suggestedDomain !== 'Auto-Detect') {
    return suggestedDomain;
  }

  const systemPrompt = `You are a domain classification expert. Analyze the query and determine which technical domain it belongs to.
Return ONLY one of these domains:
- Structural Engineering
- Software Development
- Infrastructure & Energy
- Healthcare Systems
- Financial Modeling
- Standards Reference
- General Technical`;

  const response = await callGroqAPI(systemPrompt, query, 0.3, 200);
  const domain = response.split('\n')[0].trim();

  const validDomains = [
    'Structural Engineering',
    'Software Development',
    'Infrastructure & Energy',
    'Healthcare Systems',
    'Financial Modeling',
    'Standards Reference',
    'General Technical',
  ];

  return validDomains.includes(domain) ? domain : 'General Technical';
}
