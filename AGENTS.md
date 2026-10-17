# Instruções para o LLM responsável pelo patch

## Objetivo autorizado

Manter duas personalizações no T3 Code para **macOS e Linux**, reaplicáveis após atualizações oficiais:

1. **Changes scope**: `changesScope` aceita `branch`, `uncommitted` ou `thread`, globalmente e por projeto. O contador e o painel usam o mesmo escopo. Conversation calcula o diff líquido entre o início e o último checkpoint pronto de um turno concluído, sem somar alterações repetidas de cada turno. Preserve abertura explícita, seleção de turno/arquivo e abertura automática do painel.
2. **Criação de PRs**: `pullRequestCreationEnabled` é verdadeiro por padrão e pode ser sobrescrito por projeto. Quando falso, oculte caminhos de criação no controle Git, ações rápidas e toasts de resultados. Releia a configuração ao executar ações assíncronas; não use um valor capturado antes de a preferência mudar. Preserve a última configuração conhecida durante recargas. Antes do primeiro carregamento, não ofereça criação de PR. Commit, push e acesso a PRs existentes continuam disponíveis.

Isto controla ações de criação da interface. Não promete impedir ferramentas próprias dos agentes ou a CLI do GitHub. O instalador não liga/desliga preferências e não modifica `settings.json` nem bancos para simular recursos.

**Preserve os dois sistemas.** Ao adaptar uma release de Linux, mantenha payload, fingerprints, patches e fluxo macOS; faça o equivalente ao adaptar macOS. `./apply.sh` detecta `uname -s`, seleciona o instalador e este confere arquitetura, versão, commit/fingerprints. A mesma versão textual pode representar builds diferentes. Não acrescente opção para forçar hash incompatível.

## Cuidados com o ambiente em uso

- O repositório padrão é o irmão `../t3code`. Leia seu AGENTS.md e o do worktree da release antes de alterar fontes. Se o clone foi feito com `--no-checkout`, leia `git show COMMIT:AGENTS.md` antes de criar/alterar o worktree.
- Não abra `~/.t3/userdata` para escrita, não inicie servidores contra essa base e não copie estado de teste de volta para ela. Não altere os diretórios reais de perfil Electron, inclusive `~/.config/t3code-v2`.
- Não use `pkill`, não encerre processos identificados por padrões e não feche o T3 Code que hospeda o agente. A pessoa executará o script por um Terminal externo quando fechar o aplicativo. O instalador recusa aplicação/restauração com processos daquele diretório ativos.
- Não abra navegador, UI ou ferramentas de computer use sem autorização explícita. Testes de arquivo, CLI `--version`, leitura de fuses e verificação de assinatura não precisam abrir a UI.
- Trabalhe em cópia/worktree. Não sobrescreva a instalação durante preparação, compilação ou testes. Não crie PRs, publique o kit ou configure atualização automática sem pedido.
- Não altere o Node global. Use o runtime disponível. Não execute checks do monorepo inteiro.

## Perfis e proveniência

- **macOS arm64**: `/Applications/T3 Code (Beta).app`, versão `0.1.0-disable-pr-creation.20261016`, commit `66c4f1b87b99`. `target.json` e `payload.tar.gz` na raiz são o perfil original, preservado. O servidor instalado já contém os contratos; o payload altera somente `apps/server/dist/client/`.
- **Linux x64**: `/usr/lib/t3code/t3code`, pacote Arch `t3code-bin 0.1.0-1`, versão ASAR `0.1.0`, commit exato `81493efb71e8e8244f95d3e9f71d8369654ab151`. `linux/target.json` e `linux/payload.tar.gz` são independentes. A release não tinha os contratos; o payload inclui cliente e os chunks `.mjs` necessários do servidor da mesma release. Electron, pacote raiz, IPC desktop, dependências e binários nativos são preservados.
- `manifest.json` registra a base upstream moderna `2fae0f9841448e6edb93d0ebe4cbaf2d546bb38c` e a integração final do fork `7fb09a2af59d1e33d3535d29315cc392d97132e6`, merge seguido da adaptação ao React Compiler.
- `patches/customizations.patch` contém somente as duas funcionalidades em relação à base moderna, sem as centenas de mudanças upstream do merge.
- O perfil `legacy` aplica `legacy-changes.patch` sobre `3b99fb2d2` e `legacy-pr-creation.patch` sobre `66c4f1b87`. O segundo contém a criação de PRs, suas três correções posteriores e a importação do default de Changes necessária à base antiga. O preparador pula Changes quando o commit já o contém.
- O perfil `linux` aplica `patches/linux-customizations.patch` sobre `81493efb71e8`, com a adaptação dos conflitos à release oficial, preservação da abertura automática de Changes em `ChatView` e adaptação do controle novo ao React Compiler. Inclui teste de persistência/broadcast das configurações no servidor.
- `reference-installed-version/`: fontes do payload macOS. `reference/`: integração moderna. `reference-linux/`: fontes do payload Linux. Use como referência para conflitos; **não substitua arquivos inteiros de uma release futura**, pois isso reverteria atualizações oficiais.

