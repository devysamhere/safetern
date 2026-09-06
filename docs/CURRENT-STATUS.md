\# Safetern — Current Project Status



\*\*Current Build:\*\* 06.3  

\*\*Network:\*\* GenLayer Studionet  

\*\*Status:\*\* Production hackathon build operational  

\*\*Track:\*\* Autonomous Protocols



\## Live Infrastructure



\- Website: https://safetern.xyz

\- Guardian API: https://guardian.safetern.xyz

\- Telegram Guardian: @SafeternGuardianBot

\- GitHub: https://github.com/devysamhere/safetern



\## Intelligent Contract



\*\*Version:\*\* v0.3.2



\*\*Contract:\*\*



`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`



\*\*Deployment transaction:\*\*



`0x40a1530e5e5a45f41efe64151f3b1ad2be9cce8d7a6a25bcf60c4649e1f60cdf`



Build 06.3 does not require an Intelligent Contract redeployment.



\---



\## Current Capabilities



\### Protect



Operational.



Protect creates continuity covenants whose configured public evidence can be evaluated through GenLayer.



The lifecycle supports:



`HEALTHY → assessment → CHALLENGE → RECOVERED`



During CHALLENGE, the owner can confirm presence and return the covenant to HEALTHY.



If the challenge expires, recovery finalization is permissionless.



The owner therefore has a veto while present without becoming a required participant in eventual recovery.



\### Watch



Operational.



Watch monitors public evidence and can incorporate signals including project activity, DEX liquidity, and confirmed exchange-delisting evidence.



Watch is informational only.



\*\*Watch cannot authorize recovery.\*\*



Monitoring gathers evidence; GenLayer determines what that evidence means.



\### Recover



Operational.



Recover combines the continuity lifecycle with encrypted beneficiary recovery information.



Recovery information is encrypted before storage and is decrypted locally after the nominated beneficiary successfully authorizes access.



The interface intentionally blocks full wallet seed phrases and raw private keys.



\---



\## Safetern Guardian



Safetern Guardian is operational 24/7.



It currently runs on an Oracle Cloud Ubuntu VM as a systemd-managed service.



Guardian handles:



\- continuous monitoring

\- scheduled assessment detection

\- permissionless assessment submission

\- pending assessment monitoring

\- challenge detection

\- Telegram notifications

\- owner-presence deep links

\- challenge expiry detection

\- permissionless recovery finalization

\- beneficiary availability notifications



Guardian cannot perform owner-only or beneficiary-only authorization.



\---



\## Telegram Guardian



Telegram Guardian is operational at:



`@SafeternGuardianBot`



Users can securely pair a wallet through the Safetern application.



Pairing uses:



1\. wallet signature authorization

2\. short-lived one-time Telegram pairing token

3\. Telegram confirmation



Guardian connections are wallet-scoped.



Supported commands include:



`/status`



`/record <id>`



Current status reporting deliberately separates contract state from the most recent GenLayer assessment.



Example:



&#x20;   #8 Safetern Guardian Production Test

&#x20;   PROTECT · HEALTHY

&#x20;   Last assessment: ABANDONED · 96%



This avoids presenting an old assessment as though it were the current lifecycle state.



\---



\## Production Guardian Infrastructure



The production Guardian is independent of the developer workstation.



Infrastructure currently includes:



\- Oracle Cloud Ubuntu 24.04 VM

\- Node.js 20

\- systemd-managed Safetern Guardian

\- systemd-managed Cloudflare Tunnel

\- public HTTPS Guardian API

\- production Telegram integration



Public Guardian endpoint:



https://guardian.safetern.xyz



The production Guardian and Cloudflare Tunnel have both been verified as active after disconnecting the development PC from the server session.



\---



\## Proven End-to-End Tests



\### Protect Autonomous Finalization



Successfully demonstrated:



`Monitoring → GenLayer assessment → ABANDONED → CHALLENGE → expiry → permissionless finalization → RECOVERED`



