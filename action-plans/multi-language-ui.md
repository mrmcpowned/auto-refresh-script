# Implementation Plan: Multi-Language UI (Feature #37)

## Version Target: 3.3.0

## Overview
Add i18n support with a centralized `I18N` translation dictionary, a `t()` lookup function with fallback/interpolation/plurals, and a language picker sub-modal. All ~250 hardcoded user-facing strings get wrapped in `t()` calls. Ships with English (complete) and Spanish (complete).

## Implementation Steps

### Step 1: Add `language` to CONFIG_SCHEMA
**Location**: Line ~193 (after `settingsExpanded`)
- Add `language: { key: 'autoRefreshLanguage', default: 'auto', type: 'string' }`

### Step 2: Create `I18N` dictionary, `t()` function, language helpers
**Location**: After Config block (line ~211), before watch helpers (line ~213)
- `LANGUAGE_OPTIONS` array
- `I18N` object with `en` and `es` sub-objects (~200+ keys each)
- `_missingKeyWarned` Set, `_resolveLanguage()`, `t(key, params)`, `_getLanguageLabel()`

### Step 3: Replace all hardcoded strings with `t()` calls
**Location**: Throughout file — all Modal.define titles/subtitles/build functions, showToast(), speak(), makeOptionBtn() labels, addSection() headers, badge text, GM_registerMenuCommand labels

### Step 4: Create `language-picker` Modal.define
**Location**: After alert-mode-picker modal
- Picker with `makeOptionBtn()` for each language option
- On selection: Config.set, toast, closeAll to force re-render

### Step 5: Add Language row to Settings modal General section
**Location**: Inside settings modal build function, after Alert Mode row

### Step 6: Add i18n completeness tests to runTests()
**Location**: Inside runTests(), before results summary
- Assert all en keys exist in every other language and vice versa

### Step 7: Version bump to 3.3.0

## Testing Plan
1. Script loads without errors
2. Settings modal renders with Language option
3. Language picker opens with correct options
4. Switching to Spanish updates all UI text
5. Switching back to English reverts correctly
6. 'Auto' detects browser locale
7. Badge text displays in selected language
8. Toast messages show correct interpolation
9. runTests() passes with i18n completeness checks
10. No console errors

## Deviations from Spec
- Used shorter key names in code (e.g. `inspector.title` instead of `watchInspector.title`) and added alias entries in the dictionary for both conventions
- Added ~60 additional translation keys beyond the original ~200 estimate to cover context menu, element picker, badge aria labels, and all status/mode labels
- Browser QA skipped — userscript requires Tampermonkey's GM_* sandbox and cannot be injected via Playwright

## Status: COMPLETED
**Version**: 3.3.0
**Date**: 2026-04-12
