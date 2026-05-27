---
target: app/dashboard/attendance
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-05-27T12-32-24Z
slug: app-dashboard-attendance
---
#### Design Health Score
> *Consult heuristics-scoring*

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good loading/status states, but timer pulses jarringly |
| 2 | Match System / Real World | 4 | QR scanning and generation metaphors are standard and clear |
| 3 | User Control and Freedom | 3 | Can retry scan and manually refresh QR |
| 4 | Consistency and Standards | 2 | Fails to match Stripi brand strictly; uses generic Tailwind cards and colors |
| 5 | Error Prevention | 3 | Validates location before scanning |
| 6 | Recognition Rather Than Recall | 4 | Inline instructions and contextual help provided |
| 7 | Flexibility and Efficiency | 3 | QR auto-updates, but no keyboard shortcuts for power users |
| 8 | Aesthetic and Minimalist Design | 2 | Pure black backgrounds, glowing scanner lines, and generic layout |
| 9 | Error Recovery | 3 | Clear error states with retry buttons |
| 10 | Help and Documentation | 3 | Contextual help blurbs present |
| **Total** | | **30/40** | **Moderate** |

#### Anti-Patterns Verdict

**LLM assessment**: The module suffers from generic Tailwind syndrome. It lacks the professional, financial-grade confidence of the Stripi brand defined in the design system. The use of pure black backgrounds, glowing animated lines, generic red/green status boxes, and pulsing red text for the timer all point to standard AI-generated template reflexes rather than a bespoke, high-end product UI.

**Deterministic scan**: The detector found 4 issues across the module:
- `bg-black` flagged twice in `scan/page.tsx`. Pure black is harsh and unnatural for this brand; it should use a tinted deep navy (e.g., `ink` or `brand-dark-900`).
- `border-l-4` and `border-r-4` flagged in `scan/page.tsx`. While intended as viewfinder corners, thick border accents trigger the side-tab anti-pattern detector.

**Visual overlays**: (Browser visualization skipped due to environment constraints, but the deterministic scan confirms the visual anomalies in the code.)

#### Overall Impression
The functional flow is solid—handling camera permissions, geolocation, and QR generation correctly—but the visual execution feels cheap and disconnected from the core brand. The biggest opportunity is to elevate these pages from "generic utility" to "professional tool" by applying the Stripi design tokens and removing jarring animations.

#### What's Working
- **Robust State Management**: The scanner handles the full lifecycle (idle, requesting permissions, scanning, processing, success, error) explicitly.
- **Contextual Help**: The small informational blurbs below the primary actions help set expectations for the users.

#### Priority Issues

- **[P1] Generic Tailwind Aesthetic**
  - **Why it matters**: The pages feel like a generic template rather than the high-end Stripi financial brand. Missing deep navy ink colors, pill buttons, and strict typography.
  - **Fix**: Apply the Stripi design tokens from `DESIGN.md`. Use `card-dashboard-mockup` or `card-feature-light` structures.
  - **Suggested command**: `impeccable polish app/dashboard/attendance/generate-qr/page.tsx`

- **[P2] Scanner Visual "Slop"**
  - **Why it matters**: Pure black (`bg-black`), glowing animated scan lines, and thick border corners trigger "AI-made" reflexes and violate the brand's restraint.
  - **Fix**: Replace pure black with `{colors.ink}` (`#0d253d`). Subdue the scanner corners and remove the glowing shadow from the scan line.
  - **Suggested command**: `impeccable distill app/dashboard/attendance/scan/page.tsx`

- **[P2] Jarring Motion on Timer**
  - **Why it matters**: `animate-pulse` on a red text timer creates anxiety and violates the "motion conveys state, not decoration" rule.
  - **Fix**: Remove the pulse animation. Rely on color change and tabular figures (`font-feature-settings: "tnum"`) to convey urgency calmly.
  - **Suggested command**: `impeccable quieter app/dashboard/attendance/generate-qr/page.tsx`

#### Persona Red Flags

**Alex (Power User)**: No keyboard shortcuts to refresh QR or start scan. Requires mouse interaction for repetitive daily tasks.

**Jordan (First-Timer)**: The scan page immediately throws a generic native browser prompt for location and camera without a softer in-UI explanation first, which can cause anxiety.

#### Minor Observations
- Success/Error states in the scanner use generic `bg-emerald-100` and `bg-red-100` rather than brand-aligned semantic colors.
- The `generate-qr` timer should explicitly use `tabular-nums` or the `tnum` font feature to prevent horizontal jitter as the seconds tick down.

#### Questions to Consider
- Does the scanner UI need to look like a literal camera viewfinder, or could it be a simpler, more abstract window?
- Could the QR generation page feel more like a secure, financial-grade token rather than a basic image container?
