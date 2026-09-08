import crypto from "node:crypto";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { Wallet } from "ethers";

const norm = (v = "") => String(v || "").trim().toLowerCase();
const isAddress = (v = "") =>
  /^0x[a-fA-F0-9]{40}$/.test(String(v || ""));

export class SafeternDemoWallets {
  constructor({
    enabled = false,
    pool = [],
    contract = "",
    guardian = null,
  } = {}) {
    this.contract = contract;
    this.guardian = guardian;

    this.sessions = new Map();
    this.ipWindows = new Map();

    this.sessionTtlMs = 45 * 60 * 1000;
    this.minTxGapMs = 12_000;
    this.maxTxPerSession = 12;

    this.walletPool = [];
    this.enabled = false;

    if (!enabled || !contract) return;

    try {
      const configuredPool = Array.isArray(pool) ? pool : [];

      for (let i = 0; i < configuredPool.length; i++) {
        const entry = configuredPool[i] || {};
        const ownerKey = String(entry.ownerKey || "").trim();
        const beneficiaryKey = String(
          entry.beneficiaryKey || ""
        ).trim();

        if (!ownerKey || !beneficiaryKey) continue;

        const ownerAccount = createAccount(ownerKey);
        const beneficiaryAccount =
          createAccount(beneficiaryKey);

        const ownerClient = createClient({
          chain: studionet,
          account: ownerAccount,
        });

        const beneficiaryClient = createClient({
          chain: studionet,
          account: beneficiaryAccount,
        });

        const ownerSigner = new Wallet(ownerKey);
        const beneficiarySigner = new Wallet(
          beneficiaryKey
        );

        this.walletPool.push({
          id: i + 1,
          ownerAccount,
          beneficiaryAccount,
          ownerClient,
          beneficiaryClient,
          ownerSigner,
          beneficiarySigner,
          assignedToken: null,
          assignedAt: 0,
          expiresAt: 0,
        });
      }

      if (!this.walletPool.length) {
        throw new Error(
          "No valid demo wallet pairs were configured."
        );
      }

      this.enabled = true;

      console.log(
        `Safetern embedded demo pool initialized with ${this.walletPool.length} isolated wallet pair(s).`
      );
    } catch (error) {
      console.error(
        "Could not initialize Safetern demo wallet pool:",
        error?.message || error
      );

      this.walletPool = [];
      this.enabled = false;
    }
  }

  address(account) {
    return String(
      account?.address ||
        account?.account?.address ||
        account ||
        ""
    );
  }

  publicPair(pair) {
    return {
      owner: this.address(pair.ownerAccount),
      beneficiary: this.address(
        pair.beneficiaryAccount
      ),
    };
  }

  info(pair = null) {
    const base = {
      enabled: this.enabled,
      network: "GenLayer Studionet",
      expires_minutes: 45,
      pool_size: this.walletPool.length,
    };

    if (!pair) {
      return {
        ...base,
        available_pairs: this.availablePairCount(),
      };
    }

    return {
      ...base,
      ...this.publicPair(pair),
      pair_id: pair.id,
      available_pairs: this.availablePairCount(),
    };
  }

  availablePairCount() {
    this.cleanup(false);

    return this.walletPool.filter(
      (pair) => !pair.assignedToken
    ).length;
  }

