import { useEffect, useState } from 'react';
import type { GitStatusInfo } from '../lib/api';
import {
  fetchRemoteConfig,
  fetchSiteConfig,
  saveRemoteConfig,
  saveSiteConfig,
  testRemoteConnection,
  type RemoteAuthType,
  type RemoteConfigPublic,
} from '../lib/api';

interface RemoteSettingsProps {
  gitStatus: GitStatusInfo | null;
  syncMessage?: string;
  themeName?: string;
  syncing: boolean;
  onSync: () => void;
  onSaved: () => void;
}

export default function RemoteSettings({
  gitStatus,
  syncMessage,
  themeName,
  syncing,
  onSync,
  onSaved,
}: RemoteSettingsProps) {
  const [authType, setAuthType] = useState<RemoteAuthType>('http');
  const [repoUrl, setRepoUrl] = useState('https://github.com/LR4XT/lr4xt.github.io.git');
  const [httpUsername, setHttpUsername] = useState('');
  const [httpPassword, setHttpPassword] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [sshPassphrase, setSshPassphrase] = useState('');
  const [flags, setFlags] = useState({ hasHttpPassword: false, hasSshKey: false, hasSshPassphrase: false });
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [siteRepoPath, setSiteRepoPath] = useState('');
  const [currentRepoRoot, setCurrentRepoRoot] = useState('');
  const [siteSaveMessage, setSiteSaveMessage] = useState('');

  useEffect(() => {
    fetchRemoteConfig()
      .then(({ config }) => applyConfig(config))
      .catch(() => undefined);
    fetchSiteConfig()
      .then(({ config, repoRoot }) => {
        setCurrentRepoRoot(repoRoot);
        setSiteRepoPath(config?.repoPath ?? repoRoot);
      })
      .catch(() => undefined);
  }, []);

  const applyConfig = (config: RemoteConfigPublic) => {
    setAuthType(config.authType);
    setRepoUrl(config.repoUrl);
    setHttpUsername(config.httpUsername);
    setFlags({
      hasHttpPassword: config.hasHttpPassword,
      hasSshKey: config.hasSshKey,
      hasSshPassphrase: config.hasSshPassphrase,
    });
  };

  const handleSave = async () => {
    setBusy(true);
    setSaveMessage('');
    setTestResult('');
    try {
      const payload = {
        authType,
        repoUrl,
        httpUsername: authType === 'http' ? httpUsername : undefined,
        httpPassword: authType === 'http' && httpPassword ? httpPassword : undefined,
        sshPrivateKey: authType === 'ssh' && sshPrivateKey ? sshPrivateKey : undefined,
        sshPassphrase: authType === 'ssh' ? sshPassphrase : undefined,
      };
      const result = await saveRemoteConfig(payload);
      applyConfig(result.config);
      setHttpPassword('');
      setSshPrivateKey('');
      setSshPassphrase('');
      setSaveMessage(`已保存并应用远程地址：${result.remoteUrl}`);
      onSaved();
    } catch (err) {
      setSaveMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleBrowseSiteRepo = async () => {
    if (window.electron?.pickFolder) {
      const picked = await window.electron.pickFolder();
      if (picked) {
        setSiteRepoPath(picked);
      }
    }
  };

  const handleSaveSiteRepo = async () => {
    setSiteSaveMessage('');
    try {
      const result = await saveSiteConfig(siteRepoPath.trim());
      setSiteSaveMessage(result.message);
      if (window.electron?.relaunch) {
        await window.electron.relaunch();
      }
    } catch (err) {
      setSiteSaveMessage((err as Error).message);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setTestResult('');
    try {
      const hasNewCredentials =
        (authType === 'http' && (httpPassword || httpUsername)) ||
        (authType === 'ssh' && (sshPrivateKey || sshPassphrase));

      if (hasNewCredentials) {
        await saveRemoteConfig({
          authType,
          repoUrl,
          httpUsername,
          httpPassword: httpPassword || undefined,
          sshPrivateKey: sshPrivateKey || undefined,
          sshPassphrase: sshPassphrase || undefined,
        });
        onSaved();
      }

      const result = await testRemoteConnection();
      setTestResult(result.ok ? `✓ ${result.message}` : result.message);
    } catch (err) {
      setTestResult((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="main-panel setting-page">
      <header className="panel-header">
        <h1>Setting</h1>
        <button type="button" className="btn-ghost" onClick={onSync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync from remote'}
        </button>
      </header>

      <div className="setting-section">
        <h2>Site repository</h2>
        <p className="setting-hint">
          本地博客静态站点目录（lr4xt.github.io 克隆）。修改后需重启应用生效。
        </p>
        <label className="field-block">
          Site repository path
          <div className="field-with-action">
            <input
              value={siteRepoPath}
              onChange={(e) => setSiteRepoPath(e.target.value)}
              placeholder={currentRepoRoot || '/path/to/lr4xt.github.io'}
            />
            {window.electron?.pickFolder && (
              <button type="button" className="btn-ghost" onClick={() => void handleBrowseSiteRepo()}>
                Browse…
              </button>
            )}
          </div>
        </label>
        <div className="setting-actions">
          <button type="button" className="btn-primary" onClick={() => void handleSaveSiteRepo()}>
            Save site path
          </button>
        </div>
        {siteSaveMessage && <p className="setting-feedback">{siteSaveMessage}</p>}
      </div>

      <div className="setting-section">
        <h2>Remote repository</h2>
        <p className="setting-hint">在编辑器内配置远程连接，无需在终端执行 ssh-add。</p>

        <div className="auth-type-row">
          <label className={`auth-type-card${authType === 'http' ? ' active' : ''}`}>
            <input
              type="radio"
              name="authType"
              value="http"
              checked={authType === 'http'}
              onChange={() => setAuthType('http')}
            />
            <strong>HTTP</strong>
            <span>Username + Password / Token</span>
          </label>
          <label className={`auth-type-card${authType === 'ssh' ? ' active' : ''}`}>
            <input
              type="radio"
              name="authType"
              value="ssh"
              checked={authType === 'ssh'}
              onChange={() => setAuthType('ssh')}
            />
            <strong>SSH</strong>
            <span>Private Key (+ optional passphrase)</span>
          </label>
        </div>

        <label className="field-block">
          Repository URL
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/LR4XT/lr4xt.github.io.git"
          />
        </label>

        {authType === 'http' ? (
          <div className="field-grid">
            <label className="field-block">
              Username
              <input
                value={httpUsername}
                onChange={(e) => setHttpUsername(e.target.value)}
                placeholder="GitHub username"
              />
            </label>
            <label className="field-block">
              Password / Token
              <input
                type="password"
                value={httpPassword}
                onChange={(e) => setHttpPassword(e.target.value)}
                placeholder={flags.hasHttpPassword ? '已保存，留空则保持不变' : 'GitHub Personal Access Token（非登录密码）'}
              />
            </label>
            <p className="field-hint">Fine-grained Token 粘贴到此处即可，Username 仍填 lr4xt；编辑器会自动用 x-access-token 认证。</p>
          </div>
        ) : (
          <div className="field-grid">
            <label className="field-block full">
              Private Key
              <textarea
                value={sshPrivateKey}
                onChange={(e) => setSshPrivateKey(e.target.value)}
                placeholder={flags.hasSshKey ? '已保存，留空则保持不变。粘贴新 key 可覆盖。' : '-----BEGIN OPENSSH PRIVATE KEY-----'}
                rows={8}
                spellCheck={false}
              />
            </label>
            <label className="field-block">
              Passphrase (optional)
              <input
                type="password"
                value={sshPassphrase}
                onChange={(e) => setSshPassphrase(e.target.value)}
                placeholder={flags.hasSshPassphrase ? '已保存，留空则保持不变' : '私钥密码（如有）'}
              />
            </label>
          </div>
        )}

        <div className="setting-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void handleSave()}>
            Save connection
          </button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => void handleTest()}>
            Test connection
          </button>
        </div>

        {saveMessage && <p className="setting-feedback">{saveMessage}</p>}
        {testResult && <p className="setting-feedback">{testResult}</p>}
      </div>

      <div className="setting-panel">
        {gitStatus ? (
          <>
            <div className="setting-row">
              <span>Branch</span>
              <strong>{gitStatus.branch}</strong>
            </div>
            <div className="setting-row">
              <span>Status</span>
              <strong>
                {gitStatus.hasUnpushedCommits
                  ? `${gitStatus.ahead} commits ahead`
                  : gitStatus.isClean
                    ? 'Clean'
                    : `${gitStatus.modified.length} changes`}
              </strong>
            </div>
            <div className="setting-row">
              <span>Remote</span>
              <strong>{gitStatus.remote || '—'}</strong>
            </div>
            <div className="setting-row">
              <span>Remote configured</span>
              <strong>{gitStatus.remoteConfigured ? 'Yes' : 'No'}</strong>
            </div>
            {themeName && (
              <div className="setting-row">
                <span>Theme</span>
                <strong>{themeName}</strong>
              </div>
            )}
            {syncMessage && (
              <div className="setting-row">
                <span>Last sync</span>
                <strong>{syncMessage}</strong>
              </div>
            )}
          </>
        ) : (
          <p className="empty-state">Loading git status…</p>
        )}
      </div>
    </div>
  );
}
