# Feature Spec: Multi-Language UI

## Overview

Add internationalization (i18n) support so all user-facing text in the Auto Refresh userscript — modal titles, button labels, setting descriptions, toast messages, TTS speech, error messages, and menu commands — can display in the user's preferred language. The system ships with English as the built-in default and a translation dictionary architecture that makes adding new languages straightforward.

---

## Problem Statement

Every user-facing string in Auto Refresh is hardcoded in English across ~250–300 call sites: `h()` calls, `showToast()` calls, `Modal.define()` titles/subtitles, `makeOptionBtn()` labels, `speak()` text, interpolated template literals, and Tampermonkey menu commands. Non-English-speaking users have no way to use the tool in their language. Adding even a single translation today would require touching hundreds of lines scattered throughout the codebase.

---

## User Stories

- As a non-English speaker, I want the Auto Refresh UI to display in my language so I can understand all settings and notifications.
- As a multilingual user, I want to switch the UI language at any time without losing my configuration.
- As a contributor, I want a clear, centralized place to add or update translations without modifying logic code.
- As a user, I want the language to default to my browser's locale automatically so I don't need to configure it manually.
- As a user using TTS alerts, I want spoken text in my selected language so announcements are understandable.

---

## UX Design

### Language Picker (Settings Sub-Modal)

A new option in the **General** section of Settings, rendered as a quicklink row that opens a picker sub-modal:

```
┌──────────────────────────────────────────┐
│  Auto Refresh Settings                   │
│                                          │
│  ─── General ──────────────────────────  │
│  ⌨ Keyboard Shortcut          Alt+Shift+R│
│  🔔 Alert Mode                     Beep  │
│  🌐 Language                     English ▸│
│  🔗 Webhook Notifications                │
│                                          │
└──────────────────────────────────────────┘
```

Clicking **🌐 Language** opens a `type:'picker'` sub-modal:

```
┌──────────────────────────────────────────┐
│  Language                                │
│  Display language for all UI elements    │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ ● English                         │  │
│  │   Default                         │  │
│  ├────────────────────────────────────┤  │
│  │ ○ Español                         │  │
│  │   Spanish                         │  │
│  ├────────────────────────────────────┤  │
│  │ ○ Français                        │  │
│  │   French                          │  │
│  ├────────────────────────────────────┤  │
│  │ ○ Deutsch                         │  │
│  │   German                          │  │
│  ├────────────────────────────────────┤  │
│  │ ○ Português                       │  │
│  │   Portuguese                      │  │
│  ├────────────────────────────────────┤  │
│  │ ○ 日本語                           │  │
│  │   Japanese                        │  │
│  ├────────────────────────────────────┤  │
│  │ ○ 한국어                           │  │
│  │   Korean                          │  │
│  ├────────────────────────────────────┤  │
│  │ ○ 中文                             │  │
│  │   Chinese (Simplified)            │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

### Behavior on Language Change

1. Language selection applies immediately (no save button needed — matches existing picker pattern).
2. A toast confirms the change: `"Language set to Español"` (shown in the *new* language).
3. If a modal is open, it re-renders in the new language by popping and re-pushing the current modal.
4. The badge text (countdown, "Paused", etc.) switches language on the next tick.
5. Tampermonkey menu command labels update on the next page load (GM API limitation).

### Settings Integration

| Setting | Config Key | Storage Key | Default | Type |
|---|---|---|---|---|
| Language | `language` | `autoRefreshLanguage` | `'auto'` | `string` |

- `'auto'` = detect from `navigator.language` and fall back to `'en'` if no translation exists.
- When set explicitly, stores the language code (e.g., `'es'`, `'fr'`, `'de'`).

---

## Technical Design

### Data Model

#### Translation Dictionary Structure

A centralized `I18N` object maps string keys to per-language values:

```javascript
const I18N = {
  en: {
    // Modal titles
    'settings.title':           'Auto Refresh Settings',
    'theme.title':              'Theme',
    'theme.subtitle':           'Choose a visual style',
    'alertMode.title':          'Alert Mode',
    'alertMode.subtitle':       'How you are notified when a watch detects a change',
    'language.title':           'Language',
    'language.subtitle':        'Display language for all UI elements',

    // Buttons & actions
    'btn.save':                 '💾 Save',
    'btn.sendTest':             '🧪 Send Test',
    'btn.deleteWebhook':        '🗑 Delete Webhook',
    'btn.resume':               '▶ Resume',
    'btn.stop':                 '⏹ Stop Refresh',
    'btn.addWatch':             '👁 Add Watch',
    'btn.inspectWatches':       '🔍 Inspect Watches',
    'btn.removeWatches':        '🗑 Remove Watches',

    // Sections
    'section.watches':          'Watches',
    'section.badge':            'Badge & Appearance',
    'section.general':          'General',
    'section.speech':           'Speech Settings',

    // Setting labels
    'setting.interval':         '⏱ Refresh Interval',
    'setting.hotkey':           '⌨ Keyboard Shortcut',
    'setting.alertMode':        '🔔 Alert Mode',
    'setting.language':         '🌐 Language',
    'setting.webhook':          '🔗 Webhook Notifications',
    'setting.theme':            '🎨 Theme',
    'setting.badgePosition':    '📍 Badge Position',
    'setting.fontSize':         '🔤 Badge Font Size',
    'setting.opacity':          '🔲 Badge Opacity',

    // Toast messages
    'toast.refreshStarted':     'Auto-refresh started: every {interval}',
    'toast.refreshStopped':     'Auto-refresh stopped',
    'toast.watchAdded':         'Watching {type}: {selector} ({count} total)',
    'toast.watchRemoved':       'Watch removed ({count} remaining)',
    'toast.allWatchesRemoved':  'All watches removed',
    'toast.languageSet':        'Language set to {language}',
    'toast.themeSet':           'Theme set to {theme}',
    'toast.webhookTestOk':      '✅ Test webhook sent successfully',
    'toast.webhookTestFail':    '❌ Webhook failed ({reason})',

    // Badge text
    'badge.paused':             'Paused',
    'badge.inactive':           'Inactive',

    // Status
    'status.active':            'Active · refreshing every {interval}',
    'status.inactive':          'Inactive',
    'status.paused':            '⏸ Paused · {time} remaining',

    // Errors
    'error.modifierRequired':   'At least one modifier key required',
    'error.reservedKey':        '{combo} is reserved by the browser',
    'error.invalidUrl':         'Invalid URL',
    'error.enterUrlFirst':      'Enter a webhook URL first',
    'error.elementNotFound':    'Element not found on page',
    'error.noWatches':          'No watches configured yet',
    'error.ttsUnavailable':     'Speech synthesis is not available in this browser.',

    // TTS templates
    'tts.watchChanged':         'Watch changed on {page}. Content updated.',
    'tts.multiChanged':         '{count} watches changed on {page}.',
    'tts.missingWarning':       'Warning: {count} watched element not found.|Warning: {count} watched elements not found.',

    // Picker option labels (alert modes)
    'alertMode.beep':           'Beep Only',
    'alertMode.beep.desc':      'Repeating tone (default)',
    'alertMode.speech':         'Speech Only',
    'alertMode.speech.desc':    'Announce changes aloud',
    'alertMode.both':           'Beep + Speech',
    'alertMode.both.desc':      'Tone followed by announcement',

    // Navigation
    'nav.escBack':              'Press Esc to go back',
    'nav.escDismiss':           'Press Esc to dismiss',
    'nav.escCancel':            'Press Esc to cancel',

    // Menu commands
    'menu.openSettings':        'Open settings',
    'menu.startRefresh':        'Start auto-refresh',
    'menu.stopRefresh':         'Stop auto-refresh',
    'menu.watchElement':        'Watch element for changes',
    'menu.clearWatch':          'Clear watch',
    'menu.runTests':            'Run tests',
  },

  es: {
    'settings.title':           'Configuración de Auto Refresh',
    'theme.title':              'Tema',
    'theme.subtitle':           'Elige un estilo visual',
    'btn.save':                 '💾 Guardar',
    'toast.refreshStarted':     'Auto-refresh iniciado: cada {interval}',
    'toast.refreshStopped':     'Auto-refresh detenido',
    'badge.paused':             'Pausado',
    // ... remaining keys
  },
  // Additional languages follow the same pattern
};
```

#### Translation Lookup Function

```javascript
const _missingKeyWarned = new Set();

