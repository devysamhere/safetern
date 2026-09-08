\# Safetern Guardian



Safetern Guardian is the 24/7 monitoring, automation, and notification layer for Safetern.



It connects users to meaningful Protect, Watch, and Recover events through Telegram while the \*\*GenLayer Intelligent Contract remains responsible for consensus-critical continuity decisions and authorization rules\*\*.



Guardian does not independently decide whether a system is abandoned, cannot override GenLayer consensus, and cannot impersonate an owner or beneficiary.



\---



\## Production Bot



\*\*Telegram Guardian:\*\*



`@SafeternGuardianBot`



\*\*Safetern:\*\*



https://safetern.xyz



\*\*Guardian API:\*\*



https://guardian.safetern.xyz



Guardian currently runs continuously on an Oracle Cloud Ubuntu server as a systemd-managed service.



The production Guardian is independent of the developer workstation.



\---



\# Wallet Pairing



Users connect Telegram Guardian from the Safetern application.



The connection process uses:



1\. wallet signature authorization

2\. a short-lived one-time pairing token

3\. a Telegram deep link

4\. Telegram confirmation

5\. wallet-to-Telegram connection storage



The authorization signature does not authorize asset transfers or blockchain transactions.



Pairing tokens expire after approximately 10 minutes.



Guardian connections are wallet-scoped.



This means Telegram information and status requests are associated with the wallet that completed the Safetern pairing flow.



Disconnecting Guardian remains a wallet-authorized action through the Safetern website.

### Embedded Demo Pairing

Build 06.5 supports Guardian pairing and disconnect from the Embedded Demo without MetaMask. The demo backend authorizes only the narrowly scoped signing required for the assigned demo wallet; private keys are never sent to the browser.

Production verification confirmed that Guardian connection state and disconnection state persist across page refreshes for the active demo session.



\---



\# Telegram Command Menu



Build 06.5 registers the production Telegram bot commands described below.



Typing `/` in the Guardian chat displays:



`/start` — Open Guardian home



`/status` — View your Safetern records



`/record` — View a specific record by ID



`/help` — Guardian help and commands



The command menu is registered directly with Telegram using the bot command interface.



\---



\# Guardian Home



Running:



`/start`



opens the Guardian home screen.



For a paired user, Guardian displays the connected wallet and provides interactive navigation.



Available buttons:



`VIEW STATUS`



`OPEN SAFETERN`



`HELP`



\### VIEW STATUS



Returns Safetern records associated with the connected wallet.



\### OPEN SAFETERN



Opens the production Safetern application.



\### HELP



Displays Guardian commands, monitoring behavior, and security boundaries.



\---



\# Status



Users can request wallet-scoped status with:



`/status`



or by selecting:



`VIEW STATUS`



Example:



&#x20;   Safetern Guardian · Status



&#x20;   #8 Safetern Guardian Production Test

&#x20;   PROTECT · HEALTHY

&#x20;   Last assessment: ABANDONED · 96%



The current protocol lifecycle state and the most recent GenLayer assessment are deliberately displayed separately.



In the example above:



\- current covenant state: `HEALTHY`

\- last GenLayer assessment: `ABANDONED · 96%`



This can occur when GenLayer assesses the evidence as ABANDONED, the covenant enters CHALLENGE, and the owner subsequently confirms presence.



The owner confirmation returns the covenant to HEALTHY without erasing the previous assessment.



\---



\# Record Lookup



A specific Safetern record can be requested with:



`/record <id>`



Example:



`/record 8`



Guardian returns information such as:



\- record name

\- mode

\- current lifecycle state

\- latest GenLayer assessment

\- owner

\- assessment cadence

\- pending assessment status

\- pending finalization status where applicable



If the user enters:



`/record`



without an ID, Guardian provides usage guidance:



&#x20;   Send /record followed by the Safetern record ID.



&#x20;   Example: /record 8



Record lookup remains wallet-scoped for paired users.



The historical `/watch <id>` command remains supported internally as a backwards-compatible alias, but it is not exposed in the primary Telegram command menu.



\---



\# Help



Users can enter:



`/help`



or select the `HELP` button.



Guardian explains:



\- available commands

\- monitoring behavior

\- Protect, Watch, and Recover alerts

\- owner authorization boundaries

\- beneficiary authorization boundaries



The help interface explicitly reminds users that Guardian cannot sign owner-only or beneficiary-only actions.



\---



\# Unknown Commands



If a paired user enters an unsupported slash command, Guardian does not silently ignore it.



Instead, it explains that the command is not recognized and directs the user to type `/` or use the interactive Guardian buttons.



This keeps the Telegram experience navigable without requiring users to memorize commands.



\---



\# Protect Alerts



Guardian monitors Protect covenants and can report meaningful lifecycle events including:



\- new GenLayer assessment results

\- recovery challenge activation

\- challenge cancellation

\- challenge expiry

\- recovery finalization submission

\- successful recovery finalization

\- automation failures or delays



When a Protect covenant enters CHALLENGE, Guardian can notify the relevant owner.



The challenge notification can include:



`I'M STILL HERE`



and:



`VIEW STATUS`



