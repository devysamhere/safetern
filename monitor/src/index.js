import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createAccount, createClient } from "genlayer-js";
import { verifyMessage } from "ethers";
import { studionet } from "genlayer-js/chains";
import { TelegramGuardian } from "./guardian.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const CONTRACT = process.env.SAFETERN_CONTRACT || "";
const PORT = Number(process.env.PORT || 8787);
const POLL_SECONDS = Math.max(60, Number(process.env.POLL_SECONDS || 900));
const STATE_POLL_SECONDS = Math.max(30, Number(process.env.STATE_POLL_SECONDS || 60));
const INITIAL_POLL_DELAY_SECONDS = Math.max(0, Number(process.env.INITIAL_POLL_DELAY_SECONDS || 10));
const ALERT_PCT = Math.max(1, Number(process.env.LIQUIDITY_ALERT_PERCENT || 40));
const SEVERE_PCT = Math.max(ALERT_PCT, Number(process.env.SEVERE_LIQUIDITY_ALERT_PERCENT || 65));
const AUTO_ASSESS = String(process.env.AUTO_ASSESS || "false").toLowerCase() === "true";
const PENDING_RETRY_SECONDS = Math.max(900, Number(process.env.ASSESSMENT_PENDING_RETRY_SECONDS || 7200));
const KEEPER_KEY = String(process.env.GENLAYER_KEEPER_PRIVATE_KEY || "").trim();
const TELEGRAM_BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID || "").trim();
const TELEGRAM_BOT_USERNAME = String(process.env.TELEGRAM_BOT_USERNAME || "SafeternGuardianBot").trim().replace(/^@/, "");
const SAFETERN_APP_URL = String(process.env.SAFETERN_APP_URL || "http://localhost:5173").trim();
const AUTO_FINALIZE = String(process.env.AUTO_FINALIZE ?? process.env.AUTO_ASSESS ?? "false").toLowerCase() === "true";
const FINALIZE_PENDING_RETRY_SECONDS = Math.max(900, Number(process.env.FINALIZE_PENDING_RETRY_SECONDS || 7200));