## Aplicação pronta

`./apply.sh --check` é somente leitura e pode rodar com o app aberto. `./apply.sh --output CAMINHO` prepara uma cópia sem substituir a instalação e também pode rodar com o app aberto. O destino deve estar livre. No Linux, ele deve ficar fora do diretório de origem. Cópias de `--output` não têm backup de instalação; `--restore` não se aplica a elas.

Para aplicar/restaurar, a pessoa fecha o app e usa Terminal externo:

```sh
# macOS
./apply.sh
./apply.sh --restore

# Linux, instalação pertencente a root; manter o Node do usuário no PATH
sudo env "PATH=$PATH" ./apply.sh
sudo env "PATH=$PATH" ./apply.sh --restore
```

`--app` seleciona outra cópia da mesma instalação. `--repo` seleciona a fonte de `@electron/asar` quando ausente no kit. As dependências também podem ser instaladas no kit com `npm ci --ignore-scripts` usando Node 24+.

O fluxo é: conferir fingerprints → copiar a instalação → extrair/reempacotar preservando unpacked → verificar a cópia → criar backup completo → conferir novamente a origem/processos → trocar diretório com rollback. O marcador liga o hash do ASAR alterado ao patch e ao backup; uma atualização que trocar o ASAR invalida esse reconhecimento. Preserve backups até a pessoa confirmar o funcionamento.

No **macOS**, `apply.mjs` atualiza a integridade ASAR no plist, assina ad hoc e verifica a assinatura. Com Node anterior a 24, relança pelo Node do Electron com `ELECTRON_RUN_AS_NODE=1` e `ELECTRON_NO_ASAR=1`; o segundo evita interceptação da leitura binária do ASAR. O alvo original já era ad hoc. Uma assinatura ad hoc não reproduz privilégios Apple: reavalie entitlements, keychain e passkeys se o próximo alvo for oficialmente assinado.

No **Linux**, `apply-linux.mjs` confere também todos os arquivos externos ao ASAR, links e modos com `linux-lib.mjs`. `cp -a` preserva metadados; cópias sem privilégios precisam repor o modo setuid de `chrome-sandbox`, que o cp pode limpar ao trocar seu proprietário. A aplicação em `/usr/lib` deve rodar como root para manter também a propriedade. Cópias de teste pertencem ao usuário que as criou. A detecção de processos lê `/proc/PID/exe`, sem sinais, e um lock ao lado da instalação serializa aplicação/restauração. Não remova um lock sem investigar uma execução interrompida. O Electron Linux atual tem `EnableEmbeddedAsarIntegrityValidation` desabilitado na origem; não alteramos fuses nem o executável. Se isso mudar numa release, adapte a verificação/empacotamento; não desabilite integridade para contorná-la.

O validador de payload permite cliente web e, **somente quando explicitamente listados em `serverFiles` no target**, chunks `apps/server/dist/NOME.mjs` no nível imediato. O macOS atual não tem essa permissão extra. Não libere toda a árvore de servidor ou `node_modules`.

## Reconstruir o Linux atual

Pré-requisitos: Git, Node 24+ e dependências da release exata. Se o checkout não existir, clone `https://github.com/pingdotgg/t3code` e resolva o commit extraído do ASAR; não use `main` como substituto.

```sh
node prepare-source.mjs --app /usr/lib/t3code --output /tmp/t3code-linux-build
```

O preparador cria um worktree isolado e registra `/tmp/t3code-linux-build.patch-context.json`. `--repo` escolhe o repositório, `--commit SHA` prepara só as fontes, `--profile linux|legacy|modern` escolhe explicitamente o delta. Merge de três vias preserva conflitos e encerra com erro; resolva-os antes de continuar. O preparador não instala dependências nem inicia servidor.

