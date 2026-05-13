# Implementation Plan: Smooth Modal Transitions (Feature #54)

## Version Target: 4.3.0

## Status: COMPLETED
**Version**: 4.3.0
**Date**: 2026-04-15

## Overview
Add directional slide+fade transitions to modal push/pop navigation, close animations to root modal dismissal, and `prefers-reduced-motion` support. The existing scale+fade entrance for root modals is preserved and slightly adjusted (150ms→180ms).

## Implementation Steps

### Step 1: Add CSS transition classes
**Location**: `buildCss()` function (~line 1189), append after `.ar-panel` rule
- Add `.ar-panel-exit-left`, `.ar-panel-exit-right` (exit slide classes)
- Add `.ar-panel-enter-from-right`, `.ar-panel-enter-from-left` (enter start state classes)
- Add `.ar-panel-exit-scale` (close animation class — reverse of root open)
- Add `@media (prefers-reduced-motion: reduce)` override to zero out transition durations
- Update `.ar-panel` transition duration from `.15s` to `.18s`

### Step 2: Add transition duration constants
**Location**: Inside the `Modal` IIFE (~line 1989), at the top after `let _modalOpen = false;`
- `const TRANSITION_MS = 180;`
- `const CLOSE_TRANSITION_MS = 120;`
- `let _transitioning = false;` (guard flag for rapid interactions)

### Step 3: Modify `_show()` for animated push
**Location**: `_show()` function (~line 2048)
- When `stack.length > 0` (sub-modal push): animate previous panel exit-left, new panel enter-from-right
- Keep root open behavior (scale+fade) largely unchanged
- Set `_transitioning = true` during animation, reset on completion

### Step 4: Modify `pop()` for animated pop/close
**Location**: `pop()` function (~line 2105)
- When popping to a parent: animate current exit-right, previous enter-from-left
- When closing last modal: animate exit-scale, then remove + resumeRefresh
- Guard against rapid pops with `_transitioning` flag

### Step 5: Modify `closeAll()` for animated close
**Location**: `closeAll()` function (~line 2115)
- Animate top panel exit-scale, then remove all panels after timeout
- Set `_modalOpen = false` and `resumeRefresh()` in the timeout callback

### Step 6: Add reduced-motion detection helper
**Location**: Inside Modal IIFE
- `const _prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;`
- When reduced motion is active, skip setTimeout delays (use 0ms)

## Key Design Decisions
- Use CSS class toggling + existing `transition` property rather than JS-driven animations for simplicity
- Use `_transitioning` flag to prevent rapid push/pop from creating glitched states
- Keep animation durations short (120–180ms) to feel responsive, not sluggish
- Slide offset is 30px — subtle enough to feel spatial without being dramatic
- `closeAll()` only animates the top panel, not the whole stack
- Detect reduced motion via `matchMedia` at transition time (reactive to OS changes)

## Testing Plan
1. Open Settings modal — verify scale+fade entrance (unchanged behavior)
2. Push a sub-modal (e.g., Theme picker) — verify old panel slides left, new slides from right
3. Pop via Back button — verify current slides right, parent slides from left
4. Pop via Escape — same directional pop animation
5. Close last modal via Escape — verify scale-down + fade-out
6. Close via overlay click — same close animation
7. `closeAll()` via Alt+Shift+R — verify fade-out of top panel
8. Rapid Escape presses — no animation glitches; stack unwinds cleanly
9. Deep stack (Settings → Theme → sub-sub) — animations consistent at every level
10. Reduced motion: enable OS "reduce motion" → verify all transitions are instant
11. Keyboard navigation works correctly after push/pop transitions complete
12. Console: zero errors during all interactions

## Deviations from Spec
- **No CSS transition classes**: The spec proposed CSS classes (`.ar-panel-exit-left`, etc.), but since panels have inline styles (`opacity:1; transform:scale(1)`) from `requestAnimationFrame`, CSS class properties would be overridden by inline specificity. Switched to all-inline-style approach — directly manipulating `style.opacity` and `style.transform`, letting the existing `.ar-panel` CSS `transition` property handle the animation. The `@media (prefers-reduced-motion: reduce)` rule still zeroes out transition duration in CSS, which applies to inline style changes too.
- **No EventBus events**: Deferred `modal:transition:start`/`modal:transition:end` events — no consumers exist currently, adding them would be dead code.
