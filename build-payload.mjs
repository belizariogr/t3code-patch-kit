#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFile, loadAsar } from './patch-lib.mjs';
import { installationFiles } from './linux-lib.mjs';

const kit = path.dirname(fileURLToPath(import.meta.url));
const values = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const arg = process.argv[i];
  if (!['--web-dist', '--server-dist', '--app', '--repo'].includes(arg) || !process.argv[i + 1]) throw new Error(`Argumento inválido: ${arg}`);
  values[arg.slice(2)] = path.resolve(process.argv[i + 1]);
}
if (!values['web-dist']) throw new Error('Uso: node build-payload.mjs --web-dist /caminho/apps/web/dist [--server-dist /caminho/apps/server/dist] [--app /caminho/T3.app] [--repo /caminho/t3code]');
const app = values.app ?? (process.platform === 'linux' ? '/usr/lib/t3code' : '/Applications/T3 Code (Beta).app');
const linux = !app.endsWith('.app');
const includeServer = Boolean(values['server-dist']);
if (linux && !includeServer) throw new Error('O perfil Linux atual exige --server-dist da mesma release.');
const repo = values.repo ?? path.resolve(kit, '../t3code');
const asar = await loadAsar(repo);
const archive = path.join(app, linux ? 'resources/app.asar' : 'Contents/Resources/app.asar');
const packageJson = JSON.parse(asar.extractFile(archive, 'package.json'));
const prefix = 'apps/server/dist/client/';
const bufferHash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const serverPattern = /^apps\/server\/dist\/[\w.-]+\.mjs$/;
const originalFiles = asar.listPackage(archive).map((name) => name.replace(/^\//, '')).filter((name) => (name.startsWith(prefix) || (includeServer && serverPattern.test(name))) && !('files' in asar.statFile(archive, name)));
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
const distribution = new Map([...newFiles].map(([name, content]) => [prefix + name, content]));
if (includeServer) {
  for (const entry of await fs.readdir(values['server-dist'], { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
    const name = `apps/server/dist/${entry.name}`;
    if (!serverPattern.test(name)) throw new Error(`Chunk de servidor inválido: ${entry.name}`);
    distribution.set(name, await fs.readFile(path.join(values['server-dist'], entry.name)));
  }
  if (!distribution.has('apps/server/dist/bin.mjs') || !distribution.has('apps/server/dist/claude-history-worker.mjs')) throw new Error('O build do servidor está incompleto.');
}
const outputDir = linux ? path.join(kit, 'linux') : kit;
await fs.mkdir(outputDir, { recursive: true });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 't3code-payload-'));
try {
  const changedFiles = {};
  for (const [name, content] of distribution) {
    const digest = bufferHash(content);
    if (originalFiles.includes(name) && bufferHash(asar.extractFile(archive, name)) === digest) continue;
    const dest = path.join(temp, name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);
    changedFiles[name] = digest;
  }
  const removedFiles = originalFiles.filter((name) => !distribution.has(name));
  const payload = path.join(outputDir, 'payload.tar.gz');
  const packed = spawnSync('/usr/bin/tar', ['-czf', payload, '-C', temp, 'apps'], { stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } });
  if (packed.error) throw packed.error;
  if (packed.status !== 0) throw new Error('Não foi possível criar o payload.');
  const originalAsarSha256 = await hashFile(archive);
  const payloadSha256 = await hashFile(payload);
  const target = {
    patchId: `changes-and-pr-creation-${originalAsarSha256.slice(0, 12)}-${payloadSha256.slice(0, 12)}`,
    version: packageJson.version, originalSourceCommit: packageJson.t3codeCommitHash,
    arch: process.arch, originalAsarSha256,
    ...(linux ? { platform: 'linux', originalFiles: await installationFiles(app) } : { originalPlistSha256: await hashFile(path.join(app, 'Contents/Info.plist')) }),
    ...(includeServer ? { serverFiles: [...new Set([...distribution.keys(), ...removedFiles].filter((name) => serverPattern.test(name)))].sort() } : {}),
    payloadSha256, changedFiles, removedFiles,
  };
  await fs.writeFile(path.join(outputDir, 'target.json'), JSON.stringify(target, null, 2) + '\n');
  console.log(JSON.stringify({ version: target.version, changedFiles: Object.keys(changedFiles).length, removedFiles: removedFiles.length, payloadBytes: (await fs.stat(payload)).size }, null, 2));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
