# Patch local do T3 Code para macOS e Linux

Este kit mantém **Changes scope** (`branch`, `uncommitted` ou `thread`) e **controle da criação de PRs**, com preferências globais e por projeto. Conversation usa o diff líquido dos checkpoints; desabilitar criação de PRs mantém commit, push e acesso a PRs existentes. As ações assíncronas consultam a preferência atual.

O mesmo `./apply.sh` detecta o sistema operacional e escolhe o perfil. Cada perfil verifica arquitetura, versão, commit e SHA-256; o número da versão sozinho não autoriza aplicação.

| Sistema | Instalação padrão | Versão / commit | Payload |
| --- | --- | --- | --- |
| macOS arm64 | `/Applications/T3 Code (Beta).app` | `0.1.1` / `fe27e8e3dc12` | `target.json`, `payload.tar.gz`: cliente web e servidor |
| Linux x64 | `/usr/lib/t3code` | `0.1.1` / `fe27e8e3dc12` | `linux/target.json`, `linux/payload.tar.gz`: cliente web e servidor |

Os dois perfis 0.1.1 usam o mesmo delta de fonte, compilado sobre o commit exato instalado, porque a release oficial ainda não contém os contratos das duas preferências. Os payloads e fingerprints são independentes. O executável Electron e suas dependências nativas permanecem os da instalação. No macOS o bundle externo passa a ser ad hoc; helpers e nativos unpacked conservam a assinatura Developer ID.

## Aplicar

Pré-requisito: Node 24+ e `@electron/asar`. Se as dependências não estiverem disponíveis no kit ou no checkout irmão `../t3code`, execute `npm ci --ignore-scripts`. Use um runtime já disponível; não precisa mudar o Node global.

Primeiro, confira a compatibilidade sem fechar ou alterar o aplicativo:

```sh
./apply.sh --check
```

Feche o T3 Code e execute **em um Terminal externo**. No macOS:

```sh
cd /Users/belizario/dev/t3code-patch-kit
./apply.sh
```

No Linux desta máquina, `/usr/lib/t3code` pertence a root:

```sh
cd /home/belizario/dev/t3code-patch-kit
sudo env "PATH=$PATH" ./apply.sh
```

O `PATH` mantém disponível o Node instalado pelo usuário quando o `sudo` não encontra `node`. O script recusa substituir ou restaurar um aplicativo com processos daquele diretório ativos. Ele não encerra processos.

O payload está compilado: a aplicação não instala dependências nem inicia servidor. O script prepara e verifica uma cópia, cria backup completo em `backups/`, confere novamente a origem e troca o diretório, com rollback se a troca falhar. Repetir o comando reconhece o patch e não cria outro backup. Mantenha o backup até confirmar o funcionamento.

As preferências atuais são preservadas. O patch disponibiliza os controles em Settings, inclusive por projeto; ele não escolhe um novo Changes scope nem desativa PRs automaticamente. A preferência limita os caminhos de criação da interface, sem impedir ferramentas próprias dos agentes ou a CLI do GitHub.

Para desfazer, feche o aplicativo e execute `./apply.sh --restore`; no Linux protegido, use `sudo env "PATH=$PATH" ./apply.sh --restore`.

## Testar em uma cópia

Não precisa fechar o aplicativo para preparar uma cópia:

```sh
# Linux
./apply.sh --output /tmp/t3code-patched
./apply.sh --app /tmp/t3code-patched --check

# macOS
./apply.sh --output '/tmp/T3 Code (Patch Test).app'
```

O destino precisa estar livre e fora da instalação de origem. `--output` não substitui a instalação nem cria backup para restauração; descarte essa cópia quando terminar. `--app` seleciona outra instalação do mesmo perfil, e `--repo` seleciona o checkout que fornece `@electron/asar` quando ele não está no kit. Nenhum desses parâmetros permite ignorar um hash incompatível.

No Linux são conferidos também hashes, links e permissões dos arquivos externos ao ASAR, inclusive `chrome-sandbox` e dependências unpacked. O perfil atual mantém o Electron intacto e não exige assinatura Apple. No macOS o fluxo atualiza a integridade no `Info.plist`, preserva nativos unpacked e helpers oficiais, e verifica a assinatura ad hoc do bundle externo.

## Próxima atualização oficial

O script recusará uma instalação diferente, mesmo que a versão continue `0.1.0`. Não troque apenas hashes ou números de versão. Entregue esta pasta ao próximo LLM com este pedido:

> Leia AGENTS.md e VALIDATION.md deste kit e o AGENTS.md da release do T3 Code. Adapte Changes scope e controle da criação de PRs ao executável instalado, identificando sistema, arquitetura, versão e commit pelo ASAR. Mantenha funcionando o outro perfil macOS/Linux, seus payloads e fingerprints. Prepare um worktree do commit exato, porte somente a intenção dos patches e preserve as mudanças oficiais e a configuração pública de produção. Confira se é necessário reconstruir o servidor. Atualize o perfil correspondente, patch de fonte, snapshots, checksums, README, AGENTS.md e VALIDATION.md. Teste aplicação, repetição e restauração numa cópia, rejeição de outra release e CLI --version. Não encerre o T3 Code em uso, não abra a UI e não altere dados de usuário. Entregue o comando para um Terminal externo.

O procedimento completo, inclusive reconstrução dos dois perfis, está em [AGENTS.md](AGENTS.md). Os testes realmente executados e suas limitações estão em [VALIDATION.md](VALIDATION.md).

## Conteúdo

- `apply.sh`: detecção do sistema; `apply.mjs`: instalador macOS; `apply-linux.mjs`: instalador Linux.
- `patch-lib.mjs`, `linux-lib.mjs`: empacotamento, validação, permissões e detecção de processos.
- `target.json`, `payload.tar.gz`: perfil macOS 0.1.1; `linux/`: perfil Linux independente.
- `prepare-source.mjs`: worktree isolado com perfil `legacy`, `modern` ou `linux`.
- `build-linux.mjs`: recupera os defaults públicos do app informado (`.app` ou instalação Linux) e compila web/servidor sem imprimir seus valores.
- `build-payload.mjs`: gera o perfil da plataforma selecionada pelo caminho de `--app`; aceita `--server-dist` também no macOS quando faltam contratos; não instala o aplicativo.
- `patches/`, `reference/`, `reference-installed-version/`, `reference-linux/`: deltas e snapshots de proveniência, nunca substitutos integrais dos arquivos de releases futuras.
- `manifest.json`, `checksums.sha256`: bases e checksums; `patch-lib.test.mjs`, `linux.test.mjs`: testes do kit.

O patch cobre o cliente web servido pelo desktop e, nas releases 0.1.1 atuais, o servidor local desse desktop. Não atualiza `app.t3.codes`, outros servidores ou apps nativos iOS/Android. Os ajustes mobile de fonte foram preservados para integração, sem entregar um build mobile.

O kit não contém banco de dados, credenciais privadas ou cópia completa do aplicativo. Deriva do [T3 Code](https://github.com/pingdotgg/t3code), distribuído sob a [licença MIT](LICENSE). Backups e dependências ficam fora do versionamento.
