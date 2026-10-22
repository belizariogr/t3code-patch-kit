import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hashFile, loadAsar, payloadPath } from './patch-lib.mjs';
import { assertLinuxStopped, copyLinuxInstallation, installationFiles, verifyInstallationFiles } from './linux-lib.mjs';

const kit = path.dirname(fileURLToPath(import.meta.url));
test('server payload is limited to individually authorized top-level mjs chunks', () => {
  const target = { serverFiles: ['apps/server/dist/bin.mjs', 'apps/desktop/main.mjs', 'apps/server/dist/../../outside.mjs'] };
  assert.equal(payloadPath('/tmp/root', 'apps/server/dist/bin.mjs', target), '/tmp/root/apps/server/dist/bin.mjs');
  for (const name of ['apps/server/dist/other.mjs', 'apps/desktop/main.mjs', 'apps/server/dist/../../outside.mjs', 'apps/server/dist/nested/test.mjs']) assert.throws(() => payloadPath('/tmp/root', name, target));
});
test('Linux refuses replacement while an executable from that exact installation runs', { skip: process.platform !== 'linux' }, async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 't3code-process-test-'));
  let child;
  try {
    await fs.copyFile('/usr/bin/sleep', path.join(temp, 't3code'));
    await fs.chmod(path.join(temp, 't3code'), 0o755);
    child = spawn(path.join(temp, 't3code'), ['60']); await once(child, 'spawn');
    await assert.rejects(assertLinuxStopped(temp), /Feche o T3 Code/);
    const different = path.join(temp, 'different'); await fs.mkdir(different);
    await assertLinuxStopped(different);
    child.kill(); await once(child, 'exit'); child = null;
    await assertLinuxStopped(temp);
    const files = await installationFiles(temp);
    await fs.chmod(path.join(temp, 't3code'), 0o700);
    await assert.rejects(verifyInstallationFiles(temp, files), /instalação mudaram/);
  } finally { if (child) child.kill(); await fs.rm(temp, { recursive: true, force: true }); }
});
test('real Linux installation: output, CLI, full ASAR comparison, apply, repeat, restore, reject changed release', { skip: !process.env.T3CODE_LINUX_INTEGRATION_APP }, async () => {
  const app = await fs.realpath(process.env.T3CODE_LINUX_INTEGRATION_APP);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 't3code-linux-integration-'));
  const target = JSON.parse(await fs.readFile(path.join(kit, 'linux/target.json')));
  const originalArchive = path.join(app, 'resources/app.asar');
  const originalHash = await hashFile(originalArchive);
  let backup;
  const run = (command, args, env) => {
    const r = spawnSync(command, args, { encoding: 'utf8', env: env ?? process.env, maxBuffer: 1024 * 1024 });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`); return r.stdout;
  };
  const apply = args => run(path.join(kit, 'apply.sh'), args);
  try {
    const output = path.join(temp, 'output');
    apply(['--app', app, '--output', output]);
    assert.match(apply(['--app', output, '--check']), /patch já aplicado/);
    assert.equal(await hashFile(originalArchive), originalHash);
    const asar = await loadAsar(path.resolve(kit, '../t3code'));
    const patchedArchive = path.join(output, 'resources/app.asar');
    const removed = new Set(target.removedFiles);
    let unchanged = 0;
    for (const entry of asar.listPackage(originalArchive)) {
      const name = entry.replace(/^\//, '');
      const stat = asar.statFile(originalArchive, name);
      if ('files' in stat || stat.link) continue;
      if (removed.has(name)) { assert.throws(() => asar.statFile(patchedArchive, name)); continue; }
      assert.equal(asar.statFile(patchedArchive, name).unpacked, stat.unpacked, name);
      if (target.changedFiles[name]) continue;
      assert.deepEqual(asar.extractFile(patchedArchive, name), asar.extractFile(originalArchive, name), name); unchanged++;
    }
    const { createHash } = await import('node:crypto');
    for (const [name, digest] of Object.entries(target.changedFiles)) assert.equal(createHash('sha256').update(asar.extractFile(patchedArchive, name)).digest('hex'), digest, name);
    const cliEnv = { ...process.env, ELECTRON_RUN_AS_NODE: '1', T3CODE_HOME: path.join(temp, 'cli-state') };
    delete cliEnv.ELECTRON_NO_ASAR;
    assert.equal(run(path.join(output, 't3code'), [path.join(patchedArchive, 'apps/server/dist/bin.mjs'), '--version'], cliEnv).trim(), `t3 v${target.version}`);
    const testApp = path.join(temp, 'installed'); await copyLinuxInstallation(app, testApp, target.originalFiles);
    apply(['--app', testApp]);
    const markerFile = path.join(testApp, 'resources/t3code-local-patch.json');
    const marker = await fs.readFile(markerFile, 'utf8'); backup = JSON.parse(marker).backupPath;
    assert.match(apply(['--app', testApp]), /Nenhuma alteração/);
    assert.equal(await fs.readFile(markerFile, 'utf8'), marker);
    apply(['--app', testApp, '--restore']);
    assert.equal(await hashFile(path.join(testApp, 'resources/app.asar')), originalHash);
    await verifyInstallationFiles(testApp, target.originalFiles);
    await fs.appendFile(path.join(testApp, 'resources/app.asar'), 'incompatible-release');
    const bad = spawnSync(path.join(kit, 'apply.sh'), ['--app', testApp, '--check'], { encoding: 'utf8' });
    assert.notEqual(bad.status, 0); assert.match(bad.stderr, /instalação mudou/);
    assert.equal(await hashFile(originalArchive), originalHash);
    console.log(`ASAR: ${unchanged} arquivos originais idênticos; ${Object.keys(target.changedFiles).length} arquivos de payload verificados.`);
    console.log(`Backup de teste preservado: ${backup}`);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
