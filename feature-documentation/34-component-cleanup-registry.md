# Feature Spec: Component Cleanup Registry

## Overview

Introduce a standardized cleanup pattern for components that register document-level event listeners, timers, or observers. Every component that adds listeners gets a cleanup function that is automatically called when the component is torn down, preventing memory leaks.

---

## Problem Statement

The element picker, context menu, hotkey capture modal, and watch overview all register document-level listeners with manual cleanup. Race conditions can leak listeners (e.g., rapid right-clicks, page navigation during picker). The modal framework has `ctx.cleanups` but it's opt-in and not used consistently. There is no systemic guarantee that listeners are cleaned up.

---

## User Stories

- As a developer, I want to register a document listener and know it will be cleaned up when my component is torn down.
- As a developer, I want the element picker to never leak listeners even if the user navigates away mid-pick.

---

## Technical Design

### Cleanup Function Pattern

All components that register external listeners return a cleanup function or push to `ctx.cleanups`:

```javascript
// In modal build functions:
ctx.cleanups.push(
  addDocListener('keydown', handler, true),
  addDocListener('mousemove', handler, true)
);
```

### Helper: `addDocListener`

```javascript
function addDocListener(event, handler, capture = false) {
  document.addEventListener(event, handler, capture);
  return () => document.removeEventListener(event, handler, capture);
}
```

### Element Picker Integration  

Refactor `startElementPicker()` to use the helper and track all listeners in a single cleanup array.

### Context Menu Integration

Refactor context menu dismiss listeners to use the helper pattern instead of manual add/remove.

---

## Scope & Non-Goals

### In Scope
- `addDocListener()` helper that returns a cleanup function
- Refactor element picker to use cleanup pattern
- Refactor context menu to use cleanup pattern
- Refactor hotkey capture modal listeners
- Refactor watch overview MutationObserver cleanup

### Out of Scope
- Automatic cleanup on page unload (userscript context handles this)
- Global listener registry with debugging UI
