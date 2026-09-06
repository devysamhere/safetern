# Safetern Build 06.1 — Telegram Guardian Onboarding + Favicon

Build 06.1 adds user-facing Telegram Guardian pairing and Safetern browser icons without changing the GenLayer Intelligent Contract.

## Added

- Safetern favicon and Apple touch icon generated from the existing approved Safetern logo.
- Wallet-menu `Telegram Guardian` entry.
- Secure wallet-authorized Guardian onboarding modal.
- One-time Telegram deep-link pairing tokens (10-minute expiry).
- Wallet signature challenge before creating or removing a Telegram pairing. The signature creates no blockchain transaction and grants no asset authority.
- Multi-user Guardian connection store (`monitor/data/guardian-connections.json`).
- Telegram alerts routed to wallets involved in a record (owner, recovery controller, and Recover beneficiary where applicable).
- Telegram `/status` and `/record <id>` are scoped to the wallet paired with that chat.
- User-facing Guardian disconnect flow protected by a fresh wallet signature.
- Existing `TELEGRAM_CHAT_ID` remains optional as a legacy/admin destination.

## New configuration

Monitor `.env`:

```env
TELEGRAM_BOT_USERNAME=SafeternGuardianBot
SAFETERN_APP_URL=https://safetern.xyz
```

Web build `.env`:

```env
VITE_GUARDIAN_API_URL=https://<public-guardian-api-host>
```

The Guardian API must be served over public HTTPS for `https://safetern.xyz`. A browser cannot safely use the local `http://localhost:8787` monitor endpoint from the production HTTPS site.

## Guardian API

- `GET /guardian/status?wallet=0x...`
- `GET /guardian/challenge?wallet=0x...&action=connect|disconnect`
- `POST /guardian/pair-request`
- `POST /guardian/disconnect`

The monitor verifies the EVM wallet signature with `ethers.verifyMessage` before creating a Telegram pair token or removing an existing connection.

## Contract

No contract change. Current deployment remains:

`0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB`
