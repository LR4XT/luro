import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canInitializeSiteRepo,
  ensureDefaultSiteRepo,
  ensureSiteRepo,
  getDefaultSiteRepoPath,
  isSiteRepo,
  OCCUPIED_DIR_ERROR,
} from '../server/default-site.js';
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

function readSiteRepoFromConfig(userData: string): string | null {
  const siteFile = path.join(userData, '.credentials', 'site.json');
  try {
    const site = JSON.parse(fs.readFileSync(siteFile, 'utf-8')) as {
      repoPath?: string;
      autoCreated?: boolean;
    };
    if (!site.repoPath) return null;
    const resolved = path.resolve(site.repoPath);
    if (isSiteRepo(resolved) || canInitializeSiteRepo(resolved)) {
      ensureSiteRepo(resolved);
      if (site.autoCreated) {
        process.env.LURO_SETUP_NEEDED = '1';
      }
      return resolved;
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

/**
 * Resolve a site repo without blocking the UI.
 * Prefer env / saved config; otherwise create ~/Documents/blog-site
 * and open the app into Settings.
 */
function resolveSiteRepo(): string {
  process.env.ELECTRON_RUN = '1';
  process.env.EDITOR_ROOT = getEditorRoot();
  process.env.USER_DATA_ROOT = app.getPath('userData');
  process.env.LURO_SETUP_NEEDED = '0';
  extendPath();

  if (process.env.SITE_REPO) {
    const fromEnv = path.resolve(process.env.SITE_REPO);
    if (isSiteRepo(fromEnv) || canInitializeSiteRepo(fromEnv)) {
      ensureSiteRepo(fromEnv);
      return fromEnv;
    }
  }

  const configured = readSiteRepoFromConfig(app.getPath('userData'));
  if (configured) {
    process.env.SITE_REPO = configured;
    return configured;
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
  // Port 0 picks a free port. A fixed one would let the app attach to whatever
  // already owns it — e.g. a `npm run dev` server pointing at another site repo.
  const { url } = await serverModule.startServer({ serveStatic: true, port: 0 });
  serverUrl = url;

  ipcMain.handle('pick-folder', async () => {
    const options = {
      title: '选择博客站点目录',
      message: '可选择空文件夹（将自动初始化），或已有的静态站点仓库',
      defaultPath: getDefaultSiteRepoPath(),
      properties: ['openDirectory' as const, 'createDirectory' as const],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const dir = result.filePaths[0];
    if (isSiteRepo(dir) || canInitializeSiteRepo(dir)) {
      return dir;
    }
    const boxOptions = {
      type: 'warning' as const,
      message: '无法使用所选目录',
      detail: OCCUPIED_DIR_ERROR,
    };
    if (mainWindow) {
      await dialog.showMessageBox(mainWindow, boxOptions);
    } else {
      await dialog.showMessageBox(boxOptions);
    }
    return null;
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
