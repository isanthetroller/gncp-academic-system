---
name: ui-ux-pro-max
description: Professional UI/UX design intelligence skill for crafting bespoke, award-winning, responsive web interfaces, design token architectures, harmonic typography, and clutter-free modern layouts.
---

# UI/UX Pro Max Design Skill

Use this skill whenever designing, building, or refactoring web interfaces, landing pages, dashboards, design systems, or frontend components to achieve state-of-the-art visual excellence, accessibility, and intuitive user experiences.

---

## 🎨 1. The Anti-Slop Design Principles

To ensure designs feel human, artisanal, and premium rather than generic AI templates:

1. **Avoid Cookie-Cutter Card Overload:**
   - Never fill an entire page with identical 3-column rounded boxes containing an icon, title, and 2 lines of text.
   - Use dynamic editorial rhythms: full-width manifesto banners, asymmetrical photo essays, split-screen ledger worksheets, and data-dense interactive catalogs.
2. **Intentional Typographic Contrast:**
   - Pair an expressive editorial serif or bold display typeface (e.g. *Playfair Display*, *Cinzel*, *Newsreader*, *Outfit*) with a crisp geometric sans-serif (e.g. *Plus Jakarta Sans*, *Inter*) and monospace accents (*JetBrains Mono*).
   - Use tight letter-spacing on display headings (`letter-spacing: -0.02em` to `-0.04em`) and proper optical line heights (`1.1` to `1.25`).
3. **Tailored Materiality & Palette:**
   - Avoid flat primary primaries (plain `#0000FF`, `#00FF00`, `#FF0000`).
   - Use curated HSL tokens, warm paper canvases (`#FBF9F5`, `#FAFAF9`), deep spruce/charcoal backgrounds (`#0A241C`, `#18181B`), and muted brass/ochre accents (`#B89240`, `#C5A869`).
   - Use hairline 1px architectural borders (`rgba(0,0,0,0.08)` or `#E8E3DA`) instead of heavy garish drop-shadows.

---

## 📐 2. Design Token Architecture

Always establish comprehensive `:root` CSS custom properties:

```css
:root {
  /* Surface & Backgrounds */
  --bg-canvas: #FBF9F5;
  --bg-surface: #FFFFFF;
  --bg-subtle: #F3EFE6;
  --bg-dark: #0A241C;
  --bg-dark-surface: #103429;

  /* Brand & Accent Hues */
  --primary: #0F4C3A;
  --primary-hover: #093729;
  --primary-light: #E7F1ED;
  --accent: #C89B3C;
  --accent-light: #F9F1DC;

  /* Text & Typography */
  --text-heading: #141C18;
  --text-body: #374151;
  --text-muted: #6B7280;
  --text-inverse: #FFFFFF;

  /* Hairlines & Focus */
  --border-subtle: #E5E7EB;
  --border-focus: #0F4C3A;

  /* Fluid Spacing & Radii */
  --radius-sharp: 4px;
  --radius-md: 10px;
  --radius-lg: 20px;
  --radius-pill: 9999px;

  /* Micro-Interactions */
  --transition-smooth: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## ♿ 3. Accessibility & WCAG Standards

- **Contrast Ratios:** Maintain minimum 4.5:1 for normal text and 3:1 for large text against background surfaces.
- **Focus Indicators:** Ensure prominent, visible `:focus-visible` outlines for keyboard navigability.
- **Touch Target Sizing:** Interactive buttons and links must meet minimum dimensions of `44x44px` or `48x48px` on mobile viewports.
- **Semantic Structure:** Single `<h1>` per page, hierarchical `<h2-h6>`, `<main>`, `<nav>`, `<header>`, `<section>`, and `<article>`.

---

## ⚡ 4. Layout & Interaction Patterns

1. **Editorial Manifesto & Split Heros:**
   - Large typography statements with high-resolution contextual imagery, micro-metadata tags, and dual-action CTAs.
2. **Interactive Prospectus / Data Ledgers:**
   - Accordion-based curriculum inspectors, course unit summaries, and live calculation worksheets.
3. **Tabbed Content Navigation:**
   - High-contrast active tab pills with zero page refresh, instantaneous state updates, and accessible ARIA attributes.
4. **Modal & Drawer Overlays:**
   - Clean backdrop-blur shades (`backdrop-filter: blur(8px)`), smooth entrance transitions, and keyboard Esc/backdrop-click dismissal.
