# Agent.Raven flagship interface fidelity ledger

Accepted brand reference: `public/brand/agent-raven-flagship.png` (byte-identical to the user-supplied 1536×1024 PNG). Design concept: `docs/design/agent-raven-flagship-interface-concept.png`. Latest verified renders: `docs/screenshots/*-desktop.png`, `*-mobile.png`, and `overview-light-*`. Browser/IAB was used first; Playwright Chromium was used for the concept-native 1440×1000 viewport and mobile emulation because the in-app browser does not expose viewport controls.

| Comparison point | Concept/reference evidence | Render evidence | Result |
|---|---|---|---|
| Flagship mark | Supplied raven is brushed silver on the left/body and deep violet on the right wing | Source and public asset SHA-256 both equal `bdc51fdc4cb9cee8ed8a82fffbb35c4221ac2c3eb5700c4923e3494d1d04a8c4`; desktop sidebar and sign-in use that exact file | Exact asset match |
| Dark palette | True black field, silver/chrome surfaces, violet trim; no additional hues | Overview render uses black canvas, grayscale text/surfaces, and violet selection/status only | Match |
| Light palette | User requested white, purple, and black | Light overview has true white canvas/sidebar, black type, neutral silver, and violet trim only | Match |
| Navigation and shell | Fixed left rail, prominent raven/wordmark, purple selected row, compact organization controls | Desktop render preserves exact navigation labels, active state, organization, role, and theme switch | Match |
| Chrome material | Concept uses brushed-silver section rails and buttons | Render uses directional multi-stop neutral chrome on section headers and actions with restrained violet edge light | Match |
| Workflow hierarchy | Discovery sequence, System status, and Discovery record are the three primary regions | Render preserves all three at 1440×1000 with actual database counts and connection state | Match |
| Real state boundary | No fake analytics or invented metrics | Runtime shows real PostgreSQL totals, real Apollo disconnected state, and only functional Phase 1 actions | Match |
| Tables and inner controls | Dark rows, chrome headers/actions, violet selection and focus | Prospect render uses violet selected row/status, grayscale table chrome, and chrome Save changes action | Match |
| Mobile continuation | Compact utility header and persistent essential navigation | Pixel 7 render stacks filters and detail panel and exposes Overview, Find Businesses, Prospects, Integrations, and Settings in the bottom rail | Match |
| Theme interaction | Visible dark/light mode control | Automated test switches to light, reloads, and verifies persisted `data-theme="light"` | Pass |
| Typography | Large metallic page title with compact operational text | Overview render matches the scale contrast and avoids default-looking button/table type | Match |

## Intentional deviations

- The generated concept approximated the raven. Production deliberately uses the original user-supplied artwork unchanged.
- Concept-only record tabs and empty-state actions were not added because they would imply product surfaces not implemented in Phase 1. The real database counts remain the source of truth.
- The production layout is slightly more compact vertically than the concept so the complete real workflow fits at 1440×1000 without reducing type legibility.
- Existing visible copy changed only from “Phase 1 setup & workflow” to “Discovery sequence” to align the product language with the accepted concept. No claims, fake metrics, or decorative marketing copy were added.

Agency sign-off: the implemented dark and light systems are faithful to the supplied brand material language and the accepted concept while preserving real app behavior and honest data states.
