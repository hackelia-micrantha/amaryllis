#!/usr/bin/env bash
set -euo pipefail

if (($# == 0)); then
  echo "usage: $0 <sbom.cdx.json> [...]" >&2
  exit 2
fi

readonly check_jsonschema_version='0.37.2'
readonly cyclonedx_schema_revision='8a27bfd1be5be0dcb2c208a34d2f4fa0b6d75bd7'
readonly schema_url="https://raw.githubusercontent.com/CycloneDX/specification/${cyclonedx_schema_revision}/schema/bom-1.6.schema.json"

python3 -m pip install --disable-pip-version-check --quiet \
  "check-jsonschema==${check_jsonschema_version}"
python3 -m check_jsonschema --schemafile "$schema_url" "$@"
