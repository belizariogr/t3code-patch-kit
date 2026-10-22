# Validações — macOS e Linux

## Port e validação Linux 0.1.1 — 22/10/2026

**O kit foi corrigido para a versão nova. A aplicação real foi tentada, mas o instalador recusou a troca porque o T3 Code hospedeiro estava aberto (PID `803980`). A instalação em uso continua original; o novo payload está pronto para aplicação pelo Terminal externo após fechar o app.**

### Alvo e fontes

- Linux x64, `/usr/lib/t3code/t3code`, pacote `t3code-bin 0.1.1-1`; metadados ASAR `version/buildVersion: 0.1.1`, commit `fe27e8e3dc12`, resolvido localmente como `fe27e8e3dc12dcbb108e9a28fd9b8cb65f34ae92`.
- ASAR original SHA-256: `c6ce4e97c52eb4c2584da05497309befa99d1b6e861c7f158b2e4736d55a3194`.
- Fontes portadas no worktree `/home/belizario/dev/t3code-patch-build-0.1.1`. Preservadas as refatorações da release: abertura automática em `useProactivePanels`, `useQuietThreadShell`, estado de carregamento do diff, tokens visuais de diff e testes de interface em Chromium.
- `patches/linux-customizations.patch`, manifest e 30 snapshots Linux atualizados. Preparação automática reproduzida em outro worktree, perfil `linux`, sem conflitos; os 30 arquivos coincidiram com os snapshots. O preparador prioriza a base Linux antes de modern quando ambas são ancestrais.
- O kit anterior, incluindo o payload 0.1.0, foi preservado em `backups/kit-before-linux-0.1.1-20261022.tar.gz`. Os backups anteriores do aplicativo permanecem preservados.

### Testes e compilação

- Dependências da release exata instaladas com `pnpm@11.10.0` e lockfile congelado, usando o Node `26.12.0` existente, sem alteração global.
- **496 testes de fonte passaram em 13 arquivos**: 440 testes em 10 arquivos de lógica/contratos/runtime/configurações/servidor/dependências externas, 20 testes de ações Git mobile, 4 testes React mobile no projeto `react` do pacote e **32 testes do controle Git em Chromium headless**. A execução headless foi expressamente autorizada pela pessoa nesta conversa.
- Os testes browser verificaram, além do comportamento oficial, PRs desabilitados antes/depois de uma ação pendente, cliques em toasts retidos após trocar de conversa, preferências globais e por projeto, recarga de configuração, estado sem configuração inicial, push e links de PRs existentes.
- Typecheck web e servidor passaram, com sugestões Effect em código upstream. Lint focado de 10 arquivos concluiu sem erros ou avisos. Não foram rodados checks do monorepo inteiro.
- Web e servidor compilados da mesma release, com versão `0.1.1`. Defaults públicos de Clerk, JWT, OAuth, relay e tracing foram recuperados do ASAR original, preservados nos bundles novos e conferidos sem registrar seus valores. Não foram copiadas credenciais ou `.env` do checkout principal nem fixadas origens HTTP/WS.
- Conjunto de **100 especificadores externos** do servidor permaneceu igual, sem adições ou remoções. Nenhuma dependência instalada ou binário nativo foi substituído.

### Payload, aplicação em cópia e tentativa real

- `linux/payload.tar.gz`: **10.700.233 bytes**, SHA-256 `7a5b60a18b3132ca1ba594922f4aef56fbbbddd9f4426bf7b66e7d8d89453cf2`.
- **758 arquivos novos/alterados**: 756 arquivos web e 2 chunks de servidor. **259 remoções**: 258 arquivos web e 1 chunk antigo de servidor. Favicons/manifest originais preservados.
- **7 testes do kit passaram**, com `T3CODE_LINUX_INTEGRATION_APP=/usr/lib/t3code node --test patch-lib.test.mjs linux.test.mjs`. A integração criou cópias para testar `--output`, `--check`, comparação completa de ASAR, CLI, aplicar, repetir sem outro backup, restaurar e recusar um ASAR alterado.
- **1.314 arquivos originais do ASAR mantidos idênticos**; os 758 arquivos do payload foram conferidos por SHA-256. Flags unpacked e remoções conferidas. Os **79 arquivos externos ao ASAR**, incluindo **39 arquivos unpacked**, foram preservados com seus hashes, links e modos, inclusive `chrome-sandbox` `4755`.
- CLI original e CLI da cópia responderam `t3 v0.1.1`, exit code 0, com `T3CODE_HOME` temporário, sem iniciar servidor ou abrir a sessão real do app.
- Fuses do Electron original lidos: `RunAsNode` habilitado, `EnableEmbeddedAsarIntegrityValidation` e `OnlyLoadAppFromAsar` desabilitados. Nenhum fuse ou executável foi alterado.
- Backup do último ciclo de teste preservado em `backups/linux/2026-10-22T15-29-14.545Z/installed`; as cópias temporárias desse ciclo foram removidas. Não é um backup de aplicação na instalação real.
- `./apply.sh --check` reconheceu a instalação real como compatível. A tentativa `./apply.sh` encerrou com exit code 1 e pediu para fechar o T3 Code no PID `803980`, antes de copiar/trocar a instalação. O SHA-256 real permaneceu igual ao original. Não houve aplicação com sudo.
- Payload, fingerprints, fontes de referência e instalador macOS preservados. O target macOS mantém SHA-256 `1b4c3701d23f45b41a98728957be6bc1eb4089c5cf5c9f94e647f542bdfefe1c`; seu payload mantém `f62b6f535176cc5ccc663f93af36db66b9f7058a61218920043afc23d94f55e8`. Não houve nova execução macOS ou codesign.