No worktree, instale sem atualizar o lockfile. Use `vp install --frozen-lockfile` se disponível; nesta máquina foi usado o gerenciador exato sem instalação global:

```sh
npm exec --yes --package=pnpm@11.10.0 -- pnpm install --frozen-lockfile
./node_modules/.bin/vp run --filter @t3tools/web typecheck
./node_modules/.bin/vp run --filter t3 typecheck
./node_modules/.bin/vp test run apps/web/src/components/GitActionsControl.lifecycle.test.ts apps/web/src/components/GitActionsControl.logic.test.ts apps/web/src/components/GitActionsControl.test.ts apps/web/src/diffPanelStore.test.ts apps/web/src/components/settings/scopedSettings.test.ts packages/contracts/src/settings.test.ts packages/shared/src/projectSettings.test.ts packages/client-runtime/src/state/server.test.ts packages/client-runtime/src/state/gitActions.test.ts packages/client-runtime/src/state/threadCheckpoints.test.ts apps/server/src/serverSettings.test.ts scripts/lib/cli-external-packages.test.ts
```

De volta ao kit, usando **a instalação original ou seu backup original**:

```sh
node build-linux.mjs --source /tmp/t3code-linux-build --app /usr/lib/t3code
node build-payload.mjs --app /usr/lib/t3code \
  --web-dist /tmp/t3code-linux-build/apps/web/dist \
  --server-dist /tmp/t3code-linux-build/apps/server/dist
node --test patch-lib.test.mjs linux.test.mjs
T3CODE_LINUX_INTEGRATION_APP=/usr/lib/t3code node --test linux.test.mjs
./apply.sh --check
./apply.sh --output /tmp/t3code-linux-patched
```

`build-linux.mjs` confere o HEAD exato, recusa `.env`/`.env.local` no worktree, recupera os defaults públicos dos bundles originais (Clerk, JWT, OAuth, relay e tracing), omite os valores do log e compila só web e servidor. Ajusta temporariamente a versão do package servidor e restaura esse arquivo ao terminar. Não define origens HTTP/WS. O extrator usa a sintaxe desta release; outra sintaxe deve falhar e exigir adaptação, nunca produzir valores vazios silenciosamente.

`build-payload.mjs` grava **somente `linux/`** nesse fluxo, inclui arquivos novos/diferentes e registra remoções de chunks antigos. Preserva favicons/manifest da instalação. Mapas de fonte do servidor não entram no payload. Confira dependências externas/nativas antes de combinar bundles: no alvo atual os 97 especificadores externos originais/reconstruídos são iguais e os arquivos nativos originais foram preservados.

## Reconstruir o macOS original

Execute no Mac, preservando os defaults públicos **em branco somente neste alvo**, conforme os bundles originais de `cloud/publicConfig`. Não copie `.env` do checkout principal.

```sh
node prepare-source.mjs --output /tmp/t3code-patch-build
```

No worktree, instale as dependências exatas, rode typecheck web e os testes focados listados acima que existam na release. Depois:

```sh
APP_VERSION=0.1.0-disable-pr-creation.20261016 T3CODE_WEB_SOURCEMAP=0 \
  ./node_modules/.bin/vp run --filter @t3tools/web build
```

De volta ao kit:

```sh
node build-payload.mjs --app '/Applications/T3 Code (Beta).app' \
  --web-dist /tmp/t3code-patch-build/apps/web/dist
node --test patch-lib.test.mjs linux.test.mjs
./apply.sh --check
./apply.sh --output '/tmp/T3 Code (Patch Rebuild Test).app'
```

Esse fluxo grava `target.json`/`payload.tar.gz` na raiz e não altera `linux/`. Guarde uma cópia do kit antes de regenerar qualquer payload.

## Adaptar depois de uma atualização oficial

