---
name: feature-spec-refinement
description: "Refine and update existing feature specs through structured discussion. USE FOR: reviewing specs against the current codebase, identifying outdated UX mockups, resolving integration gaps with recently-added features, adding new presets or options, updating payload formats, correcting stale assumptions. DO NOT USE FOR: creating new specs from scratch (use feature-spec-creation), implementing features (use feature-implementation), or unrelated projects."
argument-hint: "Feature spec number or name to refine"
---

# Feature Spec Refinement Skill

## Purpose

Feature specs can become stale as the codebase evolves. New features, UI changes, and architectural shifts create gaps between what a spec describes and what the code actually looks like. This skill defines how to systematically identify and resolve those gaps through discussion, then apply agreed-upon changes to the spec.

## When to Use

- A feature spec references UI elements, settings, or patterns that no longer exist
- A recently-implemented feature creates new integration points or shared data a pending spec should leverage
- The user wants to add options, presets, or payload formats to an existing spec
- A spec's technical notes contradict current codebase patterns

## Workflow

```
Read Spec → Explore Current Codebase → Identify Gaps → Discuss with User → Update Spec
```

## Phase 1: Audit the Spec Against the Codebase

### 1.1 Read the Spec
- Read the full spec from `feature-specs/{NN}-{name}.md`
- Note every reference to: UI layout, settings, storage keys, function names, alert modes, modal interactions, data structures

### 1.2 Explore the Current Codebase
- Search `auto-refresh.user.js` for each referenced function, storage key, and UI element
- Read the relevant sections of the main source file to understand current patterns
- Check `feature-documentation/` for recently-completed features that may affect this spec

### 1.3 Build a Gap List
For each gap found, categorize it:

| Category | Example |
|----------|---------|
| **Stale UX mockup** | Spec shows settings that don't exist or uses wrong labels |
| **Missing integration** | A new feature added data/functions the spec should leverage |
| **Outdated terminology** | Spec uses old names for modes, options, or settings |
| **Missing option/preset** | Spec should include an additional variant (e.g., a new webhook format) |
| **Data availability gap** | Spec assumes data exists that isn't currently captured |

## Phase 2: Discuss Gaps with the User

### 2.1 Present Findings
Present gaps as a numbered list with:
- What the spec says vs. what the code actually does
- Concrete suggestions for how to update
- Questions where the right answer isn't obvious

### 2.2 Discussion Principles
- **One topic at a time** — don't overwhelm with all gaps at once; let the user steer
- **Show the current code** — when discussing interaction flows, reference actual function names and line ranges
- **Propose concrete alternatives** — don't just flag problems; offer specific UX or technical solutions
- **Orthogonal vs. coupled** — when a spec's feature interacts with existing features, clarify whether they're independent settings or part of the same control surface
- **Follow the user's direction** — if they want to keep scope narrow, respect that; if they want to expand, accommodate

### 2.3 Common Discussion Topics

These recur across spec refinements:

- **Interaction flow**: How does the user navigate to the new feature? What's the modal stack path? What does each button do?
- **Discoverability**: How does the user learn about available options (e.g., template tags, format presets)?
- **Conditional UI**: Which parts of the UI should show/hide based on other selections?
- **Data reuse**: Can existing data (e.g., TTS summary text, watch details) feed into the new feature?
- **External service integration**: When adding presets for services (Slack, Discord, Teams, etc.), fetch the service's documentation to get payload formats right
- **Scope boundaries**: Is the new option purely additive, or does it change existing behavior?

## Phase 3: Update the Spec

### 3.1 Apply Agreed Changes
After each round of discussion, apply changes the user has approved:
- Update UX mockups to match the real UI structure
- Add new presets, options, or payload format examples
- Add or update data tables (template variables, behavior matrices, risk assessments)
- Fix terminology to match current codebase (function names, storage keys, mode labels)
- Add integration notes for recently-added features

### 3.2 Spec Section Checklist
When updating, verify each section is still accurate:

- [ ] **Overview / Problem Statement** — still relevant?
- [ ] **User Stories** — any new stories needed for added functionality?
- [ ] **UX Mockups** — match current settings layout, modal names, button labels?
- [ ] **Behavior Table** — covers all presets/options including new ones?
- [ ] **Payload Formats / Data Structures** — includes examples for every variant?
- [ ] **Implementation Notes** — references correct function names, insertion points, storage keys?
- [ ] **Security / Risk Assessment** — accounts for new options (e.g., service-specific rate limits)?

### 3.3 What NOT to Change
- Don't rewrite sections the user hasn't discussed or approved
- Don't change the spec number or file name
- Don't add implementation code beyond illustrative snippets
- Don't remove the spec's original intent or scope — expand, don't replace

## Integration Notes

### Fetching External Documentation
When adding presets for external services (webhooks, APIs, notification platforms):
- Fetch the service's official documentation to verify payload formats
- Note service-specific constraints (message size limits, rate limits, required fields)
- Use the service's recommended payload structure, not a generic approximation

### Cross-Feature Data Reuse
When a recently-implemented feature produces data the spec could consume:
- Identify the exact function or variable that produces the data
- Propose a template variable or config option that surfaces it
- Note whether the data is already captured or requires new work at detection time
