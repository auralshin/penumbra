#!/usr/bin/env bash
# Penumbra — sandbox dev launcher.
# Spins up an isolated VS Code profile with Penumbra live-loaded from this
# repo and (optionally) Custom UI Style configured to read the local CSS/JS.
#
# Usage:
#   ./scripts/dev.sh                  launch (creates sandbox on first run)
#   ./scripts/dev.sh --reset          nuke sandbox profile and rebuild
#   ./scripts/dev.sh --no-css         theme JSON only, skip Custom UI Style
#   ./scripts/dev.sh --no-build       skip rebuild before launch
#   ./scripts/dev.sh --no-launch      prep sandbox but don't open VS Code

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="${PENUMBRA_DEV_DIR:-$HOME/.penumbra-dev}"
DATA_DIR="$SANDBOX/data"
EXT_DIR="$SANDBOX/exts"
SETTINGS="$DATA_DIR/User/settings.json"

RESET=0; NO_CSS=0; NO_BUILD=0; NO_LAUNCH=0

for arg in "$@"; do
  case "$arg" in
    --reset)     RESET=1 ;;
    --no-css)    NO_CSS=1 ;;
    --no-build)  NO_BUILD=1 ;;
    --no-launch) NO_LAUNCH=1 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

step() { printf "\033[1;35m▸\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$*"; }

if ! command -v code >/dev/null 2>&1; then
  warn "The 'code' CLI is not on PATH. In VS Code, run:"
  warn "    Cmd+Shift+P -> 'Shell Command: Install code command in PATH'"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  warn "Node is required to build the theme. Install Node >= 18 and rerun."
  exit 1
fi

if [[ $RESET -eq 1 && -d "$SANDBOX" ]]; then
  step "Resetting sandbox at $SANDBOX"
  rm -rf "$SANDBOX"
  ok "removed"
fi

if [[ $NO_BUILD -eq 0 ]]; then
  step "Building theme JSON + token CSS"
  node "$DIR/scripts/build.mjs"
fi

step "Preparing sandbox at $SANDBOX"
mkdir -p "$DATA_DIR/User" "$EXT_DIR"

if [[ $NO_CSS -eq 0 ]]; then
  installed_in_sandbox=$(code --extensions-dir "$EXT_DIR" --user-data-dir "$DATA_DIR" \
                              --list-extensions 2>/dev/null || true)
  if ! grep -qi '^subframe7536\.custom-ui-style$' <<<"$installed_in_sandbox"; then
    step "Installing Custom UI Style into sandbox"
    code --extensions-dir "$EXT_DIR" --user-data-dir "$DATA_DIR" \
         --install-extension subframe7536.custom-ui-style >/dev/null
    ok "Custom UI Style installed in sandbox"
    if ! code --list-extensions 2>/dev/null | grep -qi '^subframe7536\.custom-ui-style$'; then
      warn "Custom UI Style was not present in your main VS Code; it has now"
      warn "patched the workbench HTML globally. Revert with the command"
      warn "palette: 'Custom UI Style: Restore'."
    fi
  fi
fi

step "Writing sandbox settings.json"
if [[ $NO_CSS -eq 0 ]]; then
  cat > "$SETTINGS" <<EOF
{
  "workbench.colorTheme": "Penumbra",
  "custom-ui-style.external.imports": [
    "file://$DIR/css/_tokens.generated.css",
    "file://$DIR/css/penumbra.css",
    "file://$DIR/css/penumbra.js"
  ],
  "editor.fontFamily": "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  "editor.fontLigatures": true,
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.cursorBlinking": "smooth",
  "workbench.list.smoothScrolling": true,
  "workbench.tree.renderIndentGuides": "onHover",
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "window.titleBarStyle": "custom",
  "window.commandCenter": true
}
EOF
else
  cat > "$SETTINGS" <<EOF
{
  "workbench.colorTheme": "Penumbra",
  "editor.fontFamily": "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  "editor.fontLigatures": true,
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "window.commandCenter": true
}
EOF
fi
ok "settings.json written"

WORKSPACE="$DIR"
[[ -d "$DIR/fixtures" ]] && WORKSPACE="$DIR/fixtures"

if [[ $NO_LAUNCH -eq 1 ]]; then
  ok "Sandbox prepared. Launch with:"
  echo "  code --user-data-dir '$DATA_DIR' --extensions-dir '$EXT_DIR' \\"
  echo "       --extensionDevelopmentPath '$DIR' '$WORKSPACE'"
  exit 0
fi

step "Launching VS Code (sandbox window)"
code --user-data-dir "$DATA_DIR" \
     --extensions-dir "$EXT_DIR" \
     --extensionDevelopmentPath "$DIR" \
     --new-window \
     "$WORKSPACE"

ok "Sandbox window opening."
echo
echo "Iteration loop:"
echo "  Cmd+R                                    reload window after editing tokens.json or theme JSON"
echo "  Cmd+Shift+P → 'Custom UI Style: Reload'  after editing CSS or JS"
echo "  ./scripts/dev.sh --reset                 if sandbox state gets weird"
echo
echo "Tint test: cycle through fixtures/ files and watch the active tab"
echo "indicator + status-bar language chip recolor per language."
