---
name: web-design-critique
description: Automated UI/UX heuristic evaluation and visual audit skill. Identifies visual clutter, weak typographic hierarchy, accessibility gaps, template tropes, and provides concrete polish refactors.
---

# Web Design Critique & Refactor Skill

Use this skill whenever evaluating, auditing, or refactoring an existing web page, application interface, or component to identify UX pain points, visual clutter, and layout dissonance.

---

## 🔍 Heuristic UI/UX Audit Framework

When auditing a page, systematically evaluate the following dimensions:

### 1. Visual Hierarchy & Typographic Rhythm
- **Heading Scannability:** Can a user grasp the core value proposition within 3 seconds of scanning?
- **Scale & Contrast:** Is there a clear optical ratio between `h1` (Display), `h2` (Section), `h3` (Subheading), and body copy?
- **Line Length:** Are paragraph line lengths kept between 45 and 75 characters for optimal reading ergonomics?

### 2. Clutter & Cognitive Load
- **Generic Card Detection:** Are there repetitive rows of identical rounded boxes that create visual noise without adding information?
- **Negative Space:** Is there sufficient whitespace around key interactive elements, or does the layout feel cramped?
- **Content Redundancy:** Are duplicate CTAs or redundant phrases cluttering the interface?

### 3. Polish & Alignment
- **Grid Consistency:** Do elements adhere to an 8px or 12px spatial grid?
- **Micro-Transitions:** Are hover, active, and focus states smooth (`0.2s - 0.3s`) rather than jarring?
- **Edge Sharpness vs. Softness:** Are border-radiuses consistent across the design (e.g. not mixing 32px pill cards with 0px sharp tables randomly)?

### 4. Accessibility & Touch Ergonomics
- **Color Contrast:** Are text elements meeting WCAG AA contrast against their immediate background?
- **Interactive Affordance:** Do clickable elements look clickable with clear cursor states and hover reactions?
- **Form Usability:** Are form inputs properly labeled, placeholder text restrained, and validation messages clearly articulated?

---

## 🛠️ Concrete Refactoring Actions

1. **Condense & Combine:** Merge fragmented, repetitive cards into a cohesive data ledger or interactive multi-tab component.
2. **Elevate Typography:** Replace standard default system fonts with characterful font pairings (e.g. Editorial Serif + Modernist Sans + Monospace metadata).
3. **Harmonize Spacing:** Standardize section padding (e.g., `80px - 100px` top/bottom) and container max-widths (`1140px - 1240px`).
4. **Remove AI Clichés:** Replace generic floating gradient circles and vague icon badges with crisp, high-context, content-rich components.
