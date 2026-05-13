# Feature Spec: Centralized State Store

## Overview

Consolidate all mutable runtime state (timer IDs, countdown values, pause status, caches, UI flags) into a single `State` object with getter/setter methods and EventBus integration. This eliminates scattered global `let` variables and makes data flow traceable.

---

## Problem Statement

Runtime state is scattered across 8+ global `let` variables: `countdownTimerId`, `remaining`, `paused`, `_watchCache`, `_activeCtxMenu`, `_lastWebhookTime`, `alertIntervalId`, `audioCtx`, `_badgeHoverEndHandler`. These are mutated from many locations with no centralized tracking, making it difficult to reason about state transitions or debug stale-state bugs.

---

## User Stories

- As a developer, I want all runtime state in one place so I can inspect it during debugging.
- As a developer, I want state changes to emit events so UI components can reactively update.
- As a developer, I want a predictable state initialization path so page load is deterministic.

---

## UX Design

No user-facing UX changes. This is a pure refactor.

---

## Technical Design

### State Object

```javascript
const State = (() => {
    const _state = {
        countdownTimerId: null,
        remaining: 0,
        paused: false,
        alertIntervalId: null,
        audioCtx: null,
        watchCache: null,
        activeCtxMenu: null,
        lastWebhookTime: 0,
        badgeHoverEndHandler: null,
    };

    return {
        get(key) {
            if (!(key in _state)) throw new Error(`Unknown state: ${key}`);
            return _state[key];
        },
        set(key, value) {
            if (!(key in _state)) throw new Error(`Unknown state: ${key}`);
            const old = _state[key];
            _state[key] = value;
            if (old !== value) EventBus.emit('state:changed', { key, value, old });
        },
    };
})();
```

### Migration

Replace all global `let` declarations and their usages:

| Old Global | State Key | Example Usage |
|---|---|---|
| `countdownTimerId` | `State.get('countdownTimerId')` | `State.set('countdownTimerId', setInterval(...))` |
| `remaining` | `State.get('remaining')` | `State.set('remaining', State.get('remaining') - 1)` |
| `paused` | `State.get('paused')` | `State.set('paused', true)` |
| `alertIntervalId` | `State.get('alertIntervalId')` | In `startAlert()`/`stopAlert()` |
| `audioCtx` | `State.get('audioCtx')` | In `playBeep()` |
| `_watchCache` | `State.get('watchCache')` | In `getWatches()`/`setWatches()` |
| `_activeCtxMenu` | `State.get('activeCtxMenu')` | In `showQuickWatchMenu()`/`dismissQuickWatch()` |
| `_lastWebhookTime` | `State.get('lastWebhookTime')` | In `sendWebhook()` |
| `_badgeHoverEndHandler` | `State.get('badgeHoverEndHandler')` | In badge hover logic |

### Placement

The `State` object should be defined right after the `EventBus` definition (line ~81), since it depends on EventBus but is needed by everything else.

---

## Edge Cases & Error Handling

- `State.get()` on unknown keys throws an error (catches typos at development time)
- Setting the same value is a no-op for event emission (prevents unnecessary updates)
- `audioCtx` is lazily initialized — `State.get('audioCtx')` returning `null` is valid

---

## Scope & Non-Goals

### In Scope
- Creating the `State` object with get/set API
- Migrating all 9 global `let` variables to `State`
- Updating all read/write sites to use `State.get()`/`State.set()`

### Out of Scope (Future)
- Reactive subscriptions per state key (e.g., `State.on('remaining', fn)`)
- State persistence across page reloads (session state is intentionally transient)
- Merging Config and State into a unified store

---

## Risks & Open Questions

1. Performance: `State.get('remaining')` is called every second in the countdown. Property access through a function call is negligible but worth noting.
2. The `_state` object should not be exposed directly to prevent bypassing the setter.
