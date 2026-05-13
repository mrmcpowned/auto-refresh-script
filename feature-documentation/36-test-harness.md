# Feature Spec: Test Harness

## Overview

Add an inline test runner to the userscript that validates pure logic functions (formatting, diffing, config schema, event bus, template rendering, webhook payloads). Tests run via a `GM_registerMenuCommand` entry and report results to the browser console and a toast summary. No external dependencies required.

---

## Problem Statement

There are zero automated tests — all QA is manual browser testing. Pure functions like `formatSeconds()`, `diffStyles()`, `formatWebhookPayload()`, and the EventBus have no regression protection. Refactors are risky because breakage is only caught by manual observation.

---

## User Stories

- As a developer, I want to run `Run Tests` from the Tampermonkey menu and see PASS/FAIL for all pure logic.
- As a developer, I want test failures to tell me which function broke and what the expected vs actual values were.
- As a developer, I want to add a new test in <5 lines when I add a new pure function.

---

## Technical Design

### Test Runner

A minimal `assert`/`describe`/`it` runner embedded in the IIFE:

```javascript
function runTests() {
    let passed = 0, failed = 0;
    const failures = [];

    function assert(condition, label) {
        if (condition) { passed++; }
        else { failed++; failures.push(label); }
    }

    function assertEq(actual, expected, label) {
        const a = JSON.stringify(actual);
        const e = JSON.stringify(expected);
        if (a === e) { passed++; }
        else { failed++; failures.push(`${label}: expected ${e}, got ${a}`); }
    }

    // ... test cases ...

    console.log(`[AutoRefresh Tests] ${passed} passed, ${failed} failed`);
    failures.forEach(f => console.error(`  FAIL: ${f}`));
    showToast(failed === 0 ? `✅ All ${passed} tests passed` : `❌ ${failed} failed, ${passed} passed`);
}
```

### Functions to Test (Priority 1 — pure, zero dependencies)

| Function | Test Cases |
|----------|-----------|
| `formatSeconds()` | 5, 30, 60, 90, 120, 300, 3600, 7200 |
| `formatCountdown()` | 0, 30, 59, 60, 150, 3661 |
| `_truncate()` | short string, exact length, over length, empty |
| `getModeColor()` | content, style, both, unknown |
| `_camelToVar()` | simple, camelCase, multi-hump |
| `v()` | basic token |
| `buildThemeVars()` | small theme object |
| `_replaceTemplateTags()` | single tag, multiple tags, missing tag, no tags |
| `diffStyles()` | no changes, one change, multiple changes, invalid JSON |
| `formatWebhookPayload()` | slack, discord, teams, generic with template |
| `EventBus` | on/emit, off, unsubscribe return value, multiple listeners, no cross-talk |
| `groupWatchesByDomain()` | single domain, multi domain, malformed URLs |

### Integration Point

- `GM_registerMenuCommand('Run tests', runTests)` — available from Tampermonkey menu
- Results go to console + toast
- No UI modal needed — console is the right place for test output

---

## Scope & Non-Goals

### In Scope
- Inline test runner with assert/assertEq
- Tests for all pure functions listed above
- EventBus integration tests
- Menu command to trigger

### Out of Scope
- DOM-dependent function tests (getUniqueSelector, captureStyles)
- Browser API mocks (speechSynthesis, AudioContext)
- CI/CD integration
- Coverage reporting