Para concluir a instalação real, fechar o T3 Code e executar em Terminal externo:

```sh
cd /home/belizario/dev/t3code-patch-kit
sudo env "PATH=$PATH" ./apply.sh
```

O script criará um novo backup da versão 0.1.1 antes da troca. Mantenha esse backup até confirmar o funcionamento. Não houve abertura da UI real, alteração de dados de usuário ou encerramento de processos do aplicativo; apenas os processos isolados dos testes foram iniciados/encerrados.

## Verificação após atualização — 22/10/2026

**Resultado: o payload Linux atual do kit não é compatível com a instalação atualizada. A instalação não foi modificada e nenhum payload novo foi gerado nesta verificação.**

- Executável em uso: `/usr/lib/t3code/t3code`, Linux x64; pacote instalado `t3code-bin 0.1.1-1`.
- Metadados lidos diretamente de `resources/app.asar`: `version/buildVersion: 0.1.1`, commit `fe27e8e3dc12`.
- SHA-256 do ASAR atualizado: `c6ce4e97c52eb4c2584da05497309befa99d1b6e861c7f158b2e4736d55a3194`. O perfil Linux do kit continua destinado à release `0.1.0`, commit `81493efb71e8`, ASAR original `54e2346258da31c28761984a0cca48bba5de4918e506ce65e340c2a28d000c16`.
- `./apply.sh --check` recusou corretamente a instalação, com exit code 1 e mensagem de que a instalação mudou.
- O marcador `resources/t3code-local-patch.json` da aplicação anterior permanece no diretório, mas seu hash de ASAR alterado não corresponde ao ASAR atual. O instalador não o aceitou como prova de que o patch está aplicado. O backup indicado pelo marcador foi preservado.
- Inspeção de todos os chunks `.mjs` no nível imediato de `apps/server/dist/`: não há `changesScope` nem `pullRequestCreationEnabled`. Será necessário portar as personalizações e reconstruir também o servidor da release exata antes de gerar um payload compatível.
- A conferência dos arquivos externos ao ASAR também encontrou diferenças: `node-pty/lib/windowsPtyAgent.js`, arquivos da extensão GNOME e o helper `hyprland-capture/t3-hyprland-snap-shot`, entre outros. Não basta trocar a versão ou o fingerprint do ASAR no target antigo.
- `node --test patch-lib.test.mjs linux.test.mjs`: **6 testes passaram, 1 integração foi pulada** por não ter sido solicitado o teste real com `T3CODE_LINUX_INTEGRATION_APP`. O ciclo de aplicação/restauração não foi executado na release incompatível.
- Todos os **115 checksums** registrados no kit foram conferidos antes da edição deste registro. O payload e os fingerprints macOS continuam iguais aos da validação anterior; os arquivos de ambos os payloads não foram alterados.

Escopo desta sessão: identificação e validação de compatibilidade. Não houve portabilidade das fontes para `0.1.1`, build, aplicação/restauração, abertura de UI, início de servidor ou alteração de dados de usuário. Para adaptar, siga o procedimento de atualização em AGENTS.md, preservando o perfil macOS.

## Linux — 17/10/2026, executado nesta máquina

Alvo original em uso: `/usr/lib/t3code/t3code`, Linux x64, pacote `t3code-bin 0.1.0-1`. Metadados ASAR `version/buildVersion: 0.1.0`, commit `81493efb71e8`, resolvido no upstream como `81493efb71e8e8244f95d3e9f71d8369654ab151`. Fontes preparadas em `/tmp/t3code-linux-build`, sem servidores ou UI.

**A instalação em uso não recebeu o patch.** O kit e o payload Linux estão prontos; somente cópias isoladas foram modificadas. Não foram alterados dados de usuário, processos ativos, atalhos do desktop ou a instalação do Node.

### Fontes e build

