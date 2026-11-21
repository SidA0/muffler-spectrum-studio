import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(app, '..');
const source = path.resolve(app, 'dist');
const target = path.resolve(repo, 'analysis');
if (path.basename(target) !== 'analysis' || !target.startsWith(repo + path.sep)) throw new Error('Refusing to sync outside the analysis output directory.');

async function files(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) out.push(...await files(path.join(dir, entry.name), relative));
    else if (entry.isFile()) out.push(relative);
  }
  return out;
}

await mkdir(target, { recursive: true });
const built = await files(source);
const builtSet = new Set(built);
for (const relative of await files(target)) {
  if (!builtSet.has(relative)) await unlink(path.join(target, relative));
}
for (const relative of built) {
  await mkdir(path.dirname(path.join(target, relative)), { recursive: true });
  await copyFile(path.join(source, relative), path.join(target, relative));
}
console.log(`Synced ${built.length} built files into analysis/.`);
