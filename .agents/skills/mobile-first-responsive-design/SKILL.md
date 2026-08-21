---
name: mobile-first-responsive-design
description: Mobile-first responsive architecture and touch ergonomics skill. Implements fluid typography clamps, responsive grid/flexbox breakpoints, touch target minimums, and performance optimization.
---

# Mobile-First Responsive Design Skill

Use this skill whenever designing, building, or auditing responsive web layouts across mobile phones, tablets, laptops, and ultra-wide desktop monitors.

---

## 📱 Core Mobile-First Invariants

1. **Fluid Typography with CSS `clamp()`:**
   - Avoid rigid pixel sizes for display headings.
   - Use fluid scaling:
     ```css
     h1.hero-title { font-size: clamp(2rem, 5vw + 1rem, 3.8rem); }
     h2.section-title { font-size: clamp(1.6rem, 3vw + 0.8rem, 2.6rem); }
     ```

2. **Touch Targets & Ergonomics:**
   - Minimum tap target size of `44x44px` (Apple HIG) or `48x48px` (Material Design).
   - Ensure adequate spacing between adjacent buttons (minimum `8px - 12px` gap) to prevent accidental taps.

3. **Responsive Breakpoint Hierarchy:**
   - **Mobile Portrait:** `< 480px` (Single column, stacked navigation, compact padding).
   - **Mobile Landscape / Small Tablet:** `481px - 768px` (2-column grids, collapsible drawer navigation).
   - **Tablet Landscape / Small Laptop:** `769px - 1024px` (Refined multi-column layouts).
   - **Desktop / High-Res:** `> 1025px` (Full editorial layouts, maximum container bounds `1200px - 1280px`).

4. **Zero Horizontal Scroll:**
   - Use `max-width: 100%; box-sizing: border-box; overflow-x: hidden;` on body and containers.
   - Images must have `max-width: 100%; height: auto; display: block;`.

5. **Smooth Off-Canvas Drawers & Modals:**
   - Mobile menus must use accessible off-canvas drawers with visible close buttons and focus traps.
