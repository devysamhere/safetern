# Build 02

## Validated before this build

Build 01 was deployed to GenLayer Studionet and tested live.

- Ambiguous GenLayer evidence -> `INCONCLUSIVE`, confidence 50.
- Explicit project-controlled discontinuation evidence -> `ABANDONED`, confidence 95.
- WATCH mode correctly kept `recovery_condition_satisfied=false`.

## Contract hardening

The v0.2.0 assessment prompt now explicitly prevents these unsafe inferences:

- reachable webpage = recent activity;
- mention of a recent technology/date = activity by the protected entity;
- dates inside page content = publication/update dates.

It also explicitly gives strong weight to project-controlled statements that clearly say the protected entity is discontinued, archived, no longer maintained, or no longer operational.

## Web milestone

Safetern Watch is now a cold-startable UI flow:

1. connect wallet;
2. create Watch with arbitrary public URLs;
3. read Watches from GenLayer;
4. run assessment;
5. display status, confidence, evidence summary and GenLayer reasoning.

Protect and Recover remain in the frozen protocol scope and are the next UI flows.
