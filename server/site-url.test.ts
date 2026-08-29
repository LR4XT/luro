import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  githubPagesUrlFromRepo,
  isPlaceholderSiteUrl,
  PLACEHOLDER_SITE_URL,
  rewriteSiteUrl,
} from './site-url.js';

describe('githubPagesUrlFromRepo', () => {
  it('builds a project pages URL from an HTTPS GitHub remote', () => {
    assert.equal(
      githubPagesUrlFromRepo('https://github.com/lr4xt/test-blog.git'),
      'https://lr4xt.github.io/test-blog',
    );
  });

  it('builds a user site URL for username.github.io repos', () => {
    assert.equal(
      githubPagesUrlFromRepo('git@github.com:alice/alice.github.io.git'),
      'https://alice.github.io',
    );
  });

  it('returns null for non-GitHub remotes', () => {
    assert.equal(githubPagesUrlFromRepo('https://gitlab.com/user/repo.git'), null);
  });
});

describe('rewriteSiteUrl', () => {
  it('replaces the placeholder origin in stylesheet and post links', () => {
    const html = `<link rel="stylesheet" href="${PLACEHOLDER_SITE_URL}/styles/main.css">
<a href="${PLACEHOLDER_SITE_URL}/post/test/">test</a>`;
    const next = rewriteSiteUrl(html, PLACEHOLDER_SITE_URL, 'https://lr4xt.github.io/test-blog');
    assert.equal(
      next,
      `<link rel="stylesheet" href="https://lr4xt.github.io/test-blog/styles/main.css">
<a href="https://lr4xt.github.io/test-blog/post/test/">test</a>`,
    );
  });

  it('treats example.com as the placeholder site URL', () => {
    assert.equal(isPlaceholderSiteUrl('https://example.com/'), true);
    assert.equal(isPlaceholderSiteUrl('https://lr4xt.github.io/test-blog'), false);
  });
});
