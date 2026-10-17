import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function loadAsar(repo) {
  for (const require of [createRequire(import.meta.url), createRequire(path.join(repo, 'scripts/package.json'))]) {
    try { return await import(pathToFileURL(require.resolve('@electron/asar')).href); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND' && error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('Dependência @electron/asar ausente. Instale as dependências do checkout com vp install ou, neste kit, npm install --ignore-scripts usando Node 24+.');
}

export function classifyArchive(actualHash, target, marker) {
  if (actualHash === target.originalAsarSha256) return 'original';
  if (marker?.patchId === target.patchId && marker?.patchedAsarSha256 === actualHash) {
    return 'patched';
  }
  throw new Error('A instalação mudou. Este patch é exclusivo da versão registrada em target.json. Leia AGENTS.md para adaptar o kit; o aplicativo não foi alterado.');
}

export function payloadPath(root, relative) {
  if (!relative.startsWith('apps/server/dist/client/') || relative.includes('\\') || relative.split('/').includes('..')) {
    throw new Error(`Caminho de payload inválido: ${relative}`);
  }
  return path.join(root, relative);
}

export async function readMarker(app) {
  try {
    return JSON.parse(await fs.readFile(path.join(app, 'Contents/Resources/t3code-local-patch.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function repackArchive(asar, original, destination, extractedRoot, payloadRoot, target) {
  const unpacked = new Set();
  function collect(entry, prefix = '', inherited = false) {
    for (const [name, child] of Object.entries(entry.files ?? {})) {
      const relative = prefix ? `${prefix}/${name}` : name;
      const isUnpacked = inherited || child.unpacked === true;
      if (isUnpacked) unpacked.add(relative);
      collect(child, relative, isUnpacked);
    }
  }
  collect(asar.getRawHeader(original).header);
  asar.extractAll(original, extractedRoot);
  for (const relative of target.removedFiles) {
    await fs.rm(payloadPath(extractedRoot, relative), { force: true });
  }
  for (const [relative, digest] of Object.entries(target.changedFiles)) {
    const source = payloadPath(payloadRoot, relative);
    if (await hashFile(source) !== digest) throw new Error(`Payload corrompido: ${relative}`);
    const dest = payloadPath(extractedRoot, relative);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(source, dest);
  }
  const streams = [];
  async function walk(relative = '') {
    const directory = path.join(extractedRoot, relative);
    const entries = (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const fullPath = path.join(extractedRoot, name);
      const stat = await fs.lstat(fullPath);
      const common = { path: name, stat, unpacked: unpacked.has(name), streamGenerator: () => createReadStream(fullPath) };
      if (entry.isDirectory()) {
        streams.push({ ...common, type: 'directory' });
        await walk(name);
      } else if (entry.isSymbolicLink()) {
        streams.push({ ...common, type: 'link', symlink: await fs.readlink(fullPath) });
      } else if (entry.isFile()) {
        streams.push({ ...common, type: 'file' });
      } else {
        throw new Error(`Tipo de arquivo inesperado: ${name}`);
      }
    }
  }
  await walk();
  await asar.createPackageFromStreams(destination, streams);
  asar.uncache(destination);
  const headerHash = createHash('sha256').update(asar.getRawHeader(destination).headerString).digest('hex');
  return { headerHash, archiveHash: await hashFile(destination) };
}
