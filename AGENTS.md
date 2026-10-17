# Instruções para o LLM responsável pelo patch

## Objetivo autorizado

Manter duas personalizações no T3 Code para macOS, reaplicáveis após atualizações oficiais:

1. **Changes scope**: `changesScope` aceita `branch`, `uncommitted` ou `thread`. A opção vale globalmente e por projeto. O contador e o painel devem usar o mesmo escopo. Conversation calcula o diff líquido entre o início e o último checkpoint pronto de um turno concluído, sem somar alterações repetidas de cada turno. Preserve a abertura explícita e a abertura automática do painel.
2. **Criação de PRs**: `pullRequestCreationEnabled` é verdadeiro por padrão e pode ser sobrescrito por projeto. Quando falso, oculte os caminhos de criação no controle Git, nas ações rápidas e nos toasts de resultados. Releia a configuração ao executar uma ação assíncrona; não use um valor capturado antes de a preferência mudar. Preserve a última configuração conhecida durante recargas. Antes do primeiro carregamento, não ofereça criação de PR. Commit, push e acesso a PRs existentes continuam disponíveis.

Isto controla as ações de criação da interface. Não promete impedir que um agente crie um PR por ferramentas próprias ou que um usuário use a CLI do GitHub.

## Cuidados com o ambiente em uso

- O checkout padrão é o diretório irmão `../t3code`. Leia também o AGENTS.md desse checkout antes de alterá-lo.
- Não abra `~/.t3/userdata` para escrita, não inicie servidores contra essa base e não copie estado de teste de volta para ela.
- Não use `pkill`, não encerre processos identificados por padrões e não feche o T3 Code que hospeda o agente. A pessoa executará o script por um Terminal externo quando fechar o aplicativo. A ferramenta recusa aplicação/restauração com processos daquele bundle ativos.
- Não abra navegador, interface do aplicativo ou ferramentas de computer use sem autorização explícita. Testes de arquivo, CLI `--version` e assinatura não precisam abrir a UI.
- Trabalhe numa cópia/worktree. Não sobrescreva a instalação durante preparação, compilação ou testes. Não crie PRs nem publique o kit sem pedido.

## Como este kit está organizado

`manifest.json` registra a base upstream `2fae0f9841448e6edb93d0ebe4cbaf2d546bb38c` e a integração final `7fb09a2af59d1e33d3535d29315cc392d97132e6` do fork (merge seguido de adaptação ao React Compiler). `patches/customizations.patch` contém somente o delta das duas funcionalidades em relação a essa base, sem as centenas de mudanças upstream trazidas pelo merge.

O perfil antigo tem dois passos: `legacy-changes.patch` sobre `3b99fb2d2` e `legacy-pr-creation.patch` sobre `66c4f1b87`. Este último inclui a implementação de PRs e suas três correções posteriores, adaptadas à base antiga, mais a importação do default de Changes necessária nessa adaptação. O preparador pula o patch Changes quando o commit da instalação já o contém.

`reference-installed-version/` corresponde ao código efetivamente usado no payload atual. `reference/` corresponde à integração com as refatorações mais recentes. Use cópias como referência para resolver conflitos; **não substitua arquivos inteiros de uma release futura por essas cópias**, pois isso reverteria atualizações oficiais.

## Script pronto para a instalação atual

A versão atual tem metadados `0.1.0-disable-pr-creation.20261016`, commit `66c4f1b87b99`, arquitetura `arm64`. `target.json` fixa o hash completo do arquivo original e do payload. O bundle do servidor já contém os contratos `changesScope` e `pullRequestCreationEnabled`; por isso o patch atual muda **somente `apps/server/dist/client/`**. O desktop Electron, o servidor, as dependências nativas e a versão permanecem os mesmos. A assinatura e o hash ASAR no plist são recalculados.

`./apply.sh` não compila nem depende de um dev server. Ele usa `@electron/asar` instalado em `../t3code/scripts/node_modules`. Com Node antigo, relança o helper pelo Node do Electron com `ELECTRON_RUN_AS_NODE=1` e `ELECTRON_NO_ASAR=1`; este último evita que o próprio runtime intercepte a leitura binária do `app.asar`.

O fluxo é: conferir fingerprints → copiar o bundle → extrair/reempacotar mantendo os arquivos nativos unpacked → atualizar a integridade no plist → assinar ad hoc e verificar → criar backup completo → conferir que a instalação não mudou durante o trabalho → trocar o diretório com rollback em caso de erro. O marcador `Contents/Resources/t3code-local-patch.json` permite reconhecer o patch e localizar o backup. Uma atualização oficial que trocar o ASAR torna esse marcador insuficiente e bloqueia o script.

Não há um comando para forçar um hash incompatível. Não acrescente esse atalho.

## Reconstruir exatamente o payload atual

Pré-requisitos: Git, Node 24 ou mais recente e as dependências do checkout (`vp install --frozen-lockfile`). Use o runtime disponível na máquina; não altere o Node global para executar este kit.

```sh
node prepare-source.mjs --output /tmp/t3code-patch-build
```

O preparador lê o commit da instalação e gera o worktree isolado. Registra o contexto em `/tmp/t3code-patch-build.patch-context.json`. Se houver conflito, mantém os arquivos e encerra com erro; resolva-os antes de continuar. Ele não inicia servidores nem instala dependências.

Dentro desse worktree, instale as dependências da versão exata e valide o código. Exemplos de verificações focadas, ajustando nomes de testes à release:

```sh
vp install --frozen-lockfile
vp run --filter @t3tools/web typecheck
vp test run apps/web/src/components/GitActionsControl.lifecycle.test.ts apps/web/src/components/GitActionsControl.logic.test.ts apps/web/src/diffPanelStore.test.ts packages/contracts/src/settings.test.ts packages/shared/src/projectSettings.test.ts packages/client-runtime/src/state/server.test.ts packages/client-runtime/src/state/gitActions.test.ts packages/client-runtime/src/state/threadCheckpoints.test.ts
```

Não execute checks do monorepo inteiro. No perfil atual, mantenha os build-time defaults públicos em branco, como na instalação original; o conteúdo foi verificado em `cloud/publicConfig` do bundle original. Não copie `.env` do checkout principal.

```sh
APP_VERSION=0.1.0-disable-pr-creation.20261016 T3CODE_WEB_SOURCEMAP=0 vp run --filter @t3tools/web build
```

De volta ao kit:

```sh
node build-payload.mjs --web-dist /tmp/t3code-patch-build/apps/web/dist
node --test patch-lib.test.mjs
./apply.sh --check
./apply.sh --output '/tmp/T3 Code (Patch Rebuild Test).app'
```

O gerador compara cada arquivo compilado com o ASAR original, inclui apenas os diferentes, registra remoções de chunks antigos e preserva favicons/manifest da instalação. Ele sobrescreve `payload.tar.gz` e `target.json`, sem modificar o aplicativo. Guarde uma cópia do kit antes de regenerar um payload para outra release.

## Adaptar depois de uma atualização oficial

1. Leia a versão e `package.json` do **ASAR instalado**, incluindo `t3codeCommitHash`. Se o hash abreviado não existir localmente, busque a tag/commit correspondente em `https://github.com/pingdotgg/t3code`. Não use `main` como substituto. Não adivinhe o commit pelo número da versão.
2. Execute `prepare-source.mjs` com `--app`, `--repo`, `--output` conforme necessário. Para uma tag que já tenha sido resolvida, `--commit SHA` prepara apenas o código. Os patches usam merge de três vias; mudanças upstream conflitantes exigem adaptação pelo LLM. Confira também se upstream já implementou uma das opções para não duplicá-la.
3. Preserve todas as mudanças da release. Porte a intenção dos diffs, incluindo configurações globais/por projeto, busca de configurações, contador, painel, toasts assíncronos e estado de recarga. O Changes automático pode ter sido extraído para um hook; a referência moderna mostra essa adaptação.
4. Confira os contratos do servidor. **Em uma release oficial sem nossos campos, só trocar a interface é insuficiente.** Recompile também o servidor da mesma release com os contratos modificados; adapte o gerador, o validador de caminhos e os testes para permitir o conjunto exato de arquivos de servidor. Revise as dependências externas/nativas antes de combinar os bundles. O helper atual restringe o payload ao cliente deliberadamente porque só esse caminho foi validado para o alvo atual.
5. Preserve a configuração pública de produção da release: chave pública Clerk, template JWT, OAuth client ID, URL do relay e configuração de tracing. Recupere os valores dos bundles originais/configuração pública da release. Não use os campos vazios deste kit numa release que tinha T3 Connect/Clerk configurados. Não configure `VITE_HTTP_URL` ou `VITE_WS_URL`; clientes locais e remotos usam a origem em que foram servidos. Não copie credenciais privadas nem imprima tokens.
6. Compile apenas os alvos necessários. Para o servidor, o checkout tem `vp run --filter t3 build:bundle`; o build web gera `apps/web/dist`. Quando reconstruir a distribuição do servidor, inclua esse cliente em `dist/client`. Preserve a versão instalada e a identidade do app. Não misture IPC do desktop de uma release com servidor/UI de outra.
7. Atualize payload, fingerprints, patches de fonte, snapshots, checksums e estas instruções. Se o processo de assinatura/ASAR mudar na release, adapte-o; não ignore falhas de integridade. Uma assinatura ad hoc não reproduz os privilégios da assinatura oficial da Apple: reavalie entitlements, keychain e passkeys quando a instalação de origem for oficialmente assinada. O alvo atual já era ad hoc.
8. Teste numa cópia: aplicar, `--check`, aplicar de novo sem novo backup e restaurar o backup original. Confira fingerprints, arquivos nativos unpacked, assinatura e integridade do plist. Confirme rejeição de uma release diferente. Não abra a UI sem autorização.

Verificação CLI sem iniciar servidor (substitua os caminhos pelo bundle de teste; não use `ELECTRON_NO_ASAR=1` nessa chamada, pois a CLI está dentro do ASAR):

```sh
ELECTRON_RUN_AS_NODE=1 T3CODE_HOME=/tmp/t3code-patch-cli-state \
  '/tmp/T3 Code (Patch Rebuild Test).app/Contents/MacOS/T3 Code (Beta)' \
  '/tmp/T3 Code (Patch Rebuild Test).app/Contents/Resources/app.asar/apps/server/dist/bin.mjs' --version
```

O script pronto não liga/desliga as preferências do usuário: ele disponibiliza os controles e mantém os valores existentes. Não edite `settings.json` ou o banco para simular o recurso.

## Superfícies

As fontes incluem contratos, runtime compartilhado, web e ajustes de UI mobile para manter o fork integrado. O payload macOS cobre desktop e o cliente web servido por esse desktop. Ele não atualiza `app.t3.codes`, outro servidor remoto ou o aplicativo nativo iOS/Android instalado em outro dispositivo. Essas superfícies precisam de seus próprios builds. Não há mudanças específicas de provider nem novos métodos MCP.

## Entrega

Registre em VALIDATION.md o alvo e os testes realmente executados. Indique claramente se só preparou uma cópia ou também instalou. Mantenha o backup até a pessoa confirmar que a instalação está funcionando. Para aplicar ao aplicativo em uso, entregue o comando de Terminal externo; não termine o processo que hospeda o agente.
