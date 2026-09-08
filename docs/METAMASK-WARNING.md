\# MetaMask Security Warning — safetern.xyz



\## Current Status



At the time of Safetern Build 06.5, MetaMask may display a malicious-site or security warning when visiting:



https://safetern.xyz



This is a known issue currently under review.



A false-positive report/review has been submitted through the appropriate MetaMask security-reporting process.



\---



\## Important



Safetern does \*\*not\*\* ask users, testers, or hackathon reviewers to disable MetaMask security alerts.



Users should keep their wallet security protections enabled and independently verify the application before interacting with it.



\---



\## Verification Information



\### Official Safetern Website



https://safetern.xyz



\### Public Source Repository



https://github.com/devysamhere/safetern



\### Network



GenLayer Studionet



\### Safetern Intelligent Contract



`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`



\### Contract Version



`v0.3.2`



\### Deployment Transaction



`0x40a1530e5e5a45f41efe64151f3b1ad2be9cce8d7a6a25bcf60c4649e1f60cdf`



\### Guardian API



https://guardian.safetern.xyz



\### Telegram Guardian



`@SafeternGuardianBot`



\---



\## What Has Been Verified



Safetern has been tested successfully on GenLayer Studionet.



Verified flows include:



\- wallet connection

\- Protect covenant creation

\- Watch creation and monitoring

\- Recover covenant creation

\- GenLayer continuity assessment

\- CHALLENGE lifecycle

\- owner presence confirmation

\- owner challenge cancellation

\- permissionless recovery finalization

\- encrypted beneficiary recovery

\- beneficiary wallet authorization

\- local recovery payload decryption

\- Telegram Guardian wallet pairing

\- wallet-scoped Guardian status

\- Guardian owner-presence deep links

\- 24/7 Guardian monitoring
- embedded Demo Owner/Beneficiary sessions without MetaMask
- Recovery Identity creation and beneficiary identity discovery in the embedded demo



The application has also been tested locally without the same domain warning.



\---



\## Security Architecture



The MetaMask domain warning does not change Safetern's protocol authorization model.



Safetern separates authority across several components.



\### GenLayer



GenLayer validators interpret configured evidence and determine continuity assessments through consensus.



\### Intelligent Contract



The Intelligent Contract controls consensus-critical lifecycle state and authorization.



\### Safetern Guardian



Guardian monitors records, sends notifications, and submits permissionless actions.



Guardian cannot:



\- impersonate an owner

\- confirm owner presence

\- impersonate a beneficiary

\- authorize beneficiary recovery access

\- decrypt beneficiary recovery information

\- override GenLayer consensus



\### Owner Authorization



Owner-presence confirmation requires the correct owner wallet.



\### Beneficiary Authorization



Recovery access requires the nominated beneficiary wallet.



\### Recovery Information



Recovery information is encrypted before storage and decrypted locally after beneficiary authorization.



\---



\## Wallet Signatures



Safetern uses wallet signatures for specific authorization flows.



Users should always inspect wallet requests before approving them.



Examples include:



\### Guardian Account Linking



Guardian pairing requires a wallet signature to prove control of the wallet being connected to Telegram.



This is an account-linking authorization and does not authorize a token transfer.



\### Recovery Identity Unlock



Beneficiary recovery may request an offchain Recovery Identity authorization.



This proves beneficiary control before local recovery decryption.



\### Onchain Actions



Actions that modify Intelligent Contract state are presented as blockchain transactions and should be reviewed in the wallet before approval.



\---



\## Guidance for Hackathon Reviewers



If MetaMask displays the warning while reviewing Safetern, please do not disable wallet security protections solely to access the project.

Build 06.5 also provides an **Embedded Demo** that does not require MetaMask. Reviewers can use it to create and inspect real Protect, Watch, and Recover records on GenLayer Studionet while demo keys remain server-side.



The complete Safetern implementation can be independently inspected through the public GitHub repository:



https://github.com/devysamhere/safetern



The deployed Intelligent Contract can be verified using:



`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`



Reviewers can also compare the implementation against the documented architecture and demonstrated end-to-end flows.



The project team has submitted the domain warning for false-positive review.



\---



\## Why This Is Documented



Safetern is security-sensitive infrastructure.



A wallet security warning should therefore be disclosed rather than hidden or worked around.



This document exists so testers and hackathon reviewers know:



1\. the warning is known

2\. a false-positive review has been submitted

3\. Safetern does not ask users to disable wallet protections

4\. the source code is publicly available for inspection

5\. the deployed contract address is publicly documented

6\. wallet authorization boundaries remain enforced by the application and Intelligent Contract



\---



\## Updates



This document reflects the status of \*\*Safetern Build 06.5\*\*.



It should be updated when the MetaMask domain review is resolved.



\---



\*\*Safetern — Built to continue.\*\*

