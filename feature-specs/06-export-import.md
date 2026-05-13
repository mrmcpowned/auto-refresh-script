# Feature Spec: Export, Import & Backup

## Overview

Allow users to export their entire auto-refresh configuration (settings, watches, profiles, history) as a portable JSON file, and import configurations from files — enabling backup, sharing, and migration between browsers/machines.

---

## Problem Statement

All configuration is stored in Tampermonkey's per-script GM_setValue storage. This data is:
- Lost when the userscript is uninstalled/reinstalled
- Not transferable between browsers or machines
- Not shareable with other users who want the same monitoring setup
- Invisible — users can't inspect what's stored
- Not backed up unless the user manually exports Tampermonkey's entire data store

---

## User Stories

- As a user switching browsers, I want to export my entire config from Chrome and import it into Firefox.
- As a user who is about to reinstall Tampermonkey, I want to back up my watches and settings.
- As a power user, I want to share my monitoring setup with a colleague.
- As a user who accidentally deleted a watch profile, I want to restore from a backup.

---

## UX Design

### Settings Integration

New section at the bottom of settings:

```
DATA
💾 Export Config
   Save all settings and watches as a file
📥 Import Config
   Load settings from a file
```

### Export Flow

1. User clicks "💾 Export Config"
2. JSON file downloads immediately: `auto-refresh-config-2026-04-10.json`
3. Toast: "Configuration exported (3 watches, 2 profiles)"

No sub-modal needed — single action with immediate feedback.

### Import Flow

