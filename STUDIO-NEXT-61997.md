# Safetern — Studio Dev / Studio Next 61997 migration

- Network: GenLayer Studio Dev / Studio Next
- Chain ID: 61997
- Canonical RPC: https://studio-dev.genlayer.com/api
- Explorer: https://explorer-studio-dev.genlayer.com
- Contract: `0x50C3c34eB95Cc0a5446d86f4Dc3473C4dAE0D331`
- SDK: `genlayer-js@2.0.0-rc.1`
- Transaction Kit: `@genlayer/transaction-kit@0.1.0-rc.2`

The frontend, embedded demo, and Guardian now use the SDK's `studioDevnet` chain definition. Writes estimate the concrete call with `estimateTransactionFeesForWrite()` and submit the returned distribution/message allocations/fee value.

The contract in `contracts/safetern.py` is the working v0.6-compatible source used for this deployment. The prior Studionet 61999 production deployment is not modified by this package.
