\# Safetern



\*\*Autonomous continuity infrastructure powered by GenLayer.\*\*



> \*\*Built to continue.\*\*



Safetern helps digital systems, protocols, projects, and controlled assets determine what should happen when their owner or operator becomes inactive.



The core idea is simple:



> \*\*We're not measuring inactivity. We're determining what the inactivity means.\*\*



Traditional inactivity systems rely primarily on timers. Safetern uses \*\*GenLayer Intelligent Contracts and validator consensus\*\* to evaluate public evidence, determine a continuity assessment, and coordinate the appropriate onchain response.



\---



\## Live Project



\- \*\*Website:\*\* https://safetern.xyz

\- \*\*Telegram Guardian:\*\* @SafeternGuardianBot

\- \*\*Guardian API:\*\* https://guardian.safetern.xyz

\- \*\*GitHub:\*\* https://github.com/devysamhere/safetern

\- \*\*Network:\*\* GenLayer Studionet

\- \*\*Hackathon Track:\*\* Autonomous Protocols



\---



\## GenLayer Intelligent Contract



\*\*Current contract:\*\*



`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`



\*\*Contract version:\*\*



`v0.3.2`



\*\*Deployment transaction:\*\*



`0x40a1530e5e5a45f41efe64151f3b1ad2be9cce8d7a6a25bcf60c4649e1f60cdf`



Build 06.3 does not require a contract redeployment.



\---



\# What Safetern Does



Safetern has three primary modes:



\## 1. Protect



Protect creates a continuity covenant for a digital system or asset controlled by an owner.



Safetern evaluates configured public evidence through GenLayer.



If the evidence indicates that continuity may have been lost, the covenant can enter a \*\*CHALLENGE\*\* period.



During that period, the owner can confirm presence using the owner wallet and return the covenant to a healthy state.



If the challenge expires without owner confirmation, recovery can be finalized permissionlessly.



This means the owner has a veto while present, but owner participation is not required for recovery to eventually complete.



\---



\## 2. Watch



Watch monitors public evidence for projects or systems a user depends on.



Evidence and signals can include:



\- project websites

\- public development activity

\- repositories

\- protocol information

\- DEX liquidity

\- liquidity changes

\- exchange delisting signals

\- other configured public evidence



Watch is intentionally \*\*informational only\*\*.



\*\*A Watch record cannot authorize recovery.\*\*



External monitoring signals are also not treated as the final truth. They provide evidence that GenLayer can interpret.



The distinction is important:



> Monitoring discovers signals. GenLayer determines what those signals mean.



\---



\## 3. Recover



Recover combines autonomous continuity assessment with encrypted recovery information.



Recovery information is encrypted before storage.



Safetern does not intentionally store plaintext recovery secrets onchain.



After the required:



1\. GenLayer assessment

2\. challenge period

3\. permissionless recovery finalization



the nominated beneficiary can authorize access using the beneficiary wallet.



The encrypted recovery information is then decrypted locally for that beneficiary.



Full wallet seed phrases and raw private keys are intentionally blocked by the Safetern interface.



\---



\# Continuity Model



Safetern uses continuity states and assessments including:



`HEALTHY`



`SILENT`



`AT\_RISK`



`ABANDONED`



`CHALLENGE`



`RECOVERED`



GenLayer may also determine that the available evidence is:



`INCONCLUSIVE`



The \*\*GenLayer assessment\*\* and the \*\*current contract lifecycle state\*\* are intentionally separate concepts.



For example:



&#x20;   #8 Safetern Guardian Production Test

&#x20;   PROTECT · HEALTHY

&#x20;   Last assessment: ABANDONED · 96%



This means GenLayer's most recent assessment classified the available evidence as \*\*ABANDONED with 96% confidence\*\*, but the covenant's current state is \*\*HEALTHY\*\* because the owner subsequently confirmed presence during the challenge.



This separation allows Safetern to combine intelligent assessment with deterministic onchain safeguards.



\---



\# Why GenLayer Matters



Safetern is not simply an uptime monitor or inactivity timer.



The easy question is:



> "Has something been inactive for X days?"



The difficult question is:



> \*\*"What does the available evidence mean for the continuity of this system?"\*\*



That requires interpretation.



A repository might become quiet because a project was abandoned.



Or development may have moved elsewhere.



