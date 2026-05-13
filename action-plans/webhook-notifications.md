# Implementation Plan: Webhook & External Notifications (Feature #11)

## Version Target: 1.9.0

## Overview
Add webhook notification support that sends change detection alerts to external services (Slack, Discord, Teams, or generic JSON endpoints). Webhook is orthogonal to the existing alert mode — both fire independently. Includes a configuration sub-modal with URL input, format preset picker, and custom template editor for generic JSON.

## Implementation Steps

### Step 1: Add `GM_xmlhttpRequest` Grant
**Location**: Header block, line ~11
- Add `// @grant GM_xmlhttpRequest` to the userscript header

### Step 2: Add Storage Key Constant
**Location**: Storage key section, after line ~163 (after `STORAGE_KEY_TTS_VOLUME`)
- Add `const STORAGE_KEY_WEBHOOK = 'autoRefreshWebhook';`

### Step 3: Add Webhook Functions
**Location**: After `_pageLabel()` function, before the Modal Framework section (~line 697)
- `_lastWebhookTime` variable for rate limiting (30s)
- `formatWebhookPayload(format, details, template)` — builds payload for slack/discord/teams/generic
- `sendWebhook(changeDetails)` — reads config, rate-limits, sends via GM_xmlhttpRequest
- `_replaceTemplateTags(template, details)` — replaces `{{tag}}` placeholders in custom templates

### Step 4: Add CSS Classes for Webhook UI
**Location**: `buildCss()` function
- `.ar-textarea` — for the template editor (multiline input)
- `.ar-tag-chip` — for clickable tag chips (styled differently from existing `.ar-chip`)

### Step 5: Define Webhook Config Modal
**Location**: After `alert-mode-picker` modal definition (~line 1378)
- `webhook-config` modal with:
  - URL input field (using `.ar-input`)
  - Format radio buttons (slack/discord/teams/generic) using `makeOptionBtn` pattern
  - Conditional template section (only when format=generic)
  - Tag chips row
  - Textarea for custom template
  - Test button + Save button

### Step 6: Add Webhook Row to Settings Panel
**Location**: Settings modal build function, after Alert Mode button (~line 1639)
- Read webhook config, show "Off" or "Configured"
- `makeOptionBtn('🌐 Webhook', false, () => ctx.push('webhook-config'), ...)`

### Step 7: Hook into Change Detection
**Location**: `checkForChanges()` function (~lines 2180-2190)
- Build `changeDetails` object with all template variables
- Call `sendWebhook(changeDetails)` alongside `speak()` and `startAlert()`
- Capture `new_content` from `el.innerText.trim()` at detection time

## Key Design Decisions
- Webhook is orthogonal to alert mode — fires regardless of beep/speech/both setting
- Rate limit of 30s between webhook calls to prevent spam
- Template textarea only shown for "generic" format to avoid confusion
- Tag chips insert at cursor position for discoverability
- `GM_xmlhttpRequest` used to bypass CORS (essential for cross-origin webhook endpoints)
- Test button sends a sample payload so users can verify before saving

## Testing Plan
1. Open settings → verify "🌐 Webhook" row shows "Off"
2. Click webhook → modal opens with URL field, format picker, test/save buttons
3. Enter Teams webhook URL → select Teams format → click Save → toast "Webhook saved"
4. Back to settings → webhook row shows "Configured"
5. Click webhook again → verify URL and format are restored
6. Click "Send Test" → toast shows success/failure
7. Switch to Generic JSON format → template section appears with tag chips and textarea
8. Click a tag chip → tag inserted into textarea
9. Switch back to Teams → template section hidden
10. Set up a real watch, trigger a change → verify webhook fires
11. Trigger another change within 30s → verify rate limiting (webhook skipped)
12. Clear webhook URL → save → webhook row shows "Off" again
13. Verify all existing features (beep, speech, watches) still work

## Deviations from Spec
1. **Save/Disable use `Modal.open('settings')` instead of `Modal.pop()`** — Popping back to the settings panel showed stale webhook status ("Off" when it should be "Configured") because stack-based modals don't re-render the parent. Same pattern used by interval-picker and other modals.
2. **Added "🚫 Disable Webhook" button** — Not in the original spec. Added during usability testing when it was observed there was no way to turn off a configured webhook without manually clearing the URL.
3. **Removed `WEBHOOK_FORMAT_LABELS` constant** — Defined during implementation but never used (webhook settings row shows "Configured"/"Off" instead of the format name). Removed during code quality audit.
4. **`sendTestWebhook` returns Promise** — Spec didn't specify async behavior. Implemented as a Promise to support the loading state on the Send Test button (`⏳ Sending...` → `🧪 Send Test`).
