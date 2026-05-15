/**
 * Serper.dev Client — Google Search API
 * Signup: https://serper.dev | Free: 2,500 searches | Env: SERPER_API_KEY
 */

const SERPER_API = 'https://google.serper.dev';

function isSerperConfigured(): boolean {
  return !!process.env.SERPER_API_KEY;
}

export interface SerperResult {
  title: string; link: string; snippet: string; position: number;
}

export async function googleSearch(query: string, num = 5): Promise<{ found: boolean; results: SerperResult[]; answerBox?: { answer: string; snippet: string } }> {
  if (!isSerperConfigured()) return { found: false, results: [] };
  try {
    const res = await fetch(`${SERPER_API}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY! },
      body: JSON.stringify({ q: query, num }),
    });
    if (!res.ok) return { found: false, results: [] };
    const data = await res.json();
    const results = (data.organic || []).slice(0, num).map((item: any, idx: number) => ({
      title: item.title || '', link: item.link || '', snippet: item.snippet || '', position: idx + 1,
    }));
    return {
      found: results.length > 0, results,
      answerBox: data.answerBox ? { answer: data.answerBox.answer || '', snippet: data.answerBox.snippet || '' } : undefined,
    };
  } catch (error) {
    console.error('[Serper] search error:', error);
    return { found: false, results: [] };
  }
}

export async function googleScholar(query: string, num = 3): Promise<{ found: boolean; papers: { title: string; link: string; snippet: string; year?: string; citedBy?: number }[] }> {
  if (!isSerperConfigured()) return { found: false, papers: [] };
  try {
    const res = await fetch(`${SERPER_API}/scholar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY! },
      body: JSON.stringify({ q: query, num }),
    });
    if (!res.ok) return { found: false, papers: [] };
    const data = await res.json();
    const papers = (data.organic || []).slice(0, num).map((p: any) => ({
      title: p.title || '', link: p.link || '', snippet: p.snippet || '', year: p.year, citedBy: p.citedBy,
    }));
    return { found: papers.length > 0, papers };
  } catch (error) {
    console.error('[Serper] scholar error:', error);
    return { found: false, papers: [] };
  }
}

export async function googleNews(query: string, num = 3): Promise<{ found: boolean; articles: { title: string; link: string; snippet: string; date: string; source: string }[] }> {
  if (!isSerperConfigured()) return { found: false, articles: [] };
  try {
    const res = await fetch(`${SERPER_API}/news`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY! },
      body: JSON.stringify({ q: query, num }),
    });
    if (!res.ok) return { found: false, articles: [] };
    const data = await res.json();
    const articles = (data.news || []).slice(0, num).map((a: any) => ({
      title: a.title || '', link: a.link || '', snippet: a.snippet || '', date: a.date || '', source: a.source || '',
    }));
    return { found: articles.length > 0, articles };
  } catch (error) {
    console.error('[Serper] news error:', error);
    return { found: false, articles: [] };
  }
}

export const serperClient = { isConfigured: isSerperConfigured, search: googleSearch, scholar: googleScholar, news: googleNews };