A website might disappear because the project failed.



Or because infrastructure is being migrated.



Liquidity might collapse because a protocol is being abandoned.



Or because liquidity moved to another venue.



A simple timer or centralized script cannot reliably distinguish these situations.



Safetern uses \*\*GenLayer validators to evaluate evidence and reach consensus on a continuity classification\*\*.



The Intelligent Contract remains responsible for consensus-critical state and authorization rules.



The offchain Guardian can observe, notify, and submit permissionless actions, but it does not decide the continuity outcome itself.



This is the central Safetern thesis:



> \*\*We're not measuring inactivity. We're determining what the inactivity means.\*\*



\---



\# Safetern Guardian



\*\*Safetern Guardian\*\* is the autonomous monitoring, automation, and notification layer.



Guardian currently runs 24/7 on an Oracle Cloud Ubuntu server and communicates with the production application through a public HTTPS API exposed using Cloudflare Tunnel.



Guardian can:



\- monitor Watch records

\- monitor Protect covenants

\- monitor Recover covenants

\- detect due assessments

\- gather configured monitoring evidence

\- submit permissionless GenLayer assessment transactions

\- monitor pending assessments

\- detect active recovery challenges

\- notify relevant users through Telegram

\- provide direct owner-presence links

\- detect challenge expiry

\- submit permissionless recovery finalization

\- report recovery finalization

\- report beneficiary recovery availability

\- provide wallet-scoped `/status`

\- provide individual `/record <id>` information



Guardian \*\*cannot\*\*:



\- impersonate the owner

\- confirm owner presence

\- sign owner-only transactions

\- impersonate a beneficiary

\- authorize beneficiary recovery access

\- decrypt beneficiary recovery information

\- override GenLayer consensus



Those actions remain protected by wallet authorization and Intelligent Contract rules.



\---



\# Telegram Guardian



Users can securely connect Telegram Guardian directly from the Safetern application.



The pairing flow uses:



1\. wallet signature authorization

2\. a short-lived one-time pairing token

3\. Telegram confirmation

4\. wallet-to-Telegram connection storage



The wallet signature used for pairing does \*\*not\*\* authorize asset transfers or blockchain transactions.



Once connected, Guardian sends meaningful alerts for Safetern records involving that wallet.



Supported commands include:



&#x20;   /status

&#x20;   /record <id>



`/status` is wallet-scoped, so a connected user receives information about Safetern records relevant to the connected wallet.



Example:



&#x20;   Safetern Guardian · Status



&#x20;   #8 Safetern Guardian Production Test

&#x20;   PROTECT · HEALTHY

&#x20;   Last assessment: ABANDONED · 96%



Guardian also provides direct owner-presence links during an active challenge.



The owner must still connect and authorize the owner-only action with the correct wallet.



\---



\# Architecture



Safetern deliberately separates consensus, automation, authorization, and recovery.



\## GenLayer Intelligent Contract



Responsible for consensus-critical protocol state, including:



\- continuity records

\- GenLayer assessment results

\- challenge state

\- owner-presence authorization

\- recovery finalization

\- beneficiary recovery eligibility



\## GenLayer Validators



Responsible for interpreting configured evidence and reaching consensus on what that evidence means for continuity.



\## Safetern Guardian



Responsible for:



\- monitoring

\- evidence gathering

\- scheduling

\- notifications

\- lifecycle observation

\- permissionless transaction submission



Guardian is an automation layer, not the final decision maker.



\## Owner



Only the authorized owner wallet can perform owner-specific actions such as confirming presence during an active recovery challenge.



\## Beneficiary



Only the nominated beneficiary wallet can authorize beneficiary recovery access after the required recovery state has been reached.



\## Browser Recovery Layer



Handles Recovery Identity cryptography and local decryption of authorized recovery information.



\---



\# Production Infrastructure



Safetern currently operates across several production components.



\## Frontend



The production Safetern web application is hosted through Cloudflare:



https://safetern.xyz



\## Guardian Server



Safetern Guardian runs continuously on an Oracle Cloud Ubuntu VM.



The production service is:



\- managed by systemd

\- configured to restart automatically

\- enabled at boot

\- independent of the developer workstation



\## Guardian API



Public Guardian API:



https://guardian.safetern.xyz



The API is exposed securely through a Cloudflare Tunnel.



