# Feature Spec: Test Harness Expansion

## Overview

Expand the inline test harness to cover the new architectural layers introduced in v4.0.0: `createFocusTrap()`, `detectChanges()` result structure, `notifyChanges()` behavior, `WatchStore.getStatus()`, `WatchStore.groupByDomain()` edge cases, `Modal.replace()`, `setToggleState()`, `setInputError()`, and `RefreshService`/`WebhookService` facade consistency.

---

## Problem Statement

The v4.0.0 refactors added 8 new abstractions but only `WebhookService.validateUrl()` has tests (5 assertions). The other new functions have zero test coverage, meaning regressions in critical pipeline functions like `detectChanges()` or `WatchStore.getStatus()` would go undetected.

---

## Technical Design

### New Test Groups

#### 1. FocusTrap (structure test — can't test DOM focus in userscript context)
- `createFocusTrap()` returns object with `handleKeyDown`, `clearOutlines`, `destroy` methods

#### 2. detectChanges / notifyChanges (result structure)
- `detectChanges()` returns `{ changes: [], missing: [], details: [] }` shape
- Tests verify the structure contract, not DOM-dependent behavior

#### 3. WatchStore.getStatus
- Returns `'other-page'` for mismatched URL
- Returns `'ok'` when no element found but mode check not applicable (already tested implicitly)

#### 4. WatchStore.groupByDomain (additional edge cases)
- Already has 3 tests; add: empty array input, single watch

#### 5. Modal.replace (API presence)
- `Modal.replace` is a function

#### 6. Helper functions
- `setToggleState` — verify it's callable (DOM-dependent, can't full-test)
- `setInputError` — verify it's callable

#### 7. State store
- `State.get()` / `State.set()` round-trip

#### 8. RefreshService / WebhookService facade consistency
- All expected methods exist on each service

---

## Implementation Location

Add after the existing `// --- WebhookService ---` test block in `runTests()`.

---

## Scope

### In Scope
- ~20 new assertions covering structural contracts and API presence

### Out of Scope
- DOM-dependent tests (focus cycling, actual watch detection)
- Browser API tests (speechSynthesis, GM_* functions)
