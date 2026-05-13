# Feature Spec: Focus Management Abstraction

## Overview

Extract the keyboard navigation logic from the Modal framework's `_setupKeyboard()` into a reusable `FocusTrap` utility. Currently, focus management uses manual `Array.from` + filter + modulo arithmetic inline in the modal framework. A `FocusTrap` utility will reduce duplication and improve accessibility compliance.

---

## Problem Statement

The modal framework's `_setupKeyboard()` function (lines ~1,990–2,028) handles:
- Arrow key navigation (ArrowUp/ArrowDown)
- Focus index tracking with modular wrapping
- Visual focus outline management
- Enter key activation
- Escape key handling
- Hotkey detection for close-all

This logic is ~40 lines but is tightly coupled to the modal system. If focus trapping is needed elsewhere (e.g., context menu, element picker), it would need to be duplicated.

---

## User Stories

- As a developer, I want a reusable focus navigation utility so that any container can have keyboard nav.
- As a developer, I want focus outline management abstracted so that style updates happen in one place.
- As a developer, I want the modal framework to be simpler by delegating focus logic to a utility.

---

## UX Design

No user-facing UX changes. Keyboard navigation should behave identically.

---

## Technical Design

### FocusTrap Utility

```javascript
function createFocusTrap(container, opts = {}) {
    let focusIndex = -1;
    const selector = opts.selector || 'button, input';
    
    function getFocusables() {
        return Array.from(container.querySelectorAll(selector))
            .filter(el => el.offsetParent !== null);
    }
    
    function setFocus(index) {
        const items = getFocusables();
        if (items.length === 0) return;
        focusIndex = ((index % items.length) + items.length) % items.length;
        items.forEach((el, i) => {
            el.style.outline = i === focusIndex ? `2px solid ${v('textLight')}` : 'none';
            el.style.outlineOffset = i === focusIndex ? '-2px' : '';
        });
        items[focusIndex].focus();
        items[focusIndex].scrollIntoView({ block: 'nearest' });
    }
    
    function clearOutlines() {
        focusIndex = -1;
        getFocusables().forEach(el => {
            el.style.outline = 'none';
            el.style.outlineOffset = '';
        });
    }
    
    function onKeyDown(e) {
        const items = getFocusables();
        if (items.length === 0) return false;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocus(focusIndex + 1);
            return true;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocus(focusIndex === -1 ? -1 : focusIndex - 1);
            return true;
        }
        if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < items.length) {
            if (items[focusIndex]?.tagName === 'INPUT') return false;
            e.preventDefault();
            items[focusIndex].click();
            return true;
        }
        return false;
    }
    
    // Auto-clear on mouse interaction
    container.addEventListener('mousedown', clearOutlines);
    
    return {
        handleKeyDown: onKeyDown,
        clearOutlines,
        destroy() {
            clearOutlines();
            container.removeEventListener('mousedown', clearOutlines);
        }
    };
}
```

### Integration with Modal Framework

```javascript
function _setupKeyboard(panel, overlay, entry) {
    const trap = createFocusTrap(panel);
    
    const onKey = (e) => {
        if (e.key === 'Escape') { pop(); return; }
        if (matchesHotkey(e)) { e.preventDefault(); e.stopImmediatePropagation(); closeAll(); return; }
        trap.handleKeyDown(e);
    };
    
    const onOverlayClick = (e) => { if (e.target === overlay) pop(); };
    
    document.addEventListener('keydown', onKey);
    if (!entry._overlayClickAttached) {
        overlay.addEventListener('click', onOverlayClick);
        entry._overlayClickAttached = true;
    }
    entry.removeKeyboard = () => {
        document.removeEventListener('keydown', onKey);
        trap.destroy();
    };
}
```

### Placement

`createFocusTrap` should be defined in the UI Helpers section, after `h()` and `makeOptionBtn()`.

---

## Edge Cases & Error Handling

- Empty containers (no focusable elements) are handled — `getFocusables()` returns empty array, no action taken
- Hidden elements (`offsetParent === null`) are filtered out (existing behavior)
- Input elements skip Enter activation (existing behavior for form inputs)
- `destroy()` cleans up event listeners to prevent memory leaks

---

## Scope & Non-Goals

### In Scope
- Creating `createFocusTrap()` utility function
- Refactoring `_setupKeyboard()` to use the utility
- Verifying keyboard navigation still works in all modals

### Out of Scope (Future)
- Adding focus trapping to context menus
- Tab key navigation support
- ARIA role management
- Focus restoration on dialog close

---

## Risks & Open Questions

1. The `outline` style is applied inline for focus visibility. In a future refactor (inline style extraction), this could move to a `.ar-focused` CSS class.
2. The `v('textLight')` call requires the `v()` helper to be defined before `createFocusTrap()` — verify ordering.
