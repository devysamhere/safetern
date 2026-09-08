# Safetern Build 06.5

Build 06.5 adds a judge-focused protocol walkthrough without changing the deployed Intelligent Contract or production Guardian behavior.

## What changed

- Added **How it works** to the primary navigation.
- Added a wallet-free architecture walkthrough from public evidence through Guardian, GenLayer consensus, continuity state, owner challenge, permissionless recovery and beneficiary unlock.
- Added a live Guardian health indicator using the existing `/health` endpoint.
- Added clear Protect / Watch / Recover protocol-path explanations.
- Added safe **Demo Owner** and **Demo Beneficiary** role views. These are explanatory identities only: no private keys are embedded and no fake onchain transactions are presented.
- Added a direct option to connect a disposable Studionet test wallet for real onchain testing.
- Added a Live System panel referencing the existing deployed contract and production-tested demo records: Protect #8, Watch #1 and Recover #9.

## Safety boundaries

- No Intelligent Contract changes.
- No contract redeployment.
- No changes to Protect, Watch or Recover transaction logic.
- No changes to recovery cryptography.
- No changes to Telegram Guardian pairing or notification authority.
- No private test-wallet keys are shipped to the browser.
- Telegram alerts remain real for wallets that are actually paired with Guardian.

## Deployed Intelligent Contract

`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`
