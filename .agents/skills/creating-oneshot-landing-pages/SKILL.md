---
name: creating-oneshot-landing-pages
description: Generates clean, modern, high-converting, single-page landing pages with rich typography, curated color palettes, Scandinavian minimalism, and responsive component architecture in one go.
---

# Creating One-Shot Landing Pages

Use this skill whenever the user asks to design, build, or scaffold a **landing page**, **single-page showcase**, **product launch page**, or **portfolio page** from a single prompt or concept.

---

## 🎨 Core Design Philosophy & Aesthetic Guidelines

When building a one-shot landing page, adhere strictly to these principles:

1. **Radical Clarity & Minimal Clutter:**
   - Eliminate non-essential fluff. Every word, image, and container must serve a purpose.
   - Emphasize white space, breathable margins, and structured visual hierarchy.
   - Embrace the requested design ethos (e.g. Scandinavian craftsmanship, Neo-brutalist, High-tech Dark Mode, Modern Editorial).

2. **Premium Typography & Harmonious Palettes:**
   - Use Google Fonts pairings (e.g., *Plus Jakarta Sans*, *Outfit*, *Inter*, *Playfair Display*, *Cinzel*).
   - Never use default browser fonts or generic colors.
   - Define tailored CSS custom properties (`:root` tokens for primary, accent, surface, muted, text, and border).

3. **High-Conversion & Engaging Storytelling:**
   - Hook the user with a distinct value proposition in the Hero.
   - Follow a logical sequence: **Hook → Proof → Craftsmanship / Detail → Social Validation → Call to Action**.
   - Ensure interactive micro-animations (hover transitions, tab switchers, accordions, floating badges).

---

## 🏗️ Standard One-Shot Landing Page Section Structure

Every complete landing page should typically incorporate the following sections (customized to the specific theme):

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Sticky Navigation Bar (Logo, Nav Links, Primary CTA)    │
├─────────────────────────────────────────────────────────────┤
│ 2. Hero Section (Pill Tag, Bold Headline, Subtitle, CTAs)   │
├─────────────────────────────────────────────────────────────┤
│ 3. Social Proof / Client Logos / Metric Counter Strip       │
├─────────────────────────────────────────────────────────────┤
│ 4. Core Pillars / Value Propositions (3-Column Bento Grid)  │
├─────────────────────────────────────────────────────────────┤
│ 5. Product / Craftsmanship Spotlight (Deep-dive on details) │
├─────────────────────────────────────────────────────────────┤
│ 6. Interactive Showcase / Image Gallery                     │
├─────────────────────────────────────────────────────────────┤
│ 7. Customer Testimonials / Social Reviews                   │
├─────────────────────────────────────────────────────────────┤
│ 8. FAQ Accordion (Common inquiries answered clearly)        │
├─────────────────────────────────────────────────────────────┤
│ 9. Final High-Impact CTA Banner                             │
├─────────────────────────────────────────────────────────────┤
│ 10. Minimalist Footer (Navigation, Copyright, Socials)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step-by-Step Implementation Workflow

When generating a one-shot landing page:

### Step 1: Establish Design Tokens (`index.css` or `<style>`)
Define complete CSS variables for:
- Typography (`--font-main`, `--font-heading`, `--font-mono`)
- Palette (`--bg-primary`, `--bg-surface`, `--accent`, `--accent-hover`, `--text-primary`, `--text-muted`, `--border-color`)
- Spacing, border-radius, shadows, and smooth transition curves.

### Step 2: Build Semantic HTML Structure
- Use `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`.
- Add unique IDs for smooth-scroll anchor navigation (`#craftsmanship`, `#collection`, `#about`, `#faq`).
- Ensure full mobile responsiveness with flexbox and CSS Grid.

### Step 3: Add Dynamic Micro-Interactions (JavaScript)
- Mobile drawer menu toggle.
- Interactive tab switchers or product spec filters.
- FAQ accordion expand/collapse logic.
- Smooth scroll on anchor clicks.
- Subtle entrance animations on scroll.

### Step 4: Quality & Polish Verification
- Ensure zero broken links or missing assets.
- Verify responsive layout on mobile, tablet, and desktop viewports.
- Check contrast ratios and accessibility standards.