\## Telegram



Safetern Guardian:



@SafeternGuardianBot



\## Current Production Health



The production deployment has been verified with:



\- Safetern Guardian service active

\- Cloudflare Tunnel service active

\- public Guardian HTTPS API reachable

\- autonomous monitoring operational

\- Telegram Guardian operational

\- secure wallet pairing operational

\- wallet-scoped commands operational

\- GenLayer assessment automation operational

\- challenge monitoring operational

\- permissionless finalization operational



\---



\# Proven End-to-End Flows



Safetern has been tested end-to-end on GenLayer Studionet.



These are not merely proposed flows; the major lifecycle paths have been executed during development and production testing.



\## 1. Autonomous Protect Recovery



A Protect covenant was monitored by Safetern Guardian.



Guardian triggered the required GenLayer assessment.



GenLayer assessed the configured evidence as \*\*ABANDONED\*\*.



The covenant entered:



`CHALLENGE`



The challenge expired without owner confirmation.



Guardian detected the expiry and submitted the permissionless recovery finalization transaction.



The covenant reached:



`RECOVERED`



This demonstrated:



\*\*Monitor → GenLayer assessment → Challenge → Expiry → Autonomous finalization → Recovered\*\*



\---



\## 2. Owner Presence Veto



A production Protect covenant received an \*\*ABANDONED\*\* GenLayer assessment and entered CHALLENGE.



Guardian sent the owner a Telegram notification containing a direct Safetern owner-presence link.



The owner opened Safetern and connected the correct owner wallet.



The owner selected:



`I'M STILL HERE`



The owner then authorized the required onchain presence confirmation.



The challenge was cancelled and the covenant returned to:



`HEALTHY`



The Guardian subsequently reported the cancellation.



This demonstrated:



\*\*Monitor → GenLayer → Challenge → Telegram → HTTPS deep link → Owner authorization → HEALTHY\*\*



It also demonstrates an important security property:



> Guardian can alert the owner, but Guardian cannot impersonate the owner.



\---



\## 3. Encrypted Beneficiary Recovery



A production Recover covenant completed the recovery lifecycle.



The recovery payload had already been encrypted.



After GenLayer assessment, challenge expiry, and permissionless finalization, the covenant reached:



`RECOVERED`



The nominated beneficiary then:



1\. connected the beneficiary wallet

2\. opened the Recover covenant

3\. selected the recovery unlock action

4\. signed the Safetern Recovery Identity authorization

5\. authorized local access to the encrypted recovery information



Safetern then decrypted and displayed the original test recovery payload only to the beneficiary.



The beneficiary closed the recovery information securely after verification.



This demonstrated:



\*\*Ciphertext → GenLayer continuity decision → Challenge → Permissionless finalization → Beneficiary authorization → Local decryption\*\*



\---



\## 4. Watch Monitoring



Safetern Watch has also been tested against a live crypto asset.



A Watch record was configured for UNI on Ethereum.



Safetern monitored public project evidence and DEX liquidity information.



Guardian observed liquidity and pool information while GenLayer remained responsible for interpreting the evidence.



This demonstrates the intended distinction between:



\*\*signal collection\*\*



and



\*\*intelligent continuity assessment\*\*



Watch remains informational and cannot authorize recovery.



\---



\# Recovery Security



Safetern's recovery design intentionally avoids treating the Guardian as a trusted secret custodian.



Recovery information is encrypted client-side.



The encrypted payload can participate in the continuity process without giving Guardian plaintext access.



After recovery becomes available, the nominated beneficiary must authorize access.



Decryption occurs locally.



The Safetern interface also intentionally blocks users from entering full seed phrases or raw private keys as recovery payloads.



The intended use is recovery information such as:



\- instructions

\- document locations

\- access procedures

\- continuity information

\- references required by an authorized beneficiary



rather than publicly exposing critical wallet secrets.



\---



\# Permissionless Automation



Two important Safetern actions are designed to remain permissionless:



\- `assess(record\_id)`

\- `finalize\_recovery(record\_id)`



This means the protocol does not depend on the owner remaining available in order for continuity processing to proceed.



Safetern Guardian can act as the normal autonomous keeper, but the protocol is not designed so that only Guardian can perform those actions.



Owner-specific and beneficiary-specific actions remain restricted to the appropriate wallets.



