#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyArchive, hashFile, loadAsar, readMarker, repackArchive } from './patch-lib.mjs';

const kit = path.dirname(fileURLToPath(import.meta.url));
const options = { app: '/Applications/T3 Code (Beta).app', repo: path.resolve(kit, '../t3code'), mode: 'apply' };
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--app' || arg === '--repo' || arg === '--output') {
    if (!process.argv[i + 1] || process.argv[i + 1].startsWith('--')) throw new Error(`Falta valor para ${arg}`);
    options[arg.slice(2)] = path.resolve(process.argv[++i]);
  } else if (arg === '--check') options.mode = 'check';
  else if (arg === '--restore') options.mode = 'restore';
  else if (arg === '--help') {
    console.log('Uso: ./apply.sh [--check | --restore | --output /caminho/Copia.app] [--app /caminho/T3.app] [--repo /caminho/t3code]');
    process.exit(0);
  } else throw new Error(`Argumento desconhecido: ${arg}`);
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} terminou com código ${result.status}: ${result.stderr ?? ''}`);
  return result.stdout?.trim();
}

async function assertStopped(app) {
  const processes = run('/bin/ps', ['-axo', 'pid=,comm='], true).split('\n');
  const running = processes.filter((line) => {
    const match = /^\s*(\d+)\s+(.+)$/.exec(line);
    return match && Number(match[1]) !== process.pid && match[2].startsWith(`${app}/Contents/`);
  });
  if (running.length) throw new Error('Feche o T3 Code antes de aplicar ou restaurar. Para testar sem fechá-lo, use --output /tmp/T3-patched.app.');
}

async function exists(file) {
  try { await fs.access(file); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function swap(app, candidate, workspace) {
  const old = path.join(workspace, 'previous.app');
  await fs.rename(app, old);
  try { await fs.rename(candidate, app); } catch (error) {
    await fs.rename(old, app);
    throw error;
  }
}

async function main() {
  if (process.platform !== 'darwin') throw new Error('Este script atende somente ao macOS.');
  if (Number(process.versions.node.split('.')[0]) < 24) {
    const executable = run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', path.join(options.app, 'Contents/Info.plist')], true);
    const result = spawnSync(path.join(options.app, 'Contents/MacOS', executable), [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ELECTRON_NO_ASAR: '1' },
    });
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
  }
  const target = JSON.parse(await fs.readFile(path.join(kit, 'target.json'), 'utf8'));
  const originalAsar = path.join(options.app, 'Contents/Resources/app.asar');
  const actualHash = await hashFile(originalAsar);
  const marker = await readMarker(options.app);
  const state = classifyArchive(actualHash, target, marker);
  if (process.arch !== target.arch) throw new Error(`Este payload é para ${target.arch}.`);
  const plistFile = path.join(options.app, 'Contents/Info.plist');
  const version = run('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', plistFile], true);
  if (version !== target.version) throw new Error(`Versão incompatível: ${version}`);
  if (state === 'original' && await hashFile(plistFile) !== target.originalPlistSha256) throw new Error('O Info.plist mudou; adapte o patch antes de continuar.');
  const payloadArchive = path.join(kit, 'payload.tar.gz');
  if (await hashFile(payloadArchive) !== target.payloadSha256) throw new Error('payload.tar.gz corrompido.');
  console.log(`Versão: ${version}\nEstado: ${state === 'patched' ? 'patch já aplicado' : 'compatível com o patch'}`);
  if (options.mode === 'check') return;
  if (options.mode === 'restore' && options.output) throw new Error('--restore não aceita --output.');
  if (state === 'patched' && options.mode !== 'restore') { console.log('Nenhuma alteração necessária.'); return; }
  if (state === 'original' && options.mode === 'restore') { console.log('O aplicativo já está no estado original.'); return; }
  if (!options.output) await assertStopped(options.app);
  const tempParent = options.output ? path.dirname(options.output) : path.dirname(options.app);
  await fs.mkdir(tempParent, { recursive: true });
  if (options.output && await exists(options.output)) throw new Error(`O destino já existe: ${options.output}`);
  const temp = await fs.mkdtemp(path.join(tempParent, '.t3code-patch-'));
  let keepWorkspace = false;
  try {
    const candidate = path.join(temp, path.basename(options.app));
    if (options.mode === 'restore') {
      if (!marker.backupPath) throw new Error('Esta cópia de teste não tem backup de instalação.');
      const backup = path.resolve(marker.backupPath);
      const backupRoot = `${path.join(kit, 'backups')}${path.sep}`;
      if (!backup.startsWith(backupRoot)) throw new Error('Backup fora da pasta do kit.');
      if (await hashFile(path.join(backup, 'Contents/Resources/app.asar')) !== target.originalAsarSha256) throw new Error('Backup inválido.');
      run('/usr/bin/ditto', [backup, candidate]);
      await assertStopped(options.app);
      keepWorkspace = true;
      await swap(options.app, candidate, temp);
      keepWorkspace = false;
      console.log(`Aplicativo original restaurado. Backup preservado em ${backup}`);
      return;
    }
    console.log('Preparando cópia e recompacotando o app.asar...');
    run('/usr/bin/ditto', [options.app, candidate]);
    const entitlements = path.join(temp, 'adhoc.entitlements');
    const dumped = spawnSync('/usr/bin/codesign', ['-d', '--entitlements', '-', '--xml', candidate], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (dumped.error) throw dumped.error;
    if (dumped.status !== 0) throw new Error(`Não foi possível ler os entitlements: ${dumped.stderr}`);
    await fs.writeFile(entitlements, dumped.stdout);
    for (const key of ['com.apple.application-identifier', 'com.apple.developer.associated-domains', 'com.apple.developer.team-identifier', 'keychain-access-groups']) {
      spawnSync('/usr/libexec/PlistBuddy', ['-c', `Delete :${key}`, entitlements]);
    }
    const asar = await loadAsar(options.repo);
    const extracted = path.join(temp, 'extracted');
    const payload = path.join(temp, 'payload');
    await fs.mkdir(payload);
    run('/usr/bin/tar', ['-xzf', payloadArchive, '-C', payload]);
    const archive = path.join(candidate, 'Contents/Resources/app.asar');
    const packed = path.join(temp, 'packed.asar');
    const result = await repackArchive(asar, originalAsar, packed, extracted, payload, target);
    await fs.rename(packed, archive);
    const plist = path.join(candidate, 'Contents/Info.plist');
    run('/usr/libexec/PlistBuddy', ['-c', `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${result.headerHash}`, plist]);
    const backup = options.output ? null : path.join(kit, 'backups', new Date().toISOString().replaceAll(':', '-'), path.basename(options.app));
    await fs.writeFile(path.join(candidate, 'Contents/Resources/t3code-local-patch.json'), JSON.stringify({
      patchId: target.patchId, originalAsarSha256: target.originalAsarSha256,
      patchedAsarSha256: result.archiveHash, backupPath: backup, appliedAt: new Date().toISOString(),
    }, null, 2) + '\n');
    const ticket = path.join(candidate, 'Contents/CodeResources');
    if (await exists(ticket)) await fs.rm(ticket);
    run('/usr/bin/codesign', ['--force', '--sign', '-', '--options', 'runtime', '--entitlements', entitlements, candidate]);
    run('/usr/bin/codesign', ['--verify', '--deep', '--strict', candidate]);
    if (options.output) {
      await fs.rename(candidate, options.output);
      console.log(`Cópia com patch: ${options.output}`);
      return;
    }
    await assertStopped(options.app);
    if (await hashFile(originalAsar) !== actualHash) throw new Error('O aplicativo foi atualizado durante a operação; tente novamente.');
    await fs.mkdir(path.dirname(backup), { recursive: true });
    run('/usr/bin/ditto', [options.app, backup]);
    if (await hashFile(path.join(backup, 'Contents/Resources/app.asar')) !== target.originalAsarSha256) throw new Error('A verificação do backup falhou.');
    try { await swap(options.app, candidate, temp); } catch (error) { keepWorkspace = true; throw error; }
    console.log(`Patch aplicado.\nBackup: ${backup}\nPara desfazer: ./apply.sh --restore`);
  } finally {
    if (!keepWorkspace) await fs.rm(temp, { recursive: true, force: true });
    else console.error(`Arquivos de recuperação preservados em ${temp}`);
  }
}

main().catch((error) => { console.error(`Erro: ${error.message}`); process.exitCode = 1; });
