# Implementation Plan: Theme System & Visual Customization (Feature #15)

## Version Target: 1.7.0

## Overview
Add 4 theme presets (Dark, Light, Minimal, High Contrast) and a badge opacity slider. The T object will be made mutable; `applyTheme()` rebuilds CSS and badge styling. Two new modals (theme-picker, opacity-picker) and two new settings entries.

## Implementation Steps

### Step 1: Add storage keys and theme definitions
**Location**: After existing storage key constants (~line 107)
- Add `STORAGE_KEY_THEME` and `STORAGE_KEY_OPACITY` constants
- Define `THEMES` object with 4 presets, each mapping to T-compatible property values
- Theme keys: `dark`, `light`, `minimal`, `highContrast`

### Step 2: Make T mutable and create applyTheme()
**Location**: After T object and before CSS creation
- Change T from `const` to `let` (or keep const and update properties in-place)
- Create `applyTheme(themeName)` that:
  - Copies theme values into T
  - Rebuilds `_css.textContent` with new T values
  - Re-applies badge inline styles (background, color, shadow, progress bar)
  - Stores theme in GM storage
- Create `applyBadgeOpacity(opacity)` that sets badge opacity and adds hover override
- Extract CSS template to a function `buildCss()` so it can be called again

### Step 3: Extract CSS building into a reusable function
**Location**: Where `_css.textContent` is currently set (~line 192-239)
- Move CSS template into `function buildCss()` that returns the CSS string
- Call `buildCss()` for initial assignment and in `applyTheme()`

### Step 4: Create badge style refresh function
**Location**: Near `applyCorner()` and `applyFontSize()` (~line 415)
- `refreshBadgeTheme()` — updates badge inline styles, progressBar, hoverInfo, watchDot based on current T values
- Called by `applyTheme()` and on initialization

### Step 5: Add theme-picker modal
**Location**: After fontsize-picker modal (~line 746)
- Show 4 theme options with live preview (badge mockup in each theme)
- Current theme gets checkmark
- Selecting a theme calls `applyTheme()`, navigates back to settings, shows toast

### Step 6: Add opacity-picker modal
**Location**: After theme-picker modal
- Range slider 20-100% in 10% steps
- Live preview showing current opacity
- Badge hover overrides opacity to 100%

### Step 7: Add entries to settings modal
**Location**: In settings modal build (~line 1189-1191, Refresh section)
- Add "🎨 Theme" option button after Badge Font Size
- Add "🔲 Badge Opacity" option button after Theme
- Show current theme name and opacity % as values

### Step 8: Call applyTheme and applyBadgeOpacity on init
**Location**: After `applyCorner()` and `applyFontSize()` calls (~line 428)
- Read stored theme and opacity, apply them

## Key Design Decisions
- T object properties are mutated in-place (it's a const object, properties are mutable)
- CSS is rebuilt entirely on theme change (simpler than CSS custom properties, ensures all classes update)
- Badge inline styles require explicit refresh since they're set once at creation
- Minimal theme adds text-shadow for visibility on transparent backgrounds
- Opacity hover override uses mouseenter/mouseleave on badge (already has these listeners)

## Testing Plan
1. Default theme (dark) loads correctly — badge, modals, toasts look unchanged
2. Switch to Light — badge gets white background, dark text; modal backgrounds light
3. Switch to Minimal — badge background transparent, text with shadow
4. Switch to High Contrast — bold borders, bright colors
5. Badge opacity slider — set to 40%, badge becomes translucent; hover → 100%
6. Theme persists across page reload
7. Opacity persists across page reload
8. Existing features (watches, position, font size) unaffected by theme changes

## Deviations from Spec
- `MODE_COLORS` const was replaced with `getModeColor()` function since theme changes would make the cached values stale
- Spec suggested `applyTheme()` store directly per property; implementation uses `Object.assign(T, theme)` to update all T values at once, then rebuilds CSS via `buildCss()`
- CSS was extracted into `buildCss()` function (not in original spec) to enable re-rendering on theme change

## Status: COMPLETED
**Version**: 1.7.0
**Date**: 2026-04-11
