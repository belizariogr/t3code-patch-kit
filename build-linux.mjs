#!/usr/bin/env node
// Recover only the public production defaults embedded in the installed release.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadAsar } from './patch-lib.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--source', '--app'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('Uso: node build-linux.mjs --source /worktree [--app /caminho/do/app]');
  args[process.argv[i].slice(2)] = path.resolve(process.argv[i + 1]);
}
if (!args.source) throw new Error('Informe --source.');
const asar = await loadAsar(args.source);
const app = args.app ?? (process.platform === 'linux' ? '/usr/lib/t3code' : '/Applications/T3 Code (Beta).app');
const archive = path.join(app, app.endsWith('.app') ? 'Contents/Resources/app.asar' : 'resources/app.asar');
const metadata = JSON.parse(asar.extractFile(archive, 'package.json'));
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: args.source, encoding: 'utf8' });
if (revision.status !== 0 || !revision.stdout.trim().startsWith(metadata.t3codeCommitHash)) throw new Error('O worktree não está no commit exato da instalação.');
const names = asar.listPackage(archive).map(n => n.replace(/^\//, ''));
const server = names.filter(n => /^apps\/server\/dist\/[^/]+\.mjs$/.test(n)).map(n => asar.extractFile(archive, n).toString()).join('\n');
const web = names.filter(n => /^apps\/server\/dist\/client\/assets\/[^/]+\.js$/.test(n)).map(n => asar.extractFile(archive, n).toString()).join('\n');
function match(source, expression, label) {
  const matches = [...source.matchAll(expression)];
  const values = new Set(matches.map(m => m[1]));
  if (values.size !== 1) throw new Error(`Não foi possível recuperar univocamente ${label}; adapte o extrator à release.`);
  return [...values][0];
}
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITE_') && !/^T3CODE_(CLERK|RELAY|MOBILE_OTLP)/.test(k)));
env.APP_VERSION = metadata.version;
env.T3CODE_WEB_SOURCEMAP = '0';
env.T3CODE_RELAY_URL = match(server, /const buildTimeRelayUrl = normalizeSecureRelayUrl\("([^"\n]*)"\)/g, 'relay URL');
env.T3CODE_CLERK_PUBLISHABLE_KEY = match(server, /const buildTimeClerkPublishableKey = readBuildTimeValue\("([^"\n]*)"\)/g, 'Clerk publishable key');
env.T3CODE_CLERK_CLI_OAUTH_CLIENT_ID = match(server, /const buildTimeClerkCliOAuthClientId = readBuildTimeValue\("([^"\n]*)"\)/g, 'OAuth client ID');
env.T3CODE_CLERK_JWT_TEMPLATE = match(web, /clerkJwtTemplate:\w+\(`([^`\n]*)`\)/g, 'JWT template');
const tracing = match(server, /const buildTimeRelayClientTracing = \{([\s\S]*?)\};/g, 'public tracing config');
for (const [field, suffix] of [['tracesUrl', 'URL'], ['tracesDataset', 'DATASET'], ['tracesToken', 'TOKEN']]) {
  env[`T3CODE_RELAY_CLIENT_OTLP_TRACES_${suffix}`] = match(tracing, new RegExp(`${field}: readBuildTimeValue\\("([^"\\n]*)"\\)`, 'g'), `public tracing ${field}`);
}
for (const file of ['.env', '.env.local']) {
  try { await fs.access(path.join(args.source, file)); throw new Error(`Remova ${file} do worktree de build para não incorporar configurações locais.`); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
}
const serverPackage = path.join(args.source, 'apps/server/package.json');
const original = await fs.readFile(serverPackage, 'utf8');
try {
  const pkg = JSON.parse(original); pkg.version = metadata.version;
  await fs.writeFile(serverPackage, JSON.stringify(pkg, null, 2) + '\n');
  for (const target of ['@t3tools/web', 't3']) {
    const command = target === 't3' ? 'build:bundle' : 'build';
    console.log(`Compilando ${target} ${metadata.version} com configuração pública recuperada (valores omitidos).`);
    const r = spawnSync(path.join(args.source, 'node_modules/.bin/vp'), ['run', '--filter', target, command], { cwd: args.source, env, stdio: 'inherit' });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`Build ${target} falhou (${r.status}).`);
  }
} finally { await fs.writeFile(serverPackage, original); }
