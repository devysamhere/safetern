# Safetern Guardian

Safetern Guardian is the offchain notification interface for the autonomous monitor. It does not decide continuity or recovery outcomes.

## Current Watch alerts
Guardian sends Telegram only for meaningful events:
- Watch classification changes (for example HEALTHY -> AT_RISK)
- material DEX liquidity drops crossing the configured alert threshold
- exchange delisting signals confirmed on two consecutive lightweight checks
- keeper assessment submission failures
- assessments that remain pending beyond the configured retry window

Routine HEALTHY assessments are intentionally silent.

## Telegram commands
- `/start` — connection confirmation and command help
- `/status` — current summary of monitored Watch records
- `/watch <id>` — detailed current snapshot for one Watch

## Setup
1. Create a Telegram bot with @BotFather and place its token in `monitor/.env` as `TELEGRAM_BOT_TOKEN`.
2. Run `npm run guardian:setup` and follow the prompt to send `/start` to the bot.
3. Copy the printed chat ID into `TELEGRAM_CHAT_ID` in `monitor/.env`.
4. Run `npm run guardian:test`.
5. Restart `npm start`.

## Privacy
Telegram bot tokens, chat IDs, notification state and preferences remain offchain in the monitor service. The Intelligent Contract stores none of them.
