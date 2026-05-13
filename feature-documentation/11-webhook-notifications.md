# Feature Spec: Webhook & External Notifications

## Overview

Send change detection alerts to external services — Slack, Discord, email (via webhook), or arbitrary HTTP endpoints — enabling remote monitoring without keeping the browser tab visible.

---

## Problem Statement

Desktop notifications and audio alerts require the user to be at their computer. For critical monitoring (server status, stock prices, inventory availability), users need alerts that reach them on their phone or in team channels even when they're away from their desk.

---

## User Stories

- As a team lead, I want status page changes posted to our Slack channel automatically.
- As a user monitoring a product drop, I want an alert on my phone when inventory appears.
- As a DevOps engineer, I want server error page changes sent to a Discord webhook.

---

## UX Design

### Settings Integration

Webhook appears as its own row in the **General** section, alongside Alert Mode. It is orthogonal to Alert Mode — both fire independently when a change is detected.

```
─── General ───
⌨ Keyboard Shortcut          Shift+A       ▸
🔔 Alert Mode                Beep          ▸
🌐 Webhook                   Off           ▸
```

The value label shows `Off` (no URL configured) or `Configured`.

### Webhook Configuration Modal

The template textarea is **only shown when Generic JSON is selected**. Slack, Discord, and Teams presets use fixed payload formats and hide the template section entirely.

**Default view (preset selected):**
```
┌──────────────────────────────────────────┐
│ ◀ Webhook Notifications                 │
│ Send alerts to external services         │
│                                          │
│  WEBHOOK URL                             │
│  ┌─────────────────────────────────────┐ │
│  │ https://hooks.slack.com/services/...│ │
│  └─────────────────────────────────────┘ │
│                                          │
│  FORMAT                                  │
│  ( ) Slack                               │
│  ( ) Discord                             │
│  ( ) Teams                               │
│  (●) Generic JSON                        │
│                                          │
│  [ 🧪 Send Test ]  [ Save ]             │
│                                          │
│  Press Esc to go back                    │
└──────────────────────────────────────────┘
```

**When Generic JSON is selected — template section appears:**
```
│  FORMAT                                  │
│  ( ) Slack                               │
│  ( ) Discord                             │
│  ( ) Teams                               │
│  (●) Generic JSON                        │
│                                          │
│  AVAILABLE TAGS                          │
│  [url] [selector] [mode] [summary]       │
│  [old_content] [new_content] [timestamp] │
│                                          │
│  MESSAGE TEMPLATE                        │
│  ┌─────────────────────────────────────┐ │
│  │ {                                   │ │
│  │   "event": "change_detected",      │ │
│  │   "url": "{{url}}",               │ │
│  │   "selector": "{{selector}}",     │ │
│  │   "summary": "{{summary}}",       │ │
│  │   "timestamp": "{{timestamp}}"    │ │
│  │ }                                   │ │
│  └─────────────────────────────────────┘ │
```

Tag chips are clickable — tapping one inserts `{{tag}}` at the cursor position in the textarea.

### Template Variables

| Tag | Source | Description |
|-----|--------|-------------|
| `{{url}}` | `location.href` | Current page URL |
| `{{selector}}` | `w.selector` | CSS selector of the watched element |
| `{{mode}}` | `w.mode` | Watch mode (content/style/both) |
| `{{summary}}` | TTS text builder | Human-readable summary (same text used for speech alerts) |
| `{{old_content}}` | `w.content` | Stored content at watch creation |
| `{{new_content}}` | `el.innerText.trim()` | Live content at detection time |
| `{{timestamp}}` | `new Date().toISOString()` | ISO 8601 timestamp |

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Webhook configured + change detected | POST request sent with change details |
| Test button clicked | Test payload sent; toast shows success/failure |
| Webhook URL invalid | Validation error: "Enter a valid URL" |
| Webhook call fails (network/4xx/5xx) | Toast: "Webhook failed: [status]"; alert still fires locally |
| Slack preset selected | Payload auto-formatted as Slack Block Kit message |
| Discord preset selected | Payload auto-formatted as Discord embed |
| Teams preset selected | Payload auto-formatted as Adaptive Card |
| URL field empty | Webhook disabled; no requests sent |

---

## Technical Notes

### Payload Formats

**Generic JSON:**
```json
{
    "event": "change_detected",
    "url": "https://example.com/dashboard",
    "selector": "#counter",
    "mode": "content",
    "old_content": "299",
    "new_content": "301",
    "timestamp": "2026-04-10T14:30:00.000Z"
}
```

