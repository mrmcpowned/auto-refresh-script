---
name: feature-ideation
description: "Brainstorm and generate new feature ideas for the Auto Refresh userscript. USE FOR: generating new ideas, expanding the backlog, creative brainstorming sessions. DO NOT USE FOR: writing full specs (use feature-spec-creation), implementing features (use feature-implementation), or unrelated projects."
argument-hint: "Number of ideas to generate, or a theme/category to focus on"
---

# Feature Ideation Skill

## Purpose

Generate creative, practical feature ideas for the Auto Refresh userscript and append them to the ideas backlog (`feature-specs/feature-ideas.md`). Ideas should range from quick wins to ambitious concepts, covering UX improvements, new capabilities, integrations, and power-user features.

## Workflow

### Phase 1: Context Gathering (MANDATORY)

Before generating any ideas, you MUST:

1. **Read the ENTIRE existing ideas backlog** — `feature-specs/feature-ideas.md` — to understand what ideas already exist. **Do NOT rely on partial reads.** First check the file's total line count (e.g., `Measure-Object -Line` or `wc -l`), then read from line 1 to the end. New ideas must not duplicate or substantially overlap with existing ones.
2. **Programmatically find the highest idea number** — extract all `^\d+\.` lines from the file and compute the maximum number. Do NOT eyeball or assume the last number you read is the highest — the file may have multiple batches with non-sequential numbering.
3. **Read the existing feature specs** — scan `feature-specs/` and `feature-documentation/` for graduated specs. These represent ideas that have already been specced out or implemented.
4. **Understand the current codebase capabilities** — review the architecture section of the auto-refresh-dev skill or the current `auto-refresh.user.js` to know what the userscript already does.

### Phase 2: Idea Generation

#### Quality Criteria

Each idea must:
- **Be distinct** from every existing idea in the backlog — no duplicates, no rewordings of the same concept
- **Be actionable** — specific enough that someone could write a spec from it
- **Include a one-sentence description** explaining what it does and why it's useful
- **Be feasible** within the Tampermonkey/Greasemonkey userscript sandbox (no native OS access, no filesystem, limited to browser APIs + GM_* APIs)

#### Categories to Consider

Draw ideas from a mix of these categories:
- **UX / UI polish** — animations, layouts, visual feedback, accessibility
- **Watch capabilities** — new detection modes, selectors, comparison methods
- **Notification channels** — new ways to alert the user of changes
- **Data management** — export, import, backup, statistics, history
- **Performance & efficiency** — smarter refresh strategies, resource savings
- **Integrations** — external services, APIs, other tools
- **Power user features** — scripting hooks, advanced configuration, automation
- **Accessibility** — screen reader support, keyboard improvements, high-contrast

#### Numbering

- Use the highest number found in Phase 1 step 2 — do NOT guess or assume from a partial read
- Start new ideas from `highest + 1`
- Do NOT renumber existing ideas — numbers are stable references
- Note: some numbers may be skipped (e.g., #25, #53) — this is intentional
- **Verify before appending:** confirm your starting number doesn't collide with any existing entry

### Phase 3: Append to Backlog

- Append new ideas to the end of `feature-specs/feature-ideas.md`
- Follow the existing format: `{number}. **{Title}** — {One-sentence description}.`
- Do not modify or reorder existing ideas
- Do not add section headers or categories — the file is a flat numbered list

### Phase 4: Summary

Report back with:
- How many ideas were added
- The number range (e.g., #91–#110)
- A brief categorized summary of the ideas

## Anti-Patterns

- **Do NOT generate ideas without reading the ENTIRE existing backlog first.** Partial reads lead to duplicate numbering and missed ideas.
- **Do NOT assume the last idea you see is the highest number.** Always compute the max programmatically.
- **Do NOT create overly vague ideas** like "Make it better" or "Improve performance" — be specific about the mechanism.
- **Do NOT suggest ideas that require native OS access** (filesystem, system notifications beyond GM_notification, running external processes).
- **Do NOT suggest ideas that require a backend server** the user would need to host — keep it client-side or use existing third-party APIs.
- **Do NOT modify existing ideas** — only append new ones.
