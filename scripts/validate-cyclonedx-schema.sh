#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  echo "usage: $0 <sbom.cdx.json> [...]" >&2
  exit 2
fi

readonly workspace="$(pwd -P)"
readonly validator="$(nix build --no-link --print-out-paths .#cyclonedx-validator)"
readonly cyclonedx="$validator/bin/cyclonedx"

test -x "$cyclonedx"

for sbom_file in "$@"; do
  if [[ ! -f "$sbom_file" ]]; then
    echo "SBOM file does not exist: $sbom_file" >&2
    exit 2
  fi

  absolute_file="$(cd "$(dirname "$sbom_file")" && pwd -P)/$(basename "$sbom_file")"
  case "$absolute_file" in
    "$workspace"/*) relative_file="${absolute_file#"$workspace"/}" ;;
    *)
      echo "SBOM file must be inside the current workspace: $sbom_file" >&2
      exit 2
      ;;
  esac

  "$cyclonedx" validate \
    --input-file "$relative_file" \
    --input-format json \
    --input-version v1_6 \
    --fail-on-errors
done
