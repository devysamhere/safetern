# Safetern Build 05.2

Frontend-only modal overflow fix. No contract changes and no redeployment required.

- Keeps the existing fixed, centered wizard modal and fixed action footer.
- Allows only the wizard content area to scroll when a step is taller than the available viewport.
- Removes the wizard page's internal clipping so cards/fields are never truncated behind the footer.
- Keeps background/body scrolling locked while a modal is open.
- Adds a subtle scrollbar only when needed.

Contract remains v0.3.2 at:
`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`
