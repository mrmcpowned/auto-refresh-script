# Copilot Instructions — Auto Refresh Workspace

## Mandatory Skill Routing

Before starting any task on `auto-refresh.user.js`, classify the request and load the corresponding skill. **You must read the skill file before doing any work.**

| Request Type | Skill to Load | Trigger Keywords |
|---|---|---|
| Bug fix, glitch, broken behavior, regression | **bug-fix** | "bug", "fix", "broken", "doesn't work", "issue", "glitch", "regression", "wrong" |
| New feature from a spec | **feature-implementation** | "implement", "feature", "spec #", "add [capability]" |
| Code cleanup, refactor, audit | **code-quality** | "refactor", "cleanup", "audit", "dead code", "extract", "consistency" |
| Feature spec creation | **feature-spec-creation** | "write a spec", "new feature idea", "spec for" |
| Feature spec refinement | **feature-spec-refinement** | "update spec", "refine spec", "review spec" |
| Feature ideation / brainstorming | **feature-ideation** | "generate ideas", "brainstorm", "feature ideas", "more ideas" |
| General dev work, testing, versioning | **auto-refresh-dev** | deployment, snapshots, version bumps, browser testing |

### Enforcement Rules

1. **Never skip a skill.** If the task matches a skill, read and follow that skill's full workflow before writing any code.
2. **Bug fixes require browser validation.** The bug-fix skill mandates Phase 3 (Validate). A syntax check alone is never sufficient. Do not call `task_complete` until the fix is verified in the browser.
3. **Feature implementations require all 7 phases.** Do not skip planning, code quality, usability, QA, version bump, or documentation.
4. **When in doubt, ask.** If the request could be a bug fix or a feature, ask the user before proceeding.
5. **Never call GM_* APIs directly outside service objects.** All `GM_getValue`/`GM_setValue`/`GM_listValues` calls must go through `Config`, `WatchStore`, or `RefreshService` internals. Run `scripts/lint-gm-calls.ps1` after any change that touches storage to verify.