**Slack:**
```json
{
    "blocks": [{
        "type": "section",
        "text": {
            "type": "mrkdwn",
            "text": "🔔 *Change Detected*\n>*URL:* https://example.com\n>*Element:* `#counter`\n>*Old:* 299\n>*New:* 301"
        }
    }]
}
```

**Discord:**
```json
{
    "embeds": [{
        "title": "🔔 Change Detected",
        "color": 5814783,
        "fields": [
            { "name": "URL", "value": "https://example.com", "inline": false },
            { "name": "Element", "value": "`#counter`", "inline": true },
            { "name": "Old", "value": "299", "inline": true },
            { "name": "New", "value": "301", "inline": true }
        ],
        "timestamp": "2026-04-10T14:30:00.000Z"
    }]
}
```

**Teams (Adaptive Card):**
```json
{
    "type": "message",
    "attachments": [{
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.4",
            "body": [
                {
                    "type": "TextBlock",
                    "text": "🔔 Change Detected",
                    "weight": "Bolder",
                    "size": "Medium"
                },
                {
                    "type": "FactSet",
                    "facts": [
                        { "title": "URL", "value": "https://example.com" },
                        { "title": "Element", "value": "#counter" },
                        { "title": "Old", "value": "299" },
                        { "title": "New", "value": "301" }
                    ]
                },
                {
                    "type": "TextBlock",
                    "text": "2026-04-10T14:30:00.000Z",
                    "isSubtle": true,
                    "size": "Small"
                }
            ]
        }
    }]
}
```

Note: Teams imposes a 28 KB message size limit and throttles at >4 requests/second. The built-in 30s rate limit keeps us well within these bounds.

### Implementation

```javascript
async function sendWebhook(changeDetails) {
    const config = GM_getValue('ar_webhook', null);
    if (!config?.url) return;

    const payload = formatPayload(config.format, changeDetails);

    try {
        // Use GM_xmlhttpRequest to bypass CORS
        GM_xmlhttpRequest({
            method: 'POST',
            url: config.url,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload),
            onload: (res) => {
                if (res.status >= 400) console.warn('Webhook failed:', res.status);
            }
        });
    } catch (err) {
        console.warn('Webhook error:', err);
    }
}
```

Note: Requires adding `GM_xmlhttpRequest` to the `@grant` list to bypass CORS restrictions.

### Storage Keys

```javascript
GM_getValue('ar_webhook', { url: '', format: 'generic', template: '' })
```

### Security Considerations

- Webhook URL is stored locally — never transmitted except to the configured endpoint
- Template variables are sanitized (no script injection)
- `GM_xmlhttpRequest` bypasses CORS but only sends to user-configured URLs
- Rate limit: max 1 webhook per 30 seconds to prevent spam

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| User pastes wrong webhook URL | Low | Test button lets them verify before saving |
| Webhook endpoint leaks page content | Medium | User configures URL themselves; user is responsible for endpoint security |
| Rate limiting by webhook service | Low | Built-in 30s rate limit; configurable |
| GM_xmlhttpRequest not available | Low | Graceful fallback with toast explaining limitation |

---

## Implementation Details

**Version**: 1.9.0
**Date**: 2026-04-11
**Action Plan**: [action-plans/webhook-notifications.md](../action-plans/webhook-notifications.md)

### What Was Built
- Full webhook notification system: configuration modal, 4 format presets (Slack/Discord/Teams/Generic JSON), rate-limited delivery, template editor with tag chips
- Webhook fires orthogonally to alert mode (beep/speech) — both systems run independently
- URL validation, Send Test button with loading state, Disable button for configured webhooks
- ~220 lines of new code added

### Deviations from Spec
1. Save/Disable use `Modal.open('settings')` instead of `Modal.pop()` to force settings panel re-render with updated webhook status
2. Added "🚫 Disable Webhook" button (not in original spec) — discovered during usability testing
3. Removed unused `WEBHOOK_FORMAT_LABELS` constant during code quality audit
4. `sendTestWebhook` returns a Promise to support async loading state on the Send Test button

### Code Location
| Component | Location |
|-----------|----------|
| `GM_xmlhttpRequest` grant | Line 11 |
| `STORAGE_KEY_WEBHOOK` | Line 165 |
| Webhook functions (`formatWebhookPayload`, `sendWebhook`, `sendTestWebhook`, `_replaceTemplateTags`) | Lines 709–845 |
| CSS classes (`.ar-textarea`, `.ar-tag-chips`, `.ar-tag-chip`) | Lines ~270–280 |
| `WEBHOOK_FORMAT_OPTIONS` constant | Line 1527 |
| `webhook-config` modal definition | Lines 1537–1665 |
| Webhook settings row in settings panel | Line 1931 |
| Change detection hook (`checkForChanges`) | Lines 2495–2502 |

### Testing Notes
- All 14 usability/QA tests passed via MCP browser automation
- Format switching correctly shows/hides template section
- Save → settings row updates to "Configured"; Disable → reverts to "Off"
- URL validation rejects invalid URLs with toast + red border
- Send Test sends actual HTTP POST (tested against Power Automate endpoint, received 400 due to schema mismatch — expected for non-matching endpoint schemas)
- Tag chip insertion at cursor position works correctly
- Back button and Escape navigation work in all states
- Known limitation: Teams Adaptive Card format may not work with Power Automate HTTP triggers that have strict JSON schemas — works with native Teams Incoming Webhook connectors

### Screenshots
Screenshots captured during QA testing:
- [Settings panel with webhook row](images/webhook-settings-row.png)
- [Webhook config modal](images/usability-test-1.png)
