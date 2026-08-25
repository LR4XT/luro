import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPty,
  getTerminalCwd,
  killAllPtys,
  killPty,
  killPtysForWebContents,
  resizePty,
  writePty,
} from './pty-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let serverUrl = '';

function extendPath(): void {
  const extras = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  const current = process.env.PATH ?? '';
  const parts = current.split(':');
  for (const extra of extras) {
    if (!parts.includes(extra)) {
      parts.unshift(extra);
    }
  }
  process.env.PATH = parts.join(':');
}

function getEditorRoot(): string {
  if (!app.isPackaged) {
    return path.resolve(__dirname, '../..');
  }
  return app.getAppPath();
}

function isSiteRepo(dir: string): boolean {
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

function getDefaultSiteRepoPath(): string {
  return path.join(process.env.HOME ?? '', 'Documents', 'blog-site');
}

function ensureDefaultSiteRepo(repoPath: string): { created: boolean } {
  if (isSiteRepo(repoPath)) {
    return { created: false };
  }

  fs.mkdirSync(path.join(repoPath, 'post'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'post-images'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'archives'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'tags'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'tag'), { recursive: true });

  fs.writeFileSync(
    path.join(repoPath, 'index.html'),
    `<!DOCTYPE html>
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
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(repoPath, 'atom.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Blog</title>
  <id>https://example.com/</id>
  <updated>${new Date().toISOString()}</updated>
  <rights>©</rights>
</feed>
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(repoPath, 'archives', 'index.html'),
    `<!DOCTYPE html>
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
`,
    'utf-8',
  );

  fs.writeFileSync(
    path.join(repoPath, 'tags', 'index.html'),
    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>Tags</title>
</head>
<body>
  <div class="tags-container"></div>
</body>
</html>
`,
    'utf-8',
  );

  return { created: true };
}

function readSiteRepoFromConfig(userData: string): string | null {
  const siteFile = path.join(userData, '.credentials', 'site.json');
  try {
    const site = JSON.parse(fs.readFileSync(siteFile, 'utf-8')) as {
      repoPath?: string;
      autoCreated?: boolean;
    };
    if (site.repoPath && isSiteRepo(site.repoPath)) {
      if (site.autoCreated) {
        process.env.LURO_SETUP_NEEDED = '1';
      }
      return path.resolve(site.repoPath);
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSiteConfig(repoPath: string, extra: { autoCreated?: boolean } = {}): void {
  const credDir = path.join(app.getPath('userData'), '.credentials');
  fs.mkdirSync(credDir, { recursive: true, mode: 0o700 });
  const payload: { repoPath: string; autoCreated?: boolean } = { repoPath };
  if (extra.autoCreated) {
    payload.autoCreated = true;
  }
  fs.writeFileSync(
    path.join(credDir, 'site.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    { mode: 0o600 },
  );
}

function defaultCandidates(): string[] {
  const home = process.env.HOME ?? '';
  const editorRoot = getEditorRoot();
  return [
    path.join(editorRoot, '..'),
    getDefaultSiteRepoPath(),
    path.join(home, 'Sites', 'blog'),
  ];
}

/**
 * Resolve a site repo without blocking the UI.
 * Prefer env / saved config / known candidates; otherwise create
 * ~/Documents/blog-site and open the app into Settings.
 */
function resolveSiteRepo(): string {
  process.env.ELECTRON_RUN = '1';
  process.env.EDITOR_ROOT = getEditorRoot();
  process.env.USER_DATA_ROOT = app.getPath('userData');
  process.env.LURO_SETUP_NEEDED = '0';
  extendPath();

  if (process.env.SITE_REPO && isSiteRepo(process.env.SITE_REPO)) {
    return path.resolve(process.env.SITE_REPO);
  }

  const configured = readSiteRepoFromConfig(app.getPath('userData'));
  if (configured) {
    process.env.SITE_REPO = configured;
    return configured;
  }

  for (const candidate of defaultCandidates()) {
    if (isSiteRepo(candidate)) {
      const resolved = path.resolve(candidate);
      process.env.SITE_REPO = resolved;
      saveSiteConfig(resolved);
      return resolved;
    }
  }

  const fallback = getDefaultSiteRepoPath();
  const { created } = ensureDefaultSiteRepo(fallback);
  const resolved = path.resolve(fallback);
  process.env.SITE_REPO = resolved;
  process.env.LURO_SETUP_NEEDED = '1';
  saveSiteConfig(resolved, { autoCreated: created || true });
  return resolved;
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'luro',
    webPreferences: {
      // Must be CJS: sandboxed preload does not support ESM ("type": "module").
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const setupNeeded = process.env.LURO_SETUP_NEEDED === '1';
  const url = setupNeeded ? `${serverUrl}/?setup=1` : serverUrl;
  const webContentsId = mainWindow.webContents.id;
  await mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    killPtysForWebContents(webContentsId);
    mainWindow = null;
  });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  const repo = resolveSiteRepo();
  console.log(`Site repo: ${repo}`);

  const serverModule = await import('../server/index.js');
  const { url } = await serverModule.startServer({ serveStatic: true, port: 3456 });
  serverUrl = url;

  ipcMain.handle('pick-folder', async () => {
    const options = {
      title: '选择博客静态站点目录',
      message: '请选择包含 index.html、post/ 和 atom.xml 的仓库目录',
      defaultPath: path.join(process.env.HOME ?? '', 'Documents'),
      properties: ['openDirectory' as const],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const dir = result.filePaths[0];
    if (!isSiteRepo(dir)) {
      const boxOptions = {
        type: 'warning' as const,
        message: '所选目录不是有效的博客仓库',
        detail: '请选择包含 index.html、post/ 和 atom.xml 的目录。',
      };
      if (mainWindow) {
        await dialog.showMessageBox(mainWindow, boxOptions);
      } else {
        await dialog.showMessageBox(boxOptions);
      }
      return null;
    }
    return dir;
  });

  ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle(
    'terminal:create',
    (event, payload: { cols?: number; rows?: number }) => {
      return createPty(
        event.sender.id,
        payload?.cols ?? 80,
        payload?.rows ?? 24,
      );
    },
  );

  ipcMain.handle(
    'terminal:write',
    (_event, payload: { id: string; data: string }) => {
      writePty(payload.id, payload.data);
    },
  );

  ipcMain.handle(
    'terminal:resize',
    (_event, payload: { id: string; cols: number; rows: number }) => {
      resizePty(payload.id, payload.cols, payload.rows);
    },
  );

  ipcMain.handle('terminal:kill', (_event, payload: { id: string }) => {
    killPty(payload.id);
  });

  ipcMain.handle('terminal:cwd', () => getTerminalCwd());

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
}

app.on('before-quit', () => {
  killAllPtys();
});

app.on('window-all-closed', () => {
  app.quit();
});

bootstrap().catch((error) => {
  console.error(error);
  dialog.showErrorBox('启动失败', (error as Error).message);
  app.quit();
});
