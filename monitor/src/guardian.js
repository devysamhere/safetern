import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const shortMoney = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$0";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
};

const signedPct = (value) => {
  const n = Number(value || 0);
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
};

const clean = (value, max = 360) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const shortWallet = (value) => {
  const v = String(value || "");
  return v.length > 14 ? `${v.slice(0, 8)}…${v.slice(-6)}` : (v || "—");
};

const duration = (seconds) => {
  const s = Math.max(0, Number(seconds || 0));
  if (s < 60) return `${Math.ceil(s)}s`;
  if (s < 3600) return `${Math.ceil(s / 60)}m`;
  if (s < 86400) return `${Math.ceil(s / 3600)}h`;
  return `${Math.ceil(s / 86400)}d`;
};

const norm = (value) => String(value || "").trim().toLowerCase();

export class TelegramGuardian {
  constructor({ root, token, chatId, contract, appUrl, botUsername }) {
    this.root = root;
    this.token = String(token || "").trim();
    this.chatId = String(chatId || "").trim();
    this.contract = contract;
    this.appUrl = String(appUrl || "").trim().replace(/\/$/, "");
    this.botUsername = String(botUsername || "SafeternGuardianBot").replace(/^@/, "");
    this.statePath = path.join(root, "data", "guardian-state.json");
    this.connectionsPath = path.join(root, "data", "guardian-connections.json");
    this.apiBase = this.token ? `https://api.telegram.org/bot${this.token}` : "";
    this.commandTimer = null;
    this.commandsRegistered = false;
  }

  get configured() {
    return Boolean(this.token);
  }

  readLocalState() {
    try {
      return JSON.parse(fs.readFileSync(this.statePath, "utf8"));
    } catch {
      return {
        initialized: false,
        notified_event_ids: [],
        update_offset: 0,
      };
    }
  }

