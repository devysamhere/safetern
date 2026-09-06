\# Safetern — Build 06.3



\## Production Guardian Status Polish



Build 06.3 finalizes the production deployment and improves the clarity of Safetern Guardian's Telegram status reporting.



\### Guardian `/status` clarity



Guardian now separates a covenant's current lifecycle state from its most recent GenLayer assessment.



Previously:



PROTECT · HEALTHY · ABANDONED · 96%



Now:



PROTECT · HEALTHY

Last assessment: ABANDONED · 96%



This makes it clear that HEALTHY is the covenant's current state while ABANDONED · 96% represents the most recent GenLayer assessment.



No Intelligent Contract logic, recovery logic, assessment logic, or lifecycle rules were changed.



\### 24/7 Guardian production infrastructure



Safetern Guardian is now running independently on an Oracle Cloud Ubuntu server.



Production services:



\- Safetern Guardian monitor — systemd managed and enabled at boot

\- Cloudflare Tunnel — systemd managed and enabled at boot

\- Public Guardian API — https://guardian.safetern.xyz

\- Production application — https://safetern.xyz

\- Telegram Guardian — @SafeternGuardianBot



The Guardian no longer depends on a developer PC remaining online.



\### Production verification



Confirmed:



\- Safetern Guardian service: active

\- Cloudflare Tunnel service: active

\- Public Guardian API reachable over HTTPS

\- Autonomous monitoring operational

\- Telegram wallet pairing operational

\- Wallet-scoped `/status` operational

\- Protect challenge notifications operational

\- Owner-presence deep links operational

\- Autonomous permissionless recovery finalization operational

\- Beneficiary-only encrypted recovery access operational



\### Contract



No contract redeployment was required for Build 06.3.



Current Intelligent Contract:



0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB



Contract version: v0.3.2



\## Build 06.3 status



Production Guardian infrastructure and Telegram status polish complete.

