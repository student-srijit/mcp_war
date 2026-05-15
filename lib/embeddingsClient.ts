/**
 * HuggingFace Embeddings Client — RAG & Semantic Similarity
 * Signup: https://huggingface.co/settings/tokens | Free tier available
 * Env: HUGGINGFACE_API_KEY
 * Model: sentence-transformers/all-MiniLM-L6-v2
 */

const HF_API = 'https://api-inference.huggingface.co';
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

function isHFConfigured(): boolean {
  return !!process.env.HUGGINGFACE_API_KEY;
}

/**
 * Get embedding vector for a text string
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (!isHFConfigured()) return null;

  try {
    const res = await fetch(`${HF_API}/pipeline/feature-extraction/${EMBEDDING_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text.slice(0, 512), options: { wait_for_model: true } }),
    });

    if (!res.ok) {
      console.error(`[HF] Embedding failed: ${res.status}`);
      return null;
    }

    const data = await res.json();
    // The API returns [[...vector...]] for single input
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0];
    }
    return null;
  } catch (error) {
    console.error('[HF] getEmbedding error:', error);
    return null;
  }
}

/**
 * Get batch embeddings for multiple texts
 */
export async function getBatchEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  if (!isHFConfigured() || texts.length === 0) return texts.map(() => null);

  try {
    const res = await fetch(`${HF_API}/pipeline/feature-extraction/${EMBEDDING_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: texts.map(t => t.slice(0, 512)), options: { wait_for_model: true } }),
    });

    if (!res.ok) return texts.map(() => null);

    const data = await res.json();
    if (Array.isArray(data)) return data;
    return texts.map(() => null);
  } catch (error) {
    console.error('[HF] getBatchEmbeddings error:', error);
    return texts.map(() => null);
  }
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Compare semantic similarity of two texts (0.0 - 1.0)
 */
export async function semanticSimilarity(text1: string, text2: string): Promise<number> {
  const [emb1, emb2] = await Promise.all([getEmbedding(text1), getEmbedding(text2)]);
  if (!emb1 || !emb2) return 0.5; // Return neutral if embeddings unavailable
  return Math.max(0, Math.min(1, cosineSimilarity(emb1, emb2)));
}

/**
 * RAG-style relevance ranking: find the most relevant documents for a query
 */
export async function findMostRelevant(
  query: string,
  documents: { id: string; text: string }[]
): Promise<{ id: string; text: string; score: number }[]> {
  if (!isHFConfigured() || documents.length === 0) {
    return documents.map(d => ({ ...d, score: 0.5 }));
  }

  const queryEmb = await getEmbedding(query);
  if (!queryEmb) return documents.map(d => ({ ...d, score: 0.5 }));

  const docEmbeddings = await getBatchEmbeddings(documents.map(d => d.text));

  const scored = documents.map((doc, idx) => {
    const docEmb = docEmbeddings[idx];
    const score = docEmb ? cosineSimilarity(queryEmb, docEmb) : 0.5;
    return { ...doc, score: Math.max(0, Math.min(1, score)) };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export const embeddingsClient = {
  isConfigured: isHFConfigured,
  getEmbedding,
  getBatchEmbeddings,
  semanticSimilarity,
  findMostRelevant,
  cosineSimilarity,
};
