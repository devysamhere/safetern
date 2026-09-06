# Safetern Build 05.5 — Telegram Guardian

No contract change. No redeployment required.

## Added
- Telegram Guardian transport integrated into the existing monitor/event pipeline.
- Selective alerts only for meaningful events: Watch status changes, material DEX liquidity drops, confirmed exchange-delisting signals, keeper submission failures, and assessment pending timeouts.
- Routine HEALTHY assessments do not generate Telegram spam.
- `/status` shows all monitored Watches.
- `/watch <id>` shows one Watch snapshot.
- `/start` confirms Guardian is connected.
- `npm run guardian:setup` discovers the user's Telegram chat ID after `/start`.
- `npm run guardian:test` sends a safe test message.
- `/health` now exposes `telegram_guardian: true/false`.
- Existing monitor events are marked as historical on first Guardian startup so old alerts are not replayed.

## Security
- Bot token and Telegram chat ID remain only in `monitor/.env`.
- They are never written onchain and never sent to GenLayer prompts.
- The Guardian does not decide continuity or recovery. GenLayer remains the decision layer.
