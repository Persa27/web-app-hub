// Deliberately publish an allowlist, never the repository root.
import { readFile, writeFile, mkdir, readdir, lstat, copyFile, rm } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.pages-dist');
function inside(base, path) {
  const rel = relative(base, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Unsafe path outside project: ${path}`);
  return path;
}
const excluded = /(^|\/)(\.[^/]+|node_modules|docs|tests|promo|_review_candidates|_self_review_candidates|_debug_compare|_debug_sheet_grid\.png)(\/|$)|\.(psd|blend|zip|mp4|mov|pyc)$|(^|\/)(sheet(?:_transparent)?\.png|gemini_prompt\.txt|gemini_reference\.png|portrait_prompt\.txt)$|_(preview|compare|raw_evolve|sheet_extract)/i;
let count = 0;
let bytes = 0;
async function copy(source, destination, name) {
  if (excluded.test(name)) return;
  inside(root, source);
  inside(output, destination);
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Symlink is not a publishable asset: ${name}`);
  if (info.isDirectory()) {
    const children = await readdir(source);
    for (let i = 0; i < children.length; i += 16) {
      await Promise.all(children.slice(i, i + 16).map(child => copy(resolve(source, child), resolve(destination, child), `${name}/${child}`)));
    }
  } else if (info.isFile()) {
    if (info.size > 25 * 1024 * 1024) throw new Error(`Asset exceeds 25 MiB: ${name}`);
    if (++count > 20000) throw new Error('Pages Free limit exceeded: 20,000 files');
    bytes += info.size;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}
const manifest = JSON.parse(await readFile(resolve(root, 'pages-assets.json'), 'utf8'));
// Resolve every path before clearing the fixed, project-local output directory.
const entries = manifest.entries.map(({ from, to = from }) => ({
  source: inside(root, resolve(root, from)),
  destination: inside(output, resolve(output, to)),
  name: from.replaceAll('\\', '/'),
}));
if (entries.some(({ source }) => source === root || source === output || source.startsWith(output + sep))) {
  throw new Error('Unsafe source: choose explicit public files or directories');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const entry of entries) await copy(entry.source, entry.destination, entry.name);
await lstat(resolve(output, 'index.html'));
await writeFile(resolve(output, '404.html'), '<!doctype html><html lang="ja"><meta charset="utf-8"><title>404</title><h1>404</h1><p>ページがみつかりません。</p><a href="/">ホームへ</a></html>\n');
if (count + 1 > 20000) throw new Error('Pages Free limit exceeded: 20,000 files');
console.log(`Pages output: ${output} (${count + 1} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB)`);