\---



\# Challenge Safety



Recovery does not immediately occur simply because an assessment indicates abandonment.



Safetern introduces a challenge period.



During CHALLENGE:



\- the owner can confirm presence

\- the owner can return the covenant to HEALTHY

\- Guardian cannot perform the owner confirmation

\- recovery finalization must wait for challenge expiry



Production-oriented challenge options include longer periods such as:



\- 24 hours

\- 3 days

\- 7 days



Accelerated challenge periods are also available for testing and demonstrations and are clearly identified as test modes.



\---



\# RPC and Monitoring Resilience



Safetern Guardian includes RPC-throttling and lifecycle monitoring designed for GenLayer Studionet.



Heavy monitoring can run at a slower cadence while lightweight lifecycle checks run more frequently for records with:



\- pending assessments

\- active challenges

\- pending finalizations



This allows Safetern to react to lifecycle changes without continuously performing expensive full monitoring scans.



\---



\# Security Boundaries



Safetern separates responsibilities deliberately.



\## Intelligent Contract



Controls consensus-critical state and authorization.



\## Guardian



Automates monitoring, notifications, and permissionless actions.



\## Owner Wallet



Controls owner-only presence confirmation.



\## Beneficiary Wallet



Controls beneficiary-only recovery authorization.



\## Recovery Identity



Provides cryptographic authorization used for beneficiary recovery access.



\## Public Evidence



Provides information for GenLayer assessment but does not directly authorize recovery.



\---



\# MetaMask Security Warning



At the time of Build 06.3, some visits to:



https://safetern.xyz



may trigger a MetaMask malicious-site/security warning.



The Safetern production application itself is deployed at that domain, and the application has also been tested locally without the same domain warning.



A false-positive report/review has been submitted through the appropriate MetaMask security-reporting process.



Safetern does \*\*not\*\* ask users or hackathon reviewers to disable MetaMask security alerts.



Until the domain review is resolved, reviewers should independently verify:



\- the domain: `safetern.xyz`

\- this public GitHub repository

\- the deployed GenLayer Intelligent Contract address

\- the transaction or signature requested by their wallet before approving it



Current contract:



`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`



The known domain warning does not alter Safetern's Intelligent Contract authorization model, Guardian architecture, or beneficiary encryption model.



Additional information is documented in:



`docs/METAMASK-WARNING.md`



\---



\# Repository Structure



&#x20;   safetern/

&#x20;   ├── contracts/

&#x20;   │   └── safetern.py

&#x20;   ├── docs/

&#x20;   │   ├── BUILD-01.md

&#x20;   │   ├── BUILD-02.md

&#x20;   │   ├── ...

&#x20;   │   ├── TELEGRAM-GUARDIAN.md

&#x20;   │   ├── CURRENT-STATUS.md

&#x20;   │   └── METAMASK-WARNING.md

&#x20;   ├── monitor/

&#x20;   │   ├── src/

&#x20;   │   │   ├── guardian.js

&#x20;   │   │   ├── index.js

&#x20;   │   │   ├── telegram-setup.js

&#x20;   │   │   └── telegram-test.js

&#x20;   │   ├── package.json

&#x20;   │   └── package-lock.json

&#x20;   ├── web/

&#x20;   │   ├── public/

&#x20;   │   ├── src/

&#x20;   │   │   ├── App.jsx

&#x20;   │   │   ├── genlayer.js

&#x20;   │   │   ├── recoveryCrypto.js

&#x20;   │   │   ├── index.css

&#x20;   │   │   └── assets/

&#x20;   │   ├── package.json

&#x20;   │   ├── package-lock.json

&#x20;   │   ├── vite.config.js

&#x20;   │   └── wrangler.jsonc

&#x20;   ├── BUILD-06.3.md

&#x20;   ├── .gitignore

&#x20;   └── README.md



\---



\# Running the Frontend Locally



\## Requirements



\- Node.js 20+

\- npm

\- compatible browser wallet

\- access to the configured GenLayer environment



Clone the repository:



&#x20;   git clone https://github.com/devysamhere/safetern.git



Enter the web application:



&#x20;   cd safetern/web



Install dependencies:



&#x20;   npm install



Start the development server:



&#x20;   npm run dev



The local Vite application will normally be available at:



