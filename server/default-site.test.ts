import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  canInitializeSiteRepo,
  ensureSiteRepo,
  isSiteRepo,
} from './default-site.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luro-site-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('site repo initialization', () => {
  it('treats an empty folder as a valid place to start a site', () => {
    const dir = makeTempDir();
    assert.equal(isSiteRepo(dir), false);
    assert.equal(canInitializeSiteRepo(dir), true);

    const result = ensureSiteRepo(dir);

    assert.equal(result.created, true);
    assert.equal(isSiteRepo(dir), true);
    assert.equal(fs.existsSync(path.join(dir, '.git')), true);
    assert.equal(fs.existsSync(path.join(dir, 'styles', 'main.css')), true);
    const indexHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
    assert.match(indexHtml, /styles\/main\.css/);
    assert.match(indexHtml, /class="sidebar"/);
    assert.match(indexHtml, /content-container/);
  });

  it('initializes a cloned-empty repo that only has git metadata and a README', () => {
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, 'README.md'), '# blog\n');

    assert.equal(canInitializeSiteRepo(dir), true);
    const result = ensureSiteRepo(dir);

    assert.equal(result.created, true);
    assert.equal(isSiteRepo(dir), true);
  });

  it('copies missing stylesheet assets into an already valid site without rewriting HTML', () => {
    const dir = makeTempDir();
    ensureSiteRepo(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), '<html>keep-me</html>');
    fs.rmSync(path.join(dir, 'styles'), { recursive: true, force: true });

    const result = ensureSiteRepo(dir);

    assert.equal(result.created, false);
    assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf-8'), '<html>keep-me</html>');
    assert.equal(fs.existsSync(path.join(dir, 'styles', 'main.css')), true);
  });

  it('refuses a directory that already has unrelated files', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'not a blog');

    assert.equal(canInitializeSiteRepo(dir), false);
    assert.throws(
      () => ensureSiteRepo(dir),
      (error: Error) => {
        assert.match(error.message, /空文件夹|已有/);
        return true;
      },
    );
    assert.equal(fs.existsSync(path.join(dir, 'index.html')), false);
  });
});
