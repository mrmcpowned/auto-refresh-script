---
name: feature-spec-creation
description: "Create detailed feature specs for Auto Refresh from ideas or user descriptions. USE FOR: graduating ideas from feature-ideas.md into full specs, writing new feature specs from scratch, assigning spec numbers, maintaining the ideas backlog. DO NOT USE FOR: implementing features (use feature-implementation skill), bug fixes, or unrelated projects."
argument-hint: "Idea number from feature-ideas.md or a feature description"
---

# Feature Spec Creation Skill

## Workflow Overview

This skill defines how to create a new feature spec for the Auto Refresh userscript, from idea to specced-out document ready for implementation.

```
Idea / Request → Codebase Exploration → Feature Spec → Remove from Ideas Backlog
```

## Phase 1: Idea Intake

### 1.1 Identify the Source

The idea may come from:
- **Feature ideas backlog** (`feature-specs/feature-ideas.md`) — user references an idea by number
- **User description** — user describes a new feature directly
- **Related work** — discovered during implementation of another feature

### 1.2 Determine the Next Spec Number

- List existing specs in `feature-specs/` matching the pattern `{NN}-*.md`
- Also check `feature-documentation/` for graduated specs (those numbers are taken too)
- Assign the next unused number, zero-padded to two digits

## Phase 2: Codebase Exploration

### 2.1 Understand Current State
- Read `auto-refresh.user.js` to understand relevant existing features, UI patterns, and data structures
- Identify which existing modules/systems the new feature would interact with
- Note current architectural patterns (modal system, state management, DOM construction, styling approach)

### 2.2 Identify Constraints
- What existing UI surfaces could host this feature?
- Are there storage/performance implications?
- Does the feature conflict with or depend on other pending specs?

## Phase 3: Write the Feature Spec

### 3.1 File Location
Save to `feature-specs/{NN}-{kebab-case-name}.md`

### 3.2 Spec Structure

Follow this template:

```markdown
# Feature Spec: {Feature Title}

## Overview

One-paragraph summary of what the feature does and why it matters.

---

## Problem Statement

What pain point or gap does this address? Why is the current behavior insufficient?

---

## User Stories

- As a user [doing X], I want [Y] so that [Z].
- (3–5 user stories covering the main use cases)

---

## UX Design

### {Primary UI Surface}

Describe the main UI element or interaction. Include ASCII mockups for modal/panel layouts:

```
┌──────────────────────────────────────────┐
│  UI mockup here                          │
└──────────────────────────────────────────┘
```

### {Secondary UI Surface} (if applicable)

Additional UI elements, settings toggles, indicators, etc.

### Settings Integration

What new settings are exposed? Defaults? Where do they appear in the Settings modal?

---

## Technical Design

### Data Model

Describe new data structures, storage keys, and formats.

### Core Logic

Describe the main algorithm or behavior loop.

### Integration Points

How does this connect to existing systems (refresh cycle, watch system, modal framework, etc.)?

---

## Edge Cases & Error Handling

- List edge cases and how each is handled
- Storage limits, race conditions, invalid input, etc.

---

## Scope & Non-Goals

### In Scope
- Bulleted list of what IS included

### Out of Scope (Future)
- Bulleted list of what is explicitly deferred

---

## Risks & Open Questions

- Numbered list of unresolved design decisions or technical risks
```

### 3.3 Writing Guidelines

- **Be concrete** — include ASCII UI mockups, data structure examples, specific defaults
- **Match existing patterns** — reference actual function names, CSS class conventions, and DOM construction patterns from the current codebase
- **Code samples are illustrative** — note that implementers should follow current codebase patterns, which may differ from spec sketches
- **Keep scope realistic** — a single spec should be implementable in one focused session
- **Call out dependencies** — if the feature depends on another spec being implemented first, say so explicitly

## Phase 4: Backlog Cleanup

### 4.1 Remove Graduated Ideas

**CRITICAL**: If the spec originated from `feature-specs/feature-ideas.md`, remove the idea entry from that file after the spec is created.

- Delete the numbered line for the graduated idea
- Do NOT renumber remaining ideas (numbers are stable references)
- This prevents duplicate work and keeps the backlog clean

### 4.2 Cross-Reference Check

- Verify the new spec number doesn't collide with any existing spec in `feature-specs/` or `feature-documentation/`
- If the idea is closely related to an existing spec, note the relationship in the new spec's overview

## Quick Reference: Existing Spec Numbers

To avoid collisions, always check both directories:
```powershell
Get-ChildItem "feature-specs/*.md", "feature-documentation/*.md" | Where-Object Name -match '^\d' | Sort-Object Name
```
