# Safetern Build 05.3

Monitor reliability hotfix. No Intelligent Contract change and no redeployment required.

- Fixed false-positive exchange delisting detection caused by substring matching (for example `UNI` inside unrelated words).
- Token symbols must now appear as standalone tokens in an actual delisting/removal announcement phrase.
- A scraped delisting signal must be observed in two consecutive lightweight checks before it can create an alert or trigger an automatic GenLayer assessment.
- Existing DEX liquidity monitoring and v0.3.2 contract integration are unchanged.
