#!/usr/bin/env bash
# Penumbra fixture — Bash (tint: green)
set -euo pipefail

readonly NAME="${1:-world}"
declare -a TAGS=("admin" "guest")

greet() {
  local name="$1"
  if [[ -z "$name" ]]; then
    echo "no name" >&2
    return 1
  fi
  printf "Hello, %s\n" "$name"
}

main() {
  greet "$NAME"
  for tag in "${TAGS[@]}"; do
    echo "  - tag: $tag"
  done

  if [[ "${DEBUG:-0}" == "1" ]]; then
    echo "debug mode" >&2
  fi
}

main "$@"
