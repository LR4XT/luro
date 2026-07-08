import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import multer from 'multer';
import {
  DEV_CLIENT_URL,
  EDITOR_ROOT,
  getPostImagesDir,
  getRepoRoot,
  IS_ELECTRON,
} from './config.js';
import { getPostDetail, listExistingPosts, publishPost, deletePosts } from './publish/index.js';
import { createTag, listTags } from './tags/index.js';
import { listSiteNav, saveSiteNav } from './pages/index.js';
import { readThemes } from './themes/index.js';
import {
  applySiteThemeToRepo,
  getSiteThemesResponse,
  importSiteTheme,
} from './themes/site.js';
import {
  getRemoteConfigPublic,
  saveAndApplyRemoteConfig,
  testRemoteConnection,
} from './remote/index.js';
import { readSiteConfig, writeSiteConfig } from './site-config.js';
import { getGitStatus, pullLatest, pushLocalChanges } from './utils/git.js';
import { titleToSlug } from './utils/text.js';

function isValidRepo(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'index.html')) &&
    fs.existsSync(path.join(dir, 'post')) &&
    fs.existsSync(path.join(dir, 'atom.xml'))
  );
}

export function createApp(options: { serveStatic?: boolean } = {}): Express {
  const app = express();
  const serveStatic = options.serveStatic ?? IS_ELECTRON;

  const upload = multer({
    storage: multer.diskStorage({
      destination: async (_req, _file, cb) => {
        const dir = getPostImagesDir();
        await fsPromises.mkdir(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      cb(null, /^image\//.test(file.mimetype));
    },
  });

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/assets', express.static(getRepoRoot(), { index: false }));

  if (serveStatic) {
    const staticDir = path.join(EDITOR_ROOT, 'dist');
    app.use(express.static(staticDir));
  } else {
    app.get('/', (_req, res) => {
      res.redirect(302, DEV_CLIENT_URL);
    });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, repoRoot: getRepoRoot(), electron: IS_ELECTRON });
  });

  app.get('/api/site-config', async (_req, res) => {
    const config = await readSiteConfig();
    res.json({ config, repoRoot: getRepoRoot() });
  });

  app.post('/api/site-config', async (req, res) => {
    try {
      const repoPath = String(req.body.repoPath ?? '').trim();
      if (!repoPath || !isValidRepo(repoPath)) {
        res.status(400).json({ error: '无效的博客仓库路径' });
        return;
      }
      await writeSiteConfig({ repoPath });
      process.env.SITE_REPO = repoPath;
      res.json({ ok: true, repoPath, message: '已保存，请重启应用生效' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/sync', async (_req, res) => {
    try {
      const pull = await pullLatest();
      const posts = await listExistingPosts();
      res.json({ ...pull, posts });
    } catch (error) {
      try {
        const posts = await listExistingPosts();
        res.json({
          success: false,
          summary: (error as Error).message,
          branch: 'unknown',
          posts,
        });
      } catch {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  });

  app.get('/api/posts', async (_req, res) => {
    try {
      res.json({ posts: await listExistingPosts() });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/posts/:slug', async (req, res) => {
    try {
      res.json({ post: await getPostDetail(req.params.slug) });
    } catch (error) {
      res.status(404).json({ error: (error as Error).message });
    }
  });

  app.post('/api/posts/delete', async (req, res) => {
    try {
      const slugs = Array.isArray(req.body.slugs) ? req.body.slugs.map(String) : [];
      const result = await deletePosts(slugs);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/tags', async (_req, res) => {
    try {
      res.json({ tags: await listTags() });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/tags', async (req, res) => {
    try {
      const name = String(req.body.name ?? '').trim();
      if (!name) {
        res.status(400).json({ error: '标签名不能为空' });
        return;
      }
      res.json({ tag: await createTag(name) });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get('/api/pages', async (_req, res) => {
    try {
      res.json({ items: await listSiteNav() });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/pages', async (req, res) => {
    try {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      const result = await saveSiteNav(items);
      res.json({
        items: result.items,
        updatedFiles: result.updatedFiles,
        message: `已更新 ${result.updatedFiles} 个页面`,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/themes', async (_req, res) => {
    try {
      const config = await readThemes();
      const siteState = await getSiteThemesResponse();
      res.json({
        editor: config.editor,
        site: siteState.site,
        activeSiteThemeId: siteState.activeSiteThemeId,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/themes/site/apply', async (req, res) => {
    try {
      const themeId = String(req.body.themeId ?? '');
      if (!themeId) {
        res.status(400).json({ error: '缺少 themeId' });
        return;
      }
      const result = await applySiteThemeToRepo(themeId);
      res.json({
        theme: result.theme,
        updatedFiles: result.updatedFiles,
        message: `已将网站主题切换为 ${result.theme.name}，更新了 ${result.updatedFiles} 个页面`,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/themes/site/import', async (req, res) => {
    try {
      const name = String(req.body.name ?? '');
      const css = String(req.body.css ?? '');
      const imported = await importSiteTheme(name, css);
      res.json({
        theme: imported.theme,
        site: imported.updatedConfig.site,
        message: `已导入主题 ${imported.theme.name}`,
      });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/git/status', async (_req, res) => {
    try {
      res.json(await getGitStatus());
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/push', async (req, res) => {
    try {
      const commitMessage = req.body.commitMessage ? String(req.body.commitMessage) : undefined;
      res.json(await pushLocalChanges(commitMessage));
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get('/api/remote/config', async (_req, res) => {
    try {
      res.json({ config: await getRemoteConfigPublic() });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/remote/config', async (req, res) => {
    try {
      res.json(await saveAndApplyRemoteConfig(req.body));
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post('/api/remote/test', async (_req, res) => {
    try {
      res.json(await testRemoteConnection());
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post('/api/slug', (req, res) => {
    res.json({ slug: titleToSlug(String(req.body.title ?? '')) });
  });

  app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: '未收到图片文件' });
      return;
    }
    const filename = req.file.filename;
    res.json({
      filename,
      url: `/post-images/${filename}`,
      absoluteUrl: `https://lr4xt.com/post-images/${filename}`,
      markdown: `![](/post-images/${filename})`,
    });
  });

  app.post('/api/publish', async (req, res) => {
    try {
      const { title, date, markdown, tags, featureImage, slug, keywords, push, commitMessage, themeId, update } =
        req.body;
      if (!title || !date || !markdown) {
        res.status(400).json({ error: '标题、日期和正文为必填项' });
        return;
      }
      res.json(
        await publishPost({
          title: String(title),
          date: String(date),
          markdown: String(markdown),
          tags: Array.isArray(tags) ? tags.map(String) : [],
          featureImage: featureImage ? String(featureImage) : undefined,
          slug: slug ? String(slug) : undefined,
          keywords: keywords ? String(keywords) : undefined,
          push: Boolean(push),
          update: Boolean(update),
          commitMessage: commitMessage ? String(commitMessage) : undefined,
          themeId: themeId ? String(themeId) : undefined,
        }),
      );
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  if (serveStatic) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(EDITOR_ROOT, 'dist', 'index.html'));
    });
  }

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  return app;
}

export async function startServer(options: { port?: number; serveStatic?: boolean } = {}) {
  const port = options.port ?? 3456;
  const app = createApp({ serveStatic: options.serveStatic });

  await new Promise<void>((resolve) => {
    app.listen(port, '127.0.0.1', () => resolve());
  });

  const url = `http://127.0.0.1:${port}`;
  console.log(`Blog editor running at ${url}`);
  console.log(`Site repo: ${getRepoRoot()}`);

  try {
    const pull = await pullLatest();
    console.log(`[sync] ${pull.summary}`);
  } catch (error) {
    console.warn(`[sync] ${(error as Error).message}`);
  }

  return { app, port, url };
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  startServer({ serveStatic: false });
}
