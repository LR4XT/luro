import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyThemeLinksToHtml } from './links.js';

const classic = { siteStylesheet: 'styles/main.css' };
const midnight = {
  siteStylesheet: 'styles/main.css',
  themeOverlay: 'styles/themes/midnight.css',
};

describe('applyThemeLinksToHtml', () => {
  it('injects the main stylesheet into pages that have no CSS links', () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Blog</title>
</head>
<body>
  <div class="content-container"></div>
</body>
</html>
`;
    const next = applyThemeLinksToHtml(html, classic, 'https://example.com');
    assert.match(next, /<link rel="stylesheet" href="https:\/\/example.com\/styles\/main.css">/);
    assert.match(next, /<title>Blog<\/title>/);
  });

  it('adds an overlay stylesheet next to an existing main.css link', () => {
    const html =
      '<head><link rel="stylesheet" href="https://example.com/styles/main.css"></head>';
    const next = applyThemeLinksToHtml(html, midnight, 'https://lr4xt.github.io/test-blog');
    assert.match(next, /https:\/\/lr4xt.github.io\/test-blog\/styles\/main.css/);
    assert.match(next, /https:\/\/lr4xt.github.io\/test-blog\/styles\/themes\/midnight.css/);
    assert.equal((next.match(/styles\/main\.css/g) ?? []).length, 1);
  });
});
