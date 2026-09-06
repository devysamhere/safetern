# Safetern Build 04.4

Frontend architecture release. Contract remains v0.3.1 at `0x75f755DaBe665ae136492956F1ca9f16aFad3725`; no redeploy is required.

## Changes
- Home is now an overview dashboard with product counts and recent records only.
- Protect, Watch and Recover are dedicated workspaces with their own record lists and create actions.
- Newly created records remain in the modal on a completion page instead of closing immediately.
- Completion page exposes record id, transaction, monitoring cadence where relevant, and a direct View action.
- Watch wizard step 2 dynamically says Token for crypto Watches.
- Watch Review now includes project activity and the shortened token contract address.
- Recovery Identity wording simplified.
- Existing v0.3.1 contract and crypto/recovery logic are unchanged.
