import * as fs from 'node:fs/promises';
import path from 'node:path';
import { hashFile } from './patch-lib.mjs';
import { spawnSync } from 'node:child_process';

export async function copyLinuxInstallation(source, destination, files) {
  const r = spawnSync('/usr/bin/cp', ['-a', '--', source, destination], { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error('Não foi possível copiar a instalação.');
  // Unprivileged cp clears setuid when the source owner is root. Test copies
  // belong to the caller; an actual root-owned installation is copied as root.
  for (const [name, entry] of Object.entries(files)) {
    if (entry.link !== undefined) continue;
    const file = path.join(destination, name);
    if (((await fs.stat(file)).mode & 0o7777) !== entry.mode) await fs.chmod(file, entry.mode);
  }
}

export async function installationFiles(root) {
  const result = {};
  async function walk(relative = '') {
    for (const name of (await fs.readdir(path.join(root, relative))).sort()) {
      const key = relative ? `${relative}/${name}` : name;
      if (['resources/app.asar', 'resources/t3code-local-patch.json'].includes(key)) continue;
      const file = path.join(root, key);
      const stat = await fs.lstat(file);
      const mode = stat.mode & 0o7777;
      if (stat.isSymbolicLink()) result[key] = { link: await fs.readlink(file), mode };
      else if (stat.isDirectory()) { result[key] = { directory: true, mode }; await walk(key); }
      else if (stat.isFile()) result[key] = { sha256: await hashFile(file), mode };
      else throw new Error(`Tipo de arquivo inesperado: ${key}`);
    }
  }
  await walk();
  return result;
}

export async function verifyInstallationFiles(root, expected) {
  const actual = await installationFiles(root);
  const changed = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].filter(name => JSON.stringify(actual[name]) !== JSON.stringify(expected[name]));
  if (changed.length) throw new Error(`O executável, as dependências ou outros arquivos da instalação mudaram: ${changed.slice(0, 5).join(', ')}. Adapte o perfil Linux.`);
}

export async function assertLinuxStopped(app) {
  const root = await fs.realpath(app);
  for (const name of await fs.readdir('/proc')) {
    if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
    try {
      const executable = (await fs.readlink(`/proc/${name}/exe`)).replace(/ \(deleted\)$/, '');
      if (executable.startsWith(`${root}/`)) throw new Error(`Feche o T3 Code antes de aplicar ou restaurar (PID ${name}). Use um Terminal externo; para testar com o aplicativo aberto, use --output.`);
    } catch (e) {
      // Other users' processes may be inaccessible; never signal any process.
      if (!['ENOENT', 'EACCES', 'EPERM', 'ESRCH'].includes(e.code)) throw e;
    }
  }
}
