import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePostsFromIndex, upsertIndexArticle } from './index.js';

const newSiteIndex = `<!DOCTYPE html>
<html lang="zh-CN">
<body>
  <div class="content-container" data-aos="fade-up">
          <article class="post-item">
              <div class="left">
                <a href="https://example.com/post/test/">
                  <h2 class="post-title">test</h2>
                </a>
                <div class="post-date">
                  2026-08-29
                </div>
              </div>
            </article>
  </div>
</body>
</html>
`;

describe('parsePostsFromIndex', () => {
  it('lists posts from a newly initialized site that is not lr4xt.com', () => {
    const posts = parsePostsFromIndex(newSiteIndex);
    assert.deepEqual(posts, [
      { title: 'test', slug: 'test', date: '2026-08-29', featureImage: undefined },
    ]);
  });

  it('still lists posts that use the production lr4xt.com URL', () => {
    const html = newSiteIndex.replaceAll('https://example.com', 'https://lr4xt.com');
    const posts = parsePostsFromIndex(html);
    assert.equal(posts[0]?.slug, 'test');
  });

  it('keeps a slug only once if the homepage has duplicate entries', () => {
    const html = newSiteIndex.replace(
      '</article>',
      `</article>
            <article class="post-item">
              <div class="left">
                <a href="https://example.com/post/test/">
                  <h2 class="post-title">test again</h2>
                </a>
                <div class="post-date">2026-08-29</div>
              </div>
            </article>`,
    );
    const posts = parsePostsFromIndex(html);
    assert.equal(posts.length, 1);
    assert.equal(posts[0]?.title, 'test');
  });
});

describe('upsertIndexArticle', () => {
  it('collapses duplicate homepage cards that share a slug into one', () => {
    const html = `<div class="content-container" data-aos="fade-up">
          <article class="post-item">
              <div class="left">
                <a href="https://example.com/post/test/">
                  <h2 class="post-title">test</h2>
                </a>
                <div class="post-date">2026-08-29</div>
                <div class="post-abstract">test</div>
              </div>
            </article>
          <article class="post-item">
              <div class="left">
                <a href="https://example.com/post/test/">
                  <h2 class="post-title">test</h2>
                </a>
                <div class="post-date">2026-08-29</div>
                <div class="post-abstract">test1</div>
              </div>
            </article>
        </div>`;
    const next = upsertIndexArticle(
      html,
      'test',
      `<article class="post-item"><div class="left"><a href="https://example.com/post/test/"><h2 class="post-title">test</h2></a><div class="post-abstract">kept</div></div></article>`,
    );
    assert.equal((next.match(/<article class="post-item">/g) ?? []).length, 1);
    assert.match(next, /kept/);
    assert.doesNotMatch(next, /test1/);
  });
});
