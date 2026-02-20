const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  try {
    const { githubUrl } = await req.json();

    if (!githubUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'GitHub URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse GitHub URL — supports both tree and blob formats:
    // https://github.com/owner/repo/tree/branch/path/to/skill
    // https://github.com/owner/repo/blob/SHA/path/to/file.md  (parent dir used as skill dir)
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
      // For blob URLs, use the parent directory of the file as the skill dir
      const filePath = blobMatch[4];
      const parts = filePath.split('/');
      parts.pop(); // remove filename
      dirPath = parts.join('/');
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo/tree/branch/path or a blob file URL.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = Deno.env.get('GITHUB_TOKEN');
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SkillsVault',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Get the tree for the given ref
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
    console.log('Fetching tree:', treeUrl);

    let treeRes = await fetch(treeUrl, { headers });

    // If 401, the token is invalid — retry without auth (works for public repos)
    if (treeRes.status === 401 && token) {
      console.warn('GitHub token returned 401, retrying without auth');
      delete headers['Authorization'];
      treeRes = await fetch(treeUrl, { headers });
    }

    if (!treeRes.ok) {
      const err = await treeRes.text();
      console.error('GitHub tree error:', err);
      return new Response(
        JSON.stringify({ success: false, error: `GitHub API error: ${treeRes.status} ${treeRes.statusText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const treeData = await treeRes.json();
    const allItems: GitHubTreeItem[] = treeData.tree || [];

    // Filter to files inside dirPath
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

    // Fetch file contents
    const files: Array<{ filename: string; content: string }> = [];

    for (const item of relevantItems) {
      // Remove the prefix to get relative path
      const relativePath = item.path.slice(prefix.length);

      const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${item.sha}`;
      const blobRes = await fetch(blobUrl, { headers });

      if (!blobRes.ok) {
        console.error('Failed to fetch blob:', item.path);
        continue;
      }

      const blob = await blobRes.json();
      let content = '';

      if (blob.encoding === 'base64') {
        // Decode base64 to text (best-effort; binary files may garble but that's acceptable)
        try {
          const binaryStr = atob(blob.content.replace(/\n/g, ''));
          content = binaryStr;
        } catch {
          content = blob.content; // fallback: raw base64
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

    // Derive skill title from dir path
    const skillTitle = dirPath ? dirPath.split('/').pop() || 'Imported Skill' : `${repo} skill`;

    return new Response(
      JSON.stringify({ success: true, skillTitle, files }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
