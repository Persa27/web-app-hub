import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { isApprovedPagesUrl } from './pages-url-validation.mjs';
const root = resolve(import.meta.dirname, '..');
const mapping = JSON.parse(await readFile(join(root, 'docs/cloudflare-url-mapping.json'), 'utf8'));
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
for (const site of [{ ...mapping.hub, name: 'tamalab', id: 'hub' }, ...mapping.apps]) {
  if (!site.vercelProjectId || !site.previousDeploymentId) throw new Error(`Missing rollback record: ${site.id}`);
  if (!isApprovedPagesUrl(site.newUrl)) throw new Error(`Unverified URL format: ${site.newUrl}`);
  const directory = join(root, '.migration-vercel', site.vercelProject);
  await mkdir(join(directory, '.vercel'), { recursive: true });
  await writeFile(join(directory, '.vercelignore'), 'deployment.log\n');
  await writeFile(join(directory, '.vercel/project.json'), JSON.stringify({ projectId: site.vercelProjectId, orgId: 'team_LfPVgshphjWri8qY3BKBHCkP', projectName: site.vercelProject }));
  await writeFile(join(directory, 'index.html'), `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escape(site.name)} — おひっこししました</title><style>body{font-family:system-ui,sans-serif;background:#f7f5ed;color:#263d35;margin:0;padding:32px 20px;line-height:1.9}main{max-width:600px;margin:10vh auto;padding:32px;background:white;border-radius:20px}h1{font-size:1.6rem;line-height:1.6}a{color:#175f48}a.go{display:block;background:#23634d;color:white;padding:16px;border-radius:12px;text-align:center;text-decoration:none;font-weight:bold;margin:28px 0}small{display:block;overflow-wrap:anywhere}</style><main><p>${escape(site.name)}</p><h1>あたらしいページへ<br>おひっこししました。</h1><p>これからは、こちらで あそべます。</p><a class="go" href="${escape(site.newUrl)}">あたらしいページを ひらく →</a><p>ゲームの きろく・せっていは、あたらしいページへ ひきつがれません。はじめからの スタートに なります。</p><small>${escape(site.newUrl)}</small></main></html>\n`);
  if (site.id === 'hub') {
    await copyFile(join(root, 'privacy-quiz-boost.html'), join(directory, 'privacy-quiz-boost.html'));
    await copyFile(join(root, 'style.css'), join(directory, 'style.css'));
    await mkdir(join(directory, 'img'), { recursive: true });
    for (const name of ['favicon.svg', 'tamalab-logo.webp']) await copyFile(join(root, 'img', name), join(directory, 'img', name));
  }
  await writeFile(join(directory, 'vercel.json'), JSON.stringify({ version: 2, framework: null, buildCommand: null, installCommand: null, outputDirectory: '.', routes: [{ handle: 'filesystem' }, { src: '/.*', dest: '/index.html' }] }, null, 2));
  // Keep the existing Vercel project's repository root-directory setting.
  if (site.vercelProject === 'sentinel-blacklist') {
    const nested = join(directory, 'deploy/sentinel-blacklist');
    await mkdir(nested, { recursive: true });
    for (const file of ['index.html', 'vercel.json']) await copyFile(join(directory, file), join(nested, file));
  }
  console.log(`${site.vercelProject}: ${site.newUrl}`);
}
