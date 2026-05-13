# Feature Spec: Quick Watch via Context Menu

## Overview

Add a browser context menu (right-click) option to instantly add a watch on the element the user right-clicked, bypassing the full element picker flow.

---

## Problem Statement

The current Add Watch flow requires:
1. Open settings (hotkey)
2. Click "Add Watch"
3. Enter element picker mode
4. Click the element
5. Choose watch mode
6. (Optional) Set conditions

For users who already know exactly what element they want to watch, this is 4+ clicks too many. A right-click option would reduce it to 2 clicks.

---

## User Stories

- As a user, I want to right-click an element and immediately start watching it.
- As a user, I want the right-click menu to show the element's selector so I know what I'm watching.
- As a power user, I want to add a Text Content watch in a single right-click without going through modals.

---

## UX Design

### Tampermonkey Context Menu

Using `GM_registerMenuCommand` is global — not contextual. Instead, use the page's native context menu event:

When the user right-clicks anywhere on the page, the script injects a brief overlay near the cursor:

```
┌──────────────────────────────┐
│  🔍 Watch this element       │
│     #counter                 │
│                              │
│  📝 Text Content             │
│  🎨 Styling                  │
│  📝🎨 Both                   │
│                              │
│  ⚙ Full Options...          │
└──────────────────────────────┘
```

This appears **instead of or alongside** the browser context menu, triggered by holding a modifier key (Ctrl+Right-Click) to avoid interfering with normal right-click behavior.

### Flow

1. User Ctrl+Right-Clicks an element
2. Quick watch overlay appears at cursor position
3. Shows the computed CSS selector of the right-clicked element
4. User clicks a mode → watch instantly added with toast confirmation
5. Or clicks "Full Options..." → opens regular element picker with element pre-selected

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Ctrl+Right-Click on element | Quick watch overlay at cursor; shows selector |
| Click "Text Content" | Watch added; toast: "Watching #counter (Text Content)" |
| Click "Full Options..." | Opens full watch mode modal with element pre-selected |
| Regular right-click (no Ctrl) | Normal browser context menu |
| Click away from overlay | Overlay dismissed |
| Ctrl+Right-Click on already-watched element | Shows "Already watching" with options: Re-snapshot / Remove / Inspect |
| Element is inside iframe | Selector computed relative to iframe; may not work across origins |

---

## Technical Notes

### Context Menu Interception

```javascript
document.addEventListener('contextmenu', (e) => {
    if (!e.ctrlKey) return; // Only intercept Ctrl+Right-Click
    e.preventDefault();

    const target = e.target;
    const selector = getUniqueSelector(target);

    showQuickWatchMenu(e.clientX, e.clientY, target, selector);
}, true);
```

### Quick Menu DOM

```javascript
function showQuickWatchMenu(x, y, element, selector) {
    const menu = document.createElement('div');
    menu.id = 'ar-quick-watch';
    menu.style.cssText = `
        position:fixed; left:${x}px; top:${y}px; z-index:2147483647;
        background:#1e1e1e; border:1px solid #444; border-radius:8px;
        padding:8px; min-width:200px; font:13px system-ui;
        box-shadow:0 4px 16px rgba(0,0,0,0.5);
    `;

    // Header
    const header = document.createElement('div');
    header.innerHTML = `<b>🔍 Watch this element</b><br><code style="color:#aaa">${selector}</code>`;
    menu.appendChild(header);

    // Mode buttons
    ['📝 Text Content|content', '🎨 Styling|style', '📝🎨 Both|both'].forEach(item => {
        const [label, mode] = item.split('|');
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.onclick = () => {
            addWatch(selector, mode, element);
            menu.remove();
            showToast(`Watching ${selector} (${label.trim()})`);
        };
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // Click-away to dismiss
    const dismiss = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', dismiss);
        }
    };
    setTimeout(() => document.addEventListener('click', dismiss), 0);
}
```

### Storage

No new storage keys. Uses existing watch storage.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Ctrl+Right-Click conflicts with browser dev tools | Low | Only on specific pages where userscript runs; rare conflict |
| Context menu intercepted on all pages | Low | Only activates with Ctrl modifier; normal right-click unaffected |
| Quick menu overlaps with page content | Low | Menu is fixed-position; click-away dismisses |
| No condition/threshold setup in quick mode | Low | "Full Options..." link available for advanced configuration |
