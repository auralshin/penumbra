#!/usr/bin/env bash
# Penumbra — install helper.
# Installs the Custom UI Style extension, builds the theme JSON + CSS vars,
# and prints the settings.json snippet you need to paste.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

step() { printf "\033[1;35m▸\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$*"; }

if ! command -v code >/dev/null 2>&1; then
  warn "The 'code' CLI is not on PATH. In VS Code, run:"
  warn "    Cmd+Shift+P → 'Shell Command: Install code command in PATH'"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  warn "Node is required to build the theme. Install Node ≥ 18 and rerun."
  exit 1
fi

step "Building theme JSON + token CSS"
node "$DIR/scripts/build.mjs"
ok   "Theme built"

step "Installing Custom UI Style extension"
code --install-extension subframe7536.custom-ui-style >/dev/null
ok   "Custom UI Style installed"

step "Installing Penumbra (dev link)"
if command -v vsce >/dev/null 2>&1; then
  (cd "$DIR" && vsce package --no-dependencies --out "$DIR/penumbra.vsix" >/dev/null)
  code --install-extension "$DIR/penumbra.vsix" >/dev/null
  ok "Penumbra packaged and installed"
else
  warn "vsce not found — skipping packaging."
  warn "Install with:  npm install -g @vscode/vsce"
  warn "Or use the theme directly by symlinking this folder into ~/.vscode/extensions/."
fi

cat <<EOF

──────────────────────────────────────────────────────────────────────
  Final step: open VS Code settings.json and paste this in
──────────────────────────────────────────────────────────────────────

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
  "workbench.tree.renderIndentGuides": "onHover"

Then run:  Cmd+Shift+P → "Custom UI Style: Reload"

──────────────────────────────────────────────────────────────────────
EOF
