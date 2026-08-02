# Responsive-Only Fix Prompt (Reusable Template)

Copy the block below into your agent (OpenCode / Antigravity / Claude Code / etc.) for **each page**. Just replace `{PAGE_PATH}` with the file or route you're targeting.

---

```
You are acting as a senior UI/UX engineer performing a RESPONSIVE-ONLY pass on a single page.

TARGET: {PAGE_PATH}

SCOPE — READ CAREFULLY:
Your task is strictly limited to responsiveness: sizing, spacing, positioning, and layout
behavior across breakpoints. You must NOT change the visual design language of this page.

Explicitly OUT OF SCOPE (do not touch unless it is the direct cause of a layout break):
- Color palette, gradients, backgrounds
- Typography choices (font family, weight, letter-spacing) — font SIZE may be adjusted
  only if it is causing overflow, wrapping, or unreadable text at a given breakpoint
- Border radius, shadows, animation/motion, iconography, imagery
- Component visual style (buttons, cards, inputs keep their existing look/skin)
- Copy/content text

IN SCOPE — audit and fix all of the following for this page:
1. Overall page/section layout: no horizontal overflow, no clipped content, no elements
   overlapping or colliding at any breakpoint (mobile ~360-390px, small tablet ~768px,
   tablet/laptop ~1024px, desktop ~1440px+).
2. Navigation/header: menu items, logo, and actions must collapse/reflow correctly on
   small screens (hamburger or equivalent pattern) without overlapping.
3. Modals / dialogs / popovers: must never exceed viewport width or height, must be
   scrollable internally when content is tall, must remain centered/anchored correctly,
   and must not get cut off or pushed off-screen on small viewports.
4. Buttons: must not shrink below a comfortable tap target on mobile, must not overflow
   their container, must wrap or stack sensibly in button groups instead of overlapping.
5. Forms and inputs: labels, inputs, selects, textareas, and validation/error messages
   must remain aligned and readable at every width; form rows should stack vertically on
   narrow screens instead of squeezing horizontally; input widths must never overflow
   their parent container.
6. Every structural section on the page (hero, grid/cards, tables, footer, sidebars,
   etc.) must reflow appropriately — grids/columns collapse to fewer columns or stack on
   small screens, tables become scrollable or restructure instead of breaking layout.
7. Spacing/padding/margins should scale down proportionally on smaller screens so
   content never feels cramped or touches the viewport edge, and never feels
   excessively sparse on desktop.
8. Text must never be clipped, truncated unexpectedly, or forced into horizontal
   scroll due to fixed widths.

WORKFLOW:
1. Run `/impeccable audit {PAGE_PATH}` to get a technical + responsive-focused report
   for this page (accessibility, responsive behavior, layout anti-patterns).
2. Run `/impeccable adapt {PAGE_PATH}` to apply layout adaptation across breakpoints,
   respecting the constraints above (no style changes — sizing/positioning only).
3. Run `/impeccable layout {PAGE_PATH}` if the audit flags visual rhythm/alignment
   issues that are structural rather than stylistic.
4. After changes, verify the page at these viewport widths and confirm no overlap,
   no overflow, no clipped text, and all interactive elements remain usable:
   360px, 390px, 768px, 1024px, 1440px, 1920px.
5. Summarize exactly what layout/sizing/positioning changes were made per element or
   section, and confirm no color, typography family, or component skin was altered.

If you find a case where fixing responsiveness truly requires a minor style adjustment
(e.g., a fixed pixel width causing unavoidable overflow), flag it explicitly and explain
why before applying it — do not silently change style.
```

---

---

## Consistency Mode — for pages that share the same structure

Use this instead of (or on top of) the base prompt when you have multiple pages with
identical structure but different data (e.g. a Customer page and a Supplier page that
both have a data table + input form). This prevents the agent from inventing a new
layout solution for every page.

**Step 1 — Fix ONE page first and treat it as the source of truth.**
Run the base prompt above on your best/most representative page only (e.g. the
Customer page). Review it, adjust until you're happy, then commit it before moving on.

**Step 2 — Reuse that pattern on every structurally identical page:**

```
You are acting as a senior UI/UX engineer performing a RESPONSIVE-ONLY pass on a page
that shares the same structure as an already-fixed reference page.

TARGET: {PAGE_PATH}
REFERENCE (already fixed, approved, DO NOT deviate from its pattern): {REFERENCE_PAGE_PATH}

RULE: {REFERENCE_PAGE_PATH} contains the approved responsive solution for this exact
structure (table + form / same layout family). Do NOT invent a new responsive approach,
new breakpoints, new spacing scale, or a different stacking/collapse behavior for
{PAGE_PATH}. Your job is to apply the SAME responsive pattern — same breakpoints, same
class names/utilities, same component structure, same stacking order, same modal/button/
form behavior — to {PAGE_PATH}, adapted only for its different data/columns/fields.

Before writing any code:
1. Read {REFERENCE_PAGE_PATH} and list out, in plain language, the exact responsive
   pattern it uses (breakpoints, how the table collapses/scrolls, how the form stacks,
   spacing scale used, modal behavior).
2. Confirm {PAGE_PATH} has the same structural shape (table + form, same section types).
   If it does NOT match, stop and flag the difference instead of guessing.
3. Apply the same pattern from step 1 to {PAGE_PATH}.

Do not change color, typography, or component skin, per the base rules. Do not "improve"
or restyle the layout pattern from the reference page — replicate it exactly, only
substituting the data/fields/columns specific to this page.
```

**Step 3 — Even better, ask it to refactor instead of replicate:**
Once you have 2-3 pages fixed and consistent, it's worth asking the agent directly:
"These pages share the same table+form structure — extract the responsive table and
form layout into a shared/reusable component so all pages using this pattern inherit
the same responsive behavior automatically." This removes the inconsistency problem at
the root instead of managing it prompt-by-prompt.

### Notes for using this across your whole project
- Run it page-by-page (or route-by-route) rather than on the whole project at once — this keeps the diff reviewable and stops the agent from "fixing" things you didn't ask for.
- If you paired this with Playwright MCP screenshots earlier to identify which pages are broken, feed that list of pages in one by one using this same template.
- If the agent (especially with cheaper/less multimodal models) seems to guess rather than verify, explicitly ask it to describe what it sees in the screenshot at each breakpoint before making changes — this forces it to actually reason about the layout instead of pattern-matching.
