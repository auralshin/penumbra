#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const WATCH = args.has('--watch');

for (const arg of args) {
  if (!['--check', '--watch'].includes(arg)) {
    console.error(`Unknown flag: ${arg}`);
    console.error('Usage: node scripts/build.mjs [--check] [--watch]');
    process.exit(2);
  }
}

const TOKEN_PATH = join(ROOT, 'tokens.json');
const THEME_PATH = join(ROOT, 'themes/penumbra-color-theme.json');
const CSS_VARS_PATH = join(ROOT, 'css/_tokens.generated.css');

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to read ${path}: ${error.message}`);
  }
};

let tokens = readJson(TOKEN_PATH);

const HEX = /^#[0-9a-fA-F]{6}$/;
const requiredTokenSections = [
  'name',
  'displayName',
  'description',
  'type',
  'palette',
  'syntax',
  'italics',
  'languageTints',
  'radii',
  'gaps',
];
const requiredPaletteKeys = [
  'canvas',
  'surface0',
  'surface1',
  'surface2',
  'surface3',
  'line',
  'text',
  'textMuted',
  'textFaint',
  'accent',
  'success',
  'warn',
  'error',
  'info',
];
const requiredSyntaxKeys = [
  'comment',
  'keyword',
  'constant',
  'string',
  'stringEsc',
  'function',
  'type',
  'property',
  'variable',
  'parameter',
  'operator',
  'punctuation',
  'tag',
  'attribute',
  'regex',
  'decorator',
  'markupHead',
  'markupLink',
  'markupCode',
  'diffAdd',
  'diffRemove',
];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertHexMap = (section, value, keys) => {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${section} must be an object`);
  for (const key of keys) {
    assert(typeof value[key] === 'string', `${section}.${key} must be a string`);
    assert(HEX.test(value[key]), `${section}.${key} must be a 6-digit hex color`);
  }
};

const validateTokens = (value) => {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'tokens.json must contain an object');
  for (const section of requiredTokenSections) {
    assert(value[section] !== undefined, `tokens.json is missing "${section}"`);
  }
  assert(typeof value.name === 'string' && value.name.length > 0, 'name must be a non-empty string');
  assert(typeof value.displayName === 'string' && value.displayName.length > 0, 'displayName must be a non-empty string');
  assert(typeof value.description === 'string' && value.description.length > 0, 'description must be a non-empty string');
  assert(value.type === 'dark' || value.type === 'light', 'type must be "dark" or "light"');
  assertHexMap('palette', value.palette, requiredPaletteKeys);
  assertHexMap('syntax', value.syntax, requiredSyntaxKeys);
  assert(Array.isArray(value.italics), 'italics must be an array');
  for (const key of value.italics) {
    assert(requiredSyntaxKeys.includes(key), `italics contains unknown syntax key "${key}"`);
  }
  assert(value.languageTints && typeof value.languageTints === 'object' && !Array.isArray(value.languageTints), 'languageTints must be an object');
  assert(HEX.test(value.languageTints._default ?? ''), 'languageTints._default must be a 6-digit hex color');
  for (const [key, tint] of Object.entries(value.languageTints)) {
    assert(/^[a-z0-9_-]+$/.test(key), `languageTints key "${key}" contains unsupported characters`);
    assert(HEX.test(tint), `languageTints.${key} must be a 6-digit hex color`);
  }
  assert(value.radii && typeof value.radii === 'object', 'radii must be an object');
  for (const key of ['panel', 'widget', 'input', 'item', 'pill']) {
    assert(Number.isInteger(value.radii[key]) && value.radii[key] >= 0, `radii.${key} must be a non-negative integer`);
  }
  assert(value.gaps && typeof value.gaps === 'object', 'gaps must be an object');
  for (const key of ['outer', 'top']) {
    assert(Number.isInteger(value.gaps[key]) && value.gaps[key] >= 0, `gaps.${key} must be a non-negative integer`);
  }
};

validateTokens(tokens);

let { palette: P, syntax: S, italics, languageTints, radii, gaps } = tokens;

