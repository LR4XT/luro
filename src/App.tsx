import { useCallback, useEffect, useMemo, useState } from 'react';
import PageManager from './components/PageManager';
import PostEditor from './components/PostEditor';
import PostList from './components/PostList';
import RemoteSettings from './components/RemoteSettings';
import Toast from './components/Toast';
import TerminalView from './components/TerminalView';
import Sidebar, { type NavItem } from './components/Sidebar';
import TagManager from './components/TagManager';
import ThemePanel from './components/ThemePanel';
import {
  createTag,
  deletePosts,
  applySiteTheme,
  fetchGitStatus,
  fetchPost,
  fetchTags,
  fetchThemes,
  generateSlug,
  importSiteTheme,
  publishPost,
  pushRepo,
  syncRepo,
  fetchPosts,
  uploadImage,
  type GitStatusInfo,
  type PostSummary,
  type SiteThemePreset,
  type TagInfo,
  type EditorThemePreset,
} from './lib/api';
import { insertAtCursor, todayDateString } from './lib/markdown';
import { useConsoleLog } from './lib/console-log';
import {
  applyEditorTheme,
  getStoredEditorThemeId,
  setStoredEditorThemeId,
} from './lib/theme';

type View = 'list' | 'editor';
type EditorPanelMode = 'edit' | 'preview';

const EMPTY_MARKDOWN = '';