If the production Safetern URL is configured, `I'M STILL HERE` links directly to the appropriate Safetern owner-presence route.



The owner must still connect the correct owner wallet and authorize the owner-only action.



Guardian cannot perform that authorization.



\---



\# Watch Alerts



Watch is informational only.



\*\*Watch cannot authorize recovery.\*\*



Guardian can monitor Watch signals including:



\- continuity classification changes

\- material DEX liquidity changes

\- exchange delisting signals

\- configured public project evidence

\- assessment submission failures

\- assessments that remain pending beyond the retry window



Exchange delisting signals are only elevated after confirmation on consecutive monitoring checks.



Monitoring signals are evidence, not the final continuity decision.



GenLayer remains responsible for interpreting what the evidence means.



Routine unchanged monitoring does not need to generate unnecessary Telegram alerts.



\---



\# Recover Alerts



Guardian monitors Recover covenants through the continuity lifecycle.



It can report events including:



\- GenLayer assessment changes

\- CHALLENGE activation

\- owner-presence confirmation

\- challenge expiry

\- permissionless recovery finalization

\- RECOVERED state

\- beneficiary recovery availability



Guardian may notify the beneficiary that recovery access has become available.



However, Guardian cannot authorize beneficiary recovery access.



The nominated beneficiary must use the appropriate beneficiary wallet and complete the required Safetern authorization.



Encrypted recovery information is decrypted locally after successful authorization.



Guardian does not receive the plaintext recovery information.



\---



\# Permissionless Automation



Guardian can submit supported permissionless protocol actions such as:



`assess(record\_id)`



and:



`finalize\_recovery(record\_id)`



This allows Safetern continuity processing to continue without requiring the owner to remain online.



Guardian is the normal autonomous keeper, but these actions are not intended to depend exclusively on Guardian.



Owner-specific and beneficiary-specific actions remain wallet-restricted.



\---



\# Security Boundaries



\## Guardian Can



\- monitor Safetern records

\- gather configured public evidence

\- schedule assessments

\- submit supported permissionless actions

\- monitor lifecycle state

\- send Telegram alerts

\- provide owner-presence links

\- report recovery availability



\## Guardian Cannot



\- override GenLayer consensus

\- impersonate an owner

\- sign owner-only transactions

\- confirm owner presence

\- impersonate a beneficiary

\- authorize beneficiary-only recovery

\- decrypt beneficiary recovery information

\- act as a plaintext recovery-secret custodian



These boundaries are deliberate.



Guardian provides autonomous continuity operations without becoming a substitute for wallet authorization.



\---



\# Privacy



Telegram bot tokens, pairing information, chat associations, notification state, and runtime Guardian state remain offchain.



Production secrets are stored in the private monitor environment and are excluded from the public repository.



Files containing runtime pairing and Guardian state are also excluded from Git.



The Intelligent Contract does not store Telegram bot tokens or Telegram chat IDs.



\---



\# Production Infrastructure



The production Telegram Guardian runs through:



`Telegram ↔ Safetern Guardian ↔ GenLayer / Safetern`



Infrastructure includes:



\- Oracle Cloud Ubuntu 24.04

\- Node.js 20

\- systemd-managed Guardian service

\- Cloudflare Tunnel

\- public HTTPS Guardian API

\- Telegram Bot API

\- GenLayer Studionet



The Guardian service is configured to restart automatically and start at boot.



\---



\# Build 06.5 Production Verification



The Build 06.5 Telegram experience was tested directly against the production Guardian.



Verified successfully:



1\. typing `/` displays `/start`, `/status`, `/record`, and `/help`

2\. `/start` displays the Guardian home and connected wallet

3\. `VIEW STATUS` returns wallet-scoped Safetern records

4\. `OPEN SAFETERN` is available from Guardian navigation

5\. `HELP` displays commands and security boundaries

6\. `/record` without an ID returns correct usage guidance

7\. `/record 8` returns the requested authorized record

8\. unsupported slash commands return navigation guidance

9\. interactive Guardian buttons remain available after responses

10\. lifecycle/assessment status clarity remains preserved



The production `safetern-guardian` systemd service remained active after deployment.



No GenLayer Intelligent Contract redeployment was required for Build 06.5.



\---



\# Current Status



\*\*Build:\*\* 06.5



\*\*Telegram Guardian:\*\* Operational



\*\*Wallet pairing:\*\* Operational



\*\*Multi-user connections:\*\* Operational



\*\*Native command menu:\*\* Operational



\*\*Guardian home:\*\* Operational



\*\*Wallet-scoped status:\*\* Operational



\*\*Record lookup:\*\* Operational



\*\*Help interface:\*\* Operational



\*\*Interactive navigation:\*\* Operational



\*\*Protect alerts:\*\* Operational



\*\*Watch alerts:\*\* Operational



\*\*Recover alerts:\*\* Operational



\*\*Owner challenge links:\*\* Operational



\*\*Permissionless automation:\*\* Operational



\*\*Oracle deployment:\*\* Active 24/7



\*\*Cloudflare Guardian API:\*\* Live



\---



\*\*Safetern Guardian — Built to continue.\*\*


