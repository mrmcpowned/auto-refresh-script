# Tech Debt Refactor Plan — v1.5.0

## Scope
Address all 10 identified tech debt items in a single coordinated refactor.
Strategy: full file rewrite preserving all behavior, using new infrastructure.

## Debt Items → Solutions

| # | Debt Item | Solution |
|---|-----------|----------|
| 1 | Inline CSS everywhere (~40% of file) | Inject `<style id="ar-css">` with reusable CSS classes (ar- prefix) |
| 2 | Imperative DOM construction | Add `el(tag, props, ...children)` builder utility |
| 3 | Repeated hover/interaction wiring | CSS `:hover` rules in stylesheet; eliminate JS event listeners |
| 4 | `getWatches()` deserialized every call | Add `_watchCache` with dirty-flag invalidation |
| 5 | Per-URL keys use `location.href` | Switch to `location.origin + location.pathname` |
| 6 | Modal definitions are monolithic | Extract reusable section builders; decompose large modals |
| 7 | No centralized state / event system | Watch cache as single source of truth; badge reads cache |
| 8 | Constants declared after first use | Hoist `CORNER_LABELS`, `DEFAULT_HOTKEY`, `BROWSER_RESERVED` to top |
| 9 | Watch inspector rebuild-everything | Targeted DOM updates via retained references |
| 10 | No cleanup of global event listeners | Add `beforeunload` safety cleanup for element picker |

## Implementation Phases

### Phase 1: Infrastructure (additions only, no breakage)
- Inject `<style id="ar-css">` with all reusable CSS classes
- Add `el()` DOM builder utility
- Add `_watchCache` layer to `getWatches()`/`setWatches()`

### Phase 2: Structural cleanup
- Hoist constants to top of file (after T object)
- Fix URL storage keys: `location.origin + location.pathname`
- Extract UI helpers: `addSection()`, `addCollapsible()`, `addField()`

### Phase 3: Refactor all DOM construction
- Convert badge system to use `el()` + CSS classes
- Convert toast system
- Convert modal framework DOM creation
- Convert all 9 modal `build()` functions
- Replace JS hover listeners with CSS `:hover`

### Phase 4: Final cleanup
- Add `beforeunload` safety for element picker
- Bump version to 1.5.0
- Create version snapshot

## CSS Class Design

All classes prefixed `ar-` to avoid page collisions.

| Class | Purpose |
|-------|---------|
| `.ar-overlay` | Modal overlay (fixed, centered flex) |
| `.ar-panel` | Modal panel (bg, shadow, transitions) |
| `.ar-title` | Modal title |
| `.ar-subtitle` | Modal subtitle |
| `.ar-btn` | Standard option button |
| `.ar-btn-active` | Selected/active button |
| `.ar-btn-ok` | Green action button |
| `.ar-btn-err` | Red/destructive button |
| `.ar-section-hdr` | Section header (uppercase, small) |
| `.ar-status-bar` | Status bar container |
| `.ar-footer` | Modal footer |
| `.ar-field` | Read-only content field |
| `.ar-input` | Text/number input |
| `.ar-toolbar` | Toolbar container |
| `.ar-toolbar-btn` | Toolbar button |
| `.ar-back-btn` | Back navigation button |
| `.ar-link-btn` | Text-only link button |
| `.ar-collapsible` | Collapsible toggle |
| `.ar-dot` / `.ar-dot-lg` | Status indicator dots |
| `.ar-kbd` | Keyboard key display |
| `.ar-sidebar-item` | Inspector sidebar item |

## Risk Mitigation
- Full QA retest against https://emrepbu.github.io/RefreshCounter/
- Version snapshot before and after
- All business logic (timers, watch checking, hotkey matching) unchanged
