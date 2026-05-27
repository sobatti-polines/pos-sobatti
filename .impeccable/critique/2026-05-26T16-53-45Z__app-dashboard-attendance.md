---
target: app/dashboard/attendance
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-05-26T16-53-45Z
slug: app-dashboard-attendance
---
#### Design Health Score
> *Consult heuristics-scoring*

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good scanner feedback and countdown timer |
| 2 | Match System / Real World | 4 | Standard check-in paradigms |
| 3 | User Control and Freedom | 3 | Manual refresh and retry options available |
| 4 | Consistency and Standards | 1 | Failed to use the newly extracted semantic tokens (success, warning, destructive) |
| 5 | Error Prevention | 3 | 30s QR rotation prevents spoofing |
| 6 | Recognition Rather Than Recall | 3 | Clear status badges in history |
| 7 | Flexibility and Efficiency | 2 | No pagination on the report table; huge DOM risk |
| 8 | Aesthetic and Minimalist Design | 2 | Generic 3-card metric layouts and pure black scanner background |
| 9 | Error Recovery | 1 | Camera/GPS denial gives a dead-end error without recovery instructions |
| 10 | Help and Documentation | 2 | Minimal helper text on the scan page |
| **Total** | | **24/40** | **Needs Improvement** |

#### Anti-Patterns Verdict

**LLM assessment**: The attendance module falls into a few classic traps. First, the `history` and `report` pages use the standard "Hero Metric" template (three identical cards at the top for stats). Second, the entire module ignores the brand's semantic CSS variables (using raw `emerald-50`, `amber-100`, `bg-black`, and `text-red-500` instead of `--success`, `--warning`, `--destructive`, and `--overlay`).

**Deterministic scan**: The automated detector flagged 4 issues:
- **Pure black background** (`bg-black`) used twice in the `scan/page.tsx` camera container.
- **Side-tab accent border** flagged on `border-l-4` and `border-r-4` in `scan/page.tsx`. *(Note: This is a false positive—it is used to draw the scanner reticle, not for card accents).*

#### Overall Impression
The functional flow is solid and the use of the device camera is well-implemented, but the UI feels disconnected from the rest of the polished "Spatial HUD" dashboard due to hard-coded colors and missing data-table pagination.

#### What's Working
- **Progressive Disclosure in Scanner**: The scanner correctly takes over the UI, and upon success or error, completely replaces the camera view with a clear, focused feedback state.
- **Urgency Visualization**: The QR generation timer pulses red under 10 seconds, immediately communicating state change without needing to read the numbers.

#### Priority Issues

- **[P1] Missing Semantic Tokens**: The attendance pages use raw Tailwind colors (`emerald-100`, `amber-100`, `red-500`) instead of the newly extracted semantic tokens (`bg-success/10`, `text-warning`, `bg-destructive/10`).
  - **Why it matters**: Breaks visual consistency with the rest of the application and defeats the purpose of the dark-mode theme variables.
  - **Fix**: Replace all hardcoded status colors in `history-client.tsx`, `report-client.tsx`, `scan/page.tsx`, and `generate-qr/page.tsx` with semantic tokens.
  - **Suggested command**: `extract` (or `harden`)

- **[P1] Dead-end Permission Errors**: When a user denies camera or GPS access in `scan/page.tsx`, they get a generic error and a "Coba Lagi" button that will just instantly fail again.
  - **Why it matters**: Employees will be unable to check-in and will get stuck in a frustrating loop.
  - **Fix**: Update the error state for permission denials to explicitly tell the user to open browser settings, enable permissions, and refresh the page.
  - **Suggested command**: `clarify`

- **[P2] Unpaginated Data Dump**: The `report-client.tsx` and `history-client.tsx` tables render the entire `filteredData` array at once.
  - **Why it matters**: For a POS running for months, this will attempt to render thousands of DOM nodes, causing severe lag for the Admin/Owner.
  - **Fix**: Implement client-side pagination (like in the Inventory module) capping rows at 10 or 20 per page.
  - **Suggested command**: `optimize`

#### Persona Red Flags

**Jordan (First-Timer / Cashier)**: If Jordan accidentally blocks GPS on the prompt, the scanner fails and the "Try Again" button does nothing to help them fix the browser setting. High panic risk when trying to clock in on time.

**Alex (Power User / Admin)**: Looking at the monthly report for 10 employees across 30 days generates a 300-row table that takes up the entire screen with no pagination, making it tedious to scan.
