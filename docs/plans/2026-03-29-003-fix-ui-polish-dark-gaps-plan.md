---
title: "fix: UI Polish — Dark Mode Gaps, Color Drift, Typography, Chat Components"
type: fix
status: active
date: 2026-03-29
---

# Fix UI Polish — Dark Mode Gaps, Color Drift, Typography, Chat Components

## Overview

Despite dark mode infrastructure being in place, the UI still looks rough due to: (1) missing dark: text variants making text invisible, (2) hardcoded gray hex colors instead of stone palette, (3) chat sub-components completely un-themed, (4) flat card hierarchy, (5) bland typography with no size variation.

## Implementation Units

- [ ] **Unit 1: Fix dark mode text gaps across all components**
- [ ] **Unit 2: Fix chat sub-components (components/chat/) — dark mode + color drift**
- [ ] **Unit 3: Replace all hardcoded gray hex colors with stone palette**
- [ ] **Unit 4: Typography and visual hierarchy improvements**
- [ ] **Unit 5: Verify build and deploy**
