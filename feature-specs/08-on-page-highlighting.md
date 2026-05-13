# Feature Spec: On-Page Change Highlighting

## Overview

When a watched element's content changes, visually highlight the changed element directly on the page with a pulsing outline and optional inline diff overlay, making changes immediately visible without opening the Watch Inspector.

---

## Problem Statement

Currently, when a change is detected, the user gets an audio alert and must open the Watch Inspector to see *what* changed. For users monitoring dashboards or data-heavy pages, this creates friction — they want to glance at the page and instantly see which elements changed and how.

---

## User Stories

- As a user monitoring a dashboard, I want changed elements to glow red so I can spot them immediately.
- As a user watching a status page, I want to see the old vs new value overlaid on the element itself.
- As a user tracking multiple elements, I want each changed element highlighted independently.

---

## UX Design

### Settings Integration

```
WATCHES (3)
🔦 Highlight Changes      On
   Flash changed elements on the page
```

### On-Page Highlight

When a change is detected on `#counter`:

```
┌─────────────────────────────┐
│      ┌──────────┐           │
│      │   301    │ ← pulsing │
│      │ was: 299 │   red     │
│      └──────────┘   border  │
│                             │
└─────────────────────────────┘
```

- Red pulsing outline (`box-shadow` animation) on the changed element
- Small overlay badge below the element showing `was: <old value>` (for content mode)
- Highlight persists until user clicks the element, clicks "Dismiss" on the overlay, or opens the inspector
- For style changes: overlay shows `N style changes` instead of content diff

### Multiple Elements

Each changed element gets its own independent highlight. Highlights don't interfere with each other.

### Dismiss Options

- Click the highlighted element → highlight removed
- Open Watch Inspector → all highlights cleared
- Stop Alert → all highlights cleared
- "Dismiss All" button in the overlay badge

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Content change detected, highlight enabled | Element gets red pulsing border + `was: X` overlay |
| Style change detected | Element gets blue pulsing border + `N style changes` overlay |
| Element is off-screen | Highlight still applied; user scrolls to see it |
| User clicks highlighted element | Highlight and overlay dismissed for that element |
| User opens Inspector | All highlights cleared |
| Highlight disabled | Changes detected normally (alert fires) but no visual on page |
| Element removed from DOM | Overlay can't attach; alert fires but no highlight |
| Page refreshes | Highlights cleared (new page load) |

---

## Technical Notes

### Highlight Implementation

```javascript
function highlightElement(el, oldContent) {
    // Pulsing border via CSS animation
    el.style.outline = '3px solid #ff4444';
    el.style.outlineOffset = '2px';
    el.style.animation = 'ar-pulse 1s ease-in-out infinite';

    // Inject keyframes if not already present
    if (!document.getElementById('ar-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'ar-highlight-styles';
        style.textContent = `
            @keyframes ar-pulse {
                0%, 100% { outline-color: #ff4444; }
                50% { outline-color: #ff444466; }
            }
        `;
        document.head.appendChild(style);
    }

    // Overlay badge
    const badge = document.createElement('div');
    badge.className = 'ar-change-badge';
    badge.textContent = `was: ${oldContent.substring(0, 50)}`;
    badge.style.cssText = `
        position:absolute; left:0; bottom:-24px; z-index:2147483645;
        background:#4a1c1c; color:#f88; font:11px/1 system-ui;
        padding:3px 8px; border-radius:4px; white-space:nowrap;
        cursor:pointer; pointer-events:auto;
    `;
    badge.onclick = () => clearHighlight(el);

    // Position relative to element
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:inline;';
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    wrapper.appendChild(badge);
}

function clearHighlight(el) {
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.animation = '';
    el.parentNode.querySelector('.ar-change-badge')?.remove();
}
```

### Storage Keys

```javascript
GM_getValue('ar_highlight_changes', true)  // default: enabled
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Highlight breaks page layout | Medium | Use `outline` not `border` (doesn't affect box model); overlay uses absolute positioning |
| DOM manipulation conflicts with page scripts | Low | Use unique class names with `ar-` prefix; minimal DOM changes |
| Performance with many highlights | Low | Cap at 10 simultaneous highlights |
| Overlay obscures content below element | Low | Small 24px badge; user can dismiss immediately |