  cleanup(runCount = true) {
    const now = Date.now();

    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.releaseSession(token);
      }
    }

    if (runCount) {
      return this.walletPool.filter(
        (pair) => !pair.assignedToken
      ).length;
    }

    return undefined;
  }

  releaseSession(token) {
    const key = String(token || "");
    const session = this.sessions.get(key);

    if (!session) return false;

    const pair = this.walletPool.find(
      (candidate) => candidate.id === session.pairId
    );

    if (pair && pair.assignedToken === key) {
      /*
       * Demo Guardian isolation:
       *
       * Guardian pairing is wallet-scoped. A disposable
       * wallet pair must therefore be disconnected from
       * Telegram before that pair can be recycled for a
       * future demo session.
       *
       * We clean both roles because either the Demo Owner
       * or Demo Beneficiary may have paired Guardian.
       */
      if (
        this.guardian?.configured &&
        typeof this.guardian.disconnectWallet ===
          "function"
      ) {
        const ownerWallet = this.address(
          pair.ownerAccount
        );

        const beneficiaryWallet = this.address(
          pair.beneficiaryAccount
        );

        try {
          this.guardian.disconnectWallet(ownerWallet);
        } catch (error) {
          console.warn(
            `Could not clear Guardian pairing for Demo Owner in pair ${pair.id}:`,
            error?.message || error
          );
        }

        try {
          this.guardian.disconnectWallet(
            beneficiaryWallet
          );
        } catch (error) {
          console.warn(
            `Could not clear Guardian pairing for Demo Beneficiary in pair ${pair.id}:`,
            error?.message || error
          );
        }
      }

      pair.assignedToken = null;
      pair.assignedAt = 0;
      pair.expiresAt = 0;
    }

    this.sessions.delete(key);
    return true;
  }

  acquirePair() {
    this.cleanup(false);

    return (
      this.walletPool.find(
        (pair) => !pair.assignedToken
      ) || null
    );
  }

  createSession(ip = "") {
    if (!this.enabled) {
      throw new Error(
        "Embedded demo wallet pool is not configured yet."
      );
    }

    this.cleanup(false);

    const now = Date.now();
    const key = String(ip || "unknown");

    const window = this.ipWindows.get(key) || {
      startedAt: now,
      sessions: 0,
      tx: 0,
    };

    if (
      now - window.startedAt >
      60 * 60 * 1000
    ) {
      window.startedAt = now;
      window.sessions = 0;
      window.tx = 0;
    }

    if (window.sessions >= 6) {
      throw new Error(
        "Demo session limit reached for this connection. Try again later."
      );
    }

    const pair = this.acquirePair();

    if (!pair) {
      throw new Error(
        "All Safetern demo wallets are currently in use. Please try again shortly."
      );
    }

    const token = crypto
      .randomBytes(32)
      .toString("hex");

    const expiresAt =
      now + this.sessionTtlMs;

    pair.assignedToken = token;
    pair.assignedAt = now;
    pair.expiresAt = expiresAt;

    const session = {
      token,
      ip,
      pairId: pair.id,
      createdAt: now,
      expiresAt,
      lastTxAt: 0,
      txCount: 0,
    };

    this.sessions.set(token, session);

    window.sessions += 1;
    this.ipWindows.set(key, window);

    return {
      ...this.info(pair),
      token,
      expires_at: Math.floor(
        expiresAt / 1000
      ),
    };
  }

  /*
   * Restore an existing embedded demo session.
   *
   * This does NOT create a new session or allocate another
   * wallet pair. The supplied token is validated by the same
   * getSession() and getSessionPair() checks used by demo
   * transactions, signing, and Guardian actions.
   */
  getSessionInfo({
    token,
    ip,
  }) {
    if (!this.enabled) {
      throw new Error(
        "Embedded demo wallet pool is not configured yet."
      );
    }

    const session = this.getSession(
      token,
      ip
    );

    const pair = this.getSessionPair(
      session
    );

    return {
      ...this.info(pair),
      token: session.token,
      expires_at: Math.floor(
        session.expiresAt / 1000
      ),
      tx_count: session.txCount,
      max_tx_per_session: this.maxTxPerSession,
    };
  }

  getSession(token, ip = "") {
    this.cleanup(false);

    const key = String(token || "");
    const session = this.sessions.get(key);

    if (
      !session ||
      session.expiresAt <= Date.now()
    ) {
      throw new Error(
        "Demo session expired. Start a new demo session."
      );
    }

    if (
      session.ip &&
      ip &&
      session.ip !== ip
    ) {
      throw new Error(
        "Demo session does not match this connection."
      );
    }

    return session;
  }

  getSessionPair(session) {
    const pair = this.walletPool.find(
      (candidate) =>
        candidate.id === session.pairId
    );

    if (
      !pair ||
      pair.assignedToken !== session.token
    ) {
      throw new Error(
        "Demo wallet assignment is no longer available. Start a new demo session."
      );
    }

    return pair;
  }

  consumeTx(session) {
    const now = Date.now();
    const key = String(
      session.ip || "unknown"
    );

    const window = this.ipWindows.get(key) || {
      startedAt: now,
      sessions: 0,
      tx: 0,
    };

    if (
      now - window.startedAt >
      60 * 60 * 1000
    ) {
      window.startedAt = now;
      window.sessions = 0;
      window.tx = 0;
    }

    if (window.tx >= 24) {
      throw new Error(
        "Demo transaction limit reached for this connection. Try again later."
      );
    }

    if (
      session.txCount >=
      this.maxTxPerSession
    ) {
      throw new Error(
        "Demo transaction limit reached. Start a fresh demo session later."
      );
    }

    if (
      session.lastTxAt &&
      now - session.lastTxAt <
        this.minTxGapMs
    ) {
      throw new Error(
        "Please wait a few seconds before submitting another demo transaction."
      );
    }

    session.lastTxAt = now;
    session.txCount += 1;

    window.tx += 1;
    this.ipWindows.set(key, window);
  }

  validateCall(
    pair,
    role,
    functionName,
    args = []
  ) {
    const owner = norm(
      this.address(pair.ownerAccount)
    );

    const beneficiary = norm(
      this.address(
        pair.beneficiaryAccount
      )
    );

    const ownerAllowed = new Set([
      "create_watch",
      "create_protect_covenant",
      "create_recovery_covenant",
      "assess",
      "confirm_presence",
      "finalize_recovery",
    ]);

    const beneficiaryAllowed = new Set([
      "register_recovery_identity",
      "claim_recovery_access",
      "assess",
      "finalize_recovery",
    ]);

    const allowed =
      role === "beneficiary"
        ? beneficiaryAllowed
        : ownerAllowed;

    if (!allowed.has(functionName)) {
      throw new Error(
        `That action is not available to the Demo ${
          role === "beneficiary"
            ? "Beneficiary"
            : "Owner"
        }.`
      );
    }

    if (!Array.isArray(args)) {
      throw new Error(
        "Invalid demo transaction arguments."
      );
    }

    const next = [...args];

    if (
      [
        "create_watch",
        "create_protect_covenant",
        "create_recovery_covenant",
      ].includes(functionName)
    ) {
      const raw = String(
        next[0] || "Untitled"
      )
        .trim()
        .slice(0, 100);

      next[0] = raw.startsWith("Demo ·")
        ? raw
        : `Demo · ${raw}`;
    }

    if (
      functionName ===
      "create_protect_covenant"
    ) {
      if (
        !isAddress(next[3]) ||
        ![owner, beneficiary].includes(
          norm(next[3])
        )
      ) {
        next[3] = this.address(
          pair.beneficiaryAccount
        );
      }

      const challenge = Number(
        next[7] || 0
      );

      if (
        !Number.isFinite(challenge) ||
        challenge < 60
      ) {
        next[7] = 60;
      }
    }

    if (
      functionName ===
      "create_recovery_covenant"
    ) {
      next[3] = this.address(
        pair.beneficiaryAccount
      );

      const challenge = Number(
        next[7] || 0
      );

      if (
        !Number.isFinite(challenge) ||
        challenge < 60
      ) {
        next[7] = 60;
      }
    }

    return next;
  }

  async transact({
    token,
    ip,
    role = "owner",
    functionName,
    args,
  }) {
    if (!this.enabled) {
      throw new Error(
        "Embedded demo wallet pool is not configured yet."
      );
    }

    const session = this.getSession(
      token,
      ip
    );

    const pair = this.getSessionPair(
      session
    );

    this.consumeTx(session);

    const safeRole =
      role === "beneficiary"
        ? "beneficiary"
        : "owner";

    const safeArgs = this.validateCall(
      pair,
      safeRole,
      String(functionName || ""),
      args
    );

    const client =
      safeRole === "beneficiary"
        ? pair.beneficiaryClient
        : pair.ownerClient;

    const result =
      await client.writeContract({
        address: this.contract,
        functionName: String(
          functionName
        ),
        args: safeArgs,
        value: 0n,
      });

    const hash =
      typeof result === "string"
        ? result
        : result?.hash ||
          result?.transactionHash ||
          "";

    return {
      ok: true,
      hash,
      role: safeRole,
      wallet:
        safeRole === "beneficiary"
          ? this.address(
              pair.beneficiaryAccount
            )
          : this.address(
              pair.ownerAccount
            ),
      pair_id: pair.id,
      tx_count: session.txCount,
    };
  }

  async signRecoveryMessage({
    token,
    ip,
    role = "beneficiary",
    message = "",
  }) {
    if (!this.enabled) {
      throw new Error(
        "Embedded demo wallet pool is not configured yet."
      );
    }

    const session = this.getSession(
      token,
      ip
    );

    const pair = this.getSessionPair(
      session
    );

    const safeRole =
      role === "owner"
        ? "owner"
        : "beneficiary";

    const wallet =
      safeRole === "owner"
        ? this.address(
            pair.ownerAccount
          )
        : this.address(
            pair.beneficiaryAccount
          );

    const prefix =
      `Safetern Recovery Identity Unlock v2\n` +
      `Wallet: ${wallet.toLowerCase()}\n` +
      `PublicKeyHash: `;

    if (
      !String(message).startsWith(
        prefix
      ) ||
      String(message).length >
        prefix.length + 80
    ) {
      throw new Error(
        "Demo signing is limited to Safetern Recovery Identity unlock messages."
      );
    }

    const signer =
      safeRole === "owner"
        ? pair.ownerSigner
        : pair.beneficiarySigner;

    return {
      ok: true,
      wallet,
      signature:
        await signer.signMessage(
          String(message)
        ),
    };
  }

  guardianLink({
    token,
    ip,
    role = "owner",
  }) {
    if (
      !this.enabled ||
      !this.guardian?.configured
    ) {
      throw new Error(
        "Telegram Guardian is not available for the demo."
      );
    }

    const session = this.getSession(
      token,
      ip
    );

    const pair = this.getSessionPair(
      session
    );

    const wallet =
      role === "beneficiary"
        ? this.address(
            pair.beneficiaryAccount
          )
        : this.address(
            pair.ownerAccount
          );

    const guardianPair =
      this.guardian.createPairToken(
        wallet
      );

    return {
      ok: true,
      wallet,
      telegram_url:
        guardianPair.url,
      expires_at:
        guardianPair.expires_at,
      shared_demo_wallet: false,
      isolated_demo_wallet: true,
      pair_id: pair.id,
    };
  }

  guardianDisconnect({
    token,
    ip,
    role = "owner",
  }) {
    if (
      !this.enabled ||
      !this.guardian?.configured
    ) {
      throw new Error(
        "Telegram Guardian is not available for the demo."
      );
    }

    const session = this.getSession(
      token,
      ip
    );

    const pair = this.getSessionPair(
      session
    );

    const wallet =
      role === "beneficiary"
        ? this.address(
            pair.beneficiaryAccount
          )
        : this.address(
            pair.ownerAccount
          );

    const disconnected =
      this.guardian.disconnectWallet(
        wallet
      );

    return {
      ok: true,
      connected: false,
      disconnected,
      wallet,
      pair_id: pair.id,
    };
  }
}