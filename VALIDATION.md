# Verificação — 17/10/2026

Alvo: `/Applications/T3 Code (Beta).app`, `0.1.0-disable-pr-creation.20261016`, Apple Silicon. Fingerprints completos em `target.json`.

## Fork

- As duas funcionalidades e as correções posteriores de PRs foram integradas no `main`.
- Commit final: `7fb09a2af59d1e33d3535d29315cc392d97132e6`, enviado a `origin/main`.
- Testes focados: **366 testes passaram em 9 arquivos**.
- Typecheck do cliente web passou. Lint dos arquivos de integração e do Changes control passou. O lint adicional dos controles mobile emite avisos de dependências de memoização que já estavam no desenvolvimento de PRs; não foram tratados como parte deste kit.
- A remoção de memoização manual do Changes control é uma adaptação ao React Compiler da base mais recente; o perfil antigo mantém a implementação compatível com sua base original.

## Código do payload atual

- Reconstruído sobre `66c4f1b87b99ebb5baa7bea0a40f66a06ba5b8a6`, com o perfil legacy e as correções de PRs.
- Snapshot local de proveniência: `6b0266942` (referência completa no manifest; não é necessário obter esse commit para reconstruir: use os patches).
- **338 testes passaram em 8 arquivos**. Typecheck web passou.
- Build web concluído com a versão instalada e sem sourcemaps. O build do servidor também foi conferido; não foi necessário incluí-lo no patch porque os contratos já existem na instalação original.
- Payload: **7.263.809 bytes**, **741 arquivos web novos/alterados**, **189 chunks/arquivos antigos removidos**. Favicons e manifest originais preservados.

## Preparação de fontes

- `prepare-source.mjs` testado sobre o commit da instalação atual, perfil legacy.
- Perfil modern testado sobre `2fae0f9841448e6edb93d0ebe4cbaf2d546bb38c`.
- Os arquivos preparados foram comparados com os snapshots correspondentes; a comparação do perfil modern final foi refeita após a adaptação ao React Compiler.
- Checksums dos patches e cópias de referência conferidos.

## Script e bundle

- **3 testes automatizados do kit passaram**: rejeição de release diferente/repetição, restrição de caminhos e reempacotamento real de ASAR preservando arquivos nativos unpacked e o arquivo de origem; payload adulterado também é rejeitado.
- `./apply.sh --check` reconheceu o aplicativo instalado sem alterá-lo, inclusive usando automaticamente o Node do Electron a partir do Node 20 do sistema.
- `--output` produziu uma cópia real do bundle; `codesign --verify --deep --strict` passou.
- Integridade do hash ASAR no `Info.plist` conferida separadamente.
- Comparação completa dos arquivos pertinentes do ASAR: **1.358 arquivos originais mantidos idênticos**, **95 arquivos unpacked preservados** e **741 arquivos de payload conferidos por SHA-256**.
- A CLI da cópia respondeu `t3 v0.1.0` com exit code 0, igual à CLI original. A versão do aplicativo no plist permanece `0.1.0-disable-pr-creation.20261016`.
- Em uma segunda cópia isolada, o fluxo completo foi testado: aplicar → detectar repetição sem fazer alterações → restaurar backup. Após restaurar, os hashes do ASAR e do plist eram iguais aos da instalação original.
- Uma alteração proposital no ASAR dessa cópia fez o script recusar a operação antes de modificar o aplicativo.

**A instalação original não recebeu o patch e seus fingerprints continuam iguais aos originais.** Não foram abertos navegador ou UI, iniciados servidores nem alterados dados de usuário. As cópias e o backup criados exclusivamente para os testes foram removidos após as verificações; o script criará um backup novo quando for usado na instalação real.
