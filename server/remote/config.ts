import fs from 'node:fs/promises';
import path from 'node:path';
import { USER_DATA_ROOT } from '../config.js';

export type RemoteAuthType = 'http' | 'ssh';

export interface RemoteConfigPublic {
  authType: RemoteAuthType;
  repoUrl: string;
  httpUsername: string;
  hasHttpPassword: boolean;
  hasSshKey: boolean;
  hasSshPassphrase: boolean;
}

export interface RemoteConfigInput {
  authType: RemoteAuthType;
  repoUrl: string;
  httpUsername?: string;
  httpPassword?: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
}

interface RemoteMeta {
  authType: RemoteAuthType;
  repoUrl: string;
  httpUsername?: string;
}

interface RemoteSecrets {
  httpPassword?: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
}

const CREDENTIALS_DIR = path.join(USER_DATA_ROOT, '.credentials');
const META_FILE = path.join(CREDENTIALS_DIR, 'remote.meta.json');
const SECRETS_FILE = path.join(CREDENTIALS_DIR, 'remote.secrets.json');
const SSH_KEY_FILE = path.join(CREDENTIALS_DIR, 'id_ed25519');
const SSH_ASKPASS_FILE = path.join(CREDENTIALS_DIR, 'ssh-askpass.sh');

const BLOCKED_GIT_ENV_KEYS = [
  'EDITOR',
  'GIT_EDITOR',
  'GIT_SEQUENCE_EDITOR',
  'VISUAL',
  'PAGER',
  'GIT_PAGER',
];

export function sanitizeGitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean = { ...env };
  for (const key of BLOCKED_GIT_ENV_KEYS) {
    delete clean[key];
  }
  clean.GIT_MERGE_AUTOEDIT = 'no';
  clean.GIT_TERMINAL_PROMPT = '0';
  return clean;
}

const DEFAULT_REPO = '';

export async function ensureCredentialsDir(): Promise<void> {
  await fs.mkdir(CREDENTIALS_DIR, { mode: 0o700, recursive: true });
}

async function readMeta(): Promise<RemoteMeta | null> {
  try {
    const raw = await fs.readFile(META_FILE, 'utf-8');
    return JSON.parse(raw) as RemoteMeta;
  } catch {
    return null;
  }
}

async function readSecrets(): Promise<RemoteSecrets> {
  try {
    const raw = await fs.readFile(SECRETS_FILE, 'utf-8');
    return JSON.parse(raw) as RemoteSecrets;
  } catch {
    return {};
  }
}

export async function getRemoteConfigPublic(): Promise<RemoteConfigPublic> {
  const meta = await readMeta();
  const secrets = await readSecrets();

  if (!meta) {
    return {
      authType: 'http',
      repoUrl: DEFAULT_REPO,
      httpUsername: '',
      hasHttpPassword: false,
      hasSshKey: false,
      hasSshPassphrase: false,
    };
  }

  return {
    authType: meta.authType,
    repoUrl: meta.repoUrl,
    httpUsername: meta.httpUsername ?? '',
    hasHttpPassword: Boolean(secrets.httpPassword),
    hasSshKey: Boolean(secrets.sshPrivateKey),
    hasSshPassphrase: Boolean(secrets.sshPassphrase),
  };
}

export async function saveRemoteConfig(input: RemoteConfigInput): Promise<RemoteConfigPublic> {
  await ensureCredentialsDir();

  const repoUrl = normalizeRepoUrl(input.repoUrl.trim());
  if (!repoUrl) throw new Error('仓库地址不能为空');

  const meta: RemoteMeta = {
    authType: input.authType,
    repoUrl,
    httpUsername: input.httpUsername?.trim() ?? '',
  };

  const secrets = await readSecrets();

  if (input.authType === 'http') {
    if (input.httpPassword !== undefined && input.httpPassword !== '') {
      secrets.httpPassword = input.httpPassword;
    }
    if (!secrets.httpPassword) {
      throw new Error('HTTP 模式需要填写 Password / Token');
    }
    if (!meta.httpUsername) {
      throw new Error('HTTP 模式需要填写 Username');
    }
    delete secrets.sshPrivateKey;
    delete secrets.sshPassphrase;
    await fs.rm(SSH_KEY_FILE, { force: true });
  } else {
    if (input.sshPrivateKey !== undefined && input.sshPrivateKey.trim() !== '') {
      secrets.sshPrivateKey = input.sshPrivateKey.trim();
    }
    if (!secrets.sshPrivateKey) {
      throw new Error('SSH 模式需要粘贴 Private Key');
    }
    if (input.sshPassphrase !== undefined) {
      secrets.sshPassphrase = input.sshPassphrase;
    }
    delete secrets.httpPassword;
  }

  await fs.writeFile(META_FILE, `${JSON.stringify(meta, null, 2)}\n`, { mode: 0o600 });
  await fs.writeFile(SECRETS_FILE, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });

  if (input.authType === 'ssh') {
    await writeSshKeyFile(secrets.sshPrivateKey!);
    await writeAskpassScript(secrets.sshPassphrase);
  }

  return getRemoteConfigPublic();
}

function normalizeRepoUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '');
  if (!normalized.endsWith('.git')) {
    normalized += '.git';
  }
  return normalized;
}

export function maskRemoteUrl(url: string): string {
  return url.replace(/:\/\/[^@]+@/, '://***@');
}

function resolveHttpUsername(username: string, password: string): string {
  if (/^(github_pat_|ghp_|gho_|ghu_|ghs_|ghr_)/.test(password)) {
    return 'x-access-token';
  }
  return username;
}

export async function buildOriginUrl(): Promise<string | null> {
  const meta = await readMeta();
  const secrets = await readSecrets();
  if (!meta) return null;

  if (meta.authType === 'http') {
    if (!secrets.httpPassword || !meta.httpUsername) return null;
    const base = meta.repoUrl
      .replace(/^https:\/\//, '')
      .replace(/^http:\/\//, '');
    const user = encodeURIComponent(resolveHttpUsername(meta.httpUsername, secrets.httpPassword));
    const pass = encodeURIComponent(secrets.httpPassword);
    return `https://${user}:${pass}@${base}`;
  }

  if (meta.repoUrl.startsWith('git@') || meta.repoUrl.startsWith('ssh://')) {
    return meta.repoUrl;
  }

  const match = meta.repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (match) {
    return `git@github.com:${match[1]}/${match[2]}.git`;
  }

  return meta.repoUrl;
}

export async function getGitEnv(): Promise<NodeJS.ProcessEnv> {
  const meta = await readMeta();
  const secrets = await readSecrets();
  const env = { ...process.env };

  if (!meta || meta.authType !== 'ssh' || !secrets.sshPrivateKey) {
    return sanitizeGitEnv(env);
  }

  await writeSshKeyFile(secrets.sshPrivateKey);
  await writeAskpassScript(secrets.sshPassphrase);

  env.GIT_SSH_COMMAND = [
    'ssh',
    `-i ${SSH_KEY_FILE}`,
    '-o IdentitiesOnly=yes',
    '-o ConnectTimeout=10',
    '-o StrictHostKeyChecking=accept-new',
  ].join(' ');

  if (secrets.sshPassphrase) {
    env.SSH_ASKPASS = SSH_ASKPASS_FILE;
    env.SSH_ASKPASS_REQUIRE = 'force';
    env.DISPLAY = env.DISPLAY ?? ':0';
    env.SSH_PASSPHRASE = secrets.sshPassphrase;
  } else {
    env.GIT_SSH_COMMAND += ' -o BatchMode=yes';
  }

  return sanitizeGitEnv(env);
}

async function writeSshKeyFile(key: string): Promise<void> {
  await ensureCredentialsDir();
  await fs.writeFile(SSH_KEY_FILE, `${key.trim()}\n`, { mode: 0o600 });
}

async function writeAskpassScript(passphrase?: string): Promise<void> {
  if (!passphrase) {
    await fs.rm(SSH_ASKPASS_FILE, { force: true });
    return;
  }
  const script = `#!/bin/sh\necho "$SSH_PASSPHRASE"\n`;
  await fs.writeFile(SSH_ASKPASS_FILE, script, { mode: 0o700 });
}

export async function isRemoteConfigured(): Promise<boolean> {
  const meta = await readMeta();
  if (!meta) return false;
  const secrets = await readSecrets();
  if (meta.authType === 'http') {
    return Boolean(meta.httpUsername && secrets.httpPassword);
  }
  return Boolean(secrets.sshPrivateKey);
}
