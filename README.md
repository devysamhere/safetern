# Safetern Build 05.6

Build 05.6 adds full Protect/Recover lifecycle automation to Telegram Guardian. The keeper now monitors all continuity records, runs due assessments, detects recovery challenges and permissionlessly finalizes expired challenges. Owner presence confirmation remains owner-wallet-only; beneficiary recovery access remains beneficiary-wallet-only. No contract redeployment is required.

Current contract: `0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`

See `docs/BUILD-05.6.md`.

# Safetern Build 05.5

Autonomous continuity for digital systems.

## Deployment
GenLayer Studionet contract v0.3.2:
`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`

Deployment transaction:
`0x40a1530e5e5a45f41efe64151f3b1ad2be9cce8d7a6a25bcf60c4649e1f60cdf`

No contract change from Build 05.4. No redeployment is required.

## Build 05.5
Telegram Guardian is now integrated into the proven Safetern Monitor + Keeper pipeline. It sends selective, event-driven alerts for status changes, material liquidity deterioration, confirmed delisting signals and automation failures, while routine HEALTHY assessments remain silent. It also supports `/status` and `/watch <id>` commands.

See `docs/BUILD-05.5.md` and `docs/TELEGRAM-GUARDIAN.md`.


## Build 05.8
RPC-resilient frontend and direct Telegram owner-presence deep link. No contract redeploy.


## Build 05.9
- Heavy monitoring remains at `POLL_SECONDS=900` by default.
- Adds `STATE_POLL_SECONDS=60` for lightweight Protect/Recover lifecycle checks only.
- Pending GenLayer assessments and active challenges are detected quickly without rescanning all records or external market APIs.
- This allows short test challenge windows to be surfaced to Telegram in time while keeping Studionet RPC load low.
- No contract redeployment required.

## Build 06.1

Build 06.1 adds a Safetern favicon and secure user-facing Telegram Guardian onboarding. See `docs/BUILD-06.1.md`. No Intelligent Contract redeployment is required.
