You are acting as a senior UI/UX engineer performing a STYLE & LAYOUT CONSISTENCY pass.

TARGET PAGE (the one to be updated): {PAGE_PATH}

GOAL: Make {PAGE_PATH} visually and structurally consistent with the rest of the
project by having it adopt the style, sizing, and layout of whichever existing page is
the closest match in purpose/content — found through your own analysis, not told to you.

WORKFLOW — follow in order, do not skip steps:

STEP 1 — Project-wide analysis
Scan all pages/routes in this project. For each page, note its purpose/content type
(e.g. "list + filter + data table", "record detail view", "create/edit form",
"dashboard with cards", etc.), its layout structure, and its visual style (spacing
scale, typography, color usage, component patterns, sizing conventions).

STEP 2 — Find the best reference match
Compare {PAGE_PATH} against all other pages found in Step 1. Identify the page that is
the CLOSEST match in purpose and content structure (e.g. if {PAGE_PATH} is a
"Supplier" list+form page, the best match is likely another master-data list+form page
like "Customer" or "Product", not an unrelated dashboard or settings page).

Before changing anything, report back:
- Which page you selected as the reference, and why (what makes it the closest match)
- A short list of the concrete style/layout differences between {PAGE_PATH} and the
  reference page (spacing, sizing, typography, component patterns, structure)
- Any case where {PAGE_PATH} has content/elements that genuinely don't exist in the
  reference page (e.g. an extra section, a different number/type of table columns,
  extra form fields) — these will need reasonable adaptation, not forced copying

Wait for my confirmation of the selected reference page before proceeding to Step 3,
unless I've explicitly told you to proceed without confirmation.

STEP 3 — Apply the reference page's style and layout to the target
Update {PAGE_PATH} to match the reference page's:
- Layout structure and section ordering/composition
- Sizing conventions (component widths/heights, container max-widths, breakpoints)
- Spacing scale (padding, margins, gaps between elements/sections)
- Typography scale and usage (heading sizes, body text sizes — not necessarily font
  family if that's a deliberate per-page choice; flag this if unsure)
- Component styling (buttons, inputs, tables, cards, modals) so they look like they
  belong to the same design system
- Responsive behavior pattern (breakpoints and stacking/collapse behavior), consistent
  with how the reference page handles small screens

Where {PAGE_PATH} has elements/data that genuinely differ from the reference page
(different number of table columns, different form fields, an extra section the
reference doesn't have), adapt reasonably rather than forcing an exact 1:1 copy — the
goal is that it LOOKS AND FEELS like it belongs to the same family of pages, not that
every pixel is identical regardless of content differences.

STEP 4 — Verification
After applying changes, summarize:
- What was changed (layout, sizing, spacing, typography, components) and what was
  intentionally adapted rather than copied, with a short reason for each adaptation
- Confirm {PAGE_PATH} still functions correctly (no broken bindings, no lost
  functionality) — this pass should not change any logic/data behavior, only
  presentation
- Any remaining inconsistency you weren't confident enough to resolve automatically,
  flagged for my review
