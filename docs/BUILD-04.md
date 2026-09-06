# Build 04

## Contract v0.3.0
`assess(record_id)` and `finalize_recovery(record_id)` remain permissionless. The owner is required only to create/update their covenant and to stop a false challenge by calling `confirm_presence(record_id)`.

### Recovery Identity registry
A beneficiary creates a local Recovery Identity once, then registers only the public Recovery Key Code and fingerprint onchain. Future owners can nominate the wallet and fetch its public encryption identity directly. The private decryption key never goes onchain.

### Automation metadata
Every record now has a monitoring interval and last-assessment timestamp in separate maps. This lets a future Safetern Watcher/Guardian service determine which records are due without granting that service recovery authority.

## UI
All create flows are step-by-step fixed-height wizards. Wallet-triggering actions immediately enter a visible busy state. The connected-wallet button opens an account menu with copy/network/disconnect controls.
