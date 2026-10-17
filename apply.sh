#!/bin/sh
set -eu
kit_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
case "$(uname -s)" in
  Darwin) helper=apply.mjs ;;
  Linux) helper=apply-linux.mjs ;;
  *) echo 'Sistema operacional não suportado.' >&2; exit 1 ;;
esac
exec node "$kit_dir/$helper" "$@"
