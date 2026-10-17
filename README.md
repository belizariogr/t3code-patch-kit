# Patch local do T3 Code para macOS

Este kit reúne **Changes scope** (branch, alterações não commitadas ou conversa) e **desativação da criação de PRs**, com configurações globais e por projeto e as correções das ações de PR em notificações.

O script pronto atende especificamente ao **T3 Code (Beta) 0.1.0-disable-pr-creation.20261016, Apple Silicon**, instalado em `/Applications/T3 Code (Beta).app`. A identificação também usa SHA-256 do `app.asar`, não apenas o número da versão. Essa instalação já tinha as primeiras versões dos recursos; o payload inclui a versão consolidada com as correções posteriores de PRs.

## Aplicar agora

Feche o T3 Code e execute **em um Terminal externo**:

```sh
cd /Users/belizario/dev/t3code-patch-kit
./apply.sh
```

O payload já está compilado. O script prepara e assina uma cópia, verifica sua integridade, cria um backup completo em `backups/` e só então troca o aplicativo. Execute o mesmo comando novamente sem efeitos adicionais. As preferências existentes são mantidas; o patch não escolhe um novo Changes scope nem desativa PRs automaticamente.

Para verificar sem alterar o aplicativo:

```sh
./apply.sh --check
```

Para desfazer, feche o aplicativo e execute:

```sh
./apply.sh --restore
```

Para gerar apenas uma cópia de teste, sem fechar ou substituir o aplicativo instalado:

```sh
./apply.sh --output '/tmp/T3 Code (Patch Test).app'
```

O destino de teste precisa estar livre. `--app '/outro/caminho/T3.app'` permite operar outra cópia da **mesma instalação**. `--repo /caminho/t3code` permite mudar a localização do checkout que fornece `@electron/asar`; por padrão ele é o diretório irmão `../t3code`. As dependências já estão instaladas nesta máquina. Se levar o kit para outra pasta sem o checkout, execute `npm install --ignore-scripts` no kit usando Node 24+. O lançador usa `node` e, se ele for anterior ao Node 24, usa o runtime Node do próprio Electron.

## Depois de atualizar o T3 Code

O script atual recusará um `app.asar` diferente. Entregue esta pasta ao próximo LLM com este pedido:

> Leia AGENTS.md deste kit. Adapte o patch de Changes scope e desativação de criação de PRs à versão do T3 Code atualmente instalada. Preserve as atualizações oficiais. Use os patches e arquivos de referência, prepare o código da versão exata, atualize o payload e o script, e teste aplicação, repetição e restauração numa cópia isolada. Não encerre o T3 Code em uso nem altere ~/.t3/userdata.

O [AGENTS.md](AGENTS.md) traz o procedimento, os comandos de reconstrução e os limites do patch atual. Não basta atualizar o número da versão ou trocar os hashes.

## Conteúdo

- `apply.sh`, `apply.mjs`, `patch-lib.mjs`: patch pronto, backup, detecção de repetição e restauração.
- `payload.tar.gz`, `target.json`: arquivos compilados que mudam e a identificação exata da instalação compatível.
- `patches/`: diferenças no código-fonte das duas funcionalidades, incluindo um perfil para a versão instalada e outro para a base mais recente do fork.
- `reference-installed-version/`: arquivos completos usados para compilar o payload atual, incluindo testes.
- `reference/`: arquivos completos após o merge no `main` atualizado.
- `prepare-source.mjs`: cria um worktree no commit da instalação e aplica o perfil de patches adequado; mantém conflitos para o LLM resolver.
- `build-payload.mjs`: regenera o payload web a partir de um build revisado; não instala nada.
- `manifest.json`, `VALIDATION.md`, `patch-lib.test.mjs`: proveniência, checksums, verificações realizadas e testes do empacotamento.

O kit não contém credenciais, banco de dados nem cópia do aplicativo completo. O patch altera os arquivos web dentro do `app.asar`, atualiza seu hash no `Info.plist` e aplica assinatura ad hoc local. A assinatura de publicação da Apple não pode ser preservada após modificar um aplicativo; para esta versão de teste, a instalação original já tinha assinatura ad hoc.

As cópias de código e os patches derivam do [T3 Code](https://github.com/pingdotgg/t3code), distribuído sob a [licença MIT](LICENSE). Backups locais e dependências ficam fora do versionamento.
