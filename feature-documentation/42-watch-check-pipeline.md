# Feature Spec: Watch Check Pipeline

## Overview

Refactor `checkForChanges()` from a monolithic function into a discrete pipeline: **detect → diff → notify**. Each stage is a separate function connected via data passing, making the pipeline testable, extensible, and easier to reason about.

---

## Problem Statement

`checkForChanges()` (~80 lines) currently handles:
1. Reading watch list from storage
2. Iterating watches and filtering by current page
3. Awaiting element presence (`waitForElement`)
4. Waiting for stable content (`_waitForStableContent`)
5. Comparing content and styles
6. Collecting changes and missing elements
7. Stopping refresh on detection
8. Speaking TTS alerts
9. Playing beep alerts
10. Showing toasts
11. Sending webhooks

Adding a new notification channel (e.g., desktop notification) requires editing deep inside this function. Testing detection logic requires triggering the full alert/webhook chain.

---

## User Stories

- As a developer, I want to test change detection without triggering alerts.
- As a developer, I want to add new notification channels without editing detection logic.
- As a developer, I want each pipeline stage to have a clear input/output contract.

---

## UX Design

No user-facing UX changes.

---

## Technical Design

### Pipeline Stages

#### Stage 1: `detectChanges(watches)` → `DetectionResult`

```javascript
async function detectChanges(watches) {
    const results = { changes: [], missing: [], details: [] };
    
    for (const w of watches) {
        if (w.url !== _pageUrl()) continue;
        const el = await waitForElement(w.selector);
        if (!el) { results.missing.push(_truncate(w.selector)); continue; }
        
        const stable = await _waitForStableContent(el, w.mode);
        const changes = [];
        let newContent = '';
        
        if (w.mode === 'content' || w.mode === 'both') {
            newContent = stable.content;
            if (newContent !== w.content) changes.push('content');
        }
        if (w.mode === 'style' || w.mode === 'both') {
            if (w.styles && diffStyles(w.styles, stable.styles).length > 0) changes.push('styling');
        }
        
        if (changes.length > 0) {
            results.changes.push(`${_truncate(w.selector, 25)} (${changes.join(' & ')})`);
            results.details.push({
                url: location.href,
                selector: w.selector,
                mode: w.mode,
                old_content: w.content || '',
                new_content: newContent || el.innerText.trim(),
                timestamp: new Date().toISOString()
            });
        }
    }
    
    return results;
}
```

#### Stage 2: `notifyChanges(results)` → void

```javascript
function notifyChanges(results) {
    if (results.missing.length > 0) {
        stopRefresh();
        speak(t('speak.missingWarning', { count: results.missing.length, page: _pageLabel() }));
        startAlert();
        showToast(t('toast.missingElements', { count: results.missing.length }));
        return;
    }
    
    if (results.changes.length > 0) {
        stopRefresh();
        const summary = results.changes.length === 1
            ? t('speak.watchChanged', { page: _pageLabel() })
            : t('speak.watchesChanged', { count: results.changes.length, page: _pageLabel() });
        speak(summary);
        startAlert();
        showToast(t('toast.watchesChanged', { count: results.changes.length }));
        
        if (results.details.length > 0) {
            sendWebhook({ ...results.details[0], summary });
        }
    }
}
```

#### Stage 3: Coordinating Function

```javascript
async function checkForChanges() {
    if (!GM_getValue(STORAGE_KEY_WATCH_ENABLED, false)) return;
    const watches = getWatches();
    if (watches.length === 0) return;
    
    const results = await detectChanges(watches);
    notifyChanges(results);
}
```

### Test Harness Additions

```javascript
// Test detectChanges returns correct structure
const mockResults = { changes: [], missing: [], details: [] };
assert(Array.isArray(mockResults.changes), 'detectChanges result has changes array');
assert(Array.isArray(mockResults.missing), 'detectChanges result has missing array');
assert(Array.isArray(mockResults.details), 'detectChanges result has details array');
```

---

## Edge Cases & Error Handling

- If `waitForElement` times out, the watch is classified as `missing` (unchanged behavior)
- If `_waitForStableContent` has an error, it falls through to the current iteration
- Missing elements take priority over changes (fires missing alert, skips change notifications)

---

## Scope & Non-Goals

### In Scope
- Splitting `checkForChanges()` into `detectChanges()` + `notifyChanges()`
- Keeping the same overall behavior
- Adding basic structure tests to the test harness

### Out of Scope (Future)
- Making the pipeline EventBus-driven (detect stage emits events, notify stage listens)
- Adding desktop notification as a new notification channel
- Retry logic for transient detection failures

---

## Risks & Open Questions

1. The `async` nature of `detectChanges()` means the pipeline is still sequential — this is intentional for correctness (parallel watch checking could cause race conditions).
2. `notifyChanges()` calls `stopRefresh()` which has side effects — this coupling is acceptable in the current architecture.
