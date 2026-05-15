/**
 * StackExchange Client — Developer Community Search
 * Free API, no key needed (10,000 req/day)
 * Searches StackOverflow for code patterns, errors, best practices
 */

const SE_API = 'https://api.stackexchange.com/2.3';

export interface StackQuestion {
  questionId: number;
  title: string;
  link: string;
  score: number;
  answerCount: number;
  isAnswered: boolean;
  tags: string[];
  snippet: string;
}

export interface StackAnswer {
  answerId: number;
  score: number;
  isAccepted: boolean;
  body: string;
  link: string;
}

/**
 * Search StackOverflow questions
 */
export async function searchQuestions(
  query: string,
  tags?: string[],
  pageSize = 5
): Promise<{ found: boolean; questions: StackQuestion[] }> {
  try {
    const params = new URLSearchParams({
      order: 'desc',
      sort: 'relevance',
      intitle: query.slice(0, 150),
      site: 'stackoverflow',
      pagesize: String(pageSize),
      filter: '!nKzQUR30U9',
    });
    if (tags && tags.length > 0) {
      params.set('tagged', tags.slice(0, 3).join(';'));
    }

    const res = await fetch(`${SE_API}/search/advanced?${params.toString()}`);
    if (!res.ok) return { found: false, questions: [] };

    const data = await res.json();
    const questions: StackQuestion[] = (data.items || []).slice(0, pageSize).map((q: any) => ({
      questionId: q.question_id,
      title: q.title || '',
      link: q.link || '',
      score: q.score || 0,
      answerCount: q.answer_count || 0,
      isAnswered: q.is_answered || false,
      tags: q.tags || [],
      snippet: (q.body_markdown || q.body || '').replace(/<[^>]*>/g, '').slice(0, 300),
    }));

    return { found: questions.length > 0, questions };
  } catch (error) {
    console.error('[StackExchange] searchQuestions error:', error);
    return { found: false, questions: [] };
  }
}

/**
 * Search with a broader text query (tagged search)
 */
export async function searchByTag(
  query: string,
  tag: string,
  pageSize = 3
): Promise<{ found: boolean; questions: StackQuestion[] }> {
  try {
    const params = new URLSearchParams({
      order: 'desc',
      sort: 'votes',
      q: query.slice(0, 150),
      tagged: tag,
      site: 'stackoverflow',
      pagesize: String(pageSize),
      filter: '!nKzQUR30U9',
    });

    const res = await fetch(`${SE_API}/search/advanced?${params.toString()}`);
    if (!res.ok) return { found: false, questions: [] };

    const data = await res.json();
    const questions: StackQuestion[] = (data.items || []).slice(0, pageSize).map((q: any) => ({
      questionId: q.question_id,
      title: q.title || '',
      link: q.link || '',
      score: q.score || 0,
      answerCount: q.answer_count || 0,
      isAnswered: q.is_answered || false,
      tags: q.tags || [],
      snippet: '',
    }));

    return { found: questions.length > 0, questions };
  } catch (error) {
    console.error('[StackExchange] searchByTag error:', error);
    return { found: false, questions: [] };
  }
}

/**
 * Get top answers for a specific question
 */
export async function getTopAnswers(questionId: number, limit = 3): Promise<StackAnswer[]> {
  try {
    const params = new URLSearchParams({
      order: 'desc',
      sort: 'votes',
      site: 'stackoverflow',
      pagesize: String(limit),
      filter: 'withbody',
    });

    const res = await fetch(`${SE_API}/questions/${questionId}/answers?${params.toString()}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.items || []).slice(0, limit).map((a: any) => ({
      answerId: a.answer_id,
      score: a.score || 0,
      isAccepted: a.is_accepted || false,
      body: (a.body || '').replace(/<[^>]*>/g, '').slice(0, 1000),
      link: `https://stackoverflow.com/a/${a.answer_id}`,
    }));
  } catch (error) {
    console.error('[StackExchange] getTopAnswers error:', error);
    return [];
  }
}

export const stackExchangeClient = { searchQuestions, searchByTag, getTopAnswers };
