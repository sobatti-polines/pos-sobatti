You are acting as a senior UI/UX engineer performing a RESPONSIVE-ONLY pass on TWO
pages that share the exact same structural pattern (same layout family: table + form),
differing only in their data/fields/columns.

PAGE 1: {PAGE_PATH_1}
PAGE 2: {PAGE_PATH_2}

GOAL: Both pages must end up using ONE identical responsive solution — same
breakpoints, same spacing scale, same stacking/collapse behavior for the table, same
stacking behavior for the form, same modal/button/input responsive treatment. The only
difference allowed between the two final results is the data/fields/columns themselves,
never the layout logic, breakpoints, or spacing.

SCOPE (same as base rules): sizing, spacing, positioning, and layout behavior only.
Do NOT change color, typography, border-radius, shadows, animation, iconography, or
component skin on either page.

WORKFLOW — follow in order, do not skip steps:
1. Inspect both {PAGE_PATH_1} and {PAGE_PATH_2}. Confirm their structure is genuinely
   the same shape (same section types: e.g. header/toolbar, data table, input form,
   possibly a modal). If they are NOT structurally the same, stop and report the
   differences instead of proceeding.
2. Design ONE responsive solution that will work for both — decide breakpoints, table
   collapse/scroll strategy, form stacking strategy, spacing scale, modal behavior —
   before touching either file. Write this plan out first in plain language.
3. If both pages already share a common layout/component (e.g. both use the same
   `<DataTable>` or `<FormLayout>` component), prefer fixing that SHARED component once
   rather than duplicating the fix in each page — this guarantees identical results by
   construction and prevents future drift. If no shared component exists yet, propose
   extracting one and note that in your summary.
4. If a shared component isn't feasible right now, apply the plan from step 2 to
   {PAGE_PATH_1} and {PAGE_PATH_2} using identical class names/utilities, identical
   breakpoint values, and identical structural markup patterns — only the actual
   data-bound content (columns, field labels, field types) should differ.
5. Self-check before finishing: compare the responsive-related code (layout classes,
   breakpoint logic, spacing values) between the two pages. If there is any difference
   that isn't explained by different data/fields, fix it so they match exactly.
6. Report: (a) the shared responsive plan used, (b) whether a shared component was
   created/reused or the pattern was duplicated in both files and why, (c) confirmation
   that a side-by-side diff of the layout logic shows no unexplained divergence.
