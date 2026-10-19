import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
test('Hub build contains all catalog images and pages, without repository files', async () => {
  const result = spawnSync(process.execPath, ['scripts/build-pages.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = join(root, '.pages-dist');
  const files = await readdir(output);
  for (const file of ['index.html', 'main.js', 'style.css', 'apps.json', 'privacy-quiz-boost.html', '404.html']) {
    assert.ok(files.includes(file), file);
  }
  for (const name of ['.git', '.env', '.vercel', 'docs', 'tests', 'node_modules']) assert.ok(!files.includes(name), name);
  const catalog = JSON.parse(await readFile(join(output, 'apps.json'), 'utf8'));
  assert.equal(catalog.apps.length, 9);
  for (const app of catalog.apps) await readFile(join(output, app.image));
});

test('packager excludes secrets and rejects paths outside the project', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'pages-build-'));
  try {
    await mkdir(join(fixture, 'scripts'));
    await cp(join(root, 'scripts/build-pages.mjs'), join(fixture, 'scripts/build-pages.mjs'));
    await mkdir(join(fixture, 'public'));
    await writeFile(join(fixture, 'public/index.html'), '<h1>Fixture</h1>');
    await writeFile(join(fixture, 'public/.env'), 'SECRET=never-publish');
    await writeFile(join(fixture, 'pages-assets.json'), JSON.stringify({ entries: [{ from: 'public', to: '.' }] }));
    const run = () => spawnSync(process.execPath, ['scripts/build-pages.mjs'], { cwd: fixture, encoding: 'utf8' });
    assert.equal(run().status, 0);
    assert.ok(!(await readdir(join(fixture, '.pages-dist'))).includes('.env'));
    await writeFile(join(fixture, 'pages-assets.json'), JSON.stringify({ entries: [{ from: '../outside', to: '.' }] }));
    const rejected = run();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /outside|unsafe/i);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
