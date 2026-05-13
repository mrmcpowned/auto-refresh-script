# Feature Spec: Keyboard-Only Element Picker

## Overview

Add a keyboard-driven DOM navigation mode to the element picker, allowing users to select elements without a mouse using arrow keys to traverse the DOM tree.

---

## Problem Statement

The current element picker is mouse-only:
- Accessibility: users relying on keyboard navigation cannot add watches
- Precision: small or overlapping elements are hard to click accurately
- Iframes: mouse-based picker can't reach inside iframes
- Automation: MCP/browser automation tools can't click the overlay (documented in QA)

---

## User Stories

- As a keyboard-centric user, I want to navigate the DOM tree and select elements with arrow keys.
- As a user trying to select a tiny element nested inside others, I want precise parent/child navigation.
- As a user, I want to type a CSS selector directly instead of clicking.

---

## UX Design

### Picker Mode Toggle

When element picker activates, bottom bar shows both modes:

```
┌──────────────────────────────────────────────────────────┐
│  🖱 Click to pick  |  ⌨ Press Tab for keyboard mode     │
│  Esc to cancel                                           │
└──────────────────────────────────────────────────────────┘
```

### Keyboard Navigation Mode

After pressing Tab:

```
┌──────────────────────────────────────────────────────────┐
│  ⌨ Keyboard Mode                                        │
│  ↑↓ siblings · ←→ parent/child · Enter to select        │
│                                                          │
│  Current: <div#counter>                                  │
│  Path: html > body > div#app > div#counter               │
│  Esc to cancel                                           │
└──────────────────────────────────────────────────────────┘
```

The currently focused element is highlighted on the page (blue outline).

### Manual Selector Input

```
┌──────────────────────────────────────────────────────────┐
│  ⌨ Keyboard Mode                                        │
│  Type a selector: [ #counter          ]                  │
│  ↑↓ siblings · ←→ parent/child · Enter to select        │
│                                                          │
│  Matched: <div id="counter">301</div>                    │
│  Esc to cancel                                           │
└──────────────────────────────────────────────────────────┘
```

Pressing `/` activates selector input. As user types, matched element is highlighted live.

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Tab in picker | Switches to keyboard mode; starts at `<body>` |
| ArrowDown | Move to next sibling element |
| ArrowUp | Move to previous sibling element |
| ArrowRight | Move to first child element |
| ArrowLeft | Move to parent element |
| Enter | Select current element → opens mode picker |
| `/` key | Activates selector text input; live matching |
| Type invalid selector | "No match" shown; highlight removed |
| Press Escape | Exit keyboard mode / cancel picker |
| Tab again | Return to mouse mode |

---

## Technical Notes

### DOM Traversal

```javascript
let currentElement = document.body;

function navigateDOM(direction) {
    switch (direction) {
        case 'down': // next sibling
            currentElement = currentElement.nextElementSibling || currentElement;
            break;
        case 'up': // prev sibling
            currentElement = currentElement.previousElementSibling || currentElement;
            break;
        case 'right': // first child
            currentElement = currentElement.firstElementChild || currentElement;
            break;
        case 'left': // parent
            if (currentElement.parentElement && currentElement.parentElement !== document.documentElement) {
                currentElement = currentElement.parentElement;
            }
            break;
    }
    highlightElement(currentElement);
    updatePathDisplay(currentElement);
}
```

### Element Path Display

```javascript
function getElementPath(el) {
    const parts = [];
    let current = el;
    while (current && current !== document) {
        let desc = current.tagName.toLowerCase();
        if (current.id) desc += `#${current.id}`;
        else if (current.className) desc += `.${current.className.split(' ')[0]}`;
        parts.unshift(desc);
        current = current.parentElement;
    }
    return parts.join(' > ');
}
```

### Live Selector Matching

```javascript
selectorInput.addEventListener('input', (e) => {
    try {
        const el = document.querySelector(e.target.value);
        if (el) {
            currentElement = el;
            highlightElement(el);
            matchIndicator.textContent = `Matched: <${el.tagName.toLowerCase()}>`;
        } else {
            matchIndicator.textContent = 'No match';
        }
    } catch {
        matchIndicator.textContent = 'Invalid selector';
    }
});
```

### Storage

No new storage keys. Keyboard mode is session-only preference.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| DOM traversal on complex pages is slow | Low | Only one element tracked at a time |
| Keyboard events conflict with page hotkeys | Low | Keyboard mode captures all events; `stopPropagation()` |
| User navigates to `<script>` or `<style>` elements | Low | Filter to visible elements only (`offsetParent !== null`) |
| Selector input allows injection | Very Low | `querySelector()` is safe; no eval |

### Accessibility

- Full keyboard navigation means the entire watch creation flow is accessible without a mouse
- Screen reader support: current element announced via `aria-live` region
- Path display provides context for non-visual users