1. Identifique o executável em uso, sistema e arquitetura. Leia `package.json` do **ASAR instalado**, incluindo `version`, `buildVersion` e `t3codeCommitHash`. macOS: `Contents/Resources/app.asar`; Linux instalado: `resources/app.asar`. AppImage exige identificar a origem persistente, pois o mount temporário não é um destino de instalação suportado pelo helper atual.
2. Resolva o hash abreviado no Git. Se ausente, busque a tag/commit exato em `https://github.com/pingdotgg/t3code`. Não adivinhe pelo número da versão nem substitua por `main`. Leia as instruções da release.
3. Prepare um worktree e aplique o perfil adequado. Verifique se upstream já implementou alguma opção. Porte a intenção dos diffs sem reverter atualizações oficiais. Changes automático pode estar em `ChatView` ou num hook; a referência moderna mostra essa extração. Preserve contador, painel, aberturas explícitas/automáticas e configuração global/por projeto.
4. Revise todas as entradas de criação de PR, inclusive menus, ações rápidas e toasts assíncronos. Teste preferência alterada durante ação pendente, recarga sem configuração momentânea e estado anterior ao primeiro carregamento. Acesso a PR existente, commit e push devem continuar disponíveis.
5. **Confira os contratos do servidor. Só trocar a interface é insuficiente quando faltam os campos.** Reconstrua também o servidor da mesma release, mantenha os chunks necessários e a lista exata `serverFiles`. Revise os imports externos, versões e arquivos nativos/ABI antes de usar dependências instaladas. Não misture IPC desktop de uma release com servidor/UI de outra.
6. Preserve defaults públicos de produção: chave pública Clerk, JWT template, OAuth client ID, relay e tracing. Recupere-os dos bundles originais; nunca reutilize campos vazios do perfil macOS num Linux configurado. Não copie credenciais privadas nem imprima tokens. Não configure `VITE_HTTP_URL` ou `VITE_WS_URL`; clientes locais/remotos usam a origem que os serve.
7. Compile só alvos necessários: web gera `apps/web/dist`; servidor usa `vp run --filter t3 build:bundle`. Ao reconstruir a distribuição de servidor, inclua esse cliente em `dist/client`. Preserve versão e identidade do aplicativo.
8. Atualize **só o perfil da instalação alvo**, seu delta de fonte, snapshots, manifest e checksums. Mantenha o perfil do outro sistema. Atualize README, AGENTS.md e VALIDATION.md para refletir o novo alvo e o que realmente foi testado. O gerador atual distingue perfis pelo layout/caminho `.app`; adapte explicitamente se o layout mudar.
9. Teste numa cópia: aplicar, `--check`, repetir sem novo backup, restaurar e confirmar fingerprints originais. Confira todos os arquivos não alterados do ASAR, unpacked, executável e permissões; no Mac confira assinatura e integridade do plist, no Linux confira fuses e sandbox. Confirme rejeição de release diferente e de payload adulterado. Não abra a UI sem autorização.
10. Confira que a instalação original permanece intacta e entregue o comando de Terminal externo. Uma atualização do gerenciador de pacotes pode sobrescrever o patch; não adicione hooks ou atalhos que ignorem fingerprints.

CLI sem iniciar servidor, usando o bundle de teste e estado temporário:

```sh
# Linux
ELECTRON_RUN_AS_NODE=1 T3CODE_HOME=/tmp/t3code-patch-cli-state \
  /tmp/t3code-linux-patched/t3code \
  /tmp/t3code-linux-patched/resources/app.asar/apps/server/dist/bin.mjs --version

# macOS
ELECTRON_RUN_AS_NODE=1 T3CODE_HOME=/tmp/t3code-patch-cli-state \
  '/tmp/T3 Code (Patch Rebuild Test).app/Contents/MacOS/T3 Code (Beta)' \
  '/tmp/T3 Code (Patch Rebuild Test).app/Contents/Resources/app.asar/apps/server/dist/bin.mjs' --version
```

**Não use `ELECTRON_NO_ASAR=1` nessas chamadas CLI**, pois o entrypoint está dentro do ASAR.

## Superfícies e entrega

Fontes incluem contratos, runtime compartilhado, web e ajustes mobile de integração. Os payloads cobrem desktop e o cliente web servido por ele; não atualizam `app.t3.codes`, outro servidor remoto ou apps nativos iOS/Android. Não há mudanças específicas de provider nem novos métodos MCP.

Registre em VALIDATION.md o alvo, os testes realmente executados e as limitações. Diferencie validação atual Linux de evidência histórica macOS; não alegue codesign ou execução macOS realizados em Linux. Informe claramente se preparou cópias ou instalou. Mantenha o backup até a pessoa confirmar que a instalação está funcionando. Para o app em uso, entregue o comando de Terminal externo e não termine o processo que hospeda o agente.
