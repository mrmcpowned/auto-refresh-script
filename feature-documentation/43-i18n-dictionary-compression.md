# Feature Spec: I18N Dictionary Compression

## Overview

Reduce the I18N dictionary section from ~800 lines by eliminating duplicate keys and extracting shared structure. The current dictionaries have many keys that are duplicated between the original block and a "Key aliases" block at the bottom, and the Spanish dictionary is a full copy with translations. Deduplicating the aliases and using a compact dictionary format will significantly reduce code volume.

---

## Problem Statement

The I18N section (lines 223–1,027) is ~800 lines — nearly 20% of the file. Issues:
- **Duplicate keys**: The English dictionary has a "Key aliases" section at the bottom that re-declares ~50 keys already defined above (e.g., `inspector.title` appears twice with the same value)
- **Spanish duplicates similarly**: The `es` dictionary also has a duplicate alias section
- **Scrolling overhead**: Developers must scroll past 800 lines of static strings to reach code
- **Parse cost**: Every page load parses all 7 language dictionaries even though only one is used

---

## User Stories

- As a developer, I want the I18N dictionary to have no duplicate keys so that edits are single-point.
- As a developer, I want the dictionary section to be as compact as possible to reduce scrolling.
- As a developer, I want to easily find the canonical key for any UI string.

---

## UX Design

No user-facing UX changes.

---

## Technical Design

### Step 1: Remove Duplicate Alias Keys

Audit the English and Spanish dictionaries for keys that appear twice. Remove the duplicate from the "Key aliases" block, keeping the one in the main categorized section. Where the alias block has a DIFFERENT value than the main block, keep the alias version (it's likely the newer/corrected one) and remove the main block entry.

### Step 2: Consolidate Key Names

Many keys have two naming styles:
- Categorized: `inspector.noWatches`, `overview.noWatches`, `ctx.watchElement`
- Settings-prefixed: `setting.inspectWatches`, `setting.watchOverview`

Keep all of these — they serve different UI surfaces. But remove any that are truly identical duplicates.

### Step 3: Verify All Keys Are Used

Run a scan to find keys in the dictionary that are never referenced by `t('key')` calls. Remove unused keys.

### Step 4: Compact Formatting (Optional)

Consider grouping related keys more tightly:
```javascript
// Before: each key on its own line with alignment padding
'settings.title':           'Auto Refresh Settings',
'theme.title':              'Theme',

// After: same, but without excessive alignment padding
'settings.title': 'Auto Refresh Settings',
'theme.title': 'Theme',
```

This is a minor change but reduces horizontal scrolling.

---

## Edge Cases & Error Handling

- If a key is used in code but exists only in the alias section, moving it to the main section must preserve the same string value
- The `t()` function's fallback to English when a key is missing in the active language must continue to work
- The Spanish dictionary parity test in the test harness must still pass

---

## Scope & Non-Goals

### In Scope
- Removing duplicate keys from English and Spanish dictionaries
- Verifying all keys are referenced in code
- Removing any unused keys
- Verifying test harness still passes

### Out of Scope (Future)
- Lazy-loading translations (only loading active language)
- Externalizing translations to separate files
- Adding more language translations
- Compressing translations into a JSON blob format

---

## Risks & Open Questions

1. Must be careful not to remove a key that's used via string concatenation (e.g., `t('alertMode.' + mode)`) — need to check for dynamic key construction patterns.
2. The parity test (`missingInEs`) will fail if keys are removed from English but not Spanish — must update both dictionaries simultaneously.