const a = (hex, alpha) => {
  const h = hex.replace('#', '');
  const aa = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${h}${aa}`.toLowerCase();
};

const colors = {
  // ---- Core ----
  "focusBorder":                                  a(P.accent, 0.40),
  "foreground":                                   P.text,
  "descriptionForeground":                        P.textMuted,
  "errorForeground":                              P.error,
  "icon.foreground":                              P.textMuted,
  "selection.background":                         a(P.accent, 0.25),
  "widget.shadow":                                "#00000000",
  "sash.hoverBorder":                             a(P.accent, 0.50),

  // ---- Window / title bar ----
  "window.activeBorder":                          P.canvas,
  "window.inactiveBorder":                        P.canvas,
  "titleBar.activeBackground":                    P.canvas,
  "titleBar.activeForeground":                    P.text,
  "titleBar.inactiveBackground":                  P.canvas,
  "titleBar.inactiveForeground":                  P.textMuted,
  "titleBar.border":                              P.canvas,

  // ---- Activity bar ----
  "activityBar.background":                       P.surface0,
  "activityBar.foreground":                       P.text,
  "activityBar.inactiveForeground":               P.textFaint,
  "activityBar.border":                           P.canvas,
  "activityBar.activeBorder":                     P.accent,
  "activityBar.activeBackground":                 "#00000000",
  "activityBar.activeFocusBorder":                P.accent,
  "activityBarBadge.background":                  P.accent,
  "activityBarBadge.foreground":                  P.canvas,
  "activityBarTop.foreground":                    P.text,
  "activityBarTop.activeBorder":                  P.accent,
  "activityBarTop.inactiveForeground":            P.textFaint,

  // ---- Sidebar ----
  "sideBar.background":                           P.surface0,
  "sideBar.foreground":                           P.text,
  "sideBar.border":                               P.canvas,
  "sideBarTitle.foreground":                      P.text,
  "sideBarSectionHeader.background":              "#00000000",
  "sideBarSectionHeader.foreground":              P.textMuted,
  "sideBarSectionHeader.border":                  P.canvas,

  // ---- Editor ----
  "editor.background":                            P.surface0,
  "editor.foreground":                            P.text,
  "editorLineNumber.foreground":                  P.textFaint,
  "editorLineNumber.activeForeground":            P.textMuted,
  "editorCursor.foreground":                      P.accent,
  "editor.selectionBackground":                   a(P.accent, 0.20),
  "editor.selectionHighlightBackground":          a(P.accent, 0.10),
  "editor.inactiveSelectionBackground":           a(P.accent, 0.10),
  "editor.findMatchBackground":                   a(P.warn, 0.30),
  "editor.findMatchHighlightBackground":          a(P.warn, 0.15),
  "editor.findRangeHighlightBackground":          a(P.accent, 0.10),
  "editor.hoverHighlightBackground":              a(P.accent, 0.10),
  "editor.lineHighlightBackground":               a(P.surface3, 0.40),
  "editor.lineHighlightBorder":                   "#00000000",
  "editor.rangeHighlightBackground":              a(P.surface3, 0.30),
  "editor.wordHighlightBackground":               a(P.accent, 0.12),
  "editor.wordHighlightStrongBackground":         a(P.accent, 0.18),
  "editorWhitespace.foreground":                  P.surface3,
  "editorIndentGuide.background1":                P.surface1,
  "editorIndentGuide.activeBackground1":          P.surface3,
  "editorRuler.foreground":                       P.surface1,
  "editorBracketMatch.background":                a(P.accent, 0.15),
  "editorBracketMatch.border":                    a(P.accent, 0.50),
  "editorCodeLens.foreground":                    P.textFaint,
  "editorOverviewRuler.border":                   "#00000000",
  "editorOverviewRuler.errorForeground":          P.error,
  "editorOverviewRuler.warningForeground":        P.warn,
  "editorOverviewRuler.infoForeground":           P.info,

  // ---- Editor groups & tabs ----
  "editorGroup.border":                           P.canvas,
  "editorGroup.dropBackground":                   a(P.accent, 0.10),
  "editorGroupHeader.tabsBackground":             P.surface0,
  "editorGroupHeader.tabsBorder":                 P.canvas,
  "editorGroupHeader.border":                     P.canvas,
  "editorGroupHeader.noTabsBackground":           P.surface0,
  "tab.activeBackground":                         P.surface0,
  "tab.activeForeground":                         P.text,
  "tab.activeBorder":                             "#00000000",
  "tab.activeBorderTop":                          P.accent,
  "tab.inactiveBackground":                       P.surface0,
  "tab.inactiveForeground":                       P.textMuted,
  "tab.unfocusedActiveForeground":                P.textMuted,
  "tab.unfocusedInactiveForeground":              P.textFaint,
  "tab.border":                                   "#00000000",
  "tab.unfocusedActiveBorder":                    "#00000000",
  "tab.unfocusedActiveBorderTop":                 a(P.accent, 0.30),
  "tab.hoverBackground":                          P.surface1,
  "tab.hoverForeground":                          P.text,
  "tab.unfocusedHoverBackground":                 P.surface1,
  "tab.lastPinnedBorder":                         P.line,

  // ---- Panel ----
  "panel.background":                             P.surface0,
  "panel.border":                                 P.canvas,
  "panel.dropBorder":                             P.accent,
  "panelTitle.activeBorder":                      P.accent,
  "panelTitle.activeForeground":                  P.text,
  "panelTitle.inactiveForeground":                P.textMuted,
  "panelInput.border":                            P.line,
  "panelSection.border":                          P.canvas,

  // ---- Status bar ----
  "statusBar.background":                         P.canvas,
  "statusBar.foreground":                         P.textMuted,
  "statusBar.border":                             P.canvas,
  "statusBar.noFolderBackground":                 P.canvas,
  "statusBar.debuggingBackground":                P.canvas,
  "statusBar.debuggingForeground":                P.warn,
  "statusBarItem.activeBackground":               a(P.accent, 0.20),
  "statusBarItem.hoverBackground":                P.surface1,
  "statusBarItem.prominentBackground":            P.surface2,
  "statusBarItem.prominentHoverBackground":       P.surface3,
  "statusBarItem.remoteBackground":               P.accent,
  "statusBarItem.remoteForeground":               P.canvas,
  "statusBarItem.errorBackground":                P.error,
  "statusBarItem.errorForeground":                P.canvas,
  "statusBarItem.warningBackground":              P.warn,
  "statusBarItem.warningForeground":              P.canvas,

  // ---- Inputs / buttons ----
  "input.background":                             P.surface1,
  "input.foreground":                             P.text,
  "input.border":                                 P.line,
  "input.placeholderForeground":                  P.textFaint,
  "inputOption.activeBackground":                 a(P.accent, 0.20),
  "inputOption.activeBorder":                     a(P.accent, 0.50),
  "inputOption.activeForeground":                 P.text,
  "inputValidation.errorBackground":              a(P.error, 0.15),
  "inputValidation.errorBorder":                  P.error,
  "inputValidation.warningBackground":            a(P.warn, 0.15),
  "inputValidation.warningBorder":                P.warn,
  "inputValidation.infoBackground":               a(P.info, 0.15),
  "inputValidation.infoBorder":                   P.info,
  "button.background":                            P.accent,
  "button.foreground":                            P.canvas,
  "button.hoverBackground":                       a(P.accent, 0.85),
  "button.secondaryBackground":                   P.surface2,
  "button.secondaryForeground":                   P.text,
  "button.secondaryHoverBackground":              P.surface3,
  "checkbox.background":                          P.surface1,
  "checkbox.border":                              P.line,
  "checkbox.foreground":                          P.text,

  // ---- Lists / trees ----
  "list.activeSelectionBackground":               P.surface3,
  "list.activeSelectionForeground":               P.text,
  "list.inactiveSelectionBackground":             P.surface2,
  "list.inactiveSelectionForeground":             P.text,
  "list.hoverBackground":                         P.surface1,
  "list.hoverForeground":                         P.text,
  "list.focusBackground":                         P.surface3,
  "list.focusForeground":                         P.text,
  "list.focusOutline":                            "#00000000",
  "list.highlightForeground":                     P.accent,
  "list.errorForeground":                         P.error,
  "list.warningForeground":                       P.warn,
  "list.dropBackground":                          a(P.accent, 0.10),
  "tree.indentGuidesStroke":                      P.surface1,
  "tree.inactiveIndentGuidesStroke":              P.surface1,
  "listFilterWidget.background":                  P.surface2,
  "listFilterWidget.outline":                     P.accent,
  "listFilterWidget.noMatchesOutline":            P.error,

  // ---- Quick input / command palette ----
  "quickInput.background":                        P.surface2,
  "quickInput.foreground":                        P.text,
  "quickInputTitle.background":                   P.surface2,
  "quickInputList.focusBackground":               P.surface3,
  "quickInputList.focusForeground":               P.text,
  "quickInputList.focusIconForeground":           P.accent,
  "pickerGroup.foreground":                       P.textMuted,
  "pickerGroup.border":                           P.line,
  "keybindingLabel.background":                   P.surface3,
  "keybindingLabel.foreground":                   P.text,
  "keybindingLabel.border":                       P.line,
  "keybindingLabel.bottomBorder":                 P.line,

  // ---- Editor widgets ----
  "editorWidget.background":                      P.surface2,
  "editorWidget.foreground":                      P.text,
  "editorWidget.border":                          "#00000000",
  "editorWidget.resizeBorder":                    a(P.accent, 0.40),
  "editorHoverWidget.background":                 P.surface2,
  "editorHoverWidget.foreground":                 P.text,
  "editorHoverWidget.border":                     P.line,
  "editorSuggestWidget.background":               P.surface2,
  "editorSuggestWidget.border":                   "#00000000",
  "editorSuggestWidget.foreground":               P.text,
  "editorSuggestWidget.highlightForeground":      P.accent,
  "editorSuggestWidget.selectedBackground":       P.surface3,
  "editorSuggestWidget.selectedForeground":       P.text,
  "editorMarkerNavigation.background":            P.surface2,
  "editorMarkerNavigationError.background":       P.error,
  "editorMarkerNavigationWarning.background":     P.warn,
  "editorMarkerNavigationInfo.background":        P.info,
  "peekView.border":                              P.accent,
  "peekViewEditor.background":                    P.surface1,
  "peekViewResult.background":                    P.surface2,
  "peekViewTitle.background":                     P.surface2,
  "peekViewTitleLabel.foreground":                P.text,
  "peekViewTitleDescription.foreground":          P.textMuted,
  "peekViewResult.fileForeground":                P.text,
  "peekViewResult.lineForeground":                P.textMuted,
  "peekViewResult.matchHighlightBackground":      a(P.accent, 0.25),
  "peekViewEditor.matchHighlightBackground":      a(P.accent, 0.25),

  // ---- Notifications ----
  "notifications.background":                     P.surface2,
  "notifications.foreground":                     P.text,
  "notifications.border":                         "#00000000",
  "notificationToast.border":                     "#00000000",
  "notificationCenter.border":                    "#00000000",
  "notificationCenterHeader.background":          P.surface2,
  "notificationCenterHeader.foreground":          P.text,
  "notificationLink.foreground":                  P.accent,
  "notificationsErrorIcon.foreground":            P.error,
  "notificationsWarningIcon.foreground":          P.warn,
  "notificationsInfoIcon.foreground":             P.info,

  // ---- Scrollbar ----
  "scrollbar.shadow":                             "#00000000",
  "scrollbarSlider.background":                   a(P.surface3, 0.40),
  "scrollbarSlider.hoverBackground":              a(P.surface3, 0.70),
  "scrollbarSlider.activeBackground":             a(P.accent, 0.50),
  "minimap.background":                           P.surface0,
  "minimap.findMatchHighlight":                   a(P.warn, 0.40),
  "minimap.selectionHighlight":                   a(P.accent, 0.30),
  "minimap.errorHighlight":                       P.error,
  "minimap.warningHighlight":                     P.warn,
  "minimapSlider.background":                     a(P.surface3, 0.30),
  "minimapSlider.hoverBackground":                a(P.surface3, 0.50),
  "minimapSlider.activeBackground":               a(P.accent, 0.40),
  "minimapGutter.addedBackground":                P.success,
  "minimapGutter.modifiedBackground":             P.info,
  "minimapGutter.deletedBackground":              P.error,

  // ---- Diff editor ----
  "diffEditor.insertedTextBackground":            a(P.success, 0.10),
  "diffEditor.removedTextBackground":             a(P.error, 0.12),
  "diffEditor.insertedLineBackground":            a(P.success, 0.06),
  "diffEditor.removedLineBackground":             a(P.error, 0.08),
  "diffEditor.diagonalFill":                      P.surface1,
  "diffEditor.border":                            P.canvas,
  "diffEditorOverview.insertedForeground":        a(P.success, 0.50),
  "diffEditorOverview.removedForeground":         a(P.error, 0.50),

  // ---- Merge conflicts ----
  "merge.currentHeaderBackground":                a(P.info, 0.30),
  "merge.currentContentBackground":               a(P.info, 0.10),
  "merge.incomingHeaderBackground":               a(P.accent, 0.30),
  "merge.incomingContentBackground":              a(P.accent, 0.10),
  "merge.commonHeaderBackground":                 a(P.textFaint, 0.30),
  "merge.commonContentBackground":                a(P.textFaint, 0.10),

  // ---- Git decorations ----
  "gitDecoration.modifiedResourceForeground":     P.info,
  "gitDecoration.deletedResourceForeground":      P.error,
  "gitDecoration.untrackedResourceForeground":    P.success,
  "gitDecoration.ignoredResourceForeground":      P.textFaint,
  "gitDecoration.conflictingResourceForeground":  P.warn,
  "gitDecoration.addedResourceForeground":        P.success,
  "gitDecoration.stageModifiedResourceForeground": P.info,
  "gitDecoration.stageDeletedResourceForeground": P.error,
  "gitDecoration.submoduleResourceForeground":    P.textMuted,

  // ---- Editor gutter ----
  "editorGutter.background":                      P.surface0,
  "editorGutter.modifiedBackground":              P.info,
  "editorGutter.addedBackground":                 P.success,
  "editorGutter.deletedBackground":               P.error,
  "editorGutter.commentRangeForeground":          P.textFaint,
  "editorGutter.foldingControlForeground":        P.textMuted,

  // ---- Errors / squigglies ----
  "editorError.foreground":                       P.error,
  "editorWarning.foreground":                     P.warn,
  "editorInfo.foreground":                        P.info,
  "editorHint.foreground":                        P.textMuted,
  "editorError.background":                       "#00000000",
  "editorWarning.background":                     "#00000000",
  "problemsErrorIcon.foreground":                 P.error,
  "problemsWarningIcon.foreground":               P.warn,
  "problemsInfoIcon.foreground":                  P.info,

  // ---- Breadcrumbs ----
  "breadcrumb.background":                        P.surface0,
  "breadcrumb.foreground":                        P.textMuted,
  "breadcrumb.focusForeground":                   P.text,
  "breadcrumb.activeSelectionForeground":         P.text,
  "breadcrumbPicker.background":                  P.surface2,

  // ---- Terminal ----
  "terminal.background":                          P.surface0,
  "terminal.foreground":                          P.text,
  "terminalCursor.background":                    P.surface0,
  "terminalCursor.foreground":                    P.accent,
  "terminal.selectionBackground":                 a(P.accent, 0.25),
  "terminal.inactiveSelectionBackground":         a(P.accent, 0.15),
  "terminal.border":                              P.canvas,
  "terminal.tab.activeBorder":                    P.accent,
  "terminal.ansiBlack":                           "#000000",
  "terminal.ansiRed":                             "#F87171",
  "terminal.ansiGreen":                           "#4ADE80",
  "terminal.ansiYellow":                          "#FBBF24",
  "terminal.ansiBlue":                            "#60A5FA",
  "terminal.ansiMagenta":                         "#A78BFA",
  "terminal.ansiCyan":                            "#22D3EE",
  "terminal.ansiWhite":                           "#E6E6EB",
  "terminal.ansiBrightBlack":                     "#525260",
  "terminal.ansiBrightRed":                       "#FCA5A5",
  "terminal.ansiBrightGreen":                     "#86EFAC",
  "terminal.ansiBrightYellow":                    "#FCD34D",
  "terminal.ansiBrightBlue":                      "#93C5FD",
  "terminal.ansiBrightMagenta":                   "#C4B5FD",
  "terminal.ansiBrightCyan":                      "#67E8F9",
  "terminal.ansiBrightWhite":                     "#FFFFFF",

  // ---- Debug ----
  "debugToolBar.background":                      P.surface2,
  "debugToolBar.border":                          "#00000000",
  "debugIcon.breakpointForeground":               P.error,
  "debugIcon.breakpointDisabledForeground":       P.textFaint,
  "debugIcon.breakpointUnverifiedForeground":     P.warn,
  "debugConsole.errorForeground":                 P.error,
  "debugConsole.warningForeground":               P.warn,
  "debugConsole.infoForeground":                  P.info,
  "debugConsole.sourceForeground":                P.textMuted,
  "debugConsoleInputIcon.foreground":             P.accent,

  // ---- Symbol icons (subset) ----
  "symbolIcon.classForeground":                   S.type,
  "symbolIcon.constantForeground":                S.constant,
  "symbolIcon.enumeratorForeground":              S.type,
  "symbolIcon.functionForeground":                S.function,
  "symbolIcon.interfaceForeground":               S.type,
  "symbolIcon.keywordForeground":                 S.keyword,
  "symbolIcon.methodForeground":                  S.function,
  "symbolIcon.namespaceForeground":               S.type,
  "symbolIcon.propertyForeground":                S.property,
  "symbolIcon.stringForeground":                  S.string,
  "symbolIcon.variableForeground":                S.variable,
  "symbolIcon.typeParameterForeground":           S.type,

  // ---- Charts ----
  "charts.foreground":                            P.text,
  "charts.lines":                                 P.surface3,
  "charts.red":                                   P.error,
  "charts.blue":                                  P.info,
  "charts.yellow":                                P.warn,
  "charts.orange":                                "#F97316",
  "charts.green":                                 P.success,
  "charts.purple":                                "#A78BFA"
};

// ---------- Token colors ----------
const fs = (settings) => settings;
const italic = (k) => italics.includes(k) ? "italic" : undefined;

const t = (name, scopes, foreground, fontStyle) => ({
  name,
  scope: scopes,
  settings: { foreground, ...(fontStyle ? { fontStyle } : {}) }
});

const tokenColors = [
  t("Comment", ["comment", "punctuation.definition.comment"], S.comment, italic("comment")),
  t("Punctuation", ["punctuation", "meta.brace", "meta.delimiter"], S.punctuation),
  t("Operator", ["keyword.operator"], S.operator),
  t("Keyword", ["keyword", "keyword.control", "storage.type", "storage.modifier"], S.keyword, italic("keyword")),
  t("Storage type", ["storage.type.function", "storage.type.class", "storage.type.struct"], S.keyword, italic("keyword")),
  t("Constant", ["constant.language", "constant.numeric"], S.constant, italic("constant")),
  t("Constant other", ["constant.other", "variable.other.constant"], S.constant),
  t("String", ["string", "string.quoted"], S.string),
  t("String escape", ["constant.character.escape", "string.regexp"], S.stringEsc),
  t("Regex", ["string.regexp"], S.regex),
  t("Function", ["entity.name.function", "support.function", "meta.function-call"], S.function),
  t("Function call", ["meta.function-call entity.name.function", "variable.function"], S.function),
  t("Type", ["entity.name.type", "entity.name.class", "support.type", "support.class", "entity.other.inherited-class"], S.type),
  t("Interface / Enum", ["entity.name.type.interface", "entity.name.type.enum"], S.type),
  t("Property", ["variable.other.property", "variable.other.object.property", "support.variable.property", "meta.object-literal.key"], S.property),
  t("Variable", ["variable", "variable.other.readwrite", "variable.other"], S.variable),
  t("Parameter", ["variable.parameter"], S.parameter),
  t("This / self", ["variable.language", "variable.language.this"], S.keyword, italic("keyword")),
  t("Decorator", ["meta.decorator", "tag.decorator", "punctuation.decorator"], S.decorator, italic("decorator")),
  t("Decorator name", ["entity.name.function.decorator"], S.decorator, italic("decorator")),
  t("Tag", ["entity.name.tag", "punctuation.definition.tag"], S.tag),
  t("Tag attribute", ["entity.other.attribute-name"], S.attribute),
  t("Tag attribute value", ["string.quoted.double.html", "string.quoted.single.html"], S.string),
  t("Heading", ["markup.heading", "entity.name.section"], S.markupHead),
  t("Bold", ["markup.bold"], P.text, "bold"),
  t("Italic", ["markup.italic"], P.text, "italic"),
  t("Markdown link", ["markup.underline.link", "string.other.link"], S.markupLink, "underline"),
  t("Markdown code", ["markup.inline.raw", "markup.fenced_code"], S.markupCode),
  t("Diff inserted", ["markup.inserted"], S.diffAdd),
  t("Diff deleted", ["markup.deleted"], S.diffRemove),
  t("Diff changed", ["markup.changed"], S.string),
  t("Invalid", ["invalid", "invalid.illegal"], P.error),
  t("JSON property", ["support.type.property-name.json", "meta.structure.dictionary.json string.quoted.double.json"], S.property),
  t("YAML key", ["entity.name.tag.yaml"], S.property),
  t("CSS class", ["entity.other.attribute-name.class.css"], S.type),
  t("CSS id", ["entity.other.attribute-name.id.css"], S.constant),
  t("CSS pseudo", ["entity.other.attribute-name.pseudo-class.css", "entity.other.attribute-name.pseudo-element.css"], S.keyword, italic("keyword")),
  t("CSS property", ["support.type.property-name.css"], S.property),
  t("CSS value", ["support.constant.property-value.css", "constant.numeric.css"], S.constant)
];

// ---------- Semantic tokens ----------
// Omit `fontStyle` entirely when not italic — emitting an empty string can
// strip italics inherited from a TextMate scope on some VS Code versions.
const sem = (foreground, italicKey) =>
  italicKey && italics.includes(italicKey)
    ? { foreground, fontStyle: "italic" }
    : { foreground };

const semanticTokenColors = {
  "namespace":         sem(S.type),
  "class":             sem(S.type),
  "interface":         sem(S.type),
  "enum":              sem(S.type),
  "enumMember":        sem(S.constant),
  "struct":            sem(S.type),
  "type":              sem(S.type),
  "typeParameter":     sem(S.type),
  "function":          sem(S.function),
  "method":            sem(S.function),
  "macro":             sem(S.function),
  "property":          sem(S.property),
  "variable":          sem(S.variable),
  "variable.readonly": sem(S.constant),
  "parameter":         sem(S.parameter),
  "keyword":           sem(S.keyword,  "keyword"),
  "string":            sem(S.string),
  "number":            sem(S.constant),
  "regexp":            sem(S.regex),
  "operator":          sem(S.operator),
  "comment":           sem(S.comment,   "comment"),
  "decorator":         sem(S.decorator, "decorator")
};

// ---------- Compose the theme ----------
const theme = {
  $schema: "vscode://schemas/color-theme",
  name: tokens.name,
  type: tokens.type,
  semanticHighlighting: true,
  colors,
  tokenColors,
  semanticTokenColors
};

// ---------- Emit ----------
mkdirSync(join(ROOT, 'themes'), { recursive: true });
mkdirSync(join(ROOT, 'css'), { recursive: true });

const themeJson = JSON.stringify(theme, null, 2) + '\n';

// Generated CSS variables — sourced by penumbra.css
const tintRules = Object.entries(languageTints)
  .filter(([k]) => k !== '_default')
  .map(([k, v]) => `.monaco-workbench[data-active-lang="${k}"] { --void-tint: ${v}; }`)
  .join('\n');

const cssVars = `/* AUTO-GENERATED from tokens.json — do not edit by hand. */
.monaco-workbench {
  --void-canvas:    ${P.canvas};
  --void-surface-0: ${P.surface0};
  --void-surface-1: ${P.surface1};
  --void-surface-2: ${P.surface2};
  --void-surface-3: ${P.surface3};
  --void-line:      ${P.line};
  --void-text:      ${P.text};
  --void-text-muted:${P.textMuted};
  --void-text-faint:${P.textFaint};
  --void-accent:    ${P.accent};
  --void-success:   ${P.success};
  --void-warn:      ${P.warn};
  --void-error:     ${P.error};
  --void-info:      ${P.info};

  --void-r-panel:  ${radii.panel}px;
  --void-r-widget: ${radii.widget}px;
  --void-r-input:  ${radii.input}px;
  --void-r-item:   ${radii.item}px;
  --void-r-pill:   ${radii.pill}px;

  --void-gap-outer: ${gaps.outer}px;
  --void-gap-top:   ${gaps.top}px;

  --void-tint: ${languageTints._default};
}

${tintRules}
`;

const emitFile = (path, content) => {
  if (CHECK) {
    if (!existsSync(path)) {
      throw new Error(`${path} is missing. Run npm run build.`);
    }
    const current = readFileSync(path, 'utf8');
    if (current !== content) {
      throw new Error(`${path} is out of date. Run npm run build.`);
    }
    return;
  }
  writeFileSync(path, content);
};

try {
  emitFile(THEME_PATH, themeJson);
  emitFile(CSS_VARS_PATH, cssVars);
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

console.log(`✓ themes/penumbra-color-theme.json (${Object.keys(colors).length} colors, ${tokenColors.length} token rules)`);
console.log(`✓ css/_tokens.generated.css (${Object.keys(languageTints).length - 1} language tints)`);

if (CHECK) {
  console.log('✓ generated files are current');
}

if (WATCH) {
  console.log('Watching tokens.json for changes...');
  let running = false;
  const rebuild = () => {
    if (running) return;
    running = true;
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    running = false;
    if (result.error) {
      console.error(`✗ rebuild failed: ${result.error.message}`);
    }
  };
  watch(TOKEN_PATH, { persistent: true }, rebuild);
}
