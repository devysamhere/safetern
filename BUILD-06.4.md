\# Safetern Build 06.4



\## Telegram Guardian Professional UX



Build 06.4 improves the production Safetern Guardian Telegram experience without changing the GenLayer intelligent contract or Safetern's core protocol logic.



\### What Changed



\- Registered native Telegram bot commands using `setMyCommands`.

\- Typing `/` in Telegram now exposes:

&#x20; - `/start` — Open Guardian home

&#x20; - `/status` — View your Safetern records

&#x20; - `/record` — View a specific record by ID

&#x20; - `/help` — Guardian help and commands

\- Added a professional Guardian home screen.

\- Added persistent inline navigation:

&#x20; - `VIEW STATUS`

&#x20; - `OPEN SAFETERN`

&#x20; - `HELP`

\- Added `guardian\_status` callback handling.

\- Added `guardian\_help` callback handling.

\- Added clear `/record` guidance when no record ID is supplied.

\- Preserved `/watch <id>` as a backwards-compatible alias.

\- Added clean handling for unknown slash commands.

\- Improved unpaired-user guidance.

\- Successful wallet pairing now opens directly into the Guardian navigation experience.

\- Guardian help clearly explains its security boundaries.



\## Security Boundaries



Safetern Guardian remains an automation and notification layer, not an authority over protected assets.



Guardian can:



\- Monitor Safetern records.

\- Surface Protect, Watch and Recover events.

\- Submit supported permissionless automation.

\- Alert owners during recovery challenges.

\- Report recovery finalization and beneficiary availability.



Guardian cannot:



\- Impersonate an owner.

\- Sign owner-only presence confirmations.

\- Impersonate a beneficiary.

\- Sign beneficiary-only recovery authorization.

\- Decrypt beneficiary recovery information on behalf of the beneficiary.



Disconnecting Telegram Guardian continues to require the wallet-authorized Safetern website flow.



\## Production Verification



Build 06.4 was deployed to the existing 24/7 Safetern Guardian running on Oracle Cloud and exposed through the production Cloudflare Tunnel.



The following Telegram behaviors were verified live:



1\. Native `/` command menu displays all four Guardian commands.

2\. `/start` displays the connected wallet and Guardian home navigation.

3\. `VIEW STATUS` returns wallet-scoped Safetern records.

4\. `HELP` displays commands, automation behavior and security boundaries.

5\. `/record` without an ID displays correct usage guidance.

6\. `/record 8` returns the requested wallet-authorized Safetern record.

7\. Unknown commands return concise guidance and the Guardian navigation menu.



The existing Build 06.3 status clarity remains preserved:



\- Current protocol lifecycle state is displayed independently.

\- The most recent GenLayer assessment classification is displayed separately.



Example:



`PROTECT · HEALTHY`



`Last assessment: ABANDONED · 96%`



This distinction is important because an owner may successfully confirm presence after an ABANDONED assessment, returning the covenant to HEALTHY while preserving the previous GenLayer assessment result.



\## Infrastructure



Production Guardian:



\- Oracle Cloud Ubuntu VM

\- Node.js 20

\- systemd-managed `safetern-guardian` service

\- Cloudflare Tunnel

\- Public Guardian API: `guardian.safetern.xyz`

\- Production application: `safetern.xyz`

\- Telegram bot: `@SafeternGuardianBot`



The Guardian and Cloudflare Tunnel run independently of the development computer.



\## Contract



No intelligent-contract redeployment was required for Build 06.4.



Current Safetern contract:



`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`



Build 06.4 is a production Guardian UX and interaction-layer improvement on top of the existing Safetern protocol.



\## Build Status



\*\*PRODUCTION VERIFIED\*\*



Safetern Guardian now provides a clearer, more professional Telegram interface while preserving the protocol's owner/beneficiary authorization boundaries and GenLayer-controlled continuity decisions.

