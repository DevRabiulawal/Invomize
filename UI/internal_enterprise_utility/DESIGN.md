---
name: Internal Enterprise Utility
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf4'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dde9ff'
  surface-container-highest: '#d5e3fd'
  on-surface: '#0d1c2f'
  on-surface-variant: '#434655'
  inverse-surface: '#233144'
  inverse-on-surface: '#ebf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0d1c2f'
  surface-variant: '#d5e3fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
---

## Brand & Style

The design system is engineered for **Invomize**, an internal corporate attendance portal. The brand personality is rooted in **Professionalism, Reliability, and Clarity**. It aims to evoke a sense of trust and efficiency, reducing the cognitive load for employees and HR administrators.

The visual style is **Corporate Modern**, drawing inspiration from high-tier SaaS HR platforms. It prioritizes:
- **Exceptional Legibility:** High-contrast text and generous white space to ensure data is easily digestible.
- **Systematic Order:** A strict adherence to grid structures and consistent spacing to reflect corporate stability.
- **Subtle Modernity:** Utilizing refined borders and soft elevation rather than aggressive shadows or loud gradients.
- **Functional Aesthetics:** Every design choice serves the utility of the tool, ensuring that the portal feels like an indispensable workplace asset rather than a distraction.

## Colors

The palette is anchored by a **Deep Indigo-Blue** (Primary), derived from the professional core of the logo, paired with a **Teal** (Secondary) used for accents. 

### Palette Usage
- **Primary Blue:** Used for primary actions, active navigation states, and key brand touchpoints.
- **Slate Gray (#334155):** The standard for body text and headers to maintain high readability without the harshness of pure black.
- **Backgrounds:** A crisp white (#FFFFFF) is used for containers and cards, while a very soft slate tint (#F8FAFC) is used for the page background to create a clear visual distinction between the canvas and the content.
- **Semantic Badges:** 
    - **Success (Green):** Present, On-time, Approved.
    - **Warning (Yellow):** Late, Pending, At-risk.
    - **Error (Red):** Absent, Rejected, Critical.
    These are implemented as subtle, low-saturation badges with dark text to remain professional and accessible.

## Typography

The design system utilizes **Inter** for all roles. It is chosen for its exceptional legibility at small sizes and its neutral, systematic character.

- **Scale:** A modular scale is used to create clear hierarchy. 
- **Headlines:** Use Semi-Bold (600) or Bold (700) weights with slightly tighter letter-spacing for a modern, compact feel.
- **Body Text:** Uses a 14px base for data-dense environments (tables and dashboards), and 16px for general content.
- **Labels:** Small caps and increased letter spacing are used for table headers and section descriptors to differentiate them from interactive data.
- **Optimization:** For mobile views, display and large headline sizes are reduced to prevent awkward line breaks while maintaining the weight hierarchy.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. Content is contained within a max-width of 1280px on desktop to prevent eye-strain, while the navigation and background may extend to the screen edges.

- **Grid:** A 12-column grid is used for dashboard layouts. 
    - **KPI Cards:** Typically span 3 columns (4 per row).
    - **Main Data Tables:** Span 8-12 columns depending on secondary sidebar presence.
- **Rhythm:** A 4px baseline grid ensures vertical consistency. All margins and paddings are multiples of 4 or 8.
- **Mobile Adaptivity:** At the 768px breakpoint, the layout transitions to a single-column stack. Margins shrink from 24px to 16px, and gutters are reduced to maximize usable screen real estate for data tables.

## Elevation & Depth

This design system uses **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows to maintain a clean SaaS aesthetic.

1.  **Level 0 (Base):** The #F8FAFC page background.
2.  **Level 1 (Surface):** White (#FFFFFF) cards and containers. These use a 1px border of #E2E8F0 (Slate 200) to define their boundaries.
3.  **Level 2 (Interaction):** When a card or element is hovered, a very subtle, diffused ambient shadow (8% opacity, Slate tint) is applied to suggest interactivity.
4.  **Level 3 (Overlays):** Modals and dropdowns use a slightly more pronounced shadow and a backdrop blur of 8px to focus the user’s attention on the task at hand.

Avoid using drop shadows on standard UI elements like buttons or input fields; rely on color state changes (hover/active) for feedback.

## Shapes

The design system employs a **Rounded** shape language to soften the corporate environment and make the portal feel modern and accessible.

- **Standard Radius:** 0.5rem (8px) is the default for buttons, input fields, and small cards.
- **Large Radius:** 1rem (16px) is reserved for major dashboard containers and modal windows.
- **Pill Shapes:** Used exclusively for status badges and tags (e.g., "Present", "On Leave") to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid Indigo/Blue background with white text. High-contrast.
- **Secondary:** White background with Indigo/Blue border and text.
- **Ghost:** No border or background until hover; used for tertiary actions like "Cancel".

### KPI Cards
- Large, bold numerical values (Display-lg).
- Subtle trend indicators (tiny green/red arrows) positioned in the bottom corner.
- Consistent 24px internal padding.

### Data Tables
- Header row with a subtle gray background (#F1F5F9) and Label-md typography.
- Thin horizontal dividers (#E2E8F0) only; no vertical lines.
- Hover states for rows to improve tracking across wide screens.

### Input Fields
- Clear labels positioned above the field.
- 1px Slate border that shifts to Primary Blue on focus.
- Error states marked by a red border and a small supporting text string below the field.

### Status Badges
- Soft, light background tints of the status color with high-contrast text. 
- Example: "Late" uses a pale yellow background with a dark amber text color.