import { NextRequest, NextResponse } from 'next/server';
import { githubClient, parseGitHubUrl } from '@/lib/githubClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, owner, repo, path } = body;

    let targetOwner = owner;
    let targetRepo = repo;
    let targetPath = path;

    if (url) {
      const parsed = parseGitHubUrl(url);
      if (parsed) {
        targetOwner = parsed.owner;
        targetRepo = parsed.repo;
        targetPath = parsed.path || '';
      } else {
        return NextResponse.json(
          { error: 'Invalid GitHub URL format' },
          { status: 400 }
        );
      }
    }

    if (!targetOwner || !targetRepo) {
      return NextResponse.json(
        { error: 'Repository owner and name are required' },
        { status: 400 }
      );
    }

    if (targetPath) {
      // Read specific file
      const file = await githubClient.readFile(targetOwner, targetRepo, targetPath);
      if (!file) {
        return NextResponse.json(
          { error: 'File not found or cannot be read' },
          { status: 404 }
        );
      }
      return NextResponse.json({ type: 'file', data: file });
    } else {
      // Get repo info and tree
      const info = await githubClient.getRepoInfo(targetOwner, targetRepo);
      if (!info) {
        return NextResponse.json(
          { error: 'Repository not found' },
          { status: 404 }
        );
      }
      const tree = await githubClient.getRepoTree(targetOwner, targetRepo);
      return NextResponse.json({ type: 'repo', info, tree });
    }

  } catch (error) {
    console.error('[API] GitHub route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
