# Safetern Build 05 — Crypto Monitoring Engine

Contract: **v0.3.2** (deployment required before the new onchain market snapshot feature is active)

## What changed

### GenLayer assessment now checks crypto market continuity directly
For Crypto Token Watches with DEX liquidity enabled, `assess(record_id)` now fetches the DEX Screener token-pairs API using the stored chain + token contract address. It aggregates current USD liquidity across pools and compares it with the previous GenLayer-verified assessment snapshot.

The resulting snapshot is stored onchain and exposed through `get_watch_market_snapshot(record_id)`. Watch remains informational only; market data can never authorize recovery.

### Exchange continuity evidence
For token Watches with exchange monitoring enabled, the Intelligent Contract adds current official delisting/availability evidence from Binance, Bybit, OKX, KuCoin and Coinbase public product endpoints to the GenLayer evidence bundle. A single delisting is explicitly a risk signal, not an abandonment verdict.

### Lightweight Safetern Monitor
`monitor/` is a separate low-cost Node service designed for continuous polling without running GenLayer consensus every few minutes. It:

- reads active Watch configurations from Safetern;
- polls DEX Screener;
- checks major exchange delisting/availability sources;
- persists baselines in `monitor/data/state.json`;
- detects large liquidity drops and new delisting signals;
- marks scheduled assessments when the onchain cadence is due;
- exposes `/health`, `/watches`, `/events`, and `/snapshot/:recordId` for the dashboard and future Telegram Guardian;
- can optionally trigger permissionless `assess(record_id)` using a dedicated keeper wallet.

Telegram Guardian will consume the same event stream later, so monitoring logic is not duplicated.

## Cost model
DEX Screener's public API and the exchange sources used by this prototype require no paid API key. The monitor polls cheaply/offchain and only invokes GenLayer when the scheduled cadence is due or a meaningful signal changes.

## Security
Never put a personal wallet private key into the monitor. If `AUTO_ASSESS=true`, use a dedicated low-value automation/keeper wallet whose only purpose is to call permissionless Safetern functions.

## Current deployment
Build 05 source still references the proven v0.3.1 deployment until v0.3.2 passes lint and is deployed. After deployment, update `web/.env` and `monitor/.env`, then package Build 05.1.
