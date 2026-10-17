import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyArchive, hashFile, loadAsar, payloadPath, repackArchive } from './patch-lib.mjs';

const kit = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(kit, '../t3code');

test('the same launcher selects macOS or Linux and forwards options', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 't3code-dispatch-test-'));
  try {
    await fs.writeFile(path.join(temp, 'uname'), '#!/bin/sh\nprintf "%s\\n" "$T3CODE_TEST_SYSTEM"\n', { mode: 0o755 });
    await fs.writeFile(path.join(temp, 'node'), '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
    for (const [system, helper] of [['Darwin', 'apply.mjs'], ['Linux', 'apply-linux.mjs']]) {
      const r = spawnSync(path.join(kit, 'apply.sh'), ['--check', '--app', '/path with spaces/app'], { encoding: 'utf8', env: { ...process.env, PATH: `${temp}:${process.env.PATH}`, T3CODE_TEST_SYSTEM: system } });
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(r.stdout.trim().split('\n'), [path.join(kit, helper), '--check', '--app', '/path with spaces/app']);
    }
    const r = spawnSync(path.join(kit, 'apply.sh'), [], { encoding: 'utf8', env: { ...process.env, PATH: `${temp}:${process.env.PATH}`, T3CODE_TEST_SYSTEM: 'unsupported' } });
    assert.notEqual(r.status, 0);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test('refuses a different release and recognizes an unchanged second application', () => {
  const target = { patchId: 'one', originalAsarSha256: 'original' };
  assert.equal(classifyArchive('original', target, null), 'original');
  assert.equal(classifyArchive('patched', target, { patchId: 'one', patchedAsarSha256: 'patched' }), 'patched');
  assert.throws(() => classifyArchive('new-release', target, { patchId: 'one', patchedAsarSha256: 'patched' }), /instalação mudou/);
  assert.throws(() => classifyArchive('patched', target, { patchId: 'different', patchedAsarSha256: 'patched' }));
});

test('restricts every payload write and deletion to the web distribution', () => {
  assert.equal(payloadPath('/tmp/root', 'apps/server/dist/client/index.html'), '/tmp/root/apps/server/dist/client/index.html');
  for (const name of ['../../outside', 'apps/server/dist/client/../../bin.mjs', 'apps/server/dist/bin.mjs', 'apps/server/dist/client/..\\outside']) {
    assert.throws(() => payloadPath('/tmp/root', name));
  }
});

test('repacking changes only the payload, preserves native unpacking and leaves the original intact', async () => {
  const asar = await loadAsar(repo);
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 't3code-kit-test-'));
  try {
    const source = path.join(temp, 'source');
    const payload = path.join(temp, 'payload');
    const web = 'apps/server/dist/client/';
    for (const [relative, value] of Object.entries({
      [`${web}index.html`]: 'old page', [`${web}assets/old.js`]: 'old chunk',
      'apps/server/dist/bin.mjs': 'unchanged server', 'apps/desktop/main.cjs': 'unchanged desktop',
      'node_modules/test/addon.node': 'native fixture',
    })) {
      await fs.mkdir(path.dirname(path.join(source, relative)), { recursive: true });
      await fs.writeFile(path.join(source, relative), value);
    }
    await fs.mkdir(path.join(payload, web), { recursive: true });
    const newPage = path.join(payload, web, 'index.html');
    await fs.writeFile(newPage, 'patched page');
    const original = path.join(temp, 'original.asar');
    const dest = path.join(temp, 'patched.asar');
    await asar.createPackageWithOptions(source, original, { unpack: '*.node' });
    const originalHash = await hashFile(original);
    const target = { changedFiles: { [`${web}index.html`]: await hashFile(newPage) }, removedFiles: [`${web}assets/old.js`] };
    const result = await repackArchive(asar, original, dest, path.join(temp, 'extracted'), payload, target);
    assert.equal(await hashFile(original), originalHash);
    assert.equal(asar.extractFile(dest, `${web}index.html`).toString(), 'patched page');
    assert.equal(asar.extractFile(dest, 'apps/server/dist/bin.mjs').toString(), 'unchanged server');
    assert.equal(asar.extractFile(dest, 'apps/desktop/main.cjs').toString(), 'unchanged desktop');
    assert.equal(asar.statFile(dest, 'node_modules/test/addon.node').unpacked, true);
    assert.equal(asar.extractFile(dest, 'node_modules/test/addon.node').toString(), 'native fixture');
    assert.throws(() => asar.extractFile(dest, `${web}assets/old.js`));
    assert.equal(result.archiveHash, await hashFile(dest));
    await fs.writeFile(newPage, 'tampered page');
    await assert.rejects(() => repackArchive(asar, original, path.join(temp, 'bad.asar'), path.join(temp, 'bad-extracted'), payload, target), /corrompido/);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