function slugFromPostPath(file: string): string | null {
  const match = file.match(/^post\/([^/]+)\//);
  return match ? match[1] : null;
}

function createEmptyDraft() {
  return {
    title: '',
    slug: '',
    date: todayDateString(),
    tags: [] as string[],
    featureImage: '',
    markdown: EMPTY_MARKDOWN,
  };
}

export default function App() {
  const [view, setView] = useState<View>('list');
  const [nav, setNav] = useState<NavItem>('post');
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [siteThemes, setSiteThemes] = useState<SiteThemePreset[]>([]);
  const [editorThemes, setEditorThemes] = useState<EditorThemePreset[]>([]);
  const [activeSiteThemeId, setActiveSiteThemeId] = useState('lr4xt-classic');
  const [editorThemeId, setEditorThemeId] = useState<'light' | 'dark'>('light');
  const [applyingSiteTheme, setApplyingSiteTheme] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);
  const [pendingPostChanges, setPendingPostChanges] = useState<Record<string, 'new' | 'modified'>>({});
  const [selectedPostSlugs, setSelectedPostSlugs] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [editorLoading, setEditorLoading] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editorPanelMode, setEditorPanelMode] = useState<EditorPanelMode>('edit');
  const [loadedContentHtml, setLoadedContentHtml] = useState('');
  const [markdownSource, setMarkdownSource] = useState<'draft' | 'converted' | 'empty'>('empty');

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [tags, setTags] = useState<string[]>([]);
  const [featureImage, setFeatureImage] = useState('');
  const [markdown, setMarkdown] = useState(EMPTY_MARKDOWN);

  const { logs: consoleLogs, appendLog, clearLogs } = useConsoleLog();

  const refreshTags = useCallback(async () => {
    const { tags: nextTags } = await fetchTags();
    setAllTags(nextTags);
  }, []);

  const refreshGitStatus = useCallback(async () => {
    const gitRes = await fetchGitStatus();
    setGitStatus(gitRes);
  }, []);

  const loadThemes = useCallback(async () => {
    const config = await fetchThemes();
    setSiteThemes(config.site.presets);
    setEditorThemes(config.editor.presets);
    setActiveSiteThemeId(config.activeSiteThemeId);

    const editorId = getStoredEditorThemeId(config.editor.default);
    const editorPreset =
      config.editor.presets.find((theme) => theme.id === editorId) ?? config.editor.presets[0];
    setEditorThemeId(editorPreset.id === 'dark' ? 'dark' : 'light');
    applyEditorTheme(editorPreset);
  }, []);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setError('');
    appendLog({ level: 'info', action: 'Sync', message: '正在同步远程仓库…' });
    try {
      const result = await syncRepo();
      setPosts(result.posts);
      setSyncMessage(result.summary);
      if (!result.success) {
        setError(result.summary);
        appendLog({ level: 'error', action: 'Sync', message: result.summary });
      } else {
        appendLog({ level: 'success', action: 'Sync', message: result.summary });
      }
      await Promise.all([refreshGitStatus(), refreshTags()]);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      appendLog({ level: 'error', action: 'Sync', message: msg });
    } finally {
      setSyncing(false);
    }
  }, [appendLog, refreshGitStatus, refreshTags]);

  const runPush = useCallback(async () => {
    setPushing(true);
    setError('');
    setMessage('');
    appendLog({ level: 'info', action: 'Push', message: '正在提交并推送更改…' });
    try {
      const result = await pushRepo();
      setSyncMessage(result.summary);
      if (result.pushed) {
        setMessage(result.summary);
        setPendingPostChanges({});
        appendLog({ level: 'success', action: 'Push', message: result.summary });
      } else if (result.success) {
        setSyncMessage(result.summary);
        appendLog({ level: 'warn', action: 'Push', message: result.summary });
      } else {
        setError(result.summary);
        appendLog({ level: 'error', action: 'Push', message: result.summary });
      }
      await Promise.all([refreshGitStatus(), refreshTags()]);
      const { posts: nextPosts } = await fetchPosts();
      setPosts(nextPosts);
      return result;
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      appendLog({ level: 'error', action: 'Push', message: msg });
      throw err;
    } finally {
      setPushing(false);
    }
  }, [appendLog, refreshGitStatus, refreshTags]);

  const postChangeMap = useMemo(() => {
    const map = new Map<string, 'new' | 'modified'>();

    for (const [slug, kind] of Object.entries(pendingPostChanges)) {
      map.set(slug, kind);
    }

    if (gitStatus) {
      for (const file of gitStatus.created) {
        const slug = slugFromPostPath(file);
        if (slug) map.set(slug, 'new');
      }
      for (const file of gitStatus.modified) {
        const slug = slugFromPostPath(file);
        if (slug && !map.has(slug)) map.set(slug, 'modified');
      }
    }

    return map;
  }, [pendingPostChanges, gitStatus]);

  const pendingFileCount = useMemo(() => {
    if (gitStatus) {
      const fileChanges = gitStatus.modified.length + gitStatus.created.length;
      if (fileChanges > 0) return fileChanges;
      if (gitStatus.hasUnpushedCommits) return gitStatus.ahead;
      return 0;
    }
    return Object.keys(pendingPostChanges).length;
  }, [gitStatus, pendingPostChanges]);

  useEffect(() => {
    void loadThemes();
    void runSync();
  }, [loadThemes, runSync]);

  useEffect(() => {
    if (editingSlug || !title.trim()) {
      if (!editingSlug) setSlug('');
      return;
    }
    const timer = setTimeout(() => {
      generateSlug(title)
        .then((res) => setSlug(res.slug))
        .catch(() => setSlug(''));
    }, 300);
    return () => clearTimeout(timer);
  }, [title, editingSlug]);

  const handleCreateTag = useCallback(
    async (name: string) => {
      await createTag(name);
      await refreshTags();
    },
    [refreshTags],
  );

  const handleToggleEditorTheme = () => {
    const nextId = editorThemeId === 'dark' ? 'light' : 'dark';
    const preset = editorThemes.find((theme) => theme.id === nextId);
    if (!preset) return;
    setEditorThemeId(nextId);
    setStoredEditorThemeId(nextId);
    applyEditorTheme(preset);
  };

  const handleSelectSiteTheme = async (id: string) => {
    if (id === activeSiteThemeId || applyingSiteTheme) return;
    setApplyingSiteTheme(true);
    setError('');
    appendLog({ level: 'info', action: 'Theme', message: '正在切换网站主题…' });
    try {
      const result = await applySiteTheme(id);
      setActiveSiteThemeId(id);
      setSiteThemes((prev) => {
        const exists = prev.some((theme) => theme.id === result.theme.id);
        return exists ? prev : [...prev, result.theme];
      });
      setMessage(result.message);
      appendLog({ level: 'success', action: 'Theme', message: result.message });
      await refreshGitStatus();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      appendLog({ level: 'error', action: 'Theme', message: msg });
    } finally {
      setApplyingSiteTheme(false);
    }
  };

  const handleImportSiteTheme = async (name: string, css: string) => {
    appendLog({ level: 'info', action: 'Theme', message: `正在导入主题 ${name}…` });
    const result = await importSiteTheme(name, css);
    setSiteThemes(result.site.presets);
    setMessage(result.message);
    appendLog({ level: 'success', action: 'Theme', message: result.message });
    await handleSelectSiteTheme(result.theme.id);
  };

  const loadPostForEdit = useCallback(async (postSlug: string) => {
    setEditorLoading(true);
    setView('editor');
    setNav('post');
    setEditingSlug(postSlug);
    setEditorPanelMode('edit');
    setError('');
    setMessage('');
    try {
      const { post } = await fetchPost(postSlug);
      setTitle(post.title);
      setSlug(post.slug);
      setDate(post.date);
      setTags(post.tags);
      setFeatureImage(post.featureImage ?? '');
      setMarkdown(post.markdown ?? '');
      setLoadedContentHtml(post.contentHtml);
      setMarkdownSource(post.markdownSource ?? 'empty');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      appendLog({ level: 'error', action: 'Open', message: msg });
      setView('list');
      setEditingSlug(null);
    } finally {
      setEditorLoading(false);
    }
  }, []);

  const resetDraft = () => {
    const draft = createEmptyDraft();
    setTitle(draft.title);
    setSlug(draft.slug);
    setDate(draft.date);
    setTags(draft.tags);
    setFeatureImage(draft.featureImage);
    setMarkdown(draft.markdown);
    setEditingSlug(null);
    setEditorPanelMode('edit');
    setLoadedContentHtml('');
    setMarkdownSource('empty');
  };

  const handleNewPost = () => {
    resetDraft();
    setView('editor');
    setNav('post');
    setError('');
    setMessage('');
  };

  const handleBackToList = () => {
    if (busy || pushing) return;
    setView('list');
    resetDraft();
  };

  const handleNavigate = (item: NavItem) => {
    setNav(item);
    if (item === 'post') {
      setView('list');
      resetDraft();
    }
  };

  const insertImageMarkdown = useCallback(
    (snippet: string, textarea: HTMLTextAreaElement | null) => {
      if (!textarea) {
        setMarkdown((prev) => `${prev}\n${snippet}\n`);
        return;
      }
      const { selectionStart, selectionEnd } = textarea;
      setMarkdown((prev) => {
        const { nextValue } = insertAtCursor(prev, selectionStart, selectionEnd, `\n${snippet}\n`);
        return nextValue;
      });
    },
    [],
  );

  const handleUploadImage = async (file: File) => {
    setError('');
    const result = await uploadImage(file);
    const textarea = document.querySelector('.editor-textarea') as HTMLTextAreaElement | null;
    insertImageMarkdown(result.markdown, textarea);
    if (!featureImage) {
      setFeatureImage(result.filename);
    }
  };

  const handlePickCover = async (file: File) => {
    setError('');
    const result = await uploadImage(file);
    setFeatureImage(result.filename);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    setBusy(true);
    try {
      await handleUploadImage(file);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      appendLog({ level: 'error', action: 'Upload', message: msg });
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePosts = async (slugs: string[]) => {
    if (slugs.length === 0) return;
    setDeleting(true);
    setError('');
    setMessage('');
    appendLog({ level: 'info', action: 'Delete', message: `正在删除 ${slugs.length} 篇文章…` });
    try {
      const result = await deletePosts(slugs);
      setPendingPostChanges((prev) => {
        const next = { ...prev };
        for (const slug of result.deleted) {
          delete next[slug];
        }
        return next;
      });
      setSelectedPostSlugs(new Set());
      const deleteMessage = `已删除 ${result.deleted.length} 篇文章`;
      setMessage(deleteMessage);
      appendLog({ level: 'success', action: 'Delete', message: deleteMessage });
      const [{ posts: nextPosts }] = await Promise.all([
        fetchPosts(),
        refreshGitStatus(),
        refreshTags(),
      ]);
      setPosts(nextPosts);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      appendLog({ level: 'error', action: 'Delete', message: msg });
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    appendLog({ level: 'info', action: 'Save', message: '正在保存文章…' });
    try {
      const result = await publishPost({
        title: title.trim(),
        date,
        markdown,
        slug: slug.trim(),
        tags,
        featureImage: featureImage.trim() || undefined,
        push: false,
        update: Boolean(editingSlug),
        themeId: activeSiteThemeId,
      });
      setPendingPostChanges((prev) => ({
        ...prev,
        [result.slug]: editingSlug ? 'modified' : 'new',
      }));
      if (!editingSlug) {
        setEditingSlug(result.slug);
      }
      const saveMessage = `已保存：/post/${result.slug}/`;
      setMessage(saveMessage);
      appendLog({ level: 'success', action: 'Save', message: saveMessage });
      const [{ posts: nextPosts }] = await Promise.all([
        fetchPosts(),
        refreshGitStatus(),
        refreshTags(),
      ]);
      setPosts(nextPosts);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      appendLog({ level: 'error', action: 'Save', message: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell">
      <Sidebar
        active={nav}
        editorThemeId={editorThemeId}
        onNavigate={handleNavigate}
        onToggleEditorTheme={handleToggleEditorTheme}
        gitStatus={gitStatus}
        consoleLogs={consoleLogs}
      />

      <main className={`content${nav === 'console' ? ' content-terminal' : ''}`}>
        {nav === 'console' ? (
          <TerminalView logs={consoleLogs} onClear={clearLogs} />
        ) : nav === 'tag' ? (
          <TagManager tags={allTags} onCreateTag={handleCreateTag} />
        ) : nav === 'page' ? (
          <PageManager />
        ) : nav === 'theme' ? (
          <ThemePanel
            themes={siteThemes}
            activeId={activeSiteThemeId}
            applying={applyingSiteTheme}
            onSelect={(id) => void handleSelectSiteTheme(id)}
            onImport={handleImportSiteTheme}
          />
        ) : nav === 'setting' ? (
          <RemoteSettings
            gitStatus={gitStatus}
            syncMessage={syncMessage}
            themeName={siteThemes.find((theme) => theme.id === activeSiteThemeId)?.name}
            syncing={syncing}
            onSync={runSync}
            onSaved={refreshGitStatus}
          />
        ) : view === 'list' ? (
          <PostList
            posts={posts}
            syncing={syncing}
            pushing={pushing}
            deleting={deleting}
            syncMessage={syncMessage}
            pendingFileCount={pendingFileCount}
            postChanges={postChangeMap}
            selectedSlugs={selectedPostSlugs}
            pushEnabled={Boolean(gitStatus?.remoteConfigured)}
            hasUnpushedCommits={Boolean(gitStatus?.hasUnpushedCommits)}
            onNewPost={handleNewPost}
            onSelectPost={loadPostForEdit}
            onSync={runSync}
            onPush={runPush}
            onSelectedSlugsChange={setSelectedPostSlugs}
            onDeleteSelected={() => void handleDeletePosts([...selectedPostSlugs])}
          />
        ) : (
          <PostEditor
            isNew={!editingSlug}
            loading={editorLoading}
            panelMode={editorPanelMode}
            onPanelModeChange={setEditorPanelMode}
            loadedContentHtml={loadedContentHtml}
            markdownSource={markdownSource}
            title={title}
            slug={slug}
            date={date}
            tags={tags}
            availableTags={allTags}
            featureImage={featureImage}
            markdown={markdown}
            busy={busy}
            onTitleChange={setTitle}
            onSlugChange={setSlug}
            onDateChange={setDate}
            onTagsChange={setTags}
            onCreateTag={handleCreateTag}
            onFeatureImageChange={setFeatureImage}
            onMarkdownChange={setMarkdown}
            onBack={handleBackToList}
            onSave={() => void handleSave()}
            onPickCover={async (file) => {
              try {
                await handlePickCover(file);
              } catch (err) {
                const msg = (err as Error).message;
                setError(msg);
                appendLog({ level: 'error', action: 'Upload', message: msg });
                throw err;
              }
            }}
            onUploadImage={async (file) => {
              setBusy(true);
              try {
                await handleUploadImage(file);
              } catch (err) {
                const msg = (err as Error).message;
                setError(msg);
                appendLog({ level: 'error', action: 'Upload', message: msg });
              } finally {
                setBusy(false);
              }
            }}
            onDrop={handleDrop}
          />
        )}
      </main>

      {message && <Toast message={message} variant="success" onDismiss={() => setMessage('')} />}
      {error && <Toast message={error} variant="error" onDismiss={() => setError('')} />}
    </div>
  );
}
