const YOU_COM_API_KEY = process.env.YOU_COM_API_KEY || process.env.NEXT_PUBLIC_YOU_COM_API_KEY;

export async function searchYouCom(query: string): Promise<{ found: boolean; snippet: string; url: string }> {
  if (!YOU_COM_API_KEY) {
    return { found: false, snippet: '', url: '' };
  }

  try {
    const res = await fetch('https://api.you.com/search/web', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${YOU_COM_API_KEY}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) return { found: false, snippet: '', url: '' };

    const data = await res.json();

    // Attempt to map to a simple result shape
    const first = (data?.web?.results && data.web.results[0]) || data?.results?.[0] || null;
    if (first) {
      return {
        found: true,
        snippet: first?.snippet || first?.summary || '',
        url: first?.url || first?.link || '',
      };
    }

    return { found: false, snippet: '', url: '' };
  } catch (error) {
    console.error('[v0] you.com search error:', error);
    return { found: false, snippet: '', url: '' };
  }
}
