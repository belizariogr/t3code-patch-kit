# Validações — macOS e Linux

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