function t(key, params = {}) {
  const lang = Config.get('language') === 'auto'
    ? (navigator.language || 'en').split('-')[0]
    : Config.get('language');

  let str = I18N[lang] && I18N[lang][key];

  // Fallback to English; warn on first miss per key
  if (str == null) {
    if (lang !== 'en' && !_missingKeyWarned.has(`${lang}:${key}`)) {
      _missingKeyWarned.add(`${lang}:${key}`);
      console.warn(`[Auto Refresh i18n] Missing ${lang} translation for "${key}"`);
    }
    str = I18N.en[key] || key;
  }

  // Handle plurals: "singular|plural" with {count}
  if (str.includes('|') && 'count' in params) {
    const [singular, plural] = str.split('|');
    str = params.count === 1 ? singular : plural;
  }

  // Interpolate {param} placeholders
  for (const [k, v] of Object.entries(params)) {
    str = str.replaceAll(`{${k}}`, v);
  }

  return str;
}
```

### Core Logic

#### Migration Strategy

The migration is mechanical and can be done incrementally:

1. **Create the `I18N` dictionary** with all English strings keyed by dot-notation IDs.
2. **Create the `t()` function** for lookup + interpolation.
3. **Replace hardcoded strings** with `t()` calls site-by-site:
   ```javascript
   // Before
   h('div', { class: 'ar-title', text: 'Theme' })
   // After
   h('div', { class: 'ar-title', text: t('theme.title') })

   // Before
   showToast('Auto-refresh stopped');
   // After
   showToast(t('toast.refreshStopped'));

   // Before (interpolation)
   showToast(`Watching ${type}: ${selector} (${count} total)`);
   // After
   showToast(t('toast.watchAdded', { type, selector, count }));
   ```
4. **Ship English-only first** — the architecture is in place; additional languages can be added by populating the `I18N` sub-objects.

#### Key naming convention

Use dot-separated namespaces:
- `{modal}.title` / `{modal}.subtitle` — Modal chrome
- `btn.{action}` — Button labels
- `section.{name}` — Section headers
- `setting.{name}` — Setting row labels
- `toast.{event}` — Toast notifications
- `error.{type}` — Error messages
- `tts.{event}` — TTS speech templates
- `alertMode.{key}` / `alertMode.{key}.desc` — Picker option labels
- `nav.{action}` — Navigation hints
- `menu.{action}` — Tampermonkey menu commands
- `badge.{state}` — Badge state text
- `status.{state}` — Status bar text

### Translation Completeness Guarantees

Two mechanisms ensure every supported language has complete coverage:

#### 1. Test Harness Assertion

Add a translation completeness check to the existing `runTests()` function. This runs as part of the inline test harness and fails loudly on any missing or extraneous keys:

```javascript
// Inside runTests()
const enKeys = Object.keys(I18N.en);
for (const [lang, translations] of Object.entries(I18N)) {
  if (lang === 'en') continue;
  const missing = enKeys.filter(k => !(k in translations));
  assert(missing.length === 0,
    `I18N: ${lang} missing ${missing.length} keys: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
  const extra = Object.keys(translations).filter(k => !(k in I18N.en));
  assert(extra.length === 0,
    `I18N: ${lang} has ${extra.length} stale/typo keys: ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? '...' : ''}`);
}
```

This catches:
- **Missing keys** — translation was never added for a new string
- **Stale/typo keys** — a key exists in a translation but not in English (renamed or misspelled)

#### 2. Runtime Console Warnings

The `t()` function logs a `console.warn` on the first miss per key per language (see implementation above). This surfaces gaps organically during manual testing without requiring the harness to run. Warnings are deduplicated via a `Set` so they don't spam the console.

### Integration Points

| System | Integration |
|---|---|
| **Config / CONFIG_SCHEMA** | Add `language: { key: 'autoRefreshLanguage', default: 'auto', type: 'string' }` |
| **EventBus** | Emit `'config:changed'` with `name: 'language'` on change (already handled by `Config.set()`) |
| **Modal.define()** | Titles/subtitles become `t()` calls. Modals re-render on language change by listening to `config:changed`. |
| **h() builder** | No changes needed — `text` property just receives `t()` return values |
| **showToast()** | No changes needed — receives translated strings |
| **speak()** | Receives `t()` return values for TTS announcements |
| **makeOptionBtn()** | Label and subtitle params become `t()` calls |
| **GM_registerMenuCommand** | Labels become `t()` calls; only update on page reload (Tampermonkey limitation) |
| **Badge rendering** | Badge text (countdown numbers are language-agnostic; state words like "Paused" use `t()`) |

---

## Edge Cases & Error Handling

- **Missing translation key**: Fall back to English (`I18N.en[key]`). If English is also missing, return the raw key string as a visible debugging aid.
- **Browser locale not supported**: `'auto'` mode falls back to `'en'` when `navigator.language` doesn't match any available translation.
- **Partial translations**: A language doesn't need 100% coverage. Any missing key falls back to English, so contributors can translate incrementally.
- **Pluralization**: Simple singular/plural split via `|` delimiter in the string value. Only `{count}` triggers plural logic. Languages with complex plural rules (e.g., Arabic) are out of scope for v1.
- **RTL languages**: Out of scope for initial implementation (see Non-Goals).
- **Emoji prefixes**: Emoji in button labels (🔔, ⌨, etc.) are language-agnostic and included in every translation string. Translators keep or replace them as appropriate.
- **Interpolated values**: Dynamic values like selectors, counts, and intervals are passed as params and inserted after translation. They are never translated themselves.
- **TTS language mismatch**: If the user picks Spanish UI but their TTS voice is English, speech will sound odd. The spec does NOT auto-switch TTS voice — the user controls voice selection independently.
- **Modal re-render on language switch**: The current modal pops and re-pushes to reflect the new language. Unsaved form state (e.g., a webhook URL being typed) is lost. A toast warns: `"Language changed — unsaved edits were discarded."`

---

## Scope & Non-Goals

### In Scope
- `t()` translation function with key lookup, fallback, interpolation, and simple plurals
- `I18N` dictionary object with English as the complete built-in language
- Language picker sub-modal in Settings → General
- `'auto'` mode that detects browser locale
- Config storage of language preference
- At least **2 fully translated languages** shipped (English + Spanish) to validate the architecture
- Toast, TTS, badge, modal, button, error, and menu command string coverage

### Out of Scope (Future)
- **RTL layout support** (Arabic, Hebrew) — requires CSS `direction: rtl` and layout mirroring
- **Complex plural rules** (e.g., Arabic has 6 plural forms) — would need a plural-rules engine like ICU
- **User-contributed translation files** — loading external JSON translation packs at runtime
- **Per-language date/time formatting** — timestamps remain in browser-default locale
- **Crowdsourced translation portal** — a web UI for community translations
- **Language-specific TTS voice auto-selection** — linking UI language to TTS voice

---

## Risks & Open Questions

1. **String volume**: ~250–300 strings to key and wrap in `t()`. This is a large mechanical change. Should it be done all at once or incrementally (e.g., modals first, then toasts, then TTS)?
2. **Bundle size**: Each additional language adds ~5–10 KB of strings. At 8 languages, that's ~40–80 KB. Is this acceptable for a userscript? Should languages beyond English be lazy-loaded from `@resource` directives?
3. **Emoji handling**: Some languages may want different or no emoji prefixes. Should emoji be separated from the translatable text (e.g., `'⌨ ' + t('setting.hotkey')`) or kept as part of the translation string?
4. **Tampermonkey menu commands**: `GM_registerMenuCommand` labels are set once at script load. Changing language requires a page reload to update menu labels. Is a toast notification sufficient to communicate this?
5. **Translation quality**: Machine-translated strings may be awkward. Should the spec mandate human-reviewed translations, or is machine translation acceptable for an initial release?
6. **Key stability**: Once translation keys are published and translators start using them, renaming keys would break translations. Should there be a key deprecation/alias system from the start?

---

## Implementation Details

**Version**: 3.3.0
**Date**: 2026-04-12
**Action Plan**: [action-plans/multi-language-ui.md](../action-plans/multi-language-ui.md)

### What Was Built
- Centralized `I18N` dictionary with `en` and `es` sub-objects (~275 unique keys each)
- `t(key, params)` function with English fallback, `{param}` interpolation, and `singular|plural` support
- `_resolveLanguage()` for auto-detection from `navigator.language`
- `LANGUAGE_OPTIONS` array and `_getLanguageLabel()` helper
- `language-picker` modal (Modal.define) with current-language highlighting
- Language row in Settings → General section
- All ~275 hardcoded English strings wrapped in `t()` calls across all modals, toasts, speak() calls, badge text, element picker, context menu, checkForChanges, and GM_registerMenuCommand labels
- 8 new i18n tests in `runTests()`: key lookup, fallback, interpolation, plural resolution, es parity, config schema

### Deviations from Spec
- Shipped with 2 languages (English + Spanish) instead of the 8 shown in the UX mockup — validates the architecture; more can be added by populating `I18N` sub-objects
- Used shorter key names in code (e.g. `inspector.title`, `menu.fontSize`) alongside the spec's longer names (e.g. `watchInspector.title`, `menu.setFontSize`) — both are in the dictionary as aliases
- Emoji prefixes kept as part of translation strings (not separated) — matches existing codebase pattern
- Modal does not re-render on language change via pop/re-push; instead `closeAll()` is called, requiring user to reopen settings
- Browser QA skipped — userscript requires Tampermonkey's GM_* sandbox

### Code Location
| Component | Location |
|-----------|----------|
| `CONFIG_SCHEMA.language` | Line ~193 |
| `LANGUAGE_OPTIONS` | Line ~215 |
| `I18N` dictionary (en + es) | Lines ~223–940 |
| `t()` function | Line ~980 |
| `_resolveLanguage()` | Line ~970 |
| `_getLanguageLabel()` | Line ~1006 |
| `language-picker` modal | Line ~2870 |
| Language row in settings | Line ~3060 |
| i18n tests in `runTests()` | Line ~4170 |
