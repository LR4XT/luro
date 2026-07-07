import { useEffect } from 'react';
import type { PostDetail } from '../lib/api';
import { IconBack } from './Icons';

interface PostPreviewProps {
  post: PostDetail | null;
  loading: boolean;
  onBack: () => void;
  onOpenPost: (slug: string) => void;
}

export default function PostPreview({ post, loading, onBack, onOpenPost }: PostPreviewProps) {
  useEffect(() => {
    const link = document.getElementById('site-preview-css') as HTMLLinkElement | null;
    if (!link) {
      const el = document.createElement('link');
      el.id = 'site-preview-css';
      el.rel = 'stylesheet';
      el.href = '/api/assets/styles/main.css';
      document.head.appendChild(el);
    }
    return () => {
      document.getElementById('site-preview-css')?.remove();
    };
  }, []);

  if (loading) {
    return (
      <div className="main-panel">
        <header className="panel-header">
          <div className="panel-header-left">
            <button type="button" className="btn-ghost" onClick={onBack}>
              <IconBack />
              Back
            </button>
            <h1>Preview</h1>
          </div>
        </header>
        <p className="empty-state">Loading local preview…</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="main-panel">
        <header className="panel-header">
          <div className="panel-header-left">
            <button type="button" className="btn-ghost" onClick={onBack}>
              <IconBack />
              Back
            </button>
            <h1>Preview</h1>
          </div>
        </header>
        <p className="empty-state">Post not found in local repo.</p>
      </div>
    );
  }

  const featureUrl = post.featureImage
    ? `/api/assets/post-images/${post.featureImage}`
    : undefined;

  return (
    <div className="main-panel preview-page">
      <header className="panel-header">
        <div className="panel-header-left">
          <button type="button" className="btn-ghost" onClick={onBack}>
            <IconBack />
            Back
          </button>
          <h1>Preview</h1>
        </div>
        <span className="preview-source">{post.sourcePath}</span>
      </header>

      <div className="site-preview-wrap">
        <article className="post-detail site-preview-article">
          <h2 className="post-title">{post.title}</h2>
          <div className="post-date">{post.date}</div>

          {featureUrl && (
            <div
              className="feature-container"
              style={{ backgroundImage: `url('${featureUrl}')` }}
            />
          )}

          <div
            className="post-content"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />

          {post.tags.length > 0 && (
            <div className="tag-container">
              {post.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {post.nextPost && (
            <div className="next-post">
              <div className="next">下一篇</div>
              <button
                type="button"
                className="next-post-link"
                onClick={() => onOpenPost(post.nextPost!.slug)}
              >
                <h3 className="post-title">{post.nextPost.title}</h3>
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
