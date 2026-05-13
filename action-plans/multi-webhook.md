# Implementation Plan: Multi-Webhook Support (Feature #28)

## Version Target: 2.0.0

## Overview
Refactor the webhook system from a single-webhook model to support multiple independently configured webhooks. Each webhook has its own URL, format, label, and enable/disable toggle. A global toggle silences all webhooks. Includes automatic migration from the v1.9.x single-webhook format.

## Implementation Steps

### Step 1: Refactor `_getWebhookConfig()` with Migration Logic
**Location**: Lines 716-718
- Replace the simple getter with a migration-aware function
- Add `_saveWebhookConfig()` and `_webhookDisplayLabel()` helpers
- If stored value has a `url` property (old format), auto-migrate to `{ globalEnabled, webhooks: [...] }`
- New default: `{ globalEnabled: false, webhooks: [] }`

### Step 2: Refactor `sendWebhook()` for Multi-Dispatch
**Location**: Lines 791-816
- Check `config.globalEnabled` instead of `config.enabled`
- Filter `config.webhooks` to enabled ones with URLs
- Loop and fire `GM_xmlhttpRequest` for each active webhook with its own format/template
- Rate limiting stays global (30s cooldown)

### Step 3: Define `webhook-list` Modal (Replaces `webhook-config`)
**Location**: After WEBHOOK_FORMAT_OPTIONS (line ~1535), replacing the old `webhook-config` Modal.define
- Global toggle at top (same pattern as auto-refresh toggle in settings)
- Section header showing webhook count
- Per-webhook rows: status dot, label, format subtitle, inline toggle
- Click row → `ctx.push('webhook-edit', { webhookId })` 
- "Add Webhook" button at bottom
- Empty state when no webhooks configured

### Step 4: Define `webhook-edit` Modal (New)
**Location**: After `webhook-list` modal definition  
- Title: "Add Webhook" or "Edit Webhook" based on whether `ctx.extra.webhookId` exists
- Label input (optional)
- URL input
- Format picker (reuse WEBHOOK_FORMAT_OPTIONS + makeOptionBtn pattern)
- Conditional template section for generic format (reuse tag chips pattern)
- Send Test + Save buttons
- Delete button (only for existing webhooks, confirm-on-second-click)

### Step 5: Update Settings Row
**Location**: Lines 1960-1963
- Change value label logic: count enabled webhooks, show "2 of 3 on" / "Off" / "None"
- Change `ctx.push('webhook-config')` → `ctx.push('webhook-list')`

### Step 6: Update `checkForChanges()` Webhook Call
**Location**: Lines 2550-2553
- No change needed — `sendWebhook(whDetails)` already called; the refactored function handles multi-dispatch internally

## Key Design Decisions
- Rate limiting is global (30s), not per-webhook — simpler and prevents burst traffic
- Migration is automatic and transparent — old single-webhook configs are converted on first read
- Webhook IDs reuse `generateId()` but aren't prefixed differently (just stored in a separate array)
- Global toggle saves immediately (like the old per-webhook toggle)
- Per-webhook inline toggles save immediately
- Save button in edit modal handles URL/format/template changes
- Delete uses confirm-on-second-click pattern (same as "Clear All" watches)

## Testing Plan
1. Fresh install — no webhooks → settings shows "None", list shows empty state
2. Migration — save a v1.9.x format webhook via console, reload → migrated to array format
3. Add webhook — click "Add Webhook", fill URL, pick format, save → appears in list
4. Edit webhook — click existing webhook, change label, save → label updated in list
5. Toggle individual — click inline toggle → saves immediately, dot color changes
6. Toggle global off — all webhooks dimmed, settings row shows "Off"
7. Toggle global on — webhooks resume their individual states
8. Delete webhook — click delete, confirm → removed from list
9. Multiple webhooks — add 3 webhooks (Slack, Teams, Generic), enable 2 → settings shows "2 of 3 on"
10. Send Test — works for individual webhook in edit modal
11. Back/Escape navigation — all modal transitions work correctly
12. Existing features — beep, speech, watches still work

## Deviations from Spec
1. Webhook IDs use `wh_` prefix (via `generateId().replace('w_', 'wh_')`) for disambiguation
2. Webhook-list cleanup uses `setTimeout` + `Modal.hasInStack('webhook-list')` guard to avoid conflicts with save/delete pop-push cycles
3. Toggle inline styles extracted to CSS classes (`ar-toggle-track`, `ar-toggle-track-sm`, `ar-toggle-thumb`, `ar-toggle-thumb-sm`) during code quality phase — applies to all toggles, not just webhook ones
4. `WEBHOOK_FORMAT_LABELS` constant re-added for webhook-list row display (had been removed in v1.8.2 code quality pass)

## Status: COMPLETED
**Version**: 2.0.0
**Date**: 2026-04-11
