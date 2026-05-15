/**
 * GitHub API Client — Read code from any public repository
 *
 * Capabilities:
 * - Read individual files from repos
 * - Search code across all of GitHub
 * - List repo file trees
 * - Get repo metadata
 * - Auto-parse GitHub URLs
 *
 * Uses GITHUB_TOKEN for 5,000 req/hr (falls back to 60 req/hr unauthenticated)
 */

const GITHUB_API = 'https://api.github.com';

function getHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'VERITAS-Agent/2.0',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function isGitHubConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

export interface GitHubFile {
  name: string;
  path: string;
  content: string;
  size: number;
  encoding: string;
  url: string;
  language?: string;
}

export interface GitHubRepoInfo {
  name: string;
  fullName: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  url: string;
  topics: string[];
  license: string;
  updatedAt: string;
}

export interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

export interface GitHubSearchResult {
  found: boolean;
  totalCount: number;
  results: {
    name: string;
    path: string;
    repository: string;
    url: string;
    textMatches: string[];
  }[];
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
}

/**
 * Parse a GitHub URL into owner/repo/path components
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  // Match patterns:
  // https://github.com/owner/repo
  // https://github.com/owner/repo/blob/branch/path/to/file
  // https://github.com/owner/repo/tree/branch/path
  // github.com/owner/repo/...
  const patterns = [
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+?)(?:\/(?:blob|tree)\/([^/]+)\/(.+))?(?:\?.*)?$/,
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
        branch: match[3] || undefined,
        path: match[4] || undefined,
      };
    }
  }
  return null;
}

/**
 * Detect GitHub URLs in a text string
 */
export function extractGitHubUrls(text: string): string[] {
  const pattern = /https?:\/\/github\.com\/[^\s)>\]]+/g;
  return (text.match(pattern) || []).map(u => u.replace(/[.,;:!?)]+$/, ''));
}

/**
 * Read a single file from a GitHub repository
 */
export async function readRepoFile(
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<GitHubFile | null> {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${branch ? `?ref=${branch}` : ''}`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) {
      console.error(`[GitHub] Failed to read ${owner}/${repo}/${path}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data.type !== 'file') return null;

    const content = data.encoding === 'base64'
      ? Buffer.from(data.content, 'base64').toString('utf-8')
      : data.content;

    // Detect language from file extension
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
      h: 'c', hpp: 'cpp', rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin',
      cs: 'csharp', scala: 'scala', sh: 'bash', yml: 'yaml', yaml: 'yaml',
      json: 'json', md: 'markdown', html: 'html', css: 'css', sql: 'sql',
    };

    return {
      name: data.name,
      path: data.path,
      content,
      size: data.size,
      encoding: data.encoding,
      url: data.html_url,
      language: langMap[ext],
    };
  } catch (error) {
    console.error('[GitHub] readRepoFile error:', error);
    return null;
  }
}

/**
 * Get repository metadata
 */
export async function getRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo | null> {
  try {
    const url = `${GITHUB_API}/repos/${owner}/${repo}`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      name: data.name,
      fullName: data.full_name,
      description: data.description || '',
      language: data.language || 'Unknown',
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      defaultBranch: data.default_branch,
      url: data.html_url,
      topics: data.topics || [],
      license: data.license?.spdx_id || 'No License',
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('[GitHub] getRepoInfo error:', error);
    return null;
  }
}

/**
 * List file tree for a repository (recursive)
 */
export async function getRepoTree(
  owner: string,
  repo: string,
  branch?: string
): Promise<GitHubTreeItem[]> {
  try {
    const ref = branch || 'HEAD';
    const url = `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) return [];

    const data = await res.json();
    return (data.tree || [])
      .filter((item: any) => item.type === 'blob' || item.type === 'tree')
      .slice(0, 500) // Cap at 500 items
      .map((item: any) => ({
        path: item.path,
        type: item.type,
        size: item.size,
      }));
  } catch (error) {
    console.error('[GitHub] getRepoTree error:', error);
    return [];
  }
}

/**
 * Search code across all of GitHub
 */
export async function searchCode(
  query: string,
  language?: string
): Promise<GitHubSearchResult> {
  try {
    const q = language ? `${query} language:${language}` : query;
    const url = `${GITHUB_API}/search/code?q=${encodeURIComponent(q)}&per_page=5`;
    const res = await fetch(url, {
      headers: {
        ...getHeaders(),
        Accept: 'application/vnd.github.text-match+json',
      },
    });

    if (!res.ok) {
      return { found: false, totalCount: 0, results: [] };
    }

    const data = await res.json();
    return {
      found: data.total_count > 0,
      totalCount: data.total_count,
      results: (data.items || []).slice(0, 5).map((item: any) => ({
        name: item.name,
        path: item.path,
        repository: item.repository?.full_name || '',
        url: item.html_url,
        textMatches: (item.text_matches || []).map((m: any) => m.fragment || ''),
      })),
    };
  } catch (error) {
    console.error('[GitHub] searchCode error:', error);
    return { found: false, totalCount: 0, results: [] };
  }
}

/**
 * Search GitHub repositories
 */
export async function searchRepos(query: string): Promise<{
  found: boolean;
  repos: { fullName: string; description: string; stars: number; url: string }[];
}> {
  try {
    const url = `${GITHUB_API}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=5`;
    const res = await fetch(url, { headers: getHeaders() });

    if (!res.ok) return { found: false, repos: [] };

    const data = await res.json();
    return {
      found: data.total_count > 0,
      repos: (data.items || []).slice(0, 5).map((r: any) => ({
        fullName: r.full_name,
        description: r.description || '',
        stars: r.stargazers_count,
        url: r.html_url,
      })),
    };
  } catch (error) {
    console.error('[GitHub] searchRepos error:', error);
    return { found: false, repos: [] };
  }
}

export const githubClient = {
  isConfigured: isGitHubConfigured,
  parseUrl: parseGitHubUrl,
  extractUrls: extractGitHubUrls,
  readFile: readRepoFile,
  getRepoInfo,
  getRepoTree,
  searchCode,
  searchRepos,
};
