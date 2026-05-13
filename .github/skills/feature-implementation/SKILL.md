---
name: feature-implementation
description: "End-to-end feature spec implementation workflow. USE FOR: implementing features from feature-specs/, creating action plans, executing dev loops, updating plans when implementation diverges, moving completed specs to feature-documentation/, creating feature docs. DO NOT USE FOR: bug fixes without a spec, refactors, or unrelated projects."
argument-hint: "Feature spec number or name to implement"
---

# Feature Spec Implementation Skill

## CRITICAL: All Phases Are Mandatory

**Every feature implementation MUST complete ALL 7 phases in order.** Do not skip, defer, or shortcut any phase. The task is NOT complete until Phase 7 (Feature Documentation) is finished.

Use the checklist at the bottom of this skill as your todo list. Mark each item as you complete it. Do not call `task_complete` until every checklist item is done.

## Workflow Overview

This skill defines the full lifecycle for implementing a feature from spec to documentation.

```
Feature Spec → Action Plan → Implementation → Code Quality → Usability → QA → Version Bump → Snapshot → Feature Doc
                                                    ↑            ↑         ↑                                    ↑
                                               DO NOT SKIP  DO NOT SKIP  DO NOT SKIP                      DO NOT SKIP
```

## Phase 1: Planning

### 1.1 Read the Feature Spec
- Read the full spec from `feature-specs/{NN}-{name}.md`
- Identify: scope, user stories, UX design, technical notes, risks
- Note any dependencies on existing code
- **Treat code samples in the spec as illustrative, not prescriptive** — specs may have been written against an older version of the codebase

### 1.2 Explore the Codebase
- Search the main source file for relevant functions, patterns, and insertion points
- Identify which existing utilities/helpers can be reused
- Note exact line numbers for planned insertion points
- **Compare spec code against actual codebase patterns** — the current code is the source of truth for DOM construction, component APIs, data models, styling approach, and event handling
- If the spec's code contradicts current patterns, **follow the current patterns** unless an improvement is clearly warranted
- If improving an existing pattern, note the improvement in the action plan

### 1.3 Create the Action Plan
Save to `action-plans/{feature-name}.md` with this structure:

```markdown
# Implementation Plan: {Feature Title} (Feature #{NN})

## Version Target: X.Y.Z

## Overview
One-paragraph summary of what will be implemented.

## Implementation Steps

### Step 1: {Description}
**Location**: Where in the file (section, line range)
- What to add/change
- Code sketch if non-obvious

### Step 2: {Description}
...

## Key Design Decisions
- List of architectural choices and why

## Testing Plan
1. Numbered test scenarios
2. Expected outcomes for each

## Deviations from Spec
(Initially empty — update during implementation if needed)
```

## Phase 2: Implementation (Dev Loop)

### 2.1 Execute Steps Sequentially
- Follow the action plan step by step
- Run syntax checks (`node -c`) after each significant edit
- Save the file after edits — file tracking syncs changes to Tampermonkey automatically

### 2.2 Track Deviations
If the implementation diverges from the action plan:
- **Update the action plan** immediately with a `## Deviations from Spec` section
- Document: what changed, why, and what the actual implementation looks like
- Example deviations:
  - Different insertion point than planned
  - Additional helper functions needed
  - Spec behavior modified for technical reasons
  - Bug found in existing code that needed fixing first
  - Scope reduced or expanded

### 2.3 Handle Discovered Bugs
If a bug in existing code is discovered during implementation:
- Fix it as part of the same change
- Document the bug and fix in the action plan's deviations section
- Note the fix in the version bump commit message

## Phase 3: Code Quality (MANDATORY — do not skip)

Code quality runs immediately after implementation so that structural issues, dead code, and theme violations are caught before any browser testing. Fixes at this stage avoid wasted usability/QA cycles.

Re-read all changed and new code with fresh eyes. Assess overall quality — look for anything fragile, unclear, or incomplete: resource leaks, unhandled edge cases, race conditions, unnecessary complexity, dead code, security issues (innerHTML with dynamic data), theme compliance (hardcoded colors), or side effects on code paths the change didn't intend to affect. For deeper or broader audits, follow the **code-quality** skill.

Fix all issues found, then run syntax check before proceeding.

## Phase 4: Usability Testing (MANDATORY — do not skip)

Usability runs after code quality so that structural fixes are already in place. It catches interaction bugs that get verified by QA in Phase 5.

### 4.1 Interactive Walkthrough
- Open the feature in the browser and use it as a real user would
- Navigate every path: primary flow, sub-menus, back navigation, edge cases
- Pay attention to:
  - **Navigation consistency**: Do Back buttons work through the full modal stack? Does Escape behave correctly at every level?
  - **Visual indicators**: Are selected/active states clearly shown (checkmarks, highlights)? Are labels and values updated after changes?
  - **Icon/label clarity**: Are similar functions visually distinguishable? Are emojis/icons appropriate and non-duplicated?
  - **Stale state**: After making a change in a sub-view, does the parent view reflect the update when you return?
  - **Keyboard navigation**: Can all interactive elements be reached via arrow keys? Does focus wrap correctly?

