---
name: bug-fix
description: "Fix bugs in the Auto Refresh userscript with mandatory validation. USE FOR: fixing reported bugs, UI glitches, logic errors, state issues, navigation problems. DO NOT USE FOR: new features (use feature-implementation skill), refactors (use code-quality skill), unrelated projects."
argument-hint: "Describe the bug to fix"
---

# Bug Fix Skill

## CRITICAL: Every Bug Fix Must Be Validated

**No bug fix is complete until it has been verified in the browser.** Do not call `task_complete` until you have confirmed the fix works by testing it. A code change alone is never sufficient.

## Workflow

### Phase 1: Reproduce & Understand

1. **Understand the bug** — what's the expected behavior vs actual behavior?
2. **Locate the code** — find the relevant function(s) in `auto-refresh.user.js`
3. **Identify root cause** — read enough context to understand why the bug occurs, don't just pattern-match the symptom

### Phase 2: Fix

1. **Make the minimal change** — fix only what's broken, don't refactor adjacent code
2. **Run syntax check** — `node -c "c:\Users\chrodr\code-scratch\auto-refresh.user.js"`
3. If syntax fails, fix and re-check before proceeding

### Phase 2.5: Code Quality Check (before validation)

Re-read the fix with fresh eyes and assess its overall quality. Look for anything that feels fragile, unclear, or incomplete — resource leaks, unhandled edge cases, race conditions, unnecessary complexity, or side effects on code paths the fix didn't intend to change. Fix any issues found before proceeding to validation.

### Phase 3: Validate (MANDATORY — do not skip)

**Every fix must be validated in the browser.** Choose the appropriate method:

#### Option A: MCP Browser (preferred for UI bugs)

1. Navigate to the test page or reload: `https://example.com/` or the test URL
2. Open the settings modal via hotkey: `Alt+Shift+r`
3. Navigate to the affected UI and reproduce the original bug scenario
4. Confirm the bug is fixed
5. Check for regressions in adjacent functionality

**MCP Browser Tips:**
- Hover before clicking Shadow DOM elements (improves reliability)
- Use `snapshot` to verify DOM state after interactions
- Use `screenshot` to capture visual confirmation
- If clicks time out, try hover first, then click with fresh refs
- Keyboard navigation works: Tab, Enter, Escape, arrow keys

#### Option B: Capture Script (for visual-only bugs)

If the MCP browser can't interact with the specific element:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/capture-browser.ps1" "path/to/screenshot.png"
```
Then view the captured image to confirm the fix visually.

#### Option C: Code-Level Verification (last resort)

Only when browser testing is impossible (e.g., the bug is in non-UI logic like webhook dispatch, timer math, or storage migration). In this case:
1. Trace through the code logic manually
2. Verify edge cases are handled
3. **Explicitly state why browser testing wasn't possible**

### Phase 4: Version Bump & Snapshot

1. **Bump the minor version** in both the `@version` header and the `VERSION` constant (e.g., `3.3.0` → `3.3.1`)
2. **Save a snapshot**: `Copy-Item auto-refresh.user.js versions/v{version}-{short-desc}.user.js`

### Phase 5: Report

Confirm to the user:
- What the bug was (root cause)
- What was changed (the fix)
- How it was validated (what you tested and saw)

## Anti-Patterns

- **Never** say "the fix should work" — prove it works
- **Never** skip validation because "it's a simple change" — simple changes break things too
- **Never** validate only with a syntax check — syntax correctness ≠ behavioral correctness
- **Never** fix multiple unrelated bugs in one edit without validating each one

## Checklist

Every bug fix must complete all items:

- [ ] Root cause identified
- [ ] Minimal fix applied
- [ ] Syntax check passes
- [ ] Code quality review
- [ ] Fix validated in browser (or explicit justification for code-only verification)
- [ ] No regressions in adjacent functionality
- [ ] Minor version bumped (`@version` header + `VERSION` constant)
- [ ] Snapshot saved to `versions/`
