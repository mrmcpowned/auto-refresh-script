# Modal Mini-Framework Refactor Plan

## Problem Statement

The current modal system has 9 modals with navigation logic scattered across ~1400 lines. Each modal manually manages:
- `openModal()` + `addSubModalChrome()` boilerplate
- `close(true)` vs `close()` for chaining vs returning
- `pauseRefresh()` / `resumeRefresh()` timer coordination
- `returnTo` callback threading
- Special-case hacks (e.g., `cameFromSettings` DOM sniffing in badge menu)

This leads to bugs like leaked intervals, dangling event handlers, and inconsistent navigation behavior.

## Design Goals

1. **Navigation stack** — push/pop modals like a router; Back/Escape pops automatically
2. **Declarative modal definitions** — each modal declares its properties, content builder handles only UI
3. **Automatic chrome** — back button, subtitle, footer auto-added based on stack position
4. **Timer coordination** — pause on first modal open, resume when stack empties
5. **Centralized cleanup** — event listeners, DOM refs all managed by framework
6. **Extensible** — new modals only need to define content; framework handles lifecycle

## Proposed API

```javascript
const Modal = createModalFramework();

// Register modal definitions
Modal.define('settings', {
    title: 'Auto Refresh Settings',
    minWidth: '320px',
    isRoot: true,           // no back button, pauses timer
    build: (panel, ctx) => { ... },
});

Modal.define('interval-picker', {
    title: 'Refresh Interval',
    subtitle: 'How often the page reloads',
    build: (panel, ctx) => { ... },
});

// Navigation
Modal.open('settings');              // push settings onto stack
Modal.push('interval-picker');       // push sub-modal (auto back button)
Modal.pop();                         // go back to settings
Modal.closeAll();                    // close everything, resume timer

// From within build():
ctx.push('interval-picker');         // navigate to sub-modal
ctx.close();                         // close current (pop or closeAll if root)
ctx.makeOptionBtn(label, opts);      // create styled button
ctx.addCollapsible(container, label, open);  // reusable collapsible
ctx.cleanups.push(fn);               // register cleanup
```

## Implementation Phases

### Phase 1: Core Framework (non-breaking scaffold)
- Create `createModalFramework()` factory
- Internal navigation stack
- `modalOpen` managed internally
- Timer pause/resume on stack empty/non-empty
- `define()`, `open()`, `push()`, `pop()`, `closeAll()`

### Phase 2: Migrate Simple Modals
- Font size picker
- Position picker
- Interval picker
- These are the simplest: single list of options, no complex state

### Phase 3: Migrate Complex Modals
- Hotkey picker (capture-phase events, cleanup hooks)
- Clear watch picker (confirm-on-click pattern)
- Watch mode selector (element picker integration)

### Phase 4: Migrate Root Modals
- Settings menu (root modal, hub for all navigation)
- Badge menu (conditional root vs sub-modal behavior)

### Phase 5: Migrate Watch Inspector
- Most complex: two-pane layout, live data, internal state
- Sidebar selection, collapsible sections, inline editing

### Phase 6: Cleanup & Polish
- Remove old `openModal`, `addSubModalChrome`, `modalOpen` flag
- Update global hotkey handler to use `Modal.isOpen()`
- Update badge click handler
- Verify all navigation paths
- Full browser QA

## Risk Mitigation

- Each phase is independently deployable — old and new code coexist until Phase 6
- Browser QA after every phase — catch regressions immediately
- Version bump per phase — easy rollback to any snapshot
- Phase 1 adds code, doesn't change code — zero risk of breaking existing behavior

## Estimated Scope

- ~80 lines added (framework core)
- ~500 lines refactored (modal definitions become slimmer)
- ~300 lines deleted (boilerplate, manual navigation, old helpers)
- Net: ~200 fewer lines with cleaner separation of concerns