const readClient = createClient({ chain: studionet });
// Studionet's public RPC is capped at 30 requests/minute. Keep monitor reads
// below that ceiling and leave headroom for the frontend/keeper.
const RPC_READ_INTERVAL_MS = Math.max(2200, Number(process.env.RPC_READ_INTERVAL_MS || 2600));
let lastRpcReadAt = 0;
let rpcReadQueue = Promise.resolve();
function readContractThrottled(request) {
  const run = async () => {
    const waitMs = Math.max(0, RPC_READ_INTERVAL_MS - (Date.now() - lastRpcReadAt));
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
    try {
      return await readClient.readContract(request);
    } finally {
      lastRpcReadAt = Date.now();
    }
  };
  const task = rpcReadQueue.then(run, run);
  rpcReadQueue = task.catch(() => {});
  return task;
}
let keeperClient = null;
if (AUTO_ASSESS && KEEPER_KEY) {
  try {
    const account = createAccount(KEEPER_KEY);
    keeperClient = createClient({ chain: studionet, account });
  } catch (error) {
    console.error("Could not initialize keeper account:", error?.message || error);
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const guardian = new TelegramGuardian({ root: ROOT, token: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_CHAT_ID, contract: CONTRACT, appUrl: SAFETERN_APP_URL, botUsername: TELEGRAM_BOT_USERNAME });
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch { return { watches: {}, records: {}, events: [], updated_at: 0 }; }
}
function writeState(state) {
  state.updated_at = Math.floor(Date.now() / 1000);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function addEvent(state, event) {
  state.events.unshift({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, at: Math.floor(Date.now()/1000), ...event });
  state.events = state.events.slice(0, 300);
}
function parseJson(value, fallback = {}) { try { return JSON.parse(value || ""); } catch { return fallback; } }
function chainAlias(name = "") {
  const k = String(name).trim().toLowerCase();
  return ({ ethereum:"ethereum",eth:"ethereum",base:"base",solana:"solana",sol:"solana",bsc:"bsc","bnb chain":"bsc","binance smart chain":"bsc",arbitrum:"arbitrum",polygon:"polygon",optimism:"optimism",avalanche:"avalanche" })[k] || k.replace(/\s+/g,"-");
}
async function getText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Safetern-Monitor/0.1", accept: "text/html,application/json;q=0.9,*/*;q=0.8" }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}
function stripHtml(text = "") {
  return String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:a|article|div|h[1-6]|li|p|section|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function symbolMentionedNearDelist(text, symbol) {
  const plain = stripHtml(text).toUpperCase().replace(/PUBLISHED ON/g, "\nPUBLISHED ON");
  const sym = String(symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!sym || sym.length < 2) return false;

  // Require the token symbol as a standalone token. The previous substring
  // search could mistake UNI inside words such as COMMUNITY for a UNI signal.
  const token = `(?:^|[^A-Z0-9])${escapeRegex(sym)}(?=$|[^A-Z0-9])`;
  // Match an actual delisting/removal action, not a generic page heading such
  // as "Delistings". Keep the action and token close enough to represent the
  // same announcement title/entry.
  const action = "\\b(?:DELIST|DELISTED|DELISTING|REMOVE|REMOVED|REMOVING|REMOVAL|DISCONTINUE|DISCONTINUED|SUSPEND(?:ED|ING)?\\s+TRADING|END(?:ED|ING)?\\s+TRADING)\\b";
  const forward = new RegExp(`${action}.{0,180}${token}`, "i");
  const reverse = new RegExp(`${token}.{0,180}${action}`, "i");

  const chunks = plain.split(/\n+/).map(part => part.trim()).filter(Boolean);
  return chunks.some(chunk => forward.test(chunk) || reverse.test(chunk));
}

async function fetchDex(metadata) {
  const chain = chainAlias(metadata.blockchain);
  const address = String(metadata.contract_address || "").trim();
  if (!chain || !address) return { available:false, error:"Missing chain or contract address" };
  const url = `https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`;
  try {
    const data = JSON.parse(await getText(url));
    const pairs = Array.isArray(data) ? data : [];
    let total = 0, largest = 0, pools = 0, volume24h = 0;
    for (const pair of pairs) {
      const liq = Number(pair?.liquidity?.usd || 0);
      if (Number.isFinite(liq) && liq > 0) { total += liq; pools += 1; largest = Math.max(largest, liq); }
      const vol = Number(pair?.volume?.h24 || 0); if (Number.isFinite(vol) && vol > 0) volume24h += vol;
    }
    return { available:pairs.length>0, provider:"DEX Screener", url, chain, total_liquidity_usd:Math.round(total), largest_pool_usd:Math.round(largest), pool_count:pools, volume_24h_usd:Math.round(volume24h) };
  } catch (error) { return { available:false, provider:"DEX Screener", url, error:error?.message || String(error) }; }
}

const ANNOUNCEMENT_URLS = {
  Binance: "https://www.binance.com/en/support/announcement/list/0000000000161",
  Bybit: "https://announcements.bybit.com/en/?category=delistings&page=1",
  OKX: "https://www.okx.com/en-us/help/section/announcements-delistings",
  KuCoin: "https://www.kucoin.com/announcement/delistings",
};
async function fetchExchangeSignals(metadata) {
  const symbol = String(metadata.token_symbol || "").toUpperCase();
  const selected = Array.isArray(metadata.major_exchanges) && metadata.major_exchanges.length ? metadata.major_exchanges : ["Binance","Coinbase","Bybit","OKX","KuCoin"];
  const result = {};
  for (const name of selected) {
    if (ANNOUNCEMENT_URLS[name]) {
      try {
        const body = await getText(ANNOUNCEMENT_URLS[name]);
        result[name] = { source: ANNOUNCEMENT_URLS[name], delisting_mention: symbolMentionedNearDelist(body, symbol), status:"checked" };
      } catch (error) { result[name] = { source: ANNOUNCEMENT_URLS[name], delisting_mention:false, status:"error", error:error?.message || String(error) }; }
    } else if (name === "Coinbase") {
      try {
        const products = JSON.parse(await getText("https://api.exchange.coinbase.com/products"));
        const matches = Array.isArray(products) ? products.filter(p => String(p?.base_currency || "").toUpperCase() === symbol) : [];
        result[name] = { source:"https://api.exchange.coinbase.com/products", listed:matches.length>0, matching_spot_products:matches.slice(0,10).map(p=>p.id), status:"checked" };
      } catch (error) { result[name] = { source:"https://api.exchange.coinbase.com/products", status:"error", error:error?.message || String(error) }; }
    }
  }
  return result;
}

async function readContinuityRows() {
  if (!CONTRACT || !CONTRACT.startsWith("0x")) throw new Error("Set SAFETERN_CONTRACT in monitor/.env.");
  const count = Number(await readContractThrottled({ address:CONTRACT, functionName:"get_record_count", args:[], stateStatus:"accepted" }) || 0);
  const rows = [];
  for (let id = 1; id <= count; id++) {
    const record = await readContractThrottled({ address:CONTRACT, functionName:"get_record", args:[id], stateStatus:"accepted" });
    const monitoring = await readContractThrottled({ address:CONTRACT, functionName:"get_monitoring_config", args:[id], stateStatus:"accepted" });
    let latest = null;
    try { latest = await readContractThrottled({ address:CONTRACT, functionName:"get_latest_assessment", args:[id], stateStatus:"accepted" }); } catch {}
    let metadata = {};
    if (record?.mode === "WATCH") {
      try {
        const wm = await readContractThrottled({ address:CONTRACT, functionName:"get_watch_metadata", args:[id], stateStatus:"accepted" });
        metadata = parseJson(wm?.metadata_json,"{}");
      } catch {}
    }
    rows.push({ id, record, metadata, monitoring, latest });
  }
  return rows;
}

async function maybeAssess(row, reasons, state) {
  if (!reasons.length || !AUTO_ASSESS || !keeperClient) return null;
  try {
    const tx = await keeperClient.writeContract({ address:CONTRACT, functionName:"assess", args:[Number(row.id)], value:0n });
    const hash = typeof tx === "string" ? tx : tx?.hash || tx?.transactionHash || "";
    addEvent(state,{ type:"assessment_triggered", record_id:row.id, name:row.record.name, reasons, tx_hash:hash });
    return hash;
  } catch (error) {
    addEvent(state,{ type:"assessment_trigger_failed", record_id:row.id, name:row.record.name, reasons, error:error?.message || String(error) });
    return null;
  }
}

async function maybeFinalizeRecovery(row, state) {
  if (!AUTO_FINALIZE || !keeperClient) return null;
  try {
    const tx = await keeperClient.writeContract({ address:CONTRACT, functionName:"finalize_recovery", args:[Number(row.id)], value:0n });
    const hash = typeof tx === "string" ? tx : tx?.hash || tx?.transactionHash || "";
    addEvent(state,{ type:"recovery_finalize_triggered", record_id:row.id, name:row.record.name, mode:row.record.mode, beneficiary:row.record.beneficiary || "", tx_hash:hash });
    return hash;
  } catch (error) {
    addEvent(state,{ type:"recovery_finalize_failed", record_id:row.id, name:row.record.name, mode:row.record.mode, error:error?.message || String(error) });
    return null;
  }
}

async function pollOnce() {
  const state = readState();
  state.watches ||= {};
  state.records ||= {};
  state.events ||= [];
  const now = Math.floor(Date.now()/1000);
  const rows = await readContinuityRows();

  for (const row of rows) {
    const key = String(row.id);
    const record = row.record || {};
    const mode = String(record.mode || "");
    const prior = state.records[key] || state.watches[key] || {};
    const metadata = row.metadata || {};
    const interval = Number(row.monitoring?.interval_seconds || 86400);
    const lastAssessment = Number(row.monitoring?.last_assessment_at || 0);
    const latestClassification = row.latest?.found ? String(row.latest.classification || "") : "";
    const latestConfidence = row.latest?.found ? Number(row.latest.confidence || 0) : 0;
    const latestAssessmentId = row.latest?.found ? Number(row.latest.assessment_id || 0) : 0;
    const priorClassification = String(prior?.latest_classification || "");
    const priorState = String(prior?.state || "");
    const currentState = String(record.state || "");

    let dex = null, exchanges = null, liquidityChange = null;
    let confirmedMentions = [], newConfirmedMentions = [];
    if (mode === "WATCH" && metadata.watch_type === "CRYPTO_TOKEN") {
      if (metadata.track_dex_liquidity) dex = await fetchDex(metadata);
      if (metadata.track_exchange_delistings) exchanges = await fetchExchangeSignals(metadata);
      const oldLiquidity = Number(prior?.dex?.total_liquidity_usd || 0);
      const newLiquidity = Number(dex?.total_liquidity_usd || 0);
      if (oldLiquidity > 0 && newLiquidity >= 0) liquidityChange = ((newLiquidity-oldLiquidity)/oldLiquidity)*100;

      const currentMentions = Object.entries(exchanges || {}).filter(([,v]) => v?.delisting_mention).map(([name])=>name);
      const priorMentions = Object.entries(prior?.exchanges || {}).filter(([,v]) => v?.delisting_mention).map(([name])=>name);
      const priorConfirmedMentions = Array.isArray(prior?.confirmed_delisting_exchanges) ? prior.confirmed_delisting_exchanges : [];
      confirmedMentions = currentMentions.filter(name => priorMentions.includes(name));
      newConfirmedMentions = confirmedMentions.filter(name => !priorConfirmedMentions.includes(name));

      if (liquidityChange !== null && liquidityChange <= -ALERT_PCT) addEvent(state,{ type:"liquidity_alert", record_id:row.id, name:record.name, change_percent:Number(liquidityChange.toFixed(2)), previous_usd:oldLiquidity, current_usd:newLiquidity });
      if (newConfirmedMentions.length) addEvent(state,{ type:"delisting_alert", record_id:row.id, name:record.name, exchanges:newConfirmedMentions, token_symbol:metadata.token_symbol });
    }

    // Surface GenLayer classification changes for every Safetern mode.
    if (priorClassification && latestClassification && latestClassification !== priorClassification) {
      let market = {};
      if (mode === "WATCH") {
        try {
          const snap = await readContractThrottled({ address:CONTRACT, functionName:"get_watch_market_snapshot", args:[Number(row.id)], stateStatus:"accepted" });
          market = parseJson(snap?.snapshot_json, {});
        } catch {}
      }
      addEvent(state,{
        type: mode === "WATCH" ? "watch_status_changed" : "assessment_status_changed",
        record_id:row.id, name:record.name, mode,
        previous_classification:priorClassification, classification:latestClassification,
        confidence:latestConfidence, evidence_summary:row.latest?.evidence_summary || "",
        dex_liquidity_usd:Number(market?.dex?.total_liquidity_usd || market?.total_liquidity_usd || 0),
        liquidity_change_percent:market?.liquidity_change_percent ?? market?.change_percent ?? null
      });
    }

    // Detect the recovery lifecycle itself. This is separate from the AI
    // classification because CHALLENGE/RECOVERED are onchain control states.
    if (currentState && currentState !== priorState) {
      if (currentState === "CHALLENGE") {
        addEvent(state,{ type:"challenge_started", record_id:row.id, name:record.name, mode, owner:record.owner || "", beneficiary:record.beneficiary || "", challenge_expires_at:Number(record.challenge_expires_at || 0), confidence:latestConfidence, classification:latestClassification, evidence_summary:row.latest?.evidence_summary || "" });
      } else if (priorState === "CHALLENGE" && currentState === "HEALTHY") {
        addEvent(state,{ type:"challenge_cancelled", record_id:row.id, name:record.name, mode, owner:record.owner || "" });
      } else if (currentState === "RECOVERED" && priorState === "CHALLENGE") {
        addEvent(state,{ type:"recovery_finalized", record_id:row.id, name:record.name, mode, beneficiary:record.beneficiary || "", recovery_controller:record.recovery_controller || "", recovered_at:Number(record.recovered_at || 0) });
      } else if (priorState) {
        addEvent(state,{ type:"continuity_state_changed", record_id:row.id, name:record.name, mode, previous_state:priorState, state:currentState });
      }
    }

    // Pending assessment de-duplication applies to Watch, Protect and Recover.
    let pendingAssessment = prior?.pending_assessment || null;
    if (pendingAssessment) {
      const baseline = Number(pendingAssessment.baseline_last_assessment_at || 0);
      if (lastAssessment > baseline) {
        addEvent(state,{ type:"assessment_finalized", record_id:row.id, name:record.name, mode, tx_hash:pendingAssessment.tx_hash || "", submitted_at:pendingAssessment.submitted_at || 0, onchain_last_assessment_at:lastAssessment });
        pendingAssessment = null;
      } else if (now >= Number(pendingAssessment.submitted_at || 0) + PENDING_RETRY_SECONDS) {
        addEvent(state,{ type:"assessment_pending_timeout", record_id:row.id, name:record.name, mode, tx_hash:pendingAssessment.tx_hash || "", submitted_at:pendingAssessment.submitted_at || 0 });
        pendingAssessment = null;
      }
    }

    // Finalization also needs de-duplication because the GenLayer write can be
    // pending across multiple lightweight polls.
    let pendingFinalize = prior?.pending_finalize || null;
    if (pendingFinalize) {
      if (currentState === "RECOVERED") {
        pendingFinalize = null;
      } else if (now >= Number(pendingFinalize.submitted_at || 0) + FINALIZE_PENDING_RETRY_SECONDS) {
        addEvent(state,{ type:"recovery_finalize_pending_timeout", record_id:row.id, name:record.name, mode, tx_hash:pendingFinalize.tx_hash || "", submitted_at:pendingFinalize.submitted_at || 0 });
        pendingFinalize = null;
      }
    }

    const assessmentAllowed = Boolean(record.active) && currentState !== "CHALLENGE" && currentState !== "RECOVERED";
    const scheduledDue = assessmentAllowed && (lastAssessment === 0 || now >= lastAssessment + interval);
    const reasons = [];
    if (mode === "WATCH") {
      if (liquidityChange !== null && liquidityChange <= -SEVERE_PCT) reasons.push(`severe_liquidity_drop_${Math.abs(liquidityChange).toFixed(1)}pct`);
      else if (liquidityChange !== null && liquidityChange <= -ALERT_PCT) reasons.push(`liquidity_drop_${Math.abs(liquidityChange).toFixed(1)}pct`);
      if (newConfirmedMentions.length) reasons.push(`confirmed_delisting_signal_${newConfirmedMentions.join("_")}`);
    }
    if (scheduledDue) reasons.push("scheduled_assessment_due");

    const common = {
      record_id:row.id, mode, name:record.name, entity:record.protected_entity,
      owner:record.owner || "", beneficiary:record.beneficiary || "", recovery_controller:record.recovery_controller || "",
      state:currentState, active:Boolean(record.active), challenge_started_at:Number(record.challenge_started_at || 0),
      challenge_expires_at:Number(record.challenge_expires_at || 0), recovered_at:Number(record.recovered_at || 0),
      checked_at:now, next_lightweight_check_at:now+POLL_SECONDS,
      assessment_due:reasons.length>0, assessment_reasons:reasons,
      onchain_last_assessment_at:lastAssessment, onchain_assessment_interval_seconds:interval,
      assessment_pending:Boolean(pendingAssessment), pending_assessment:pendingAssessment,
      finalize_pending:Boolean(pendingFinalize), pending_finalize:pendingFinalize,
      latest_assessment_id:latestAssessmentId, latest_classification:latestClassification, latest_confidence:latestConfidence,
    };

    state.records[key] = common;
    if (mode === "WATCH") {
      state.watches[key] = {
        ...common,
        watch_type:metadata.watch_type, token_symbol:metadata.token_symbol || "", blockchain:metadata.blockchain || "", contract_address:metadata.contract_address || "",
        dex, liquidity_change_since_last_poll_percent: liquidityChange === null ? null : Number(liquidityChange.toFixed(2)), exchanges,
        confirmed_delisting_exchanges:confirmedMentions,
      };
      // Keep the canonical record view in sync with market fields so Guardian
      // can render /record and /status without looking in two places.
      state.records[key] = { ...state.records[key], ...state.watches[key] };
    } else {
      delete state.watches[key];
    }

    // Submit at most one assessment at a time for this record.
    if (!pendingAssessment && reasons.length) {
      const hash = await maybeAssess(row, reasons, state);
      if (hash) {
        const p = { tx_hash:hash, submitted_at:now, baseline_last_assessment_at:lastAssessment, reasons:[...reasons] };
        state.records[key].assessment_pending = true;
        state.records[key].pending_assessment = p;
        if (mode === "WATCH") { state.watches[key].assessment_pending = true; state.watches[key].pending_assessment = p; }
      }
    }

    // Once the challenge expires, any keeper can finalize. Owner absence never
    // blocks the recovery path. Owner confirmation remains owner-wallet-only.
    const challengeExpired = mode !== "WATCH" && currentState === "CHALLENGE" && Number(record.challenge_expires_at || 0) > 0 && now >= Number(record.challenge_expires_at || 0);
    if (challengeExpired && !pendingFinalize) {
      const hash = await maybeFinalizeRecovery(row, state);
      if (hash) {
        const p = { tx_hash:hash, submitted_at:now, challenge_expires_at:Number(record.challenge_expires_at || 0) };
        state.records[key].finalize_pending = true;
        state.records[key].pending_finalize = p;
      }
    }
  }

  writeState(state);
  await guardian.notifyNewEvents(state);
  const activeWatches = Object.values(state.watches || {}).filter(w => w?.active).length;
  const activeCovenants = Object.values(state.records || {}).filter(r => r?.active && r?.mode !== "WATCH").length;
  console.log(`[${new Date().toISOString()}] monitored ${activeWatches} Watch record(s), ${activeCovenants} covenant(s)`);
  return state;
}


let lifecyclePollRunning = false;

async function lifecyclePollOnce() {
  if (lifecyclePollRunning) return;
  lifecyclePollRunning = true;
  try {
    const state = readState();
    state.watches ||= {};
    state.records ||= {};
    state.events ||= [];
    const now = Math.floor(Date.now()/1000);

    // Fast path: only records that are waiting for consensus, inside a
    // challenge, or waiting for finalization. No full record scan and no
    // external market/API checks happen here.
    const candidates = Object.values(state.records || {}).filter(r =>
      r && r.record_id && r.mode !== "WATCH" && (
        r.assessment_pending || r.finalize_pending || r.state === "CHALLENGE"
      )
    );

    for (const prior of candidates) {
      const id = Number(prior.record_id);
      let record;
      try {
        record = await readContractThrottled({ address:CONTRACT, functionName:"get_record", args:[id], stateStatus:"accepted" });
      } catch {
        continue;
      }

      let monitoring = null;
      let latest = null;
      try { monitoring = await readContractThrottled({ address:CONTRACT, functionName:"get_monitoring_config", args:[id], stateStatus:"accepted" }); } catch {}
      try { latest = await readContractThrottled({ address:CONTRACT, functionName:"get_latest_assessment", args:[id], stateStatus:"accepted" }); } catch {}

      const key = String(id);
      const currentState = String(record?.state || prior.state || "");
      const priorState = String(prior.state || "");
      const lastAssessment = Number(monitoring?.last_assessment_at ?? prior.onchain_last_assessment_at ?? 0);
      const latestClassification = latest?.found ? String(latest.classification || "") : String(prior.latest_classification || "");
      const latestConfidence = latest?.found ? Number(latest.confidence || 0) : Number(prior.latest_confidence || 0);
      const latestAssessmentId = latest?.found ? Number(latest.assessment_id || 0) : Number(prior.latest_assessment_id || 0);

      let pendingAssessment = prior.pending_assessment || null;
      if (pendingAssessment) {
        const baseline = Number(pendingAssessment.baseline_last_assessment_at || 0);
        if (lastAssessment > baseline) {
          addEvent(state,{ type:"assessment_finalized", record_id:id, name:record.name || prior.name, mode:record.mode || prior.mode, tx_hash:pendingAssessment.tx_hash || "", submitted_at:pendingAssessment.submitted_at || 0, onchain_last_assessment_at:lastAssessment });
          pendingAssessment = null;
        } else if (now >= Number(pendingAssessment.submitted_at || 0) + PENDING_RETRY_SECONDS) {
          addEvent(state,{ type:"assessment_pending_timeout", record_id:id, name:record.name || prior.name, mode:record.mode || prior.mode, tx_hash:pendingAssessment.tx_hash || "", submitted_at:pendingAssessment.submitted_at || 0 });
          pendingAssessment = null;
        }
      }

      if (currentState && currentState !== priorState) {
        if (currentState === "CHALLENGE") {
          addEvent(state,{ type:"challenge_started", record_id:id, name:record.name || prior.name, mode:record.mode || prior.mode, owner:record.owner || prior.owner || "", beneficiary:record.beneficiary || prior.beneficiary || "", challenge_expires_at:Number(record.challenge_expires_at || 0), confidence:latestConfidence, classification:latestClassification, evidence_summary:latest?.evidence_summary || "" });
        } else if (priorState === "CHALLENGE" && currentState === "HEALTHY") {
          addEvent(state,{ type:"challenge_cancelled", record_id:id, name:record.name || prior.name, mode:record.mode || prior.mode, owner:record.owner || prior.owner || "" });
        } else if (currentState === "RECOVERED" && priorState === "CHALLENGE") {
          addEvent(state,{ type:"recovery_finalized", record_id:id, name:record.name || prior.name, mode:record.mode || prior.mode, beneficiary:record.beneficiary || prior.beneficiary || "", recovery_controller:record.recovery_controller || prior.recovery_controller || "", recovered_at:Number(record.recovered_at || 0) });
        }
      }

      let pendingFinalize = prior.pending_finalize || null;
      if (pendingFinalize) {
        if (currentState === "RECOVERED") pendingFinalize = null;
        else if (now >= Number(pendingFinalize.submitted_at || 0) + FINALIZE_PENDING_RETRY_SECONDS) {
          addEvent(state,{ type:"recovery_finalize_pending_timeout", record_id:id, name:record.name || prior.name, mode:record.mode || prior.mode, tx_hash:pendingFinalize.tx_hash || "", submitted_at:pendingFinalize.submitted_at || 0 });
          pendingFinalize = null;
        }
      }

      state.records[key] = {
        ...prior,
        name: record.name || prior.name,
        entity: record.protected_entity || prior.entity,
        owner: record.owner || prior.owner || "",
        beneficiary: record.beneficiary || prior.beneficiary || "",
        recovery_controller: record.recovery_controller || prior.recovery_controller || "",
        state: currentState,
        active: Boolean(record.active),
        challenge_started_at: Number(record.challenge_started_at || 0),
        challenge_expires_at: Number(record.challenge_expires_at || 0),
        recovered_at: Number(record.recovered_at || 0),
        checked_at: now,
        onchain_last_assessment_at: lastAssessment,
        assessment_pending: Boolean(pendingAssessment),
        pending_assessment: pendingAssessment,
        finalize_pending: Boolean(pendingFinalize),
        pending_finalize: pendingFinalize,
        latest_assessment_id: latestAssessmentId,
        latest_classification: latestClassification,
        latest_confidence: latestConfidence,
      };

      const challengeExpired = currentState === "CHALLENGE" && Number(record.challenge_expires_at || 0) > 0 && now >= Number(record.challenge_expires_at || 0);
      if (challengeExpired && !pendingFinalize) {
        const hash = await maybeFinalizeRecovery({ id, record }, state);
        if (hash) {
          const p = { tx_hash:hash, submitted_at:now };
          state.records[key].finalize_pending = true;
          state.records[key].pending_finalize = p;
        }
      }
    }

    writeState(state);
    await guardian.notifyNewEvents(state);
  } finally {
    lifecyclePollRunning = false;
  }
}

function sendJson(res, status, payload) { const body=JSON.stringify(payload,null,2); res.writeHead(status,{"content-type":"application/json","access-control-allow-origin":"*","cache-control":"no-store"}); res.end(body); }
async function readJsonBody(req, limit = 32_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > limit) { reject(new Error("Request body too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("Invalid JSON body")); } });
    req.on("error", reject);
  });
}
function validWallet(value) { return /^0x[a-fA-F0-9]{40}$/.test(String(value || "")); }
async function verifyGuardianAuthorization({ wallet, nonce, signature, action }) {
  if (!validWallet(wallet)) throw new Error("Invalid wallet address");
  if (!nonce || !signature) throw new Error("Missing wallet authorization");
  const challenge = guardian.consumeSignatureChallenge(nonce, wallet, action);
  if (!challenge) throw new Error("Authorization challenge is invalid or expired");
  const recovered = verifyMessage(challenge.message, signature);
  if (String(recovered).toLowerCase() !== String(wallet).toLowerCase()) throw new Error("Wallet signature does not match the requested address");
  return true;
}
function startServer() {
  return http.createServer(async (req,res)=>{
    if (req.method === "OPTIONS") { res.writeHead(204,{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"}); return res.end(); }
    const state=readState(); const url=new URL(req.url,"http://localhost");
    try {
      if (url.pathname === "/health") {
        const pending_assessments = Object.values(state.records || {}).filter(r => r?.assessment_pending).length;
        const pending_finalizations = Object.values(state.records || {}).filter(r => r?.finalize_pending).length;
        return sendJson(res,200,{ ok:true, service:"Safetern Monitor", contract:CONTRACT, auto_assess:AUTO_ASSESS && Boolean(keeperClient), auto_finalize:AUTO_FINALIZE && Boolean(keeperClient), telegram_guardian:guardian.configured, guardian_pairing:guardian.configured, poll_seconds:POLL_SECONDS, state_poll_seconds:STATE_POLL_SECONDS, pending_assessments, pending_finalizations, pending_retry_seconds:PENDING_RETRY_SECONDS, updated_at:state.updated_at });
      }
      if (url.pathname === "/guardian/status" && req.method === "GET") {
        const wallet = url.searchParams.get("wallet") || "";
        if (!validWallet(wallet)) return sendJson(res,400,{error:"Invalid wallet address"});
        return sendJson(res,200,guardian.getConnection(wallet));
      }
      if (url.pathname === "/guardian/challenge" && req.method === "GET") {
        const wallet = url.searchParams.get("wallet") || "";
        const action = url.searchParams.get("action") === "disconnect" ? "disconnect" : "connect";
        if (!guardian.configured) return sendJson(res,503,{error:"Telegram Guardian is not configured"});
        if (!validWallet(wallet)) return sendJson(res,400,{error:"Invalid wallet address"});
        return sendJson(res,200,guardian.createSignatureChallenge(wallet, action));
      }
      if (url.pathname === "/guardian/pair-request" && req.method === "POST") {
        if (!guardian.configured) return sendJson(res,503,{error:"Telegram Guardian is not configured"});
        const body = await readJsonBody(req);
        await verifyGuardianAuthorization({ wallet:body.wallet, nonce:body.nonce, signature:body.signature, action:"connect" });
        const pair = guardian.createPairToken(body.wallet);
        return sendJson(res,200,{ ok:true, wallet:String(body.wallet).toLowerCase(), telegram_url:pair.url, expires_at:pair.expires_at });
      }
      if (url.pathname === "/guardian/disconnect" && req.method === "POST") {
        const body = await readJsonBody(req);
        await verifyGuardianAuthorization({ wallet:body.wallet, nonce:body.nonce, signature:body.signature, action:"disconnect" });
        guardian.disconnectWallet(body.wallet);
        return sendJson(res,200,{ok:true,connected:false,wallet:String(body.wallet).toLowerCase()});
      }
      if (url.pathname === "/watches") return sendJson(res,200,state.watches);
      if (url.pathname === "/records") return sendJson(res,200,state.records || {});
      if (url.pathname === "/events") return sendJson(res,200,state.events);
      const recordMatch=url.pathname.match(/^\/record\/(\d+)$/); if(recordMatch) return sendJson(res,state.records?.[recordMatch[1]]?200:404,state.records?.[recordMatch[1]]||{error:"No record snapshot yet"});
      const match=url.pathname.match(/^\/snapshot\/(\d+)$/); if(match) return sendJson(res,state.watches[match[1]]?200:404,state.watches[match[1]]||{error:"No snapshot yet"});
      return sendJson(res,404,{error:"Not found"});
    } catch (error) {
      console.error("Monitor API request failed:", error?.message || error);
      return sendJson(res,400,{error:error?.message || "Request failed"});
    }
  }).listen(PORT,()=>console.log(`Safetern Monitor API: http://localhost:${PORT}`));
}

const once = process.argv.includes("--once");
if (once) {
  pollOnce().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
} else {
  const initialState = readState();
  guardian.initializeExistingEvents(initialState.events || []);
  startServer();
  guardian.startCommandLoop(readState);
  console.log(`Initial full monitor scan scheduled in ${INITIAL_POLL_DELAY_SECONDS}s (RPC reads throttled to one every ${RPC_READ_INTERVAL_MS}ms).`);
  setTimeout(()=>pollOnce().catch(console.error), INITIAL_POLL_DELAY_SECONDS*1000);
  setInterval(()=>pollOnce().catch(console.error), POLL_SECONDS*1000);
  setInterval(()=>lifecyclePollOnce().catch(console.error), STATE_POLL_SECONDS*1000);
}