### 4.2 Document Findings
- List each usability bug found with a clear description
- Categorize: navigation, visual, labeling, state management
- Fix all issues before proceeding to QA

### 4.3 Re-verify After Fixes
- Run syntax check
- Re-test the specific flows that were fixed
- Check browser console for errors

## Phase 5: QA Testing (MANDATORY — do not skip)

QA is the final correctness gate. It runs after usability fixes so all code changes are verified. Do not version bump until QA passes.

### 5.1 Browser Testing
- Navigate to the test URL
- Test each scenario from the action plan's testing section
- Test for regressions in existing features
- Check browser console for errors

### 5.2 Keyboard Navigation Validation
- Verify every new interactive element is reachable via ArrowDown/ArrowUp
- Verify Enter activates the focused element correctly
- Verify Escape navigates back or dismisses as expected
- **Rule**: All clickable elements inside modals MUST be `<button>` or `<input>` — the keyboard nav system uses `panel.querySelectorAll('button, input')` to find focusable items. A `<div>` or `<span>` with a click listener will be invisible to keyboard navigation.

### 5.3 Record Results
- Note PASS/FAIL for each test scenario
- If bugs found, fix and re-test before proceeding

### 5.3 Capture Screenshots
- Take browser-scoped screenshots of each key UI state
- Save to `feature-documentation/images/` with descriptive kebab-case names
- Use `scripts/capture-browser.ps1` to capture just the browser window (DWM bounds, not full-screen):
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/capture-browser.ps1" "feature-documentation/images/{name}.png"
  ```

## Phase 6: Finalization

### 6.1 Version Bump
- Determine version increment:
  - **Patch** (X.Y.Z+1): Bug fixes, minor tweaks
  - **Minor** (X.Y+1.0): New features, behavioral changes
  - **Major** (X+1.0.0): Breaking changes (rare for userscripts)
- Update both `@version` and `VERSION` constant

### 6.2 Create Snapshot
```powershell
Copy-Item "auto-refresh.user.js" "versions/vX.Y.Z-{feature-name}.user.js" -Force
```

### 6.3 Update Action Plan
Add final status to the action plan:
```markdown
## Status: COMPLETED
**Version**: X.Y.Z
**Date**: YYYY-MM-DD
```

## Phase 7: Feature Documentation (MANDATORY — do not skip)

The task is NOT complete until the spec is moved and enriched. Do not call `task_complete` before this phase.

### 7.1 Create Feature Documentation Folder
If `feature-documentation/` doesn't exist, create it.

### 7.2 Move the Feature Spec
Move the original spec from `feature-specs/` to `feature-documentation/`:
```powershell
Move-Item "feature-specs/{NN}-{name}.md" "feature-documentation/{NN}-{name}.md"
```

### 7.3 Enrich the Feature Doc
Add implementation details to the moved file. Append these sections after the original spec content:

```markdown
---

## Implementation Details

**Version**: X.Y.Z
**Date**: YYYY-MM-DD
**Action Plan**: [action-plans/{feature-name}.md](../action-plans/{feature-name}.md)

### What Was Built
- Summary of actual implementation
- Key functions/components added
- Lines of code added/modified (approximate)

### Deviations from Spec
- List any differences between spec and actual implementation
- Explain why each deviation was made

### Code Location
| Component | Location |
|-----------|----------|
| {function/feature} | Line ~NNN |
| ... | ... |

### Testing Notes
- Summary of QA results
- Any known limitations
- Manual testing required (if MCP can't cover)

### Screenshots
Include browser-scoped screenshots of the implemented feature.
Store images in `feature-documentation/images/` and reference with relative paths.
```

## Mandatory Checklist

**Use this as your todo list.** Every item must be completed before calling `task_complete`.

- [ ] Phase 1: Read feature spec
- [ ] Phase 1: Explore codebase for insertion points
- [ ] Phase 1: Create action plan in `action-plans/`
- [ ] Phase 2: Implement each step from the plan
- [ ] Phase 2: Update action plan if deviations occur
- [ ] Phase 2: Run syntax checks
- [ ] Phase 3: Code quality audit on changed code
- [ ] Phase 3: Fix CRITICAL and IMPORTANT findings
- [ ] Phase 3: Inline style review and extraction
- [ ] Phase 4: Usability walkthrough of all interaction paths
- [ ] Phase 4: Fix all usability bugs found
- [ ] Phase 4: Re-verify fixes (syntax check + browser test)
- [ ] Phase 5: Navigate to test URL and run all test scenarios
- [ ] Phase 5: Keyboard navigation validation (all new elements reachable via arrow keys + Enter)
- [ ] Phase 5: Check browser console for errors
- [ ] Phase 5: Record PASS/FAIL for each test
- [ ] Phase 5: Capture screenshots to `feature-documentation/images/`
- [ ] Phase 6: Version bump (`@version` + `VERSION` constant)
- [ ] Phase 6: Create version snapshot in `versions/`
- [ ] Phase 6: Update action plan with COMPLETED status
- [ ] Phase 7: Move spec from `feature-specs/` to `feature-documentation/`
- [ ] Phase 7: Enrich feature doc with Implementation Details section

**Only after ALL items are checked may you report the task as complete.**
