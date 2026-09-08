# Safetern Build 06.5

Build 06.5 is the current GenLayer Agent Tank hackathon production build for the **Autonomous Protocols** track.

It adds a real, judge-focused embedded demo while preserving the deployed Safetern Intelligent Contract v0.3.2 and the existing continuity architecture.

## Live deployment

- Website: https://safetern.xyz
- Guardian API: https://guardian.safetern.xyz
- Telegram Guardian: `@SafeternGuardianBot`
- Network: GenLayer Studionet
- Intelligent Contract: `0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`
- Contract version: `v0.3.2`
- Deployment transaction: `0x40a1530e5e5a45f41efe64151f3b1ad2be9cce8d7a6a25bcf60c4649e1f60cdf`

No Intelligent Contract redeployment was required for Build 06.5.

## What changed

### Embedded Demo

Build 06.5 provides a production embedded demo that lets reviewers exercise Safetern without MetaMask or their own funded Studionet wallet.

The demo uses:

- five isolated funded Demo Owner/Beneficiary pairs
- exclusive pair allocation per active browser session
- 45-minute sessions
- maximum 12 demo transactions per session
- transaction/IP rate limits
- server-side private keys that are never exposed to the browser
- allowlisted transaction functions only
- narrowly restricted Recovery Identity signing

Demo-created record names are prefixed with `Demo ·`.

The demo is not a fake UI simulation. Supported actions interact with the deployed Safetern Intelligent Contract on GenLayer Studionet.

### Persistent demo sessions

The frontend stores the active demo session token and selected role for the browser session and validates the session against the Guardian API after refresh.

Verified behavior:

- Demo Owner survives refresh
- Demo Beneficiary survives refresh
- Owner/Beneficiary switching works without reconnecting
- active Safetern tab survives refresh
- Guardian connected/disconnected state survives refresh

### Record loading UX

Home, Protect, Watch, and Recover display a subtle loading state while records are being fetched.

Role switching also activates the loading state immediately while the newly selected demo wallet's records are loaded.

### Guardian integration

Embedded Demo wallets can:

- connect Safetern Guardian
- receive Telegram pairing confirmation
- retain Guardian connection state after refresh
- disconnect Guardian
- retain disconnected state after refresh

Guardian remains unable to impersonate an owner or beneficiary or override GenLayer consensus.

### Recovery Identity

The embedded beneficiary can create a Recovery Identity without MetaMask.

Verified production behavior includes:

- Recovery Identity creation
- Recovery Identity persistence
- Owner-side discovery of a registered beneficiary Recovery Identity
- beneficiary visibility of Recover covenants that nominate that wallet

Recovery Identity signing through the embedded demo is narrowly restricted.

## Recommended judge test

Reviewers should create their own records rather than rely only on pre-existing examples.

1. Open https://safetern.xyz and start **Embedded Demo** as Demo Owner.
2. Create a new **Watch** record using public evidence of your choice and verify that it appears and can receive GenLayer assessment information.
3. Create a new **Protect** covenant and verify the resulting onchain record and lifecycle information.
4. Connect **Safetern Guardian** and complete Telegram pairing.
5. Switch to **Demo Beneficiary** and create a **Recovery Identity** if one is not already registered for the assigned beneficiary.
6. Switch back to Demo Owner.
7. Open **Recover**, enter the assigned Demo Beneficiary wallet, and use **Find Recovery Identity**.
8. Create a new Recover covenant using safe test recovery information. Never enter a seed phrase or raw private key.
9. Switch to Demo Beneficiary and verify that the newly created Recover covenant is visible.
10. Refresh Protect, Watch, or Recover and verify that the active demo session, role, tab, records, and Guardian state persist.

Existing production-tested records may also be inspected for examples of GenLayer reasoning and completed lifecycle behavior.

## Production verification

Build 06.5 has been verified in production for:

- embedded demo session creation
- Demo Owner/Beneficiary role switching
- session persistence across refresh
- active-tab persistence
- Protect record display
- Watch record display and GenLayer reasoning
- Recover record display and beneficiary visibility
- Recovery Identity creation and persistence
- beneficiary Recovery Identity discovery
- Telegram Guardian pairing and confirmation
- Guardian connection persistence
- Guardian disconnect and disconnected-state persistence
- loading states on Home, Protect, Watch, and Recover
- loading state during demo role switching

Earlier production lifecycle tests remain valid for:

- autonomous Protect assessment and finalization
- owner-presence veto during CHALLENGE
- permissionless recovery finalization
- encrypted beneficiary recovery
- Watch monitoring
- multi-user Guardian pairing

## Security boundaries

Build 06.5 does not change Safetern's core authority model.

- **GenLayer validators** interpret configured real-world evidence and reach continuity consensus.
- **Intelligent Contract** controls consensus-critical lifecycle state and authorization.
- **Guardian** monitors, gathers evidence, notifies, and submits supported permissionless actions.
- **Owner** retains owner-only presence authority.
- **Beneficiary** retains beneficiary-only recovery authorization.
- **Recovery payloads** are encrypted before storage and decrypted locally after authorization.
- **Watch** remains informational only and cannot authorize recovery.
- Full wallet seed phrases and raw private keys are blocked by the recovery interface.

## Core thesis

> **We're not measuring inactivity. We're determining what the inactivity means.**

Safetern uses GenLayer because continuity is not merely a timer problem. Real-world evidence can be ambiguous. GenLayer determines what that evidence means; deterministic contract safeguards then control what may happen next.

**Safetern — Built to continue.**
