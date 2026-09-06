import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const SAFETERN_CONTRACT = import.meta.env.VITE_SAFETERN_CONTRACT || "0x2c43B5282af2Fc73bdef578E82EeAA78BB5346DB";
export const readClient = createClient({ chain: studionet });
export function walletClient(account) { return createClient({ chain: studionet, account, provider: window.ethereum }); }

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No compatible browser wallet detected.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No wallet account selected.");
  const account = accounts[0];
  return { account, client: walletClient(account) };
}

export async function disconnectWallet() {
  if (!window.ethereum) return { revoked: false };
  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
    return { revoked: true };
  } catch {
    // Not every injected wallet implements EIP-2255. The UI will still
    // terminate Safetern's local session even when wallet-level revocation
    // is unavailable.
    return { revoked: false };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const inFlightReads = new Map();

function isTransientRpcError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("429") || message.includes("too many requests") || message.includes("rate limit") || message.includes("failed to fetch") || message.includes("network");
}

async function resilientRead(key, task, { retries = 2 } = {}) {
  if (inFlightReads.has(key)) return inFlightReads.get(key);
  const promise = (async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try { return await task(); }
      catch (error) {
        lastError = error;
        if (!isTransientRpcError(error) || attempt >= retries) throw error;
        await sleep(attempt === 0 ? 2500 : 6000);
      }
    }
    throw lastError;
  })().finally(() => inFlightReads.delete(key));
  inFlightReads.set(key, promise);
  return promise;
}

function read(functionName, args = []) {
  const key = `${functionName}:${JSON.stringify(args)}`;
  return resilientRead(key, () => readClient.readContract({ address: SAFETERN_CONTRACT, functionName, args, stateStatus: "accepted" }));
}

export async function getRecordCount() { return read("get_record_count"); }
export async function getRecord(recordId) { return read("get_record", [Number(recordId)]); }
export async function getLatestAssessment(recordId) { return read("get_latest_assessment", [Number(recordId)]); }
export async function getRecoveryAccess(recordId) { return read("get_recovery_access", [Number(recordId)]); }
export async function getMonitoringConfig(recordId) { return read("get_monitoring_config", [Number(recordId)]); }
export async function getWatchMetadata(recordId) { return read("get_watch_metadata", [Number(recordId)]); }
export async function getWatchMarketSnapshot(recordId) { return read("get_watch_market_snapshot", [Number(recordId)]); }
export async function getRegisteredRecoveryIdentity(address) { return read("get_registered_recovery_identity", [address]); }

function addressMatchesRecord(record, account) {
  const needle = String(account || "").toLowerCase();
  if (!needle) return false;
  return [record?.owner, record?.beneficiary, record?.recovery_controller]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase() === needle);
}

async function enrichRecord(id, record) {
  let assessment = null; let access = null; let monitoring = null;
  try { const latest = await getLatestAssessment(id); if (latest?.found) assessment = latest; } catch {}
  try { monitoring = await getMonitoringConfig(id); } catch {}
  let watchMetadata = null; let marketSnapshot = null;
  if (record?.mode === "WATCH") {
    try { const wm = await getWatchMetadata(id); if (wm?.found) watchMetadata = JSON.parse(wm.metadata_json || "{}"); } catch {}
    try { const ms = await getWatchMarketSnapshot(id); if (ms?.found) marketSnapshot = JSON.parse(ms.snapshot_json || "{}"); } catch {}
  }
  if (record?.mode === "RECOVER") { try { access = await getRecoveryAccess(id); } catch {} }
  return { id, record, assessment, access, monitoring, watchMetadata, marketSnapshot };
}

export async function getRecordsForWallet(account) {
  if (!account) return [];
  const count = Number((await getRecordCount()) || 0);
  if (!Number.isFinite(count) || count < 1) return [];

  // The current contract exposes records by numeric id, so Safetern must inspect
  // the core record once to discover ownership. Expensive enrichment calls are
  // performed only for records related to the connected wallet.
  const relevant = [];
  for (let id = count; id >= 1; id -= 1) {
    const record = await getRecord(id);
    if (addressMatchesRecord(record, account)) relevant.push({ id, record });
  }

  const rows = [];
  for (const { id, record } of relevant) rows.push(await enrichRecord(id, record));
  return rows;
}

export async function getPresenceRecord(recordId) {
  const id = Number(recordId);
  if (!Number.isFinite(id) || id < 1) throw new Error("Invalid covenant id.");
  return getRecord(id);
}

