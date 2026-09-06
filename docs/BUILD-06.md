# Safetern Build 06 — Production Hardening + Demo Readiness

## Challenge-window safety

- Real-covenant default changed from 60 seconds to **24 hours** for both Protect and Recover.
- Accelerated **60-second** and **5-minute** choices remain available only under an explicit TEST MODE option group.
- Selecting an accelerated window displays a prominent warning inside the existing wizard.
- Real-covenant presets are now:
  - Standard — 24 hours
  - Extended — 3 days
  - Maximum Safety — 7 days
- Existing onchain records and the deployed v0.3.2 Intelligent Contract are unchanged.
- No contract redeployment is required.
- Existing Safetern visual design/layout is preserved.

This build only hardens covenant creation defaults and presentation. Challenge enforcement remains onchain using the selected `challenge_period_seconds`.
