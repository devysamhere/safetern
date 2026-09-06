# Safetern Build 05.7

Frontend/Guardian reliability hardening. No Intelligent Contract change.

- Removed React StrictMode double-mount RPC reads in development.
- Deduplicated identical in-flight GenLayer reads.
- Added bounded backoff for transient/rate-limit RPC failures.
- Preserves last-known records in localStorage instead of rendering an empty app during temporary RPC throttling.
- Adds an owner-presence emergency route: `/?presence=<recordId>`. It can submit `confirm_presence` even if the record list cannot currently load.
- Telegram Guardian uses that direct owner-presence link when `SAFETERN_APP_URL` is configured.
- Owner-presence submission reports success after the transaction even if the follow-up read is temporarily unavailable.

Contract remains `0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`.