- Clone upstream e worktree no commit exato, sem usar main como substituto. Portadas as duas funcionalidades pelos deltas legacy, com resolução dos conflitos da release; salvo delta consolidado `patches/linux-customizations.patch` e 30 snapshots em `reference-linux/`.
- Instalação com lockfile congelado: `npm exec --yes --package=pnpm@11.10.0 -- pnpm install --frozen-lockfile`. Runtime existente Node `26.12.0`; o gerenciador emitiu aviso pelo engine do monorepo pedir Node 24, sem alteração global.
- **480 testes passaram em 14 arquivos**: lifecycle/lógica/controle Git, diffPanelStore, configurações por projeto, contratos, resolução compartilhada de projeto, runtime de servidor/Git/checkpoints, persistência/broadcast de configurações no servidor, fechamento de dependências externas e dois testes de ações Git mobile.
- Typecheck web e servidor passaram. O typecheck do servidor emitiu sugestões Effect; lint focado concluiu com avisos de hooks/memoização no código da release, sem erros. Não foram executados checks do monorepo inteiro.
- Cliente web e servidor compilados com `build-linux.mjs`, preservando a versão `0.1.0` e os defaults públicos de Clerk, JWT, OAuth, relay e tracing recuperados dos bundles originais. Valores não são registrados neste documento. Nenhum `.env` do checkout principal foi copiado, nem foram definidas origens HTTP/WS fixas.
- Comparação dos defaults públicos originais/reconstruídos passou. Conjunto de **97 especificadores externos** do servidor permaneceu igual, sem adições/remoções; Electron e dependências instaladas não foram recompilados nem substituídos.
- Payload Linux: **10.546.673 bytes**, **2.349 arquivos novos/alterados** (2 chunks de servidor e 2.347 arquivos web), **295 remoções** (1 chunk antigo de servidor e 294 arquivos web). Os demais chunks de servidor coincidem com os originais. Favicons/manifest originais preservados; sourcemaps não entram no payload.
- ASAR original SHA-256: `54e2346258da31c28761984a0cca48bba5de4918e506ce65e340c2a28d000c16`.
- Payload Linux SHA-256: `2cb8261aa43d8a11edaa267424386e241789d14ee4578babcd0904b6b465d48f`.

### Instalador e cópia real

- **7 testes do kit passaram**, incluindo despacho Darwin/Linux com encaminhamento de argumentos, rejeição de outra release e marcador obsoleto, restrição de caminhos web/servidor, payload adulterado, reempacotamento ASAR com nativos unpacked e recusa quando um executável do diretório alvo está ativo. O teste de processos cria seu próprio processo e só encerra esse processo capturado.
- Integração executada com `T3CODE_LINUX_INTEGRATION_APP=/usr/lib/t3code node --test patch-lib.test.mjs linux.test.mjs`. O script criou cópias temporárias: `--output` → `--check` → comparação completa → CLI; outra cópia passou por aplicar → repetir sem novo backup/marcador → restaurar → alterar propositalmente ASAR → recusar incompatibilidade.
- **1.240 arquivos originais do ASAR mantidos idênticos**; todos os **2.349 arquivos do payload** verificados individualmente por SHA-256. Remoções e flags unpacked conferidas.
- **79 arquivos externos ao ASAR**, incluindo **39 arquivos em app.asar.unpacked**, conferidos por hash. Foram conferidos também diretórios, links e modos, inclusive `chrome-sandbox` com modo `4755`. Cópias sem privilégios repõem o modo limpo pelo cp; a aplicação real em `/usr/lib` requer root para preservar propriedade.
- CLI da cópia respondeu `t3 v0.1.0`, exit code 0, igual ao original, usando `ELECTRON_RUN_AS_NODE=1`, estado em diretório temporário e sem `ELECTRON_NO_ASAR`.
- Fuses lidos no Electron original: `RunAsNode` habilitado, `EnableEmbeddedAsarIntegrityValidation` e `OnlyLoadAppFromAsar` desabilitados. Nenhum fuse foi alterado. Assinatura Apple/plist não se aplicam a esse alvo Linux.
- `./apply.sh --check` reconheceu a instalação real, sem modificá-la. Após os testes, o SHA-256 original permanece igual. A restauração da cópia recuperou o ASAR original e todos os arquivos externos esperados.
- Cópias temporárias dos testes foram removidas. Os backups de teste continuam em `backups/linux/`; o último ciclo usou `backups/linux/2026-10-17T14-02-35.034Z/installed`. Eles não são backups de uma aplicação na instalação real. O comando externo criará um novo backup da instalação real.

### Compatibilidade e reprodução dos dois sistemas

