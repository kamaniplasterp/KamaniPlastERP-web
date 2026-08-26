# Antigravity Prompt — High-Fidelity Clone of Reference ERP

I want you to build a **high-fidelity full clone of the web application at this URL**:

**https://kamani-plastic-industries-erp.ai.studio/**

The reference website is the **PRIMARY SOURCE OF TRUTH** for the UI.

Do NOT redesign it.
Do NOT modernize it.
Do NOT create your own interpretation.
Do NOT substitute different colors, layouts, components, spacing, typography, icons, or navigation.

The goal is to reproduce the reference application's **visual design, layout, interaction patterns, and user experience as accurately as possible**, while using original code and assets that I am authorized to use.

---

## 1. FIRST: STUDY THE REFERENCE

Before implementing the application, thoroughly inspect the reference website.

Analyze every accessible:

* Page
* Route
* Sidebar item
* Navigation item
* Dashboard section
* Table
* Form
* Modal
* Dropdown
* Popup
* Button
* Card
* Chart
* Filter
* Search interface
* Notification interface
* Profile menu
* Settings page
* Empty state
* Loading state
* Error state
* Detail page
* Create/edit page
* Responsive state

Do not start coding after looking at only the homepage.

Build an understanding of the complete application structure first.

---

# 2. VISUAL CLONING REQUIREMENT

Reproduce the reference UI as closely as possible.

Match:

### Colors

Inspect and reproduce the reference application's:

* Primary color
* Secondary color
* Background colors
* Sidebar color
* Header color
* Card colors
* Border colors
* Text colors
* Muted text
* Button colors
* Hover colors
* Active navigation colors
* Success colors
* Warning colors
* Error colors
* Information colors
* Chart colors
* Badge colors

Do NOT arbitrarily choose a new color palette.

Use the reference application's actual visual palette wherever possible.

Create centralized CSS variables/design tokens so the colors remain consistent throughout the application.

Example:

```css
:root {
  --primary: ...;
  --background: ...;
  --sidebar: ...;
  --card: ...;
  --border: ...;
  --text: ...;
  --muted: ...;
}
```

---

# 3. TYPOGRAPHY

Match the reference website's typography as closely as possible.

Inspect:

* Font family
* Font weights
* Heading sizes
* Body sizes
* Table text
* Navigation text
* Button text
* Labels
* Captions
* Line height
* Letter spacing

Do not randomly select typography.

If the exact font is unavailable, choose the closest available equivalent.

---

# 4. LAYOUT

Reproduce the exact layout structure.

Pay particular attention to:

* Sidebar width
* Header height
* Main content width
* Page padding
* Card spacing
* Grid columns
* Table dimensions
* Component spacing
* Border radius
* Shadows
* Alignment
* Vertical spacing
* Horizontal spacing

Do not use generic dashboard spacing.

Measure/estimate spacing from the reference wherever possible.

---

# 5. SIDEBAR

Clone the reference sidebar structure.

Match:

* Width
* Background
* Logo position
* Logo size
* Navigation item height
* Icon size
* Icon positioning
* Text positioning
* Active state
* Hover state
* Expand/collapse behavior
* Section headings
* Bottom profile area

Every navigation item that exists in the reference should exist in the clone.

Navigation should actually work.

---

# 6. HEADER

Reproduce the reference header.

Match:

* Height
* Search
* Breadcrumbs
* Icons
* Notifications
* User profile
* Buttons
* Spacing
* Alignment
* Hover effects

Every visible header interaction should work.

---

# 7. DASHBOARD

Reproduce the dashboard from the reference as closely as possible.

Do not replace its layout with a generic ERP dashboard.

For every dashboard element inspect:

* Position
* Width
* Height
* Typography
* Colors
* Icons
* Borders
* Radius
* Shadows
* Charts
* Tables
* KPI cards
* Filters
* Buttons

Reproduce the same visual hierarchy.

If the reference has 4 cards, use 4 cards.

If it has 6 cards, use 6.

If it has a specific grid arrangement, reproduce that arrangement.

---

# 8. TABLES

Clone the table design exactly.

Match:

* Header height
* Header background
* Column spacing
* Font sizes
* Row height
* Borders
* Hover state
* Pagination
* Search
* Filters
* Action buttons
* Status badges
* Dropdowns

Tables must be functional.

Implement:

* Sorting
* Filtering
* Search
* Pagination
* Row actions
* Add
* Edit
* Delete
* View details

---

# 9. FORMS

For every form in the reference:

Reproduce:

* Field arrangement
* Labels
* Input height
* Input border
* Border radius
* Placeholder style
* Dropdowns
* Date pickers
* Buttons
* Validation
* Error messages
* Modal/page layout

Do not convert a multi-column form into a single-column form.

Preserve the reference structure.

---

# 10. MODALS AND POPUPS

Clone all modal interfaces.

Match:

* Width
* Height
* Overlay
* Header
* Footer
* Buttons
* Close button
* Form spacing
* Typography
* Shadows
* Border radius

Opening and closing must work correctly.

---

# 11. ICONS

Use icons that visually match the reference.

If the exact icon library can be identified and is legally usable, use the same library.

Otherwise use the closest equivalent icon.