  writeLocalState(state) {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  readConnections() {
    try {
      return JSON.parse(fs.readFileSync(this.connectionsPath, "utf8"));
    } catch {
      return {
        wallets: {},
        chats: {},
        pending: {},
        challenges: {},
      };
    }
  }

  writeConnections(state) {
    fs.writeFileSync(this.connectionsPath, JSON.stringify(state, null, 2));
  }

  pruneConnections(state) {
    const now = Date.now();

    for (const [k, v] of Object.entries(state.pending || {})) {
      if (!v?.expires_at || v.expires_at < now) delete state.pending[k];
    }

    for (const [k, v] of Object.entries(state.challenges || {})) {
      if (!v?.expires_at || v.expires_at < now) delete state.challenges[k];
    }

    return state;
  }

  createSignatureChallenge(wallet, action = "connect") {
    const state = this.pruneConnections(this.readConnections());
    const nonce = crypto.randomBytes(18).toString("hex");
    const expiresAt = Date.now() + 10 * 60 * 1000;

    const message = [
      "Safetern Guardian",
      "",
      action === "disconnect"
        ? "Authorize Telegram Guardian disconnection."
        : "Authorize Telegram Guardian connection.",
      `Wallet: ${wallet}`,
      `Nonce: ${nonce}`,
      "",
      "This signature does not authorize asset transfers or blockchain transactions.",
    ].join("\n");

    state.challenges[nonce] = {
      wallet: norm(wallet),
      action,
      message,
      expires_at: expiresAt,
    };

    this.writeConnections(state);

    return {
      nonce,
      message,
      expires_at: expiresAt,
    };
  }

  consumeSignatureChallenge(nonce, wallet, action = "connect") {
    const state = this.pruneConnections(this.readConnections());
    const item = state.challenges?.[nonce];

    if (!item || item.wallet !== norm(wallet) || item.action !== action) {
      return null;
    }

    delete state.challenges[nonce];
    this.writeConnections(state);

    return item;
  }

  createPairToken(wallet) {
    const state = this.pruneConnections(this.readConnections());
    const token = crypto.randomBytes(20).toString("hex");

    state.pending[token] = {
      wallet: norm(wallet),
      expires_at: Date.now() + 10 * 60 * 1000,
    };

    this.writeConnections(state);

    return {
      token,
      url: `https://t.me/${this.botUsername}?start=pair_${token}`,
      expires_at: state.pending[token].expires_at,
    };
  }

  getConnection(wallet) {
    const state = this.pruneConnections(this.readConnections());
    this.writeConnections(state);

    const entry = state.wallets?.[norm(wallet)];

    return entry
      ? {
          connected: true,
          wallet: norm(wallet),
          connected_at: entry.connected_at,
        }
      : {
          connected: false,
          wallet: norm(wallet),
        };
  }

  disconnectWallet(wallet) {
    const state = this.readConnections();
    const key = norm(wallet);
    const current = state.wallets?.[key];

    if (!current) return false;

    delete state.wallets[key];

    const chat = String(current.chat_id);

    if (state.chats?.[chat]?.wallet === key) {
      delete state.chats[chat];
    }

    this.writeConnections(state);

    return true;
  }

  completePair(token, chatId, user = {}) {
    const state = this.pruneConnections(this.readConnections());
    const pending = state.pending?.[token];

    if (!pending) return null;

    const wallet = pending.wallet;
    const previous = state.wallets?.[wallet];

    if (
      previous?.chat_id &&
      state.chats?.[String(previous.chat_id)]?.wallet === wallet
    ) {
      delete state.chats[String(previous.chat_id)];
    }

    const priorWallet = state.chats?.[String(chatId)]?.wallet;

    if (
      priorWallet &&
      state.wallets?.[priorWallet]?.chat_id === String(chatId)
    ) {
      delete state.wallets[priorWallet];
    }

    const entry = {
      chat_id: String(chatId),
      connected_at: Date.now(),
      telegram_user_id: user?.id ? String(user.id) : "",
      telegram_username: user?.username || "",
    };

    state.wallets[wallet] = entry;
    state.chats[String(chatId)] = {
      wallet,
      connected_at: entry.connected_at,
    };

    delete state.pending[token];

    this.writeConnections(state);

    return {
      wallet,
      ...entry,
    };
  }

  initializeExistingEvents(events = []) {
    if (!this.configured) return;

    const local = this.readLocalState();

    if (local.initialized) return;

    local.initialized = true;
    local.notified_event_ids = events
      .slice(0, 300)
      .map((event) => event.id)
      .filter(Boolean);

    this.writeLocalState(local);
  }

  async call(method, payload = {}) {
    if (!this.token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const response = await fetch(`${this.apiBase}/${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.ok === false) {
      throw new Error(data?.description || `Telegram ${response.status}`);
    }

    return data?.result;
  }

  async sendTo(chatId, text, extra = {}) {
    if (!this.configured || !chatId) return false;

    await this.call("sendMessage", {
      chat_id: String(chatId),
      text: String(text || "").slice(0, 4000),
      disable_web_page_preview: true,
      ...extra,
    });

    return true;
  }

  async send(text, extra = {}) {
    return this.chatId ? this.sendTo(this.chatId, text, extra) : false;
  }

  async registerCommands() {
    if (!this.configured || this.commandsRegistered) return;

    try {
      await this.call("setMyCommands", {
        commands: [
          {
            command: "start",
            description: "Open Guardian home",
          },
          {
            command: "status",
            description: "View your Safetern records",
          },
          {
            command: "record",
            description: "View a specific record by ID",
          },
          {
            command: "help",
            description: "Guardian help and commands",
          },
        ],
      });

      this.commandsRegistered = true;
      console.log("Safetern Guardian Telegram commands registered.");
    } catch (error) {
      console.error(
        "Telegram Guardian command registration failed:",
        error?.message || error
      );
    }
  }

  mainKeyboard() {
    const firstRow = [
      {
        text: "VIEW STATUS",
        callback_data: "guardian_status",
      },
    ];

    if (this.appUrl) {
      firstRow.push({
        text: "OPEN SAFETERN",
        url: this.appUrl,
      });
    }

    return {
      inline_keyboard: [
        firstRow,
        [
          {
            text: "HELP",
            callback_data: "guardian_help",
          },
        ],
      ],
    };
  }

  homeMessage(wallet = "") {
    const lines = [
      "Safetern Guardian",
      "",
      "Autonomous continuity monitoring for your Safetern records.",
    ];

    if (wallet) {
      lines.push("", `Connected wallet: ${shortWallet(wallet)}`);
    }

    lines.push(
      "",
      "Guardian monitors meaningful changes across Protect, Watch and Recover and alerts you when attention is required.",
      "",
      "Guardian can monitor and notify, but it cannot sign owner-only or beneficiary-only actions."
    );

    return lines.join("\n");
  }

  helpMessage() {
    return [
      "Safetern Guardian · Help",
      "",
      "/status",
      "View Protect, Watch and Recover records connected to your wallet.",
      "",
      "/record <id>",
      "View detailed information for one Safetern record.",
      "Example: /record 8",
      "",
      "/start",
      "Open the Guardian home screen.",
      "",
      "/help",
      "Show this help message.",
      "",
      "Guardian automatically alerts you about important assessments, challenges, Watch signals and recovery events.",
      "",
      "Security: Guardian cannot sign owner-only or beneficiary-only actions on your behalf.",
    ].join("\n");
  }

  async sendHome(chatId, wallet = "") {
    return this.sendTo(chatId, this.homeMessage(wallet), {
      reply_markup: this.mainKeyboard(),
    });
  }

  async sendHelp(chatId) {
    return this.sendTo(chatId, this.helpMessage(), {
      reply_markup: this.mainKeyboard(),
    });
  }

  audienceForRecord(record = {}) {
    const wallets = new Set();

    if (record.owner) wallets.add(norm(record.owner));

    if (record.mode === "RECOVER" && record.beneficiary) {
      wallets.add(norm(record.beneficiary));
    }

    if (record.mode === "PROTECT" && record.recovery_controller) {
      wallets.add(norm(record.recovery_controller));
    }

    const connections = this.readConnections();
    const chats = new Set();

    for (const wallet of wallets) {
      const chat = connections.wallets?.[wallet]?.chat_id;
      if (chat) chats.add(String(chat));
    }

    if (this.chatId) chats.add(this.chatId);

    return [...chats];
  }

  async sendChallengeTo(chatId, event) {
    const now = Math.floor(Date.now() / 1000);
    const left = Math.max(
      0,
      Number(event.challenge_expires_at || 0) - now
    );

    const lines = [
      "Safetern Guardian · Recovery challenge started",
      "",
      event.name || `Covenant #${event.record_id}`,
      `Mode: ${event.mode || "—"}`,
      `GenLayer result: ${event.classification || "ABANDONED"}${
        event.confidence ? ` · ${event.confidence}%` : ""
      }`,
      `Challenge window remaining: ${duration(left)}`,
    ];

    const summary = clean(event.evidence_summary, 520);

    if (summary) {
      lines.push("", summary);
    }

    lines.push(
      "",
      "If you are still in control, confirm presence with the owner wallet before the challenge expires."
    );

    await this.sendTo(chatId, lines.join("\n"), {
      reply_markup: {
        inline_keyboard: [
          [
            this.appUrl
              ? {
                  text: "I'M STILL HERE",
                  url: `${this.appUrl}/?presence=${event.record_id}`,
                }
              : {
                  text: "I'M STILL HERE",
                  callback_data: `presence_help:${event.record_id}`,
                },
            {
              text: "VIEW STATUS",
              callback_data: `record_status:${event.record_id}`,
            },
          ],
        ],
      },
    });
  }

  messageForEvent(event, state) {
    const record =
      state?.records?.[String(event.record_id)] ||
      state?.watches?.[String(event.record_id)] ||
      {};

    if (event.type === "liquidity_alert") {
      return [
        "Safetern Guardian · Liquidity alert",
        "",
        event.name || `Watch #${event.record_id}`,
        `DEX liquidity changed ${signedPct(
          event.change_percent
        )} since the previous monitor check.`,
        `Previous: ${shortMoney(event.previous_usd)}`,
        `Current: ${shortMoney(event.current_usd)}`,
        "",
        "Safetern has requested a fresh GenLayer assessment when autonomous assessment is enabled.",
      ].join("\n");
    }

    if (event.type === "delisting_alert") {
      return [
        "Safetern Guardian · Exchange signal",
        "",
        event.name || `Watch #${event.record_id}`,
        `Token: ${event.token_symbol || record.token_symbol || "—"}`,
        `Confirmed delisting signal: ${
          (event.exchanges || []).join(", ") || "Unknown exchange"
        }`,
        "",
        "The signal was observed on two consecutive checks. GenLayer will determine what it means for continuity.",
      ].join("\n");
    }

    if (
      event.type === "watch_status_changed" ||
      event.type === "assessment_status_changed"
    ) {
      const lines = [
        `Safetern Guardian · ${
          event.mode === "WATCH" || event.type === "watch_status_changed"
            ? "Watch"
            : "Covenant"
        } assessment changed`,
        "",
        event.name || `Record #${event.record_id}`,
        `${event.previous_classification || "UNKNOWN"} → ${
          event.classification || "UNKNOWN"
        }`,
        `GenLayer confidence: ${Number(event.confidence || 0)}%`,
      ];

      if (event.dex_liquidity_usd) {
        lines.push(`DEX liquidity: ${shortMoney(event.dex_liquidity_usd)}`);
      }

      if (
        event.liquidity_change_percent !== null &&
        event.liquidity_change_percent !== undefined
      ) {
        lines.push(
          `Since previous assessment: ${signedPct(
            event.liquidity_change_percent
          )}`
        );
      }

      const summary = clean(event.evidence_summary, 500);

      if (summary) {
        lines.push("", summary);
      }

      return lines.join("\n");
    }

    if (event.type === "challenge_cancelled") {
      return [
        "Safetern Guardian · Challenge cancelled",
        "",
        event.name || `Covenant #${event.record_id}`,
        "Owner presence was confirmed. The recovery challenge has been cancelled and the covenant returned to HEALTHY.",
      ].join("\n");
    }

    if (event.type === "recovery_finalize_triggered") {
      return [
        "Safetern Guardian · Finalizing recovery",
        "",
        event.name || `Covenant #${event.record_id}`,
        "The challenge window expired without owner confirmation.",
        "The autonomous keeper submitted the permissionless recovery finalization transaction.",
        event.tx_hash ? `Transaction: ${event.tx_hash}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (event.type === "recovery_finalized") {
      const lines = [
        "Safetern Guardian · Recovery finalized",
        "",
        event.name || `Covenant #${event.record_id}`,
        "State: RECOVERED",
      ];

      if (event.mode === "RECOVER") {
        lines.push(`Beneficiary: ${shortWallet(event.beneficiary)}`);
        lines.push(
          "The nominated beneficiary can now claim recovery access with the beneficiary wallet."
        );
      } else if (event.recovery_controller) {
        lines.push(
          `Recovery controller: ${shortWallet(event.recovery_controller)}`
        );
      }

      return lines.join("\n");
    }

    if (event.type === "assessment_trigger_failed") {
      return [
        "Safetern Guardian · Automation error",
        "",
        event.name || `Record #${event.record_id}`,
        "The keeper could not submit a required GenLayer assessment.",
        clean(event.error, 700),
      ].join("\n");
    }

    if (event.type === "recovery_finalize_failed") {
      return [
        "Safetern Guardian · Recovery automation error",
        "",
        event.name || `Covenant #${event.record_id}`,
        "The challenge expired, but the keeper could not submit finalization.",
        clean(event.error, 700),
      ].join("\n");
    }

    if (
      event.type === "assessment_pending_timeout" ||
      event.type === "recovery_finalize_pending_timeout"
    ) {
      return [
        `Safetern Guardian · ${
          event.type === "assessment_pending_timeout"
            ? "Assessment"
            : "Recovery finalization"
        } delayed`,
        "",
        event.name || `Record #${event.record_id}`,
        "A submitted GenLayer transaction has remained pending beyond the configured retry window.",
        event.tx_hash ? `Transaction: ${event.tx_hash}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }

    return "";
  }

  async notifyNewEvents(state) {
    if (!this.configured) return;

    const local = this.readLocalState();
    const seen = new Set(local.notified_event_ids || []);
    const events = [...(state?.events || [])].reverse();

    for (const event of events) {
      if (!event?.id || seen.has(event.id)) continue;

      const record =
        state?.records?.[String(event.record_id)] ||
        state?.watches?.[String(event.record_id)] ||
        {};

      const chats = this.audienceForRecord(record);

      for (const chatId of chats) {
        try {
          if (event.type === "challenge_started") {
            await this.sendChallengeTo(chatId, event);
          } else {
            const message = this.messageForEvent(event, state);
            if (message) {
              await this.sendTo(chatId, message);
            }
          }
        } catch (error) {
          console.error(
            "Telegram Guardian notification failed:",
            error?.message || error
          );
        }
      }

      seen.add(event.id);
    }

    local.initialized = true;
    local.notified_event_ids = [...seen].slice(-500);
    this.writeLocalState(local);
  }

  recordsForWallet(state, wallet) {
    const w = norm(wallet);

    return Object.values(state?.records || {}).filter(
      (r) =>
        norm(r.owner) === w ||
        norm(r.beneficiary) === w ||
        norm(r.recovery_controller) === w
    );
  }

  formatStatus(state, wallet = "") {
    const records = wallet
      ? this.recordsForWallet(state, wallet)
      : Object.values(state?.records || {});

    if (!records.length) {
      return "Safetern Guardian\n\nNo Safetern records have been observed for this connected wallet yet.";
    }

    const lines = ["Safetern Guardian · Status", ""];

    for (const record of records.slice(0, 16)) {
      const classification =
        record.latest_classification || "NOT ASSESSED";

      const confidence = record.latest_confidence
        ? ` · ${record.latest_confidence}%`
        : "";

      lines.push(`#${record.record_id} ${record.name}`);
      lines.push(`${record.mode} · ${record.state || "—"}`);
      lines.push(`Last assessment: ${classification}${confidence}`);

      if (record?.dex?.available) {
        lines.push(
          `DEX: ${shortMoney(record.dex.total_liquidity_usd)} · ${
            record.dex.pool_count || 0
          } pools`
        );
      }

      if (record.state === "CHALLENGE") {
        lines.push(
          `Challenge remaining: ${duration(
            Number(record.challenge_expires_at || 0) -
              Math.floor(Date.now() / 1000)
          )}`
        );
      }

      if (record.assessment_pending) {
        lines.push("GenLayer assessment: pending");
      }

      if (record.finalize_pending) {
        lines.push("Recovery finalization: pending");
      }

      lines.push("");
    }

    return lines.join("\n").trim();
  }

  formatRecord(state, id, wallet = "") {
    const record =
      state?.records?.[String(id)] ||
      state?.watches?.[String(id)];

    if (!record) {
      return `Safetern Guardian\n\nRecord #${id} is not in the current monitor state.`;
    }

    if (
      wallet &&
      !this.recordsForWallet(
        { records: { [String(id)]: record } },
        wallet
      ).length
    ) {
      return `Safetern Guardian\n\nRecord #${id} is not assigned to your connected wallet.`;
    }

    const lines = [
      `Safetern Guardian · Record #${record.record_id}`,
      "",
      record.name,
      `Mode: ${record.mode}`,
      `State: ${record.state || "—"}`,
      `Assessment: ${record.latest_classification || "NOT ASSESSED"}${
        record.latest_confidence
          ? ` · ${record.latest_confidence}%`
          : ""
      }`,
    ];

    if (record.token_symbol) {
      lines.push(
        `Token: ${record.token_symbol} · ${record.blockchain || ""}`.trim()
      );
    }

    if (record?.dex?.available) {
      lines.push(
        `DEX liquidity: ${shortMoney(record.dex.total_liquidity_usd)}`
      );
      lines.push(`Active pools: ${record.dex.pool_count || 0}`);
    }

    if (record.mode !== "WATCH") {
      lines.push(`Owner: ${shortWallet(record.owner)}`);

      if (record.beneficiary) {
        lines.push(`Beneficiary: ${shortWallet(record.beneficiary)}`);
      }

      if (record.state === "CHALLENGE") {
        lines.push(
          `Challenge remaining: ${duration(
            Number(record.challenge_expires_at || 0) -
              Math.floor(Date.now() / 1000)
          )}`
        );
      }
    }

    lines.push(
      `Assessment cadence: ${Math.max(
        1,
        Math.round(
          Number(record.onchain_assessment_interval_seconds || 0) / 3600
        )
      )}h`
    );

    lines.push(
      `Assessment pending: ${record.assessment_pending ? "Yes" : "No"}`
    );

    if (record.mode !== "WATCH") {
      lines.push(
        `Finalization pending: ${record.finalize_pending ? "Yes" : "No"}`
      );
    }

    return lines.join("\n");
  }

  async handleCallback(query, getState) {
    const data = String(query?.data || "");
    const chatId = String(query?.message?.chat?.id || "");

    if (!query?.id || !chatId) return;

    const connections = this.readConnections();

    const wallet =
      connections.chats?.[chatId]?.wallet ||
      (chatId === this.chatId ? "" : null);

    try {
      await this.call("answerCallbackQuery", {
        callback_query_id: query.id,
      });
    } catch {}

    if (wallet === null) {
      await this.sendTo(
        chatId,
        "Safetern Guardian is not connected to a wallet yet.\n\nOpen Safetern and connect Telegram Guardian first."
      );
      return;
    }

    if (data === "guardian_status") {
      await this.sendTo(
        chatId,
        this.formatStatus(getState(), wallet || ""),
        {
          reply_markup: this.mainKeyboard(),
        }
      );
      return;
    }

    if (data === "guardian_help") {
      await this.sendHelp(chatId);
      return;
    }

    const presence = data.match(/^presence_help:(\d+)$/);

    if (presence) {
      await this.sendTo(
        chatId,
        [
          `Safetern Guardian · Covenant #${presence[1]}`,
          "",
          "Owner-wallet approval is required to cancel a recovery challenge.",
          "Open Safetern → Protect/Recover → open this covenant → tap I'M STILL HERE, then approve the GenLayer transaction with the owner wallet.",
          "",
          "Guardian intentionally cannot sign this owner-only action for you.",
        ].join("\n")
      );

      return;
    }

    const status = data.match(/^record_status:(\d+)$/);

    if (status) {
      await this.sendTo(
        chatId,
        this.formatRecord(getState(), status[1], wallet || ""),
        {
          reply_markup: this.mainKeyboard(),
        }
      );
    }
  }

  async pollCommands(getState) {
    if (!this.configured) return;

    const local = this.readLocalState();

    try {
      const updates = await this.call("getUpdates", {
        offset: Number(local.update_offset || 0),
        timeout: 0,
        allowed_updates: ["message", "callback_query"],
      });

      for (const update of updates || []) {
        local.update_offset = Math.max(
          Number(local.update_offset || 0),
          Number(update.update_id || 0) + 1
        );

        if (update.callback_query) {
          await this.handleCallback(update.callback_query, getState);
          continue;
        }

        const message = update?.message;

        if (!message?.chat?.id) continue;

        const chatId = String(message.chat.id);
        const text = String(message.text || "").trim();

        const pair = text.match(/^\/start\s+pair_([a-f0-9]+)$/i);

        if (pair) {
          const connected = this.completePair(
            pair[1],
            chatId,
            message.from || {}
          );

          if (connected) {
            await this.sendTo(
              chatId,
              [
                "Safetern Guardian connected ✓",
                "",
                `Wallet: ${shortWallet(connected.wallet)}`,
                "",
                "Your Guardian is now active.",
                "You will receive meaningful Protect, Watch and Recover alerts for Safetern records involving this wallet.",
                "",
                "Use the buttons below or type / to view available commands.",
              ].join("\n"),
              {
                reply_markup: this.mainKeyboard(),
              }
            );
          } else {
            await this.sendTo(
              chatId,
              "This Safetern Guardian pairing link is invalid or expired.\n\nReturn to Safetern and create a new connection request."
            );
          }

          continue;
        }

        const connections = this.readConnections();

        const wallet =
          connections.chats?.[chatId]?.wallet ||
          (chatId === this.chatId ? "" : null);

        if (wallet === null) {
          if (/^\/start\b/i.test(text)) {
            const lines = [
              "Safetern Guardian",
              "",
              "Your autonomous continuity companion.",
              "",
              "This Telegram account is not connected to a Safetern wallet yet.",
              "",
              "Open Safetern, connect your wallet, then choose Telegram Guardian to create a secure one-time pairing link.",
            ];

            await this.sendTo(
              chatId,
              lines.join("\n"),
              this.appUrl
                ? {
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "OPEN SAFETERN",
                            url: this.appUrl,
                          },
                        ],
                      ],
                    },
                  }
                : {}
            );
          } else if (/^\/help\b/i.test(text)) {
            await this.sendTo(
              chatId,
              "Connect Telegram Guardian from Safetern first. Once connected, you can use /status, /record <id>, /start and /help."
            );
          }

          continue;
        }

        if (/^\/start(?:@\w+)?\s*$/i.test(text)) {
          await this.sendHome(chatId, wallet || "");
          continue;
        }

        if (/^\/status(?:@\w+)?\s*$/i.test(text)) {
          await this.sendTo(
            chatId,
            this.formatStatus(getState(), wallet || ""),
            {
              reply_markup: this.mainKeyboard(),
            }
          );
          continue;
        }

        if (/^\/help(?:@\w+)?\s*$/i.test(text)) {
          await this.sendHelp(chatId);
          continue;
        }

        if (/^\/record(?:@\w+)?\s*$/i.test(text)) {
          await this.sendTo(
            chatId,
            [
              "Safetern Guardian · Record Lookup",
              "",
              "Enter the record ID after the command.",
              "",
              "Example:",
              "/record 8",
            ].join("\n"),
            {
              reply_markup: this.mainKeyboard(),
            }
          );
          continue;
        }

        const recordMatch = text.match(
          /^\/(?:record|watch)(?:@\w+)?\s+(\d+)\s*$/i
        );

        if (recordMatch) {
          await this.sendTo(
            chatId,
            this.formatRecord(
              getState(),
              recordMatch[1],
              wallet || ""
            ),
            {
              reply_markup: this.mainKeyboard(),
            }
          );
          continue;
        }

        if (text.startsWith("/")) {
          await this.sendTo(
            chatId,
            [
              "Safetern Guardian",
              "",
              "I don't recognize that command.",
              "",
              "Type / to view available Guardian commands, or use the buttons below.",
            ].join("\n"),
            {
              reply_markup: this.mainKeyboard(),
            }
          );
        }
      }
    } catch (error) {
      console.error(
        "Telegram Guardian command poll failed:",
        error?.message || error
      );
    }

    this.writeLocalState(local);
  }

  startCommandLoop(getState) {
    if (!this.configured || this.commandTimer) return;

    this.registerCommands();
    this.pollCommands(getState);

    this.commandTimer = setInterval(
      () => this.pollCommands(getState),
      5000
    );
  }
}