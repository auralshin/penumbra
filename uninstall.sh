#!/usr/bin/env bash
# Penumbra — uninstall helper.
# Removes the extension and build artifacts, then prints the settings.json
# keys to delete by hand (we don't auto-edit user JSONC).
#
# Usage:
#   ./uninstall.sh          remove Penumbra only (Custom UI Style stays)
#   ./uninstall.sh --purge  also remove Custom UI Style
#   ./uninstall.sh --keep-build   skip removing built theme/CSS artifacts

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PURGE=0
KEEP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --purge)      PURGE=1 ;;
    --keep-build) KEEP_BUILD=1 ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

step() { printf "\033[1;35m▸\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$*"; }

if ! command -v code >/dev/null 2>&1; then
  warn "'code' CLI not on PATH — can't uninstall extensions automatically."
  warn "Disable Penumbra (and optionally Custom UI Style) from the Extensions view, then rerun this script for the artifact cleanup."
else
  step "Removing Penumbra extension"
  if code --list-extensions 2>/dev/null | grep -qi '^auralshin\.penumbra$'; then
    code --uninstall-extension auralshin.penumbra >/dev/null
    ok "auralshin.penumbra uninstalled"
  else
    warn "auralshin.penumbra is not installed — skipping"
  fi

  if [[ $PURGE -eq 1 ]]; then
    step "Removing Custom UI Style extension (--purge)"
    if code --list-extensions 2>/dev/null | grep -qi '^subframe7536\.custom-ui-style$'; then
      code --uninstall-extension subframe7536.custom-ui-style >/dev/null
      ok "subframe7536.custom-ui-style uninstalled"
    else
      warn "Custom UI Style is not installed — skipping"
    fi
  fi
fi

if [[ $KEEP_BUILD -eq 0 ]]; then
  step "Removing build artifacts"
  rm -f "$DIR/themes/penumbra-color-theme.json"
  rm -f "$DIR/css/_tokens.generated.css"
  rm -f "$DIR/penumbra.vsix" "$DIR"/penumbra-*.vsix
  ok "artifacts removed"
else
  warn "Keeping build artifacts (--keep-build)"
fi

cat <<EOF

──────────────────────────────────────────────────────────────────────
  Final step: open VS Code settings.json and remove these keys
──────────────────────────────────────────────────────────────────────

  "workbench.colorTheme": "Penumbra",
  "custom-ui-style.external.imports": [
    "file://$DIR/css/_tokens.generated.css",
    "file://$DIR/css/penumbra.css",
    "file://$DIR/css/penumbra.js"
  ],

  (also drop the editor.fontFamily / cursor / scrolling overrides
   from install.sh if you don't want to keep them)
EOF

if [[ $PURGE -eq 1 ]]; then
  cat <<'EOF'

  --purge mode: also delete every "custom-ui-style.*" key, then
  restart VS Code so the patched workbench files unload cleanly.
EOF
else
  cat <<'EOF'

  Then run:  Cmd+Shift+P → "Custom UI Style: Reload"
EOF
fi

cat <<EOF

──────────────────────────────────────────────────────────────────────
EOF
