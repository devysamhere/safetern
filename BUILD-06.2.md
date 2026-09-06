# Safetern Build 06.2

Frontend refinement built directly on Build 06.1.

- Adds the approved Safetern Guardian mascot to the product assets.
- Moves Telegram Guardian out of the wallet dropdown.
- Adds a prominent Guardian control beside the Studionet network indicator.
- Shows Guardian connection state directly in the top bar.
- Uses the mascot prominently inside the Guardian onboarding modal.
- Keeps the existing one-time wallet-authorized Telegram pairing flow unchanged.
- Keeps the Build 06 challenge-period safety changes unchanged.
- No Intelligent Contract redeployment.
- Web version: 0.6.2.

The mascot source is included at `web/src/assets/safetern-guardian-mascot.png` and can also be used as the Telegram bot profile image.
- Preserves the Build 06.1 RPC-throttled monitor startup fix used in the successful 30 req/min Studionet test.
