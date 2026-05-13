# Feature Spec: Event Bus

## Overview

Add a lightweight publish/subscribe event bus that allows components to communicate without direct coupling. Components emit named events and other components subscribe to react. This decouples badge updates from watch mutations, modal state from timer state, and enables future features to hook into lifecycle events.

---

## Problem Statement

Components are tightly coupled: the badge reads timer state directly, modals manually call `pauseRefresh()`/`resumeRefresh()`, watch mutations require manual cache invalidation. There is no way for a component to say "something changed" and have other components react. Adding a new reactive feature requires finding and modifying every dependent component.

---

## User Stories

- As a developer, I want to emit a `watch:changed` event and have the badge, overview, and inspector all update automatically.
- As a developer, I want to add a new component that reacts to config changes without modifying existing code.
- As a developer, I want to trace event flow for debugging.

---

## Technical Design

### API

```javascript
const EventBus = {
  on(event, handler),       // Subscribe; returns unsubscribe function
  off(event, handler),      // Unsubscribe
  emit(event, data),        // Fire event synchronously
};
```

### Core Events (initial set)

| Event | Data | Emitted By |
|-------|------|-----------|
| `config:changed` | `{ name, value, oldValue }` | `Config.set()` |
| `watch:added` | `{ watch }` | `addWatch()` |
| `watch:removed` | `{ id }` | `removeWatch()` |
| `watches:cleared` | `{}` | `clearAllWatches()` |
| `theme:changed` | `{ theme }` | `applyTheme()` |

### Implementation

Minimal Map-based implementation (~15 lines):

```javascript
const EventBus = (() => {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event).delete(fn);
    },
    off(event, fn) { listeners.get(event)?.delete(fn); },
    emit(event, data) { listeners.get(event)?.forEach(fn => fn(data)); }
  };
})();
```

---

## Scope & Non-Goals

### In Scope
- EventBus object with on/off/emit
- Emit events from watch helpers, config, and theme system
- Wire up badge to react to watch events (update dot visibility)

### Out of Scope
- Async event handling
- Event middleware or interceptors
- Persistent event log
