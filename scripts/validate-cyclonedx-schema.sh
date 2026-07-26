#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  echo "usage: $0 <sbom.cdx.json> [...]" >&2
  exit 2
fi

readonly cyclonedx_cli_version='0.32.0'
readonly cyclonedx_cli_digest='sha256:9a858a15e7b0843606efc0ff19d5f7575011a5428d7f3d343b4f6cf09d8f0d4e'
readonly cyclonedx_cli_image="cyclonedx/cyclonedx-cli:${cyclonedx_cli_version}@${cyclonedx_cli_digest}"
readonly workspace="$(pwd -P)"

docker pull "$cyclonedx_cli_image" >/dev/null

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

  docker run --rm --network none \
    --volume "$workspace:/workspace:ro" \
    --workdir /workspace \
    "$cyclonedx_cli_image" \
    validate \
    --input-file "$relative_file" \
    --input-format json \
    --input-version v1_6 \
    --fail-on-errors
done
