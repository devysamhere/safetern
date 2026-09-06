# Safetern Build 05.8

Frontend RPC-load hardening.

- No contract record reads while no wallet is connected.
- Dashboard record loading starts only after wallet connection.
- Record enrichment is limited to records related to the connected wallet.
- Disconnect clears records from the visible session.
- Telegram `?presence=<id>` flow reads only the specified covenant after wallet connection and verifies the connected wallet is the owner before enabling `I'M STILL HERE`.
- Added explicit Refresh records action in the wallet menu; no background dashboard polling.
- Wallet-scoped cache keys prevent records from one connected wallet being shown for another.
- No Intelligent Contract change; deployed v0.3.2 address remains unchanged.