1. User clicks "📥 Import Config"
2. Sub-modal appears:

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Import Configuration                     │
│ Load settings from a file                │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │                                     │ │
│  │   📄 Drop a JSON file here          │ │
│  │   or click to browse                │ │
│  │                                     │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ⚠ This will replace your current       │
│    settings and watches.                 │
│                                          │
│  Press Esc to cancel                     │
└──────────────────────────────────────────┘
```

3. After file selected/dropped, a preview appears:

```
┌──────────────────────────────────────────┐
│ ← Back                                  │
│ Import Preview                           │
│                                          │
│  📋 Settings                             │
│     Interval: 10s, Position: Top Center  │
│     Font: Extra Large, Hotkey: Alt+Sh+R  │
│                                          │
│  👁 Watches: 3                           │
│     #counter (Text Content)              │
│     .status (Styling)                    │
│     #price (Both)                        │
│                                          │
│  📂 Profiles: 2                          │
│     Sales Dashboard (5 watches)          │
│     Price Monitor (2 watches)            │
│                                          │
│  [ Import All ]  [ Import Watches Only ] │
│                                          │
│  Press Esc to cancel                     │
└──────────────────────────────────────────┘
```

4. User chooses:
   - **Import All**: Replaces all settings, watches, and profiles
   - **Import Watches Only**: Only imports watches and profiles, keeps current settings
5. Toast: "Imported 3 watches, 2 profiles, and settings"

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Export with no watches | Exports settings-only file; toast: "Configuration exported (settings only)" |
| Import invalid JSON | Error toast: "Invalid file format" |
| Import file from older version | Compatible — unknown keys silently ignored; missing keys use defaults |
| Import file from newer version | Compatible — extra keys silently ignored |
| Drop non-JSON file | Error toast: "Please select a JSON file" |
| Import giant file (>1MB) | Error toast: "File too large" |
| Import with malicious content | File is parsed as JSON only; no eval() or script execution |
| Export → uninstall → reinstall → import | Full restoration of all settings |
| Partial import (watches only) | Only `ar_watches_*` and `ar_profiles` keys updated |

---

## Technical Notes

### Export Format

```json
{
    "version": "1.2.0",
    "exportedAt": "2026-04-10T14:30:00.000Z",
    "settings": {
        "interval": 10,
        "corner": "top-center",
        "fontSize": "xl",
        "hotkey": "Alt+Shift+R",
        "alertModes": ["audio"],
        "alertSound": "beacon",
        "autoDismiss": 0,
        "schedule": { "type": "always" },
        "adaptive": false,
        "pauseIdle": false,
        "historyEnabled": true
    },
    "watches": {
        "https://example.com/dashboard": [
            {
                "selector": "#counter",
                "mode": "content",
                "condition": { "type": "always", "value": "" }
            }
        ]
    },
    "profiles": [
        {
            "name": "Sales Dashboard",
            "watches": [
                { "selector": "#revenue", "mode": "content" }
            ],
            "createdAt": 1712793600000
        }
    ]
}
```

### Key Design Decisions

1. **Snapshots excluded from export.** Snapshots are time-sensitive and page-specific. Importing old snapshots would cause false change detections. Watches are re-snapshotted on next page load.

2. **History excluded from export.** Change history is large and time-specific. Including it would bloat the export file.

3. **Watches keyed by URL.** The export preserves the URL→watches mapping so multi-site configurations are fully portable.

4. **Version field for forward compatibility.** Import logic checks the version and applies migrations if needed.

### Export Implementation

```javascript
function exportConfig() {
    const config = {
        version: VERSION,
        exportedAt: new Date().toISOString(),
        settings: {
            interval: GM_getValue('ar_interval', 10),
            corner: GM_getValue('ar_corner', 'top-center'),
            fontSize: GM_getValue('ar_font_size', 'xl'),
            hotkey: GM_getValue('ar_hotkey', DEFAULT_HOTKEY),
            // ... all settings
        },
        watches: {}, // populated below
        profiles: GM_getValue('ar_profiles', [])
    };

    // Collect watches for all known URLs
    // Note: GM_listValues() can enumerate all keys
    // For simplicity, export current page's watches
    const currentWatches = getWatches().map(w => ({
        selector: w.selector,
        mode: w.mode,
        condition: w.condition
    }));
    config.watches[location.origin + location.pathname] = currentWatches;

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auto-refresh-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const watchCount = currentWatches.length;
    const profileCount = config.profiles.length;
    showToast(`Configuration exported (${watchCount} watches, ${profileCount} profiles)`);
}
```

### Import Implementation

```javascript
function importConfig(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const config = JSON.parse(e.target.result);

            // Validate structure
            if (!config.version || !config.settings) {
                showToast('Invalid file format');
                return;
            }

            // Size check
            if (e.target.result.length > 1024 * 1024) {
                showToast('File too large');
                return;
            }

            showImportPreview(config);
        } catch {
            showToast('Invalid JSON file');
        }
    };
    reader.readAsText(file);
}
```

### File Input (Hidden)

```javascript
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';
input.style.display = 'none';
input.addEventListener('change', (e) => {
    if (e.target.files[0]) importConfig(e.target.files[0]);
});
document.body.appendChild(input);
```

### Drag-and-Drop

```javascript
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
        importConfig(file);
    } else {
        showToast('Please select a JSON file');
    }
});
```

### Security Considerations

- **No eval()**: JSON.parse only — no code execution from imported files
- **Schema validation**: Only known keys are read; unknown keys are silently discarded
- **Size limit**: 1MB max to prevent memory issues
- **No URLs**: Import doesn't fetch external resources
- **Sanitization**: All string values from imports are used only as GM_setValue inputs or DOM textContent (never innerHTML)

### Storage

No new storage keys. Export reads existing keys; import writes to existing keys.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Importing malicious selectors (XSS) | Low | Selectors are used with `querySelector()` which is safe; content set via `textContent` not `innerHTML` |
| Large file import freezes page | Low | 1MB size limit; JSON.parse is fast for reasonable sizes |
| Overwriting good config with bad import | Medium | Preview screen shows what will be imported; "Import Watches Only" option preserves settings |
| Cross-origin watch URLs | Very Low | Watches are stored per-URL; importing another site's watches just means they won't match any elements on the current page |
| Export contains sensitive page content | Low | Snapshots excluded; only selectors and settings exported |
