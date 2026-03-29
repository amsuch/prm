---
title: "feat: UI Redesign — Dark Mode, Animations, Visual Polish"
type: feat
status: active
date: 2026-03-29
---

# UI Redesign — Dark Mode, Animations, Visual Polish

## Overview

Comprehensive UI overhaul to transform the PRM app from a flat, utilitarian look to a modern, polished interface inspired by Linear, Things 3, and Notion. Adds dark mode support, spring press animations, shadow hierarchy, and visual depth throughout.

## Problem Frame

The app currently uses `shadow-sm` uniformly on every card, has zero animations despite Reanimated being installed, no dark mode despite NativeWind supporting it, and the overall aesthetic feels generic. The user reports the UI is "still so ugly."

## Requirements Trace

- R1. Dark mode toggle (light / dark / system) accessible from settings, persisted across sessions
- R2. All screens must work correctly in both light and dark mode
- R3. Micro-interactions: spring-based press animations on all interactive cards and buttons
- R4. Visual polish: shadow hierarchy, refined spacing, better card designs
- R5. Tab bar refinement: better visual treatment
- R6. Dashboard visual upgrade with section animations

## Scope Boundaries

- No glass-morphism or blur effects (add `expo-blur` in a future pass — don't want to risk build issues)
- No gradient buttons or gradient borders (keep it clean like Linear, not flashy)
- No structural layout changes — same screens, same routes, same data flow
- No custom fonts — stick with system fonts
- Focus on the dark: prefix approach with NativeWind, not CSS variables (simpler, less risky)

## Context & Research

### Relevant Code and Patterns

- `tailwind.config.js` — needs `darkMode: 'class'` added
- `global.css` — minimal, just three Tailwind directives
- `constants/colors.ts` — has brand (indigo), gray (stone), accent (rose) palettes
- `app/_layout.tsx` — root layout, needs ThemeProvider wrapper
- `app/(app)/(tabs)/_layout.tsx` — tab bar config, needs dark mode colors
- NativeWind v4 already installed — `dark:` prefix works out of the box with `darkMode: 'class'`
- Reanimated v3.16 already installed — `withSpring`, `FadeInDown`, `entering` animations ready

### Institutional Learnings

- Design tokens must use `indigo-600` primary, `stone-*` for grays
- All agents must include design tokens in prompts
- Never hardcode hex in JSX — use NativeWind classes or Colors constants
- useCallback dependency arrays must be correct (prior stale closure bug)

### External References

- NativeWind dark mode: `darkMode: 'class'` + `useColorScheme` from nativewind for toggle
- Reanimated entering animations: `FadeInDown.delay(index * 60).springify()`
- Spring press: `useSharedValue` + `withSpring` for scale on press

## Key Technical Decisions

- **Dark mode approach**: NativeWind `dark:` prefix with `darkMode: 'class'` config. Use `useColorScheme` from nativewind for manual toggle. Persist choice in AsyncStorage. Rationale: simplest approach, works with existing NativeWind setup, no CSS variable complexity.
- **Animation library**: Reanimated v3 (already installed). No new dependencies needed for animations.
- **Shadow hierarchy**: Define programmatic shadow constants in `constants/shadows.ts` using Platform.select. Used via `style` prop, not className. Rationale: React Native shadow props don't map cleanly to Tailwind.
- **Color token strategy**: Keep `Colors` constant for programmatic use. Add dark mode counterparts to `Colors` object. Use `dark:` prefix in className for all NativeWind styling.
- **No new dependencies** beyond possibly `expo-linear-gradient` if needed for the primary button accent.

## Open Questions

### Resolved During Planning

- **How to persist theme?** AsyncStorage (already a dependency) — store "light" | "dark" | "system"
- **How to toggle dark mode programmatically?** `colorScheme.set()` from nativewind
- **Shadow approach?** Programmatic via style prop with Platform.select — NativeWind shadow-sm/md/lg inconsistent across platforms

### Deferred to Implementation

- **Exact dark mode color values**: stone-950 vs stone-900 for backgrounds — test visually during implementation
- **Animation timing**: exact spring config values — tune during implementation

## Implementation Units

- [ ] **Unit 1: Dark Mode Infrastructure**

**Goal:** Set up dark mode toggle, persistence, and theme provider so all subsequent units can use `dark:` classes.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `tailwind.config.js` (add `darkMode: 'class'`)
- Modify: `constants/colors.ts` (add dark mode color mappings)
- Create: `lib/theme.ts` (theme context, persistence, toggle)
- Modify: `app/_layout.tsx` (wrap with theme provider)
- Modify: `app/(app)/(tabs)/_layout.tsx` (dark mode tab bar colors)
- Modify: `app/(app)/(tabs)/settings.tsx` (add theme toggle UI)

**Approach:**
- Add `darkMode: 'class'` to `tailwind.config.js`
- Create `lib/theme.ts` with:
  - `ThemeProvider` component that wraps the app
  - Uses `useColorScheme` from nativewind for `setColorScheme` / `toggleColorScheme`
  - On mount, reads saved preference from AsyncStorage and applies it
  - Exports `useTheme()` hook returning `{ theme, setTheme, toggleTheme }`
- Wrap `app/_layout.tsx` root with `ThemeProvider`
- Update tab bar in `_layout.tsx` to use theme-aware colors
- Add theme toggle section in settings.tsx: three buttons (Light / Dark / System) with active indicator

**Dark mode color mappings:**
| Element | Light | Dark |
|---------|-------|------|
| Screen bg | `bg-stone-50` | `dark:bg-stone-950` |
| Card/surface | `bg-white` | `dark:bg-stone-900` |
| Elevated surface | `bg-white` | `dark:bg-stone-800` |
| Primary text | `text-stone-900` | `dark:text-stone-50` |
| Secondary text | `text-stone-500` | `dark:text-stone-400` |
| Tertiary text | `text-stone-400` | `dark:text-stone-500` |
| Border | `border-stone-200` | `dark:border-stone-800` |
| Subtle border | `border-stone-100` | `dark:border-stone-800` |
| Input bg | `bg-stone-50` | `dark:bg-stone-800` |
| Divider | `bg-stone-100` | `dark:bg-stone-800` |
| Primary button | `bg-indigo-600` | `dark:bg-indigo-500` |
| Primary press | `active:bg-indigo-700` | `dark:active:bg-indigo-400` |
| Card press | `active:bg-stone-50` | `dark:active:bg-stone-800` |

**Patterns to follow:**
- NativeWind `useColorScheme` API for programmatic control
- AsyncStorage for persistence (already used for auth tokens)

**Test scenarios:**
- Happy path: toggle to dark mode in settings, entire app switches to dark colors
- Happy path: toggle to system, follows OS preference
- Happy path: preference persists across app restarts
- Edge case: default to system on first launch

**Verification:**
- All tab screens render correctly in both light and dark mode
- Theme toggle in settings works
- Preference survives app restart

---

- [ ] **Unit 2: AnimatedPressable Component**

**Goal:** Create a reusable spring-animated pressable component that gives tactile feedback on press.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Create: `components/AnimatedPressable.tsx`

**Approach:**
- Create `AnimatedPressable` using Reanimated's `useSharedValue` + `withSpring`
- On press in: scale down to 0.97 with spring config (damping: 15, stiffness: 150)
- On press out: spring back to 1.0
- Forward all PressableProps
- Accept `scaleDown` prop for customization (default 0.97)
- Must support NativeWind `className` prop

**Patterns to follow:**
- Existing component pattern: named export, accepts className
- Reanimated createAnimatedComponent pattern

**Test scenarios:**
- Happy path: pressing the component causes a subtle scale-down animation
- Happy path: releasing springs back to full size
- Edge case: rapid press/release doesn't cause visual glitches

**Verification:**
- Build passes with the new component
- Used as drop-in replacement for Pressable in key components

---

- [ ] **Unit 3: Dark Mode — All Tab Screens**

**Goal:** Add `dark:` class variants to all 6 tab screens so they render correctly in dark mode.

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `app/(app)/(tabs)/index.tsx` (dashboard)
- Modify: `app/(app)/(tabs)/contacts.tsx`
- Modify: `app/(app)/(tabs)/entities.tsx`
- Modify: `app/(app)/(tabs)/ask.tsx`
- Modify: `app/(app)/(tabs)/settings.tsx`
- Modify: `app/(app)/(tabs)/import.tsx`

**Approach:**
- For each screen, add `dark:` variants following the color mapping from Unit 1
- Pattern: every `bg-white` gets `dark:bg-stone-900`, every `bg-stone-50` gets `dark:bg-stone-950`, every `text-stone-900` gets `dark:text-stone-50`, etc.
- Focus on the main structural elements: screen background, cards, text, borders, inputs
- StatusBar should switch style based on theme

**Patterns to follow:**
- Always pair light and dark: `bg-white dark:bg-stone-900`
- Use the color mapping table from Unit 1

**Test scenarios:**
- Happy path: each tab screen looks correct in dark mode
- Happy path: text is readable against dark backgrounds
- Edge case: loading states and empty states also use dark colors

**Verification:**
- All 6 tab screens render without visual issues in dark mode

---

- [ ] **Unit 4: Dark Mode — Shared Components**

**Goal:** Add `dark:` class variants to all shared components in `components/`.

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `components/ContactCard.tsx`
- Modify: `components/SearchBar.tsx`
- Modify: `components/FilterChips.tsx`
- Modify: `components/Avatar.tsx`
- Modify: `components/ChatBubble.tsx`
- Modify: `components/ContactHeader.tsx`
- Modify: `components/ContactForm.tsx`
- Modify: `components/EntityCategoryManager.tsx`
- Modify: `components/AdvancedFilters.tsx`
- Modify: `components/MarkdownText.tsx` (dark mode styles)
- Modify: other components as needed (SuggestedQuestions, DashboardStats, RecentActivity, etc.)

**Approach:**
- Systematically add `dark:` variants to every component
- For the MarkdownText component, add dark mode styles to the StyleSheet (dark text, dark code blocks, etc.) — detect theme via useColorScheme
- Focus on: backgrounds, text colors, borders, input fields, dividers, active states
- Modals need dark backgrounds and dark overlay

**Patterns to follow:**
- Same color mapping as Unit 1
- For programmatic colors in style props, use Colors constants with theme detection

**Test scenarios:**
- Happy path: all shared components render correctly in both modes
- Happy path: ChatBubble markdown renders with dark-appropriate colors
- Happy path: Avatar contrast works in dark mode
- Edge case: modals (AdvancedFilters) have dark overlay and dark content

**Verification:**
- Navigate through all screens in dark mode with no visual anomalies

---

- [ ] **Unit 5: Dark Mode — Sub-route Screens**

**Goal:** Add dark mode to all non-tab screens (contact detail, entity detail, edit forms, import flows).

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `app/(app)/contact/[id].tsx`
- Modify: `app/(app)/contact/[id]/edit.tsx`
- Modify: `app/(app)/contact/new.tsx`
- Modify: `app/(app)/entity/[id].tsx`
- Modify: `app/(app)/entity/[id]/edit.tsx`
- Modify: `app/(app)/entity/new.tsx`
- Modify: `app/(app)/import/*.tsx` (CSV and device import flows)
- Modify: `app/(app)/bulk-link.tsx`
- Modify: `app/sign-in.tsx`

**Approach:**
- Same dark: prefix pattern as tabs
- Contact detail page has many sections — apply systematically
- Edit forms: dark input backgrounds, dark borders
- Sign-in page: dark background treatment

**Patterns to follow:**
- Same color mapping throughout

**Test scenarios:**
- Happy path: contact detail page renders in dark mode
- Happy path: edit forms have readable inputs in dark mode
- Happy path: sign-in page works in dark mode

**Verification:**
- All sub-route screens render without visual issues in dark mode

---

- [ ] **Unit 6: Visual Polish — Animations and Press Feedback**

**Goal:** Add spring press animations to interactive elements and staggered entrance animations to lists.

**Requirements:** R3, R4, R6

**Dependencies:** Unit 2

**Files:**
- Modify: `components/ContactCard.tsx` (use AnimatedPressable)
- Modify: `app/(app)/(tabs)/index.tsx` (section entrance animations)
- Modify: `app/(app)/(tabs)/contacts.tsx` (list item animations)
- Modify: `app/(app)/(tabs)/entities.tsx` (list item animations)
- Modify: `components/DashboardStats.tsx` (stat card animations)
- Modify: `components/RecentActivity.tsx` (staggered list entrance)

**Approach:**
- Replace `Pressable` with `AnimatedPressable` on ContactCard, entity cards, dashboard action buttons
- Add `Animated.View` with `entering={FadeInDown.delay(index * 60).springify()}` to FlatList renderItem wrappers
- Cap stagger delay at index 10 to avoid late-appearing items
- Dashboard sections: wrap each section in `Animated.View` with `entering={FadeInUp.delay(N * 100).springify()}`
- Keep animations subtle — 0.97 scale on press, 400ms entrance durations

**Patterns to follow:**
- Reanimated entering animations: `FadeInDown`, `FadeInUp`, `FadeIn`
- AnimatedPressable from Unit 2

**Test scenarios:**
- Happy path: pressing a contact card produces a subtle spring scale animation
- Happy path: contact list items fade in with staggered delay on first render
- Happy path: dashboard sections animate in sequentially
- Edge case: scrolling quickly through a long list doesn't cause animation issues

**Verification:**
- Interactive elements have visible press feedback
- List items animate in smoothly
- No jank or performance issues

---

- [ ] **Unit 7: Shadow Hierarchy and Card Refinement**

**Goal:** Replace uniform `shadow-sm` with a multi-level shadow system and refine card designs.

**Requirements:** R4

**Dependencies:** Unit 1 (dark mode needs shadow adjustments)

**Files:**
- Create: `constants/shadows.ts` (shadow hierarchy constants)
- Modify: `components/ContactCard.tsx` (better shadow, refined spacing)
- Modify: `components/DashboardStats.tsx` (elevated shadow for stat cards)
- Modify: `components/ChatBubble.tsx` (appropriate shadow level)
- Modify: key screen cards where `shadow-sm` is used

**Approach:**
- Create `constants/shadows.ts` with 5 levels: none, xs, sm, md, lg using Platform.select
- In dark mode, shadows are nearly invisible — use border-based depth instead (1px border-stone-800)
- Replace `shadow-sm` on cards with appropriate level:
  - ContactCard: `Shadows.sm`
  - Dashboard stat cards: `Shadows.md`
  - Chat bubbles: `Shadows.xs`
  - Modals/elevated: `Shadows.lg`
  - FAB button: `Shadows.lg`
- Add subtle `border border-stone-100 dark:border-stone-800` to cards for dark mode depth

**Patterns to follow:**
- Platform.select for cross-platform shadows
- Linear's approach: in dark mode, rely on borders + background layering instead of shadows

**Test scenarios:**
- Happy path: cards have visible but subtle shadow hierarchy in light mode
- Happy path: dark mode cards have border-based depth instead of shadows
- Edge case: shadow renders correctly on web, iOS, and Android

**Verification:**
- Visual hierarchy is clear — elevated elements look elevated
- Dark mode cards are distinguishable from the background

## System-Wide Impact

- **NativeWind config change**: `darkMode: 'class'` affects how all `dark:` classes are processed. Must be set before any dark classes work.
- **Theme provider**: Wraps the entire app at root layout level. All screens inherit theme context.
- **Color constants**: New dark mode mappings in Colors, but backward compatible — existing code still works.
- **Reanimated usage**: First real usage of the already-installed library. No new install needed.
- **Bundle size**: No new dependencies for core work. Minimal impact.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| NativeWind `dark:` classes not applying | Verify `darkMode: 'class'` config is correct; test with `useColorScheme` |
| Reanimated animations causing FlatList jank | Cap stagger delays at 10 items; use `entering` only, not per-frame |
| Dark mode color mismatches (unreadable text) | Systematic review of all screens after implementation |
| Large number of files to modify for dark mode | Parallel agent work on independent screen groups |
| Metro cache issues with config changes | Clear metro cache: `npx expo start --clear` after config changes |

## Sources & References

- NativeWind Dark Mode: `darkMode: 'class'` + `useColorScheme` from nativewind
- Reanimated Entering Animations: `FadeInDown`, `FadeInUp` with `.springify()`
- Design inspiration: Linear (border-based dark depth), Things 3 (spring press), Notion (semantic tokens)
