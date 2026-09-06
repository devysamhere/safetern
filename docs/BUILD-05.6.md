# Safetern Build 05.6 — Continuity Guardian

No Intelligent Contract change. Contract remains v0.3.2 at:
`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`

Build 05.6 extends the proven Watch keeper into the full Safetern continuity lifecycle.

## Monitor
- Reads Watch, Protect and Recover records, not only Watch.
- Runs scheduled permissionless GenLayer assessments for active records.
- Preserves pending-assessment de-duplication across all modes.
- Detects CHALLENGE, owner presence confirmation and RECOVERED state transitions.
- When a Protect/Recover challenge expires, the keeper permissionlessly calls `finalize_recovery(record_id)`.
- De-duplicates pending recovery-finalization transactions and retries only after the configured timeout.
- Adds `/records` and `/record/<id>` HTTP endpoints.
- `/health` reports `auto_finalize` and pending finalizations.

## Telegram Guardian
- `/status` covers Watch, Protect and Recover records.
- `/record <id>` gives a detailed continuity status.
- Challenge notifications include `I'M STILL HERE` and `VIEW STATUS` buttons.
- The presence button never signs for the owner. It explains that the owner must open Safetern and approve the owner-only `confirm_presence` transaction with the owner wallet.
- Guardian alerts when a challenge starts, is cancelled, enters automatic finalization, finalizes to RECOVERED, or automation fails.
- For Recover covenants, the RECOVERED alert surfaces the nominated beneficiary wallet and tells the beneficiary that recovery access can now be claimed.

This preserves the security boundary: the automation wallet can assess and finalize permissionlessly, but cannot impersonate the owner or beneficiary.