- `target.json` e `payload.tar.gz` macOS permanecem byte a byte iguais aos recebidos. Seus hashes são, respectivamente, `1b4c3701d23f45b41a98728957be6bc1eb4089c5cf5c9f94e647f542bdfefe1c` e `f62b6f535176cc5ccc663f93af36db66b9f7058a61218920043afc23d94f55e8`.
- Preparador reproduzido em worktrees independentes: perfil legacy no commit macOS (29 snapshots iguais), modern em `2fae0f98` (30 snapshots iguais) e linux em `81493efb` (30 snapshots iguais). **93 checksums** de patches/snapshots conferidos pelo manifest.
- Os testes compartilhados de ASAR e a seleção de ambos os sistemas passaram nesta máquina Linux. **Não foram executados codesign, CLI macOS ou UI macOS nesta sessão.** A evidência de bundle macOS abaixo é a validação anterior recebida com o kit.
- README e AGENTS.md foram atualizados para aplicação/restauração nos dois sistemas, preparação da próxima release, reconstrução condicional de servidor, configuração pública de produção, integridade e preservação do outro perfil.

Limites: não houve teste visual/UI, instalação real com sudo, build mobile ou validação de conexão com serviços remotos. A integração de arquivos/CLI foi validada em cópias do executável instalado.

## Evidência anterior macOS — 17/10/2026

Alvo: `/Applications/T3 Code (Beta).app`, `0.1.0-disable-pr-creation.20261016`, Apple Silicon. Fingerprints completos em `target.json`.

### Fork

- As duas funcionalidades e as correções posteriores de PRs foram integradas no `main`.
- Commit final: `7fb09a2af59d1e33d3535d29315cc392d97132e6`, enviado a `origin/main`.
- Testes focados: **366 testes passaram em 9 arquivos**.
- Typecheck do cliente web passou. Lint dos arquivos de integração e do Changes control passou. O lint adicional dos controles mobile emite avisos de dependências de memoização que já estavam no desenvolvimento de PRs; não foram tratados como parte deste kit.
- A remoção de memoização manual do Changes control é uma adaptação ao React Compiler da base mais recente; o perfil antigo mantém a implementação compatível com sua base original.

### Código do payload atual

- Reconstruído sobre `66c4f1b87b99ebb5baa7bea0a40f66a06ba5b8a6`, com o perfil legacy e as correções de PRs.
- Snapshot local de proveniência: `6b0266942` (referência completa no manifest; não é necessário obter esse commit para reconstruir: use os patches).
- **338 testes passaram em 8 arquivos**. Typecheck web passou.
- Build web concluído com a versão instalada e sem sourcemaps. O build do servidor também foi conferido; não foi necessário incluí-lo no patch porque os contratos já existem na instalação original.
- Payload: **7.263.809 bytes**, **741 arquivos web novos/alterados**, **189 chunks/arquivos antigos removidos**. Favicons e manifest originais preservados.

### Preparação de fontes

- `prepare-source.mjs` testado sobre o commit da instalação atual, perfil legacy.
- Perfil modern testado sobre `2fae0f9841448e6edb93d0ebe4cbaf2d546bb38c`.
- Os arquivos preparados foram comparados com os snapshots correspondentes; a comparação do perfil modern final foi refeita após a adaptação ao React Compiler.
- Checksums dos patches e cópias de referência conferidos.

### Script e bundle

- **3 testes automatizados do kit passaram**: rejeição de release diferente/repetição, restrição de caminhos e reempacotamento real de ASAR preservando arquivos nativos unpacked e o arquivo de origem; payload adulterado também é rejeitado.
- `./apply.sh --check` reconheceu o aplicativo instalado sem alterá-lo, inclusive usando automaticamente o Node do Electron a partir do Node 20 do sistema.
- `--output` produziu uma cópia real do bundle; `codesign --verify --deep --strict` passou.
- Integridade do hash ASAR no `Info.plist` conferida separadamente.
- Comparação completa dos arquivos pertinentes do ASAR: **1.358 arquivos originais mantidos idênticos**, **95 arquivos unpacked preservados** e **741 arquivos de payload conferidos por SHA-256**.
- A CLI da cópia respondeu `t3 v0.1.0` com exit code 0, igual à CLI original. A versão do aplicativo no plist permanece `0.1.0-disable-pr-creation.20261016`.
- Em uma segunda cópia isolada, o fluxo completo foi testado: aplicar → detectar repetição sem fazer alterações → restaurar backup. Após restaurar, os hashes do ASAR e do plist eram iguais aos da instalação original.
- Uma alteração proposital no ASAR dessa cópia fez o script recusar a operação antes de modificar o aplicativo.

**A instalação original não recebeu o patch e seus fingerprints continuam iguais aos originais.** Não foram abertos navegador ou UI, iniciados servidores nem alterados dados de usuário. As cópias e o backup criados exclusivamente para os testes foram removidos após as verificações; o script criará um backup novo quando for usado na instalação real.
