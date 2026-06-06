---
trigger: always_on
description: Enforce AMOLED-first premium design system using UI_UX_README.md and the ui-ux-design-pro-max skill.
---

## ui-ux-design-pro-max

This project strictly implements a premium, AMOLED-first, high-fidelity dark design system using design intelligence from `ui-ux-design-pro-max`.

Rules:
- **Design Alignment:** When building, modifying, or reviewing any UI component or screen, first read the project's [UI_UX_README.md](file:///C:/Antigravity/strongerN/UI_UX_README.md) and [design-system/strongern/MASTER.md](file:///C:/Antigravity/strongerN/design-system/strongern/MASTER.md) to ensure perfect aesthetic synchronization.
- **OLED Black Core:** Backgrounds must strictly use `colors.bg` (`#0D0F14`). Do not introduce light backgrounds, gray blocks, or arbitrary gradients that violate battery efficiency or cause high-glare eye strain.
- **Token Compliance:** Never use hardcoded values for styling. Always reference:
  - `colors` for accents (Electric Blue `#4F8EF7` for primary action, Electric Violet `#7C5CFC` for PRs/milestones).
  - `font` for Inter weights and dynamic scale sizes.
  - `spacing` for the strict mathematically aligned 4pt grid layouts.
  - `radius` for container rounding.
  - `shadow` for elevated depths (such as `shadow.card` or `shadow.accentGlow`).
- **Interactive States:** Every Pressable component must provide rich visual feedback:
  - Android: Configure tap ripples using `ripple.surface`, `ripple.accent`, or `ripple.borderless`.
  - iOS: Implement smooth active opacity scaling or micro-scale transforms.
  - Ensure haptic feedback triggers are integrated for key actions.
- **Aesthetic Primitives:** Use native vectors or unified SVGs (via Lucide/Ionicons). Never use raw native emojis as functional icons.
- **Pre-Delivery Verification:** Before delivering any front-end code, verify each screen against the **UI/UX Pro Max Quality Checklist** located in [UI_UX_README.md](file:///C:/Antigravity/strongerN/UI_UX_README.md#7-uiux-pro-max-quality-checklist).
