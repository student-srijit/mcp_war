import { NextResponse } from 'next/server';
import { ToolStatus } from '@/lib/schemas';

export async function GET() {
  const tools: ToolStatus[] = [
    {
      name: 'Groq LLM',
      envVar: 'GROQ_API_KEY',
      configured: !!process.env.GROQ_API_KEY,
      description: 'Core intelligence engine for analysis and reasoning.',
      freeLimit: '30 RPM (Free Tier)',
      signupUrl: 'https://console.groq.com/keys',
    },
    {
      name: 'GitHub',
      envVar: 'GITHUB_TOKEN',
      configured: !!process.env.GITHUB_TOKEN,
      description: 'Reads repositories, files, and analyzes code patterns.',
      freeLimit: '5,000 req/hr (with token)',
      signupUrl: 'https://github.com/settings/tokens',
    },
    {
      name: 'Google Search (Serper)',
      envVar: 'SERPER_API_KEY',
      configured: !!process.env.SERPER_API_KEY,
      description: 'Fact verification via Google Web, Scholar, and News.',
      freeLimit: '2,500 free searches',
      signupUrl: 'https://serper.dev',
    },
    {
      name: 'Code Execution (Judge0)',
      envVar: 'JUDGE0_API_KEY (or JUDGE0_USE_PISTON=true)',
      configured: !!process.env.JUDGE0_API_KEY || (process.env.JUDGE0_USE_PISTON || 'true').toLowerCase() === 'true',
      description: 'Secure sandbox to run and test code snippets.',
      freeLimit: 'Free tier available',
      signupUrl: 'https://rapidapi.com/judge0-official/api/judge0-ce',
    },
    {
      name: 'Embeddings (HuggingFace)',
      envVar: 'HUGGINGFACE_API_KEY',
      configured: !!process.env.HUGGINGFACE_API_KEY,
      description: 'Semantic similarity and RAG for detecting contradictions.',
      freeLimit: 'Free inference API',
      signupUrl: 'https://huggingface.co/settings/tokens',
    },
    {
      name: 'Wolfram Alpha',
      envVar: 'WOLFRAM_APP_ID',
      configured: !!process.env.WOLFRAM_APP_ID,
      description: 'Real mathematical computation and formula verification.',
      freeLimit: '2,000 queries/month',
      signupUrl: 'https://developer.wolframalpha.com/access',
    },
    {
      name: 'StackExchange',
      envVar: 'None required',
      configured: true,
      description: 'Search StackOverflow for known bugs and best practices.',
      freeLimit: '10,000 req/day',
      signupUrl: 'https://api.stackexchange.com',
    },
  ];

  return NextResponse.json({ tools });
}