\### Owner Presence Veto



Successfully demonstrated in production:



`Monitoring → GenLayer assessment → CHALLENGE → Telegram alert → Safetern deep link → owner wallet confirmation → HEALTHY`



This proves Guardian cannot impersonate the owner.



\### Encrypted Beneficiary Recovery



Successfully demonstrated:



`Encrypted payload → continuity assessment → CHALLENGE → permissionless finalization → RECOVERED → beneficiary authorization → local decryption`



The correct test recovery information was successfully decrypted for the nominated beneficiary.



\### Watch



Successfully tested against UNI on Ethereum using public project evidence and live DEX liquidity monitoring.



Watch remained informational and did not gain recovery authority.



\### Guardian Multi-User Pairing



Successfully tested with a separate wallet.



The user:



1\. connected the wallet to Safetern

2\. initiated Guardian pairing

3\. signed the account-linking message

4\. opened the generated Telegram deep link

5\. started Safetern Guardian

6\. received successful wallet pairing confirmation

7\. retrieved wallet-scoped `/status`



\---



\## Security Boundaries



\### GenLayer



Determines continuity assessments from configured evidence through validator consensus.



\### Intelligent Contract



Controls consensus-critical lifecycle state and authorization.



\### Guardian



Observes, notifies, schedules, and submits permissionless actions.



Guardian cannot override consensus.



\### Owner



Only the owner wallet can confirm owner presence.



\### Beneficiary



Only the nominated beneficiary wallet can authorize recovery access.



\### Recovery Payload



Encrypted before storage and decrypted locally after authorization.



\---



\## Challenge Periods



Production-oriented options currently include:



\- Standard — 24 hours

\- Extended — 3 days

\- Maximum Safety — 7 days



Accelerated 60-second and 5-minute options exist for testing/demo purposes and are clearly marked as TEST ONLY in the application.



\---



\## Monitoring Resilience



Guardian uses throttled GenLayer RPC reads.



Heavy evidence monitoring runs separately from faster lightweight lifecycle polling.



This allows pending assessments and active challenges to be detected quickly without repeatedly performing full evidence scans.



\---



\## Known Issue — MetaMask Domain Warning



At the time of Build 06.3, MetaMask may display a malicious-site/security warning for:



https://safetern.xyz



A false-positive report/review has been submitted through the appropriate MetaMask security-reporting process.



Safetern does not instruct users to disable MetaMask security protections.



Reviewers should independently verify the domain, public repository, deployed contract address, and wallet requests before approving transactions or signatures.



See:



`docs/METAMASK-WARNING.md`



\---



\## Current Production Checklist



\- Protect: \*\*Operational\*\*

\- Watch: \*\*Operational\*\*

\- Recover: \*\*Operational\*\*

\- GenLayer assessment: \*\*Operational\*\*

\- Challenge lifecycle: \*\*Operational\*\*

\- Owner veto: \*\*Proven\*\*

\- Permissionless finalization: \*\*Proven\*\*

\- Encrypted beneficiary recovery: \*\*Proven\*\*

\- Recovery Identity: \*\*Operational\*\*

\- Guardian monitoring: \*\*24/7\*\*

\- Telegram notifications: \*\*Operational\*\*

\- Wallet-authorized Telegram pairing: \*\*Operational\*\*

\- Wallet-scoped Guardian status: \*\*Operational\*\*

\- Cloudflare production frontend: \*\*Live\*\*

\- Public Guardian API: \*\*Live\*\*

\- Oracle Guardian service: \*\*Active\*\*

\- Cloudflare Tunnel: \*\*Active\*\*

\- MetaMask domain warning review: \*\*Pending\*\*



\---



\## Core Thesis



Safetern is not simply measuring whether something has been inactive.



It uses GenLayer to interpret the significance of that inactivity and then combines intelligent consensus with deterministic safeguards.



> \*\*We're not measuring inactivity. We're determining what the inactivity means.\*\*



\*\*Safetern — Built to continue.\*\*

