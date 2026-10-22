#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFile, loadAsar } from './patch-lib.mjs';

const kit = path.dirname(fileURLToPath(import.meta.url));
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!['--repo', '--app', '--output', '--commit', '--profile'].includes(key) || !process.argv[i + 1]) throw new Error(`Argumento inválido: ${key}`);
  args[key.slice(2)] = process.argv[i + 1];
}
const repo = path.resolve(args.repo ?? path.join(kit, '../t3code'));
function git(commandArgs, cwd = repo, allowFailure = false) {
  const result = spawnSync('git', commandArgs, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
}
const manifest = JSON.parse(await fs.readFile(path.join(kit, 'manifest.json'), 'utf8'));
let commit = args.commit;
let version = 'source-only';
if (!commit) {
  const app = path.resolve(args.app ?? (process.platform === 'linux' ? '/usr/lib/t3code' : '/Applications/T3 Code (Beta).app'));
  const asar = await loadAsar(repo);
  const metadata = JSON.parse(asar.extractFile(path.join(app, app.endsWith('.app') ? 'Contents/Resources/app.asar' : 'resources/app.asar'), 'package.json'));
  commit = metadata.t3codeCommitHash;
  version = metadata.version;
}
if (!/^[a-f0-9]{7,40}$/i.test(commit ?? '')) throw new Error('Não foi possível determinar o commit da instalação. Resolva a tag oficial e informe --commit SHA.');
const resolved = git(['rev-parse', '--verify', `${commit}^{commit}`], repo, true);
if (resolved.status !== 0) throw new Error(`Commit ${commit} ausente no fork. Busque a tag/commit da release oficial e execute novamente; não use o HEAD como substituto.`);
commit = resolved.stdout.trim();
const ancestor = (base) => git(['merge-base', '--is-ancestor', base, commit], repo, true).status === 0;
const profile = args.profile ?? (manifest.linux && ancestor(manifest.linux.upstreamBase) ? 'linux' : ancestor(manifest.upstreamBase) ? 'modern' : ancestor(manifest.legacyBase) ? 'legacy' : null);
if (!['modern', 'legacy', 'linux'].includes(profile)) throw new Error('A release não corresponde às bases conhecidas. Porte as mudanças para o commit exato; não use main como substituto.');
if (profile === 'legacy' && !ancestor(manifest.legacyBase)) throw new Error('A versão antecede as bases do kit. É necessário portar as duas mudanças manualmente.');
const patches = profile === 'linux' ? ['linux-customizations.patch'] : profile === 'modern' ? ['customizations.patch'] : [
  ...(ancestor(manifest.changesCommit) ? [] : ['legacy-changes.patch']),
  'legacy-pr-creation.patch',
];
for (const name of patches) {
  const relative = `patches/${name}`;
  if (await hashFile(path.join(kit, relative)) !== manifest.sha256[relative]) throw new Error(`Patch corrompido: ${name}`);
}
const output = path.resolve(args.output ?? path.join(path.dirname(repo), `t3code-patch-build-${Date.now()}`));
git(['worktree', 'add', '--detach', output, commit]);
console.log(`Fonte isolada: ${output}\nCommit oficial: ${commit}\nPerfil: ${profile}`);
for (const name of patches) {
  const file = path.join(kit, 'patches', name);
  if (git(['apply', '--reverse', '--check', file], output, true).status === 0) continue;
  const result = git(['apply', '--3way', file], output, true);
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    console.error(`Conflitos preservados em ${output}. Resolva usando AGENTS.md; nenhum aplicativo foi alterado.`);
    process.exitCode = 1;
    break;
  }
}
await fs.writeFile(`${output}.patch-context.json`, JSON.stringify({ commit, version, profile, patches, kit }, null, 2) + '\n');
