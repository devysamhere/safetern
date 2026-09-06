# Safetern Build 05.4

Monitor reliability hotfix. No Intelligent Contract change and no redeployment required.

- Prevents duplicate keeper assessments while a previous GenLayer assessment is still pending.
- Persists `pending_assessment` with transaction hash, submission time, baseline onchain assessment timestamp, and reasons.
- Clears pending state automatically when `last_assessment_at` advances.
- Allows a controlled retry only after `ASSESSMENT_PENDING_RETRY_SECONDS` (default 7200 / 2 hours).
- `/health` now reports `pending_assessments` and `pending_retry_seconds`.

Important: do not run `npm run once` in a second process while `npm start` is already running.
