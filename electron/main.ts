import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function readSiteRepoFromConfig(userData: string): string | null {
  const siteFile = path.join(userData, '.credentials', 'site.json');
  try {
    const site = JSON.parse(fs.readFileSync(siteFile, 'utf-8')) as { repoPath?: string };
    if (site.repoPath && isSiteRepo(site.repoPath)) {
      return path.resolve(site.repoPath);
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSiteConfig(repoPath: string): void {
  const credDir = path.join(app.getPath('userData'), '.credentials');
  fs.mkdirSync(credDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(credDir, 'site.json'),
    `${JSON.stringify({ repoPath }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

function defaultCandidates(): string[] {
  const home = process.env.HOME ?? '';
  const editorRoot = getEditorRoot();
  return [
    path.join(editorRoot, '..'),
    path.join(home, 'Documents', 'blog-site'),
    path.join(home, 'Sites', 'blog'),
  ];
}

async function resolveSiteRepo(): Promise<string> {
  process.env.ELECTRON_RUN = '1';
  process.env.EDITOR_ROOT = getEditorRoot();
  process.env.USER_DATA_ROOT = app.getPath('userData');
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

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择博客静态站点目录',
    properties: ['openDirectory'],
    message: '请选择包含 index.html、post/ 和 atom.xml 的仓库目录',
  });

  if (canceled || !filePaths[0] || !isSiteRepo(filePaths[0])) {
    throw new Error('未选择有效的博客仓库目录，应用无法启动');
  }

  const resolved = path.resolve(filePaths[0]);
  process.env.SITE_REPO = resolved;
  saveSiteConfig(resolved);
  return resolved;
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'LR Blog Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await mainWindow.loadURL(serverUrl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrap(): Promise<void> {
  await app.whenReady();

  try {
    const repo = await resolveSiteRepo();
    console.log(`Site repo: ${repo}`);
  } catch (error) {
    dialog.showErrorBox('启动失败', (error as Error).message);
    app.quit();
    return;
  }

  const serverModule = await import('../server/index.js');
  const { url } = await serverModule.startServer({ serveStatic: true, port: 3456 });
  serverUrl = url;

  ipcMain.handle('pick-folder', async () => {
    const options = {
      title: '选择博客静态站点目录',
      properties: ['openDirectory' as const],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const dir = result.filePaths[0];
    return isSiteRepo(dir) ? dir : null;
  });

  ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

bootstrap().catch((error) => {
  console.error(error);
  app.quit();
});
