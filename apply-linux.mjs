#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyArchive, hashFile, loadAsar, repackArchive } from './patch-lib.mjs';
import { assertLinuxStopped, copyLinuxInstallation, verifyInstallationFiles } from './linux-lib.mjs';

const kit = path.dirname(fileURLToPath(import.meta.url));
const options = { app: '/usr/lib/t3code', repo: path.resolve(kit, '../t3code'), mode: 'apply' };
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (['--app', '--repo', '--output'].includes(arg)) {
    if (!process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw new Error(`Falta valor para ${arg}`);
    options[arg.slice(2)] = path.resolve(process.argv[++i]);
  } else if (['--check', '--restore'].includes(arg)) options.mode = arg.slice(2);
  else if (arg === '--help') {
    console.log('Uso: ./apply.sh [--check | --restore | --output /caminho/copia] [--app /usr/lib/t3code] [--repo /caminho/t3code]');
    process.exit(0);
  } else throw new Error(`Argumento desconhecido: ${arg}`);
}
function run(command, args) {
  const r = spawnSync(command, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${command} terminou com código ${r.status}.`);
}
async function exists(file) {
  try { await fs.lstat(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}
const archiveAt = app => path.join(app, 'resources/app.asar');
const markerAt = app => path.join(app, 'resources/t3code-local-patch.json');
async function readMarker(app) {
  try { return JSON.parse(await fs.readFile(markerAt(app), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
async function swap(app, candidate, workspace) {
  const previous = path.join(workspace, 'previous');
  await fs.rename(app, previous);
  try { await fs.rename(candidate, app); } catch (e) { await fs.rename(previous, app); throw e; }
}
async function main() {
  if (process.platform !== 'linux') throw new Error('O perfil Linux requer Linux. Use ./apply.sh para detectar o sistema.');
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Use Node 24 ou mais recente, sem alterar o Node global.');
  if (options.mode === 'restore' && options.output) throw new Error('--restore não aceita --output.');
  options.app = await fs.realpath(options.app);
  const target = JSON.parse(await fs.readFile(path.join(kit, 'linux/target.json'), 'utf8'));
  if (target.platform !== 'linux' || process.arch !== target.arch) throw new Error('Sistema ou arquitetura incompatível com o perfil Linux.');
  const original = archiveAt(options.app);
  const actualHash = await hashFile(original);
  const marker = await readMarker(options.app);
  const state = classifyArchive(actualHash, target, marker);
  await verifyInstallationFiles(options.app, target.originalFiles);
  const asar = await loadAsar(options.repo);
  const pkg = JSON.parse(asar.extractFile(original, 'package.json'));
  if (pkg.version !== target.version || pkg.t3codeCommitHash !== target.originalSourceCommit) throw new Error('Versão ou commit incompatível.');
  const payloadArchive = path.join(kit, 'linux/payload.tar.gz');
  if (await hashFile(payloadArchive) !== target.payloadSha256) throw new Error('Payload Linux corrompido.');
  console.log(`Sistema: Linux ${target.arch}\nVersão: ${pkg.version} (${pkg.t3codeCommitHash})\nEstado: ${state === 'patched' ? 'patch já aplicado' : 'compatível com o patch'}`);
  if (options.mode === 'check') return;
  if (state === 'patched' && options.mode !== 'restore') { console.log('Nenhuma alteração necessária.'); return; }
  if (state === 'original' && options.mode === 'restore') { console.log('O aplicativo já está no estado original.'); return; }
  if (!options.output) await assertLinuxStopped(options.app);
  if (options.output && (options.output.startsWith(`${options.app}/`) || options.app.startsWith(`${options.output}/`) || options.output === options.app)) throw new Error('A cópia deve ficar fora da instalação.');
  const parent = options.output ? path.dirname(options.output) : path.dirname(options.app);
  await fs.mkdir(parent, { recursive: true });
  if (options.output && await exists(options.output)) throw new Error('O destino já existe.');
  // A lock beside the installation serializes apply/restore; --output never locks the live app.
  const lock = options.output ? null : `${options.app}.local-patch-lock`;
  if (lock) await fs.mkdir(lock);
  let temp;
  let preserve = false;
  try {
    temp = await fs.mkdtemp(path.join(parent, '.t3code-patch-'));
    const candidate = path.join(temp, 'candidate');
    const backup = options.mode === 'restore' ? marker.backupPath : options.output ? null : path.join(kit, 'backups/linux', new Date().toISOString().replaceAll(':', '-'), path.basename(options.app));
    if (options.mode === 'restore') {
      if (!backup || !(await fs.realpath(backup)).startsWith(`${await fs.realpath(path.join(kit, 'backups'))}/`)) throw new Error('Backup ausente ou fora da pasta do kit.');
      if (await hashFile(archiveAt(backup)) !== target.originalAsarSha256) throw new Error('Backup inválido.');
      await verifyInstallationFiles(backup, target.originalFiles);
      await copyLinuxInstallation(backup, candidate, target.originalFiles);
    } else {
      console.log('Preparando cópia e recompacotando o ASAR...');
      await copyLinuxInstallation(options.app, candidate, target.originalFiles);
      const payload = path.join(temp, 'payload'); await fs.mkdir(payload);
      run('/usr/bin/tar', ['-xzf', payloadArchive, '-C', payload]);
      const result = await repackArchive(asar, original, archiveAt(candidate), path.join(temp, 'extracted'), payload, target);
      await fs.writeFile(markerAt(candidate), JSON.stringify({ patchId: target.patchId, originalAsarSha256: target.originalAsarSha256, patchedAsarSha256: result.archiveHash, backupPath: backup, appliedAt: new Date().toISOString() }, null, 2) + '\n');
    }
    await verifyInstallationFiles(candidate, target.originalFiles);
    if (options.output) {
      if (await exists(options.output)) throw new Error('O destino foi ocupado durante a preparação.');
      await fs.rename(candidate, options.output);
      console.log(`Cópia com patch: ${options.output}`); return;
    }
    await assertLinuxStopped(options.app);
    if (await hashFile(original) !== actualHash) throw new Error('A instalação mudou durante a preparação.');
    await verifyInstallationFiles(options.app, target.originalFiles);
    if (options.mode !== 'restore') {
      await fs.mkdir(path.dirname(backup), { recursive: true });
      await copyLinuxInstallation(options.app, backup, target.originalFiles);
      if (await hashFile(archiveAt(backup)) !== target.originalAsarSha256) throw new Error('A verificação do backup falhou.');
      await verifyInstallationFiles(backup, target.originalFiles);
    }
    await assertLinuxStopped(options.app);
    if (await hashFile(original) !== actualHash) throw new Error('A instalação mudou durante o backup.');
    await verifyInstallationFiles(options.app, target.originalFiles);
    preserve = true;
    await swap(options.app, candidate, temp);
    preserve = false;
    console.log(`${options.mode === 'restore' ? 'Original restaurado' : 'Patch aplicado'}.\nBackup preservado: ${backup}`);
  } finally {
    if (temp && !preserve) await fs.rm(temp, { recursive: true, force: true });
    if (preserve) console.error(`Arquivos de recuperação preservados em ${temp}`);
    if (lock) await fs.rmdir(lock);
  }
}
main().catch(e => {
  console.error(`Erro: ${e.message}`);
  if (['EACCES', 'EPERM'].includes(e.code)) console.error('Para uma instalação protegida, execute em Terminal externo: sudo env "PATH=$PATH" ./apply.sh');
  process.exitCode = 1;
});
