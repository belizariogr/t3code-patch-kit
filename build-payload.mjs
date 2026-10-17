#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFile, loadAsar } from './patch-lib.mjs';

const kit = path.dirname(fileURLToPath(import.meta.url));
const values = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const arg = process.argv[i];
  if (!['--web-dist', '--app', '--repo'].includes(arg) || !process.argv[i + 1]) throw new Error(`Argumento inválido: ${arg}`);
  values[arg.slice(2)] = path.resolve(process.argv[i + 1]);
}
if (!values['web-dist']) throw new Error('Uso: node build-payload.mjs --web-dist /caminho/apps/web/dist [--app /caminho/T3.app] [--repo /caminho/t3code]');
const app = values.app ?? '/Applications/T3 Code (Beta).app';
const repo = values.repo ?? path.resolve(kit, '../t3code');
const asar = await loadAsar(repo);
const archive = path.join(app, 'Contents/Resources/app.asar');
const packageJson = JSON.parse(asar.extractFile(archive, 'package.json'));
const prefix = 'apps/server/dist/client/';
const bufferHash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const originalFiles = asar.listPackage(archive).map((name) => name.replace(/^\//, '')).filter((name) => name.startsWith(prefix) && !('files' in asar.statFile(archive, name)));
const newFiles = new Map();
async function walk(directory, prefix = '') {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative);
    else if (entry.isFile()) newFiles.set(relative, await fs.readFile(path.join(directory, entry.name)));
  }
}
await walk(values['web-dist']);
if (!newFiles.has('index.html')) throw new Error('O build web está incompleto.');
// Branding belongs to the installed release and is independent of these features.
for (const name of ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'manifest.webmanifest']) {
  if (originalFiles.includes(prefix + name)) newFiles.set(name, asar.extractFile(archive, prefix + name));
}
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 't3code-payload-'));
try {
  const changedFiles = {};
  for (const [relative, content] of newFiles) {
    const name = prefix + relative;
    const digest = bufferHash(content);
    if (originalFiles.includes(name) && bufferHash(asar.extractFile(archive, name)) === digest) continue;
    const dest = path.join(temp, name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);
    changedFiles[name] = digest;
  }
  const removedFiles = originalFiles.filter((name) => !newFiles.has(name.slice(prefix.length)));
  const payload = path.join(kit, 'payload.tar.gz');
  const packed = spawnSync('/usr/bin/tar', ['-czf', payload, '-C', temp, 'apps'], { stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } });
  if (packed.error) throw packed.error;
  if (packed.status !== 0) throw new Error('Não foi possível criar o payload.');
  const originalAsarSha256 = await hashFile(archive);
  const payloadSha256 = await hashFile(payload);
  const target = {
    patchId: `changes-and-pr-creation-${originalAsarSha256.slice(0, 12)}-${payloadSha256.slice(0, 12)}`,
    version: packageJson.version, originalSourceCommit: packageJson.t3codeCommitHash,
    arch: process.arch, originalAsarSha256,
    originalPlistSha256: await hashFile(path.join(app, 'Contents/Info.plist')),
    payloadSha256, changedFiles, removedFiles,
  };
  await fs.writeFile(path.join(kit, 'target.json'), JSON.stringify(target, null, 2) + '\n');
  console.log(JSON.stringify({ version: target.version, changedFiles: Object.keys(changedFiles).length, removedFiles: removedFiles.length, payloadBytes: (await fs.stat(payload)).size }, null, 2));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
