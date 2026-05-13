# Feature Spec: Change Diff Export & Reporting

## Overview

Export detected changes as structured reports (JSON, CSV, or plain text), enabling users to keep records, create logs, or feed change data into external tools.

---

## Problem Statement

Change information currently exists only in the Watch Inspector UI — it's ephemeral and not exportable. Users who need to document changes for compliance, reporting, or analysis have to manually screenshot or transcribe diffs.

---

## User Stories

- As a compliance officer, I want a timestamped log of all detected changes on a monitored page.
- As a user tracking price history, I want to export changes as CSV for spreadsheet analysis.
- As a developer, I want a JSON dump of change data to feed into monitoring dashboards.

---

## UX Design

### Watch Inspector Enhancement

New button in the inspector toolbar:

```
🔄 Re-snapshot  🗑 Remove  📤 Export
```

### Export Options (on click)

```
┌──────────────────────────────────┐
│ Export Changes                   │
│                                  │
│  📄 Plain Text                   │
│  📊 CSV                         │
│  { } JSON                       │
│  📋 Copy to Clipboard           │
│                                  │
│  SCOPE                           │
│  (●) This watch only            │
│  ( ) All watches                 │
└──────────────────────────────────┘
```

### Plain Text Output

```
Auto-Refresh Change Report
Generated: 2026-04-10 14:30:00
URL: https://example.com/dashboard

Watch: #counter (Text Content)
Status: Changed
Snapshot: 12m ago
Old: 299
New: 301

Watch: .status-badge (Styling)
Status: Unchanged
---
```

### CSV Output

```csv
timestamp,selector,mode,status,old_content,new_content,url
2026-04-10T14:30:00Z,#counter,content,changed,299,301,https://example.com/dashboard
2026-04-10T14:30:00Z,.status-badge,styling,unchanged,,,https://example.com/dashboard
```

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Export this watch (text) | Text file downloads with single watch details |
| Export all watches (CSV) | CSV file with one row per watch |
| Export (JSON) | Structured JSON with all watch data |
| Copy to clipboard | Content copied; toast: "Copied to clipboard" |
| No changes detected | Export still works; shows "unchanged" status |
| Includes history (if enabled) | History entries appended to export |

---

## Technical Notes

### Export Implementation

```javascript
function exportChanges(format, scope) {
    const watches = scope === 'all' ? getWatches() : [currentWatch];

    let content, filename, mimeType;

    if (format === 'json') {
        content = JSON.stringify(watches.map(w => ({
            selector: w.selector,
            mode: w.mode,
            status: getWatchStatus(w),
            snapshot: w.snapshot,
            history: w.history || []
        })), null, 2);
        filename = 'changes.json';
        mimeType = 'application/json';
    } else if (format === 'csv') {
        const rows = [['timestamp','selector','mode','status','old','new','url']];
        watches.forEach(w => {
            const status = getWatchStatus(w);
            rows.push([
                new Date().toISOString(),
                w.selector,
                w.mode,
                status.status,
                status.oldContent || '',
                status.newContent || '',
                location.href
            ]);
        });
        content = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
        filename = 'changes.csv';
        mimeType = 'text/csv';
    } else { // text
        content = formatPlainText(watches);
        filename = 'changes.txt';
        mimeType = 'text/plain';
    }

    downloadFile(content, filename, mimeType);
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}
```

### Storage

No new storage keys. Reads existing watch data.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large exports for many watches | Low | Watches are small; even 50 watches < 50KB |
| CSV injection | Low | Values wrapped in double quotes; proper escaping |
| Sensitive content in exports | Low | User is exporting their own data; clear labeling |
