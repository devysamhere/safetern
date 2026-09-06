# Build 01 — Intelligent Contract Core

Implemented:

- Generic continuity record storage shared by Protect, Recover and Watch.
- User-supplied HTTP/HTTPS evidence sources (up to five).
- GenLayer `gl.get_webpage()` evidence retrieval.
- LLM assessment through `gl.exec_prompt()`.
- Custom validator re-evaluation using `gl.advanced.run_nondet()`.
- Prompt-injection instructions: fetched evidence is data only.
- Explicit distinction between temporary silence, risk, inconclusive evidence and abandonment.
- Strict protocol invariant: only `ABANDONED` may satisfy recovery conditions.
- Strict protocol invariant: Watch never satisfies recovery conditions.
- Challenge period before recovery.
- Owner presence confirmation to cancel recovery.
- Recovery finalization after challenge expiry.
- Beneficiary-only onchain recovery-access claim for Recover mode.

Next build:

- Deploy/lint contract in the user's existing GenLayer environment.
- Add Safetern `genlayer.js` integration using the proven ProofFlow patterns.
- Build browser-side encryption and encrypted payload storage.
- Bind payload decryption release to beneficiary wallet proof + finalized onchain access claim.
