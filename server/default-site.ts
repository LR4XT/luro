import fs from 'node:fs';
import path from 'node:path';

/** Default local blog site under the user's Documents folder. */
export function getDefaultSiteRepoPath(home = process.env.HOME ?? ''): string {
  return path.join(home, 'Documents', 'blog-site');
}

export function isSiteRepo(dir: string): boolean {
  try {
    return (
      fs.existsSync(path.join(dir, 'index.html')) &&
      fs.existsSync(path.join(dir, 'post')) &&
      fs.existsSync(path.join(dir, 'atom.xml'))
    );
  } catch {
    return false;
  }
}

/**
 * Create a minimal static-site scaffold so the editor can start without a
 * pre-existing GitHub Pages clone. Users can point Setting → Site repository
 * at their real repo later.
 */
export function ensureDefaultSiteRepo(repoPath: string): { created: boolean } {
  if (isSiteRepo(repoPath)) {
    return { created: false };
  }

  fs.mkdirSync(path.join(repoPath, 'post'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'post-images'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'archives'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'tags'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'tag'), { recursive: true });

  const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blog</title>
</head>
<body>
  <a class="site-title-container" href="https://example.com">
    <h1 class="site-title">Blog</h1>
  </a>
  <div class="description"><p></p></div>
  <div class="content-container" data-aos="fade-up">
  </div>
</body>
</html>
`;

  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Blog</title>
  <id>https://example.com/</id>
  <updated>${new Date().toISOString()}</updated>
  <rights>©</rights>
</feed>
`;

  const archivesHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Archives</title>
</head>
<body>
  <div class="archives-container">
  </div>
</body>
</html>
`;

  const tagsHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Tags</title>
</head>
<body>
  <div class="tags-container"></div>
</body>
</html>
`;

  fs.writeFileSync(path.join(repoPath, 'index.html'), indexHtml, 'utf-8');
  fs.writeFileSync(path.join(repoPath, 'atom.xml'), atomXml, 'utf-8');
  fs.writeFileSync(path.join(repoPath, 'archives', 'index.html'), archivesHtml, 'utf-8');
  fs.writeFileSync(path.join(repoPath, 'tags', 'index.html'), tagsHtml, 'utf-8');

  return { created: true };
}
