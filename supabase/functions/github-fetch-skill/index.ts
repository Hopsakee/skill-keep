import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GitHubTreeItem {
  path: string;
  type: string;
  sha: string;
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── JWT validation ─────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const { githubUrl } = await req.json();

    if (!githubUrl || typeof githubUrl !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'GitHub URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate it is actually a github.com URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(githubUrl);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (parsedUrl.hostname !== 'github.com') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only github.com URLs are supported' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse GitHub URL
    const treePattern = /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(\/(.+))?/;
    const blobPattern = /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/;

    let owner: string, repo: string, ref: string, dirPath: string;

    const treeMatch = githubUrl.match(treePattern);
    const blobMatch = githubUrl.match(blobPattern);

    if (treeMatch) {
      owner = treeMatch[1];
      repo = treeMatch[2];
      ref = treeMatch[3];
      dirPath = treeMatch[5] || '';
    } else if (blobMatch) {
      owner = blobMatch[1];
      repo = blobMatch[2];
      ref = blobMatch[3];
      const filePath = blobMatch[4];
      const parts = filePath.split('/');
      parts.pop();
      dirPath = parts.join('/');
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo/tree/branch/path or a blob file URL.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const githubToken = Deno.env.get('GITHUB_TOKEN');
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SkillKeep',
    };
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;

    let treeRes = await fetch(treeUrl, { headers });

    if (treeRes.status === 401 && githubToken) {
      console.warn('GitHub token auth failed, retrying without auth');
      delete headers['Authorization'];
      treeRes = await fetch(treeUrl, { headers });
    }

    if (!treeRes.ok) {
      console.error('GitHub tree fetch failed:', treeRes.status);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch from GitHub. Check that the repository is public and the URL is correct.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const treeData = await treeRes.json();
    const allItems: GitHubTreeItem[] = treeData.tree || [];

    const prefix = dirPath ? dirPath + '/' : '';
    const relevantItems = allItems.filter(
      (item) => item.type === 'blob' && item.path.startsWith(prefix)
    );

    if (relevantItems.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No files found in the specified directory' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const files: Array<{ filename: string; content: string }> = [];

    for (const item of relevantItems) {
      const relativePath = item.path.slice(prefix.length);

      const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`;
      const blobRes = await fetch(blobUrl, { headers });

      if (!blobRes.ok) {
        continue;
      }

      const blob = await blobRes.json();
      let content = '';

      if (blob.encoding === 'base64') {
        try {
          const binaryStr = atob(blob.content.replace(/\n/g, ''));
          content = binaryStr;
        } catch {
          content = blob.content;
        }
      } else {
        content = blob.content;
      }

      files.push({ filename: relativePath, content });
    }

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not read any files from the directory' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const skillTitle = dirPath ? dirPath.split('/').pop() || 'Imported Skill' : `${repo} skill`;

    return new Response(
      JSON.stringify({ success: true, skillTitle, files }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in github-fetch-skill');
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