&#x20;   http://localhost:5173



For Guardian connectivity, configure:



&#x20;   VITE\_GUARDIAN\_API\_URL=https://guardian.safetern.xyz



Do not commit private environment configuration.



\---



\# Running the Monitor



Enter the monitor:



&#x20;   cd monitor



Install the locked dependencies:



&#x20;   npm ci



Start the monitor:



&#x20;   npm start



A production Guardian deployment additionally requires private environment configuration for services such as:



\- the keeper

\- Telegram

\- RPC configuration

\- application URLs



Production `.env` files and private keys must never be committed.



Runtime Guardian state and wallet-pairing files are also excluded from the public repository.



\---



\# Sensitive Files



The repository intentionally excludes files such as:



&#x20;   .env

&#x20;   .env.\*

&#x20;   node\_modules/

&#x20;   dist/

&#x20;   .vite/

&#x20;   .wrangler/

&#x20;   \_\_pycache\_\_/

&#x20;   monitor/data/guardian-connections.json

&#x20;   monitor/data/guardian-state.json

&#x20;   monitor/data/state.json



This prevents production credentials, private keys, Telegram tokens, live pairing information, and runtime state from being included in the public repository.



\---



\# Build 06.3



Build 06.3 is the current hackathon production baseline.



It includes:



\- GenLayer Intelligent Contract v0.3.2

\- Protect

\- Watch

\- Recover

\- browser-side encrypted recovery

\- Recovery Identity authorization

\- beneficiary-only recovery access

\- crypto Watch monitoring

\- DEX liquidity monitoring

\- confirmed delisting signal monitoring

\- autonomous keeper

\- Telegram Guardian

\- wallet-authorized Guardian pairing

\- multi-user Guardian connections

\- wallet-scoped Telegram commands

\- owner challenge notifications

\- owner-presence deep links

\- autonomous challenge monitoring

\- permissionless recovery finalization

\- RPC throttling and resilience

\- 24/7 Oracle Cloud Guardian

\- Cloudflare Tunnel

\- public Guardian HTTPS API

\- production `safetern.xyz` deployment

\- clarified Guardian lifecycle/assessment reporting



No Intelligent Contract redeployment was required for Build 06.3.



See:



`BUILD-06.3.md`



`docs/CURRENT-STATUS.md`



`docs/TELEGRAM-GUARDIAN.md`



`docs/METAMASK-WARNING.md`



\---



\# Hackathon



Safetern is being built for the \*\*Autonomous Protocols\*\* track of the GenLayer Agent Tank hackathon.



Safetern's core thesis is:



> \*\*Autonomous continuity for digital systems.\*\*



Its use of GenLayer goes beyond automatically executing predetermined actions.



The protocol uses intelligent consensus to determine \*\*whether an action is justified by ambiguous real-world evidence\*\*, then combines that result with deterministic onchain safeguards.



\---



\# Current Status



\*\*Build:\*\* 06.3



\*\*Network:\*\* GenLayer Studionet



\*\*Contract:\*\* `0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`



\*\*Frontend:\*\* https://safetern.xyz



\*\*Guardian API:\*\* https://guardian.safetern.xyz



\*\*Telegram Guardian:\*\* @SafeternGuardianBot



\*\*Repository:\*\* https://github.com/devysamhere/safetern



\*\*Guardian:\*\* 24/7 production deployment active



\*\*Protect:\*\* Operational



\*\*Watch:\*\* Operational



\*\*Recover:\*\* Operational



\*\*Owner veto:\*\* Proven end-to-end



\*\*Permissionless finalization:\*\* Proven end-to-end



\*\*Beneficiary encrypted recovery:\*\* Proven end-to-end



\*\*Telegram wallet pairing:\*\* Operational



\*\*Current known issue:\*\* MetaMask may display a domain security warning for `safetern.xyz`; false-positive review has been submitted.



\---



\# Philosophy



Safetern is built around one principle:



> \*\*Continuity should not depend on a single person remaining online forever.\*\*



But automation alone is not enough.



Before an autonomous system takes a consequential action, it needs a way to interpret what has actually happened.



That is where GenLayer becomes fundamental to Safetern.



> \*\*We're not measuring inactivity. We're determining what the inactivity means.\*\*



\---



\*\*Safetern — Built to continue.\*\*