// Retained for admin/debug tooling, but the Safetern UI no longer calls this
// automatically. Normal dashboard reads are wallet-scoped via getRecordsForWallet.
export async function getAllRecords() {
  const count = Number((await getRecordCount()) || 0);
  if (!Number.isFinite(count) || count < 1) return [];
  const rows = [];
  for (let id = count; id >= 1; id -= 1) {
    const record = await getRecord(id);
    rows.push(await enrichRecord(id, record));
  }
  return rows;
}

function cleanSources(values) {
  const sources = values.map((v) => v.trim()).filter(Boolean);
  if (!sources.length) throw new Error("Add at least one evidence URL.");
  return sources;
}

export async function createWatch(client, v) {
  if (!client) throw new Error("Connect your wallet first.");
  const metadata = {
    watch_type: v.watchType === "crypto" ? "CRYPTO_TOKEN" : "PROJECT",
    token_symbol: v.watchType === "crypto" ? v.tokenSymbol.trim() : "",
    blockchain: v.watchType === "crypto" ? v.blockchain.trim() : "",
    contract_address: v.watchType === "crypto" ? v.contractAddress.trim() : "",
    track_dex_liquidity: v.watchType === "crypto" && Boolean(v.trackLiquidity),
    track_exchange_delistings: v.watchType === "crypto" && Boolean(v.trackDelistings),
    track_project_activity: Boolean(v.trackProjectActivity),
    major_exchanges: v.watchType === "crypto" && v.trackDelistings ? ["Binance","Coinbase","Bybit","OKX","KuCoin"] : [],
  };
  const result = await client.writeContract({ address: SAFETERN_CONTRACT, functionName: "create_watch", args: [v.name.trim(), v.description.trim(), v.entity.trim(), v.rule.trim(), JSON.stringify(cleanSources(v.sources)), JSON.stringify(metadata), Number(v.monitoringInterval || 21600), Math.floor(Date.now()/1000)], value: 0n });
  return result;
}
export async function createProtect(client, v) {
  if (!client) throw new Error("Connect your wallet first.");
  return client.writeContract({ address: SAFETERN_CONTRACT, functionName: "create_protect_covenant", args: [v.name.trim(), v.description.trim(), v.entity.trim(), v.recoveryController.trim(), v.rule.trim(), v.policy, JSON.stringify(cleanSources(v.sources)), Number(v.challengeSeconds), Math.floor(Date.now()/1000)], value: 0n });
}
export async function createRecovery(client, v) {
  if (!client) throw new Error("Connect your wallet first.");
  return client.writeContract({ address: SAFETERN_CONTRACT, functionName: "create_recovery_covenant", args: [v.name.trim(), v.description.trim(), v.entity.trim(), v.beneficiary.trim(), v.rule.trim(), v.policy, JSON.stringify(cleanSources(v.sources)), Number(v.challengeSeconds), v.encryptedPayloadRef, v.encryptedPayloadHash, Math.floor(Date.now()/1000)], value: 0n });
}
export async function registerRecoveryIdentity(client, identityCode, fingerprint) {
  if (!client) throw new Error("Connect your wallet first.");
  return client.writeContract({ address: SAFETERN_CONTRACT, functionName: "register_recovery_identity", args: [identityCode, fingerprint, Math.floor(Date.now()/1000)], value: 0n });
}
export async function setMonitoringInterval(client, recordId, seconds) {
  if (!client) throw new Error("Connect your wallet first.");
  return client.writeContract({ address: SAFETERN_CONTRACT, functionName: "set_monitoring_interval", args: [Number(recordId), Number(seconds)], value: 0n });
}
export async function assessRecord(client, id) { if (!client) throw new Error("Connect your wallet first."); return client.writeContract({ address: SAFETERN_CONTRACT, functionName: "assess", args: [Number(id)], value: 0n }); }
export async function confirmPresence(client, id) { if (!client) throw new Error("Connect your wallet first."); return client.writeContract({ address: SAFETERN_CONTRACT, functionName: "confirm_presence", args: [Number(id)], value: 0n }); }
export async function finalizeRecovery(client, id) { if (!client) throw new Error("Connect your wallet first."); return client.writeContract({ address: SAFETERN_CONTRACT, functionName: "finalize_recovery", args: [Number(id)], value: 0n }); }
export async function claimRecoveryAccess(client, id) { if (!client) throw new Error("Connect your wallet first."); return client.writeContract({ address: SAFETERN_CONTRACT, functionName: "claim_recovery_access", args: [Number(id)], value: 0n }); }
export function txHash(result) { if (typeof result === "string") return result; return result?.hash || result?.transactionHash || result?.txHash || ""; }