Do not replace icons with random emojis.

---

# 12. CHARTS

For every chart in the reference:

Reproduce:

* Chart type
* Position
* Dimensions
* Colors
* Labels
* Legends
* Axes
* Tooltips
* Grid lines
* Data presentation

Charts should be interactive where the reference is interactive.

---

# 13. RESPONSIVE DESIGN

Inspect the reference at different viewport sizes.

Reproduce its responsive behavior for:

### Desktop

1920px
1440px
1280px

### Tablet

1024px
768px

### Mobile

430px
390px
375px

Match:

* Sidebar behavior
* Navigation
* Card stacking
* Table behavior
* Header
* Forms
* Modals
* Charts

Do not simply shrink the desktop layout.

---

# 14. ALL ROUTES MUST WORK

Create a route for every major page accessible from the reference application.

For example:

```text
/login
/dashboard
/...
/...
/...
```

Determine the actual route structure from the reference.

No navigation item should lead to:

* Blank page
* "Coming Soon"
* Placeholder
* Broken route
* Console error

---

# 15. FUNCTIONAL CLONING

This is NOT just a screenshot recreation.

Interactions must work.

Implement:

* Navigation
* Sidebar collapse
* Search
* Filters
* Sorting
* Pagination
* Dropdowns
* Tabs
* Modals
* Forms
* Add
* Edit
* Delete
* View
* Status changes
* Notifications
* Profile menu
* Theme functionality if present
* Date filters
* Chart interactions
* Breadcrumb navigation

If the reference performs an interaction, reproduce that interaction.

---

# 16. DATA

Use realistic mock data matching the type and structure of the reference application.

Do not use:

* Lorem ipsum
* Random placeholder names
* "Test User"
* "Test Product"
* Empty tables

Use realistic plastic manufacturing ERP data.

Currency:

**₹ INR**

Company context:

**Kamani Plastic Industries-style manufacturing ERP**

However, use an original company name/branding in the clone unless I explicitly provide authorization to reproduce the original branding.

---

# 17. COMPONENT ARCHITECTURE

Build reusable components.

Example:

```text
src/
  components/
    Sidebar/
    Header/
    Cards/
    Tables/
    Modals/
    Forms/
    Charts/
    StatusBadge/
    Search/
    Pagination/

  layouts/
  pages/
  routes/
  hooks/
  services/
  data/
  types/
  utils/
  styles/
```

Do not duplicate the same UI code across pages.

---

# 18. TECHNOLOGY

Use:

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui where appropriate
* Lucide React icons
* Recharts or equivalent for charts
* React Router

Use clean TypeScript.

Avoid unnecessary dependencies.

---

# 19. DATA LAYER

Create a mock backend/data service so the application behaves like a real application.

Use structured entities for the data discovered from the reference.

Examples:

```text
users
customers
suppliers
products
orders
inventory
production
machines
quality
invoices
notifications
```

Keep the data layer separate from UI components.

Use localStorage where appropriate so changes persist after refresh.

---

# 20. IMPORTANT: DO NOT INVENT A NEW DESIGN

This is the most important requirement.

If you have to choose between:

**A. Your preferred design**

and

**B. The reference website's design**

ALWAYS choose **B**.

Do not:

* Change the sidebar
* Change the color palette
* Change card shapes
* Change spacing
* Change typography
* Add unnecessary gradients
* Add unnecessary animations
* Add glassmorphism
* Add excessive rounded cards
* Add modern redesign elements
* Rearrange dashboard sections

The reference is the design specification.

---

# 21. PIXEL-ACCURACY

Aim for **pixel-level visual similarity**.

After implementing each page:

1. Compare it with the reference.
2. Identify visual differences.
3. Fix them.
4. Repeat.

Pay special attention to:

* Colors
* Widths
* Heights
* Padding
* Margins
* Font sizes
* Font weights
* Border radius
* Shadows
* Icons
* Alignment
* Table dimensions

---

# 22. SELF-TEST

After implementation, test every page.

Check:

* No console errors
* No TypeScript errors
* No broken imports
* No broken routes
* No missing icons
* No overflowing content
* No broken responsive layout
* No dead buttons
* No fake links
* No unfinished components

Use the browser to actually navigate through the application.

---

# 23. ITERATIVE IMPLEMENTATION

Do NOT stop after creating the dashboard.

Implement in this order:

### Phase 1

Application shell

* Sidebar
* Header
* Routing
* Global styles
* Design tokens

### Phase 2

Dashboard

### Phase 3

All primary navigation pages

### Phase 4

Forms

### Phase 5

Tables

### Phase 6

Modals

### Phase 7

Charts

### Phase 8

CRUD interactions

### Phase 9

Responsive layouts

### Phase 10

Final visual comparison and polishing

---

# 24. FINAL INSTRUCTION

The final application should make a user familiar with the reference website feel that they are using essentially the same application.

Do not give me a generic ERP template.

Do not give me a redesigned version.

Do not simplify the application.

Do not omit pages because they seem unnecessary.

**Clone the complete UI/UX and functionality visible in the reference.**

Start by thoroughly inspecting the reference website, mapping its pages/components/navigation, then implement the clone systematically.
