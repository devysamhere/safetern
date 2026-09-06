# Safetern Build 04.3

Build 04.3 corrects the creation UX and extends Watch for crypto continuity monitoring.

## UI
- Watch, Protect and Recover creation flows are viewport-fixed modal wizards rendered through a React portal.
- Opening a form no longer inserts content below the dashboard.
- The page behind an open wizard is locked from scrolling.
- Each wizard uses Back/Next pages and submits only from the final Review page.
- Existing wallet disconnect and Recovery Identity UX from 04.2 are preserved.

## Crypto Watch
A Watch can now be either PROJECT or CRYPTO_TOKEN. Crypto Watch stores structured monitoring metadata including token symbol, blockchain, contract/mint address, DEX-liquidity tracking, major-exchange delisting tracking, project-activity tracking, and assessment cadence.

Major exchange defaults are Binance, Coinbase, Bybit, OKX and KuCoin. These signals are risk inputs only; they do not automatically classify a project as abandoned.

## Telegram / Guardian readiness
The structured Watch metadata and monitoring interval are stored onchain so a future Safetern Guardian service can discover what to monitor, perform lightweight checks, trigger GenLayer assessments when meaningful changes occur, and send Telegram notifications.

## Contract
Contract version: v0.3.1. This changes create_watch and requires a new deployment before the Build 04.3 Watch creation UI is used.
