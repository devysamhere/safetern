import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import logo from "./assets/safetern-logo.png";
import guardianMascot from "./assets/safetern-guardian-mascot.png";
import {
  SAFETERN_CONTRACT,
  assessRecord,
  claimRecoveryAccess,
  confirmPresence,
  connectWallet,
  disconnectWallet,
  createProtect,
  createRecovery,
  createWatch,
  finalizeRecovery,
  getPresenceRecord,
  getRecordsForWallet,
  getLatestAssessment,
  getRecord,
  getRecordCount,
  getRecoveryAccess,
  getRegisteredRecoveryIdentity,
  registerRecoveryIdentity,
  txHash,
  walletClient,
} from "./genlayer.js";
import {
  decryptRecoveryPayload,
  encryptRecoveryPayload,
  exportIdentityBackup,
  generateRecoveryIdentity,
  getRecoveryIdentity,
  importIdentityBackup,
  recipientCodeFromIdentity,
  verifyRecipientCode,
} from "./recoveryCrypto.js";

const WATCH_RULE = "Determine whether this project appears to be actively operating based on the supplied public evidence. Treat unavailable sources as uncertainty, not abandonment. Do not infer recent activity merely because a page is reachable or mentions recent technologies. Prefer INCONCLUSIVE when the evidence is insufficient.";
const PROTECT_RULE = "Determine whether this protected digital system has genuinely been abandoned or its operator appears permanently unavailable. Temporary inactivity, fetch failures, maintenance, migrations, or ambiguous evidence must not authorize recovery. Require strong corroborated evidence that satisfies this covenant before concluding ABANDONED.";
const RECOVER_RULE = "Determine whether the owner of this recovery covenant appears genuinely and permanently unavailable according to the configured evidence. Temporary silence, inaccessible pages, incomplete evidence, or ordinary inactivity must never authorize recovery. Require strong corroborated evidence and prefer INCONCLUSIVE unless the covenant's recovery conditions are clearly satisfied.";
const GUARDIAN_API_URL = String(import.meta.env.VITE_GUARDIAN_API_URL || (window.location.hostname === "localhost" ? "http://localhost:8787" : "")).replace(/\/$/, "");
function utf8ToHex(value) { return "0x" + [...new TextEncoder().encode(String(value))].map(b=>b.toString(16).padStart(2,"0")).join(""); }


const statusCopy = {
  UNASSESSED: ["Not assessed", "Run an assessment to establish the current continuity state."],
  HEALTHY: ["Healthy", "Evidence supports continued operation."],
  SILENT: ["Silent", "Activity is reduced, but abandonment is not established."],
  AT_RISK: ["At risk", "Material continuity signals have deteriorated."],
  INCONCLUSIVE: ["Inconclusive", "Evidence is not strong enough for a reliable conclusion."],
  ABANDONED: ["Likely abandoned", "Strong evidence indicates genuine abandonment or discontinuation."],
  CHALLENGE: ["Recovery challenge", "Recovery conditions were satisfied. The owner can still confirm presence."],
  RECOVERED: ["Recovered", "The continuity recovery process has completed."],
};

function shortAddress(value = "") { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : ""; }
function formatUsd(value) { const n=Number(value||0); if(!Number.isFinite(n)) return "—"; return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:n>=1000000?"compact":"standard",maximumFractionDigits:n>=1000000?2:0}).format(n); }
function formatPct(value) { const n=Number(value); if(!Number.isFinite(n)) return "—"; return `${n>0?"+":""}${n.toFixed(1)}%`; }
function normalizeSources(raw) { try { return JSON.parse(raw || "[]"); } catch { return []; } }
function sameAddress(a, b) { return a && b && String(a).toLowerCase() === String(b).toLowerCase(); }
function formatDuration(seconds) { const s=Math.max(0,Number(seconds)||0); if(s<60)return `${s}s`; if(s<3600)return `${Math.round(s/60)}m`; if(s<86400)return `${Math.round(s/3600)}h`; return `${Math.round(s/86400)}d`; }
function tabMeta(tab) {
  if (tab === "protect") return { kicker: "Continuity Covenants", title: "Keep critical systems from ending with one operator.", body: "Create an intelligent recovery path for agents, protocols, DAOs and digital projects you control.", action: "+ New Covenant" };
  if (tab === "recover") return { kicker: "Encrypted Recovery", title: "Pass on what matters without handing Safetern your assets.", body: "Encrypt recovery instructions locally, bind them to a beneficiary wallet, and release them only after the covenant completes.", action: "+ Recovery Covenant" };
  return { kicker: "Safetern Watch", title: "Know when the projects you depend on stop showing signs of life.", body: "Choose public evidence, let GenLayer interpret it, and keep a live continuity view without relying on a single signal.", action: "+ New Watch" };
}

function Notice({ notice, onClear }) {
  if (!notice) return null;
  return <div className={`notice ${notice.kind || ""}`}><div><span className="notice-dot"/><span>{notice.text || notice}</span></div><div className="notice-actions">{notice.hash && <button onClick={() => navigator.clipboard?.writeText(notice.hash)}>{shortAddress(notice.hash)} · Copy</button>}<button className="notice-close" onClick={onClear}>×</button></div></div>;
}

function SourceFields({ form, setForm }) {
  return <div className="form-section"><div className="field-label"><span>Evidence sources</span><small>Public http/https URLs · max 5</small></div>{form.sources.map((value,index)=><div className="source-row" key={index}><input required={index===0} type="url" value={value} onChange={(e)=>{const sources=[...form.sources];sources[index]=e.target.value;setForm({...form,sources});}} placeholder={`Evidence URL ${index+1}`}/>{index>0&&<button type="button" onClick={()=>setForm({...form,sources:form.sources.filter((_,i)=>i!==index)})}>Remove</button>}</div>)}{form.sources.length<5&&<button type="button" className="add-source" onClick={()=>setForm({...form,sources:[...form.sources,""]})}>+ Add source</button>}</div>;
}

function App() {
  const [account, setAccount] = useState("");
  const [client, setClient] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState("");
  const [wizardStep, setWizardStep] = useState(0);
  const [walletMenu, setWalletMenu] = useState(false);
  const [guardianModal, setGuardianModal] = useState(false);
  const [guardianStatus, setGuardianStatus] = useState(null);
  const [guardianPairUrl, setGuardianPairUrl] = useState("");
  const [beneficiaryLookup, setBeneficiaryLookup] = useState(null);
  const [tab, setTab] = useState("home");
  const [creationResult, setCreationResult] = useState(null);
  const [tick, setTick] = useState(Date.now());
  const [identity, setIdentity] = useState(null);
  const [recipientCode, setRecipientCode] = useState("");
  const [revealed, setRevealed] = useState(null);
  const [presenceTarget, setPresenceTarget] = useState(null);
  const [presenceLookupError, setPresenceLookupError] = useState("");
  const backupInput = useRef(null);
  const refreshInFlight = useRef(null);
  const lastRefreshAt = useRef(0);
  const presenceRecordId = Number(new URLSearchParams(window.location.search).get("presence") || 0);

  const [watchForm, setWatchForm] = useState({ name:"",description:"",entity:"",watchType:"project",tokenSymbol:"",blockchain:"",contractAddress:"",trackLiquidity:true,trackDelistings:true,trackProjectActivity:true,monitoringInterval:"21600",rule:WATCH_RULE,sources:["",""] });
  const [protectForm, setProtectForm] = useState({ name:"",description:"",entity:"",recoveryController:"",rule:PROTECT_RULE,policy:"STRICT",challengeSeconds:"86400",sources:["",""] });
  const [recoverForm, setRecoverForm] = useState({ name:"",description:"",entity:"Personal recovery information",beneficiary:"",beneficiaryCode:"",payloadType:"Recovery instructions",secret:"",rule:RECOVER_RULE,policy:"STRICT",challengeSeconds:"86400",sources:["",""] });

  useEffect(()=>{const t=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{
    const previous=document.body.style.overflow;
    if(modal||revealed) document.body.style.overflow="hidden";
    else document.body.style.overflow=previous||"";
    return()=>{document.body.style.overflow=previous||"";};
  },[modal,revealed]);
  useEffect(()=>{
    if (!window.ethereum?.on) return;
    const changed=(accounts)=>{const next=accounts?.[0]||"";setAccount(next);setClient(next?walletClient(next):null);setIdentity(getRecoveryIdentity(next));setRecipientCode(next&&getRecoveryIdentity(next)?recipientCodeFromIdentity(getRecoveryIdentity(next)):"");setRecords([]);setPresenceTarget(null);setPresenceLookupError("");setGuardianStatus(null);setGuardianPairUrl("");setLoading(false);setNotice({text:next?"Wallet account changed. Click Refresh records to load this wallet's Safetern state.":"Wallet disconnected."});};
    window.ethereum.on("accountsChanged",changed); return()=>window.ethereum.removeListener?.("accountsChanged",changed);
  },[]);

  const watches=useMemo(()=>records.filter(({record})=>record?.mode==="WATCH"),[records]);
  const protects=useMemo(()=>records.filter(({record})=>record?.mode==="PROTECT"),[records]);
  const recovers=useMemo(()=>records.filter(({record})=>record?.mode==="RECOVER"),[records]);
  const visibleRecovers=useMemo(()=>recovers.filter(({record})=>!account||sameAddress(record.owner,account)||sameAddress(record.beneficiary,account)),[recovers,account]);
  const myAssignments=useMemo(()=>recovers.filter(({record})=>account&&sameAddress(record.beneficiary,account)),[recovers,account]);
  const meta=tab==="home"?null:tabMeta(tab);

  function walletCacheKey(address) { return `safetern:records:v2:${String(address || "").toLowerCase()}`; }

  async function loadPresenceTarget(address) {
    if (!presenceRecordId || !address) { setPresenceTarget(null); setPresenceLookupError(""); return null; }
    setPresenceLookupError("");
    try {
      const record = await getPresenceRecord(presenceRecordId);
      setPresenceTarget(record);
      if (!sameAddress(record?.owner, address)) setPresenceLookupError("The connected wallet is not the owner of this covenant.");
      return record;
    } catch (e) {
      setPresenceTarget(null);
      setPresenceLookupError(e?.message || "Could not read this covenant from GenLayer.");
      return null;
    }
  }

  async function refresh({ force=false, address=account }={}) {
    if (!address) { setRecords([]); setLoading(false); return []; }
    if (presenceRecordId > 0) {
      await loadPresenceTarget(address);
      return records;
    }
    if (refreshInFlight.current) return refreshInFlight.current;
    if (!force && Date.now() - lastRefreshAt.current < 15000) return records;
    const task = (async () => {
      setLoading(records.length === 0);
      try {
        const next = await getRecordsForWallet(address);
        setRecords(next);
        localStorage.setItem(walletCacheKey(address), JSON.stringify({ at: Date.now(), rows: next }));
        lastRefreshAt.current = Date.now();
        return next;
      } catch (e) {
        const cached = localStorage.getItem(walletCacheKey(address));
        if (records.length === 0 && cached) {
          try { const parsed = JSON.parse(cached); if (Array.isArray(parsed?.rows)) setRecords(parsed.rows); } catch {}
        }
        setNotice({text:"GenLayer RPC is temporarily rate-limited. Safetern is showing the last known state for this wallet.",kind:"error"});
        throw e;
      } finally { setLoading(false); }
    })().finally(() => { refreshInFlight.current = null; });
    refreshInFlight.current = task;
    return task;
  }

  async function onConnect(){
    setBusy("connect"); setNotice({text:"Opening your wallet…"});
    try {
      const session=await connectWallet();
      setAccount(session.account); setClient(session.client);
      const found=getRecoveryIdentity(session.account); setIdentity(found); setRecipientCode(found?recipientCodeFromIdentity(found):"");
      setNotice({text:"Wallet connected to GenLayer Studionet.",kind:"success"});
      if (presenceRecordId > 0) await loadPresenceTarget(session.account);
      else await refresh({force:true,address:session.account});
    } catch(e){setNotice({text:e?.message||"Wallet connection failed.",kind:"error"});}
    finally{setBusy("");}
  }
  async function onDisconnect(){
    setBusy("disconnect");
    setNotice({text:"Disconnecting Safetern from this wallet…"});
    try {
      const result = await disconnectWallet();
      setAccount("");
      setClient(null);
      setIdentity(null);
      setRecipientCode("");
      setRecords([]); setPresenceTarget(null); setPresenceLookupError(""); setLoading(false);
      setWalletMenu(false); setGuardianModal(false); setGuardianStatus(null); setGuardianPairUrl("");
      setNotice({text:result?.revoked?"Wallet disconnected from Safetern.":"Safetern session disconnected. Your wallet does not support app-level permission revocation, but Safetern has cleared the active session.",kind:"success"});
    } catch(e) {
      setAccount(""); setClient(null); setIdentity(null); setRecipientCode(""); setRecords([]); setPresenceTarget(null); setPresenceLookupError(""); setLoading(false); setWalletMenu(false); setGuardianModal(false); setGuardianStatus(null); setGuardianPairUrl("");
      setNotice({text:"Safetern session disconnected locally.",kind:"success"});
    } finally { setBusy(""); }
  }
  async function guardianFetch(path, options={}) {
    if (!GUARDIAN_API_URL) throw new Error("Telegram Guardian service is not configured for this deployment yet.");
    const response = await fetch(`${GUARDIAN_API_URL}${path}`, { ...options, headers:{"content-type":"application/json",...(options.headers||{})} });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data?.error || `Guardian service returned ${response.status}`);
    return data;
  }
  async function refreshGuardianStatus(wallet=account) {
    if (!wallet || !GUARDIAN_API_URL) { setGuardianStatus(null); return null; }
    setBusy("guardian-status");
    try { const status=await guardianFetch(`/guardian/status?wallet=${encodeURIComponent(wallet)}`); setGuardianStatus(status); return status; }
    catch(e){ setGuardianStatus({connected:false,error:e?.message||"Guardian service unavailable"}); return null; }
    finally { setBusy(""); }
  }
  async function signGuardianChallenge(action) {
    if (!account || !window.ethereum) throw new Error("Connect the wallet first.");
    const challenge=await guardianFetch(`/guardian/challenge?wallet=${encodeURIComponent(account)}&action=${action}`);
    const signature=await window.ethereum.request({method:"personal_sign",params:[utf8ToHex(challenge.message),account]});
    return {challenge,signature};
  }
  async function connectGuardian() {
    setBusy("guardian-connect"); setNotice({text:"Confirm the wallet signature to pair Telegram Guardian. This does not create a transaction."});
    try {
      const {challenge,signature}=await signGuardianChallenge("connect");
      const result=await guardianFetch("/guardian/pair-request",{method:"POST",body:JSON.stringify({wallet:account,nonce:challenge.nonce,signature})});
      setGuardianPairUrl(result.telegram_url||"");
      setGuardianStatus({connected:false,pending:true});
      setNotice({text:"Secure pairing link created. Finish the connection in Telegram.",kind:"success"});
      window.open(result.telegram_url,"_blank","noopener,noreferrer");
    } catch(e){ setNotice({text:e?.message||"Could not start Telegram Guardian pairing.",kind:"error"}); }
    finally { setBusy(""); }
  }
  async function disconnectGuardian() {
    setBusy("guardian-disconnect");
    try {
      const {challenge,signature}=await signGuardianChallenge("disconnect");
      await guardianFetch("/guardian/disconnect",{method:"POST",body:JSON.stringify({wallet:account,nonce:challenge.nonce,signature})});
      setGuardianStatus({connected:false}); setGuardianPairUrl("");
      setNotice({text:"Telegram Guardian disconnected from this wallet.",kind:"success"});
    } catch(e){ setNotice({text:e?.message||"Could not disconnect Telegram Guardian.",kind:"error"}); }
    finally { setBusy(""); }
  }

  async function lookupBeneficiary(){if(!/^0x[a-fA-F0-9]{40}$/.test(recoverForm.beneficiary)){setBeneficiaryLookup({found:false,message:"Enter a valid beneficiary wallet first."});return;}setBusy("lookup-beneficiary");try{const result=await getRegisteredRecoveryIdentity(recoverForm.beneficiary);if(result?.found&&result?.active){setRecoverForm((v)=>({...v,beneficiaryCode:result.public_code}));setBeneficiaryLookup({found:true,message:"Registered Safetern Recovery Identity found."});}else{setBeneficiaryLookup({found:false,message:"No active Recovery Identity is registered for this wallet yet."});}}catch(e){setBeneficiaryLookup({found:false,message:e?.message||"Could not look up Recovery Identity."});}finally{setBusy("");}}
  async function waitFor(predicate,{timeoutMs=120000,intervalMs=2500}={}){const started=Date.now();while(Date.now()-started<timeoutMs){try{const value=await predicate();if(value)return value;}catch{}await new Promise(r=>setTimeout(r,intervalMs));}return null;}
  async function waitForReceipt(hash){if(!hash||!client?.waitForTransactionReceipt)return null;try{return await client.waitForTransactionReceipt({hash});}catch(error){const m=String(error?.message||error||"").toLowerCase();if(!m.includes("timed out waiting for transaction"))throw error;return null;}}

  async function submitCreate(kind,form,createFn){setBusy(`create-${kind}`);setNotice({text:`Preparing ${kind} transaction…`});try{const before=Number((await getRecordCount())||0);const result=await createFn(client,form);const hash=txHash(result);setNotice({text:"Transaction submitted. Waiting for GenLayer finalization…",hash});await waitForReceipt(hash);const appeared=await waitFor(async()=>Number((await getRecordCount())||0)>before);await refresh();const recordId=appeared?before+1:null;setCreationResult({kind,name:form.name||"Safetern record",hash,recordId,monitoringInterval:kind==="watch"?form.monitoringInterval:null,appeared});setNotice(null);return appeared;}catch(e){setNotice({text:e?.message||"Transaction failed.",kind:"error"});return false;}finally{setBusy("");}}
  async function onCreateWatch(e){e.preventDefault();const ok=await submitCreate("watch",watchForm,createWatch);if(ok)setWatchForm({name:"",description:"",entity:"",watchType:"project",tokenSymbol:"",blockchain:"",contractAddress:"",trackLiquidity:true,trackDelistings:true,trackProjectActivity:true,monitoringInterval:"21600",rule:WATCH_RULE,sources:["",""]});}
  async function onCreateProtect(e){e.preventDefault();const ok=await submitCreate("protect",protectForm,createProtect);if(ok)setProtectForm({name:"",description:"",entity:"",recoveryController:"",rule:PROTECT_RULE,policy:"STRICT",challengeSeconds:"86400",sources:["",""]});}
  async function onCreateRecover(e){e.preventDefault();if(!client){setNotice({text:"Connect the owner wallet first.",kind:"error"});return;}setBusy("create-recover");setNotice({text:"Verifying beneficiary Recovery Key and encrypting locally…"});try{await verifyRecipientCode(recoverForm.beneficiaryCode,recoverForm.beneficiary);const encrypted=await encryptRecoveryPayload({secret:recoverForm.secret,payloadType:recoverForm.payloadType,beneficiaryCode:recoverForm.beneficiaryCode,beneficiaryAddress:recoverForm.beneficiary});const payload={...recoverForm,encryptedPayloadRef:encrypted.ref,encryptedPayloadHash:encrypted.hash};const ok=await submitCreate("recover",payload,createRecovery);if(ok)setRecoverForm({name:"",description:"",entity:"Personal recovery information",beneficiary:"",beneficiaryCode:"",payloadType:"Recovery instructions",secret:"",rule:RECOVER_RULE,policy:"STRICT",challengeSeconds:"86400",sources:["",""]});}catch(e){setNotice({text:e?.message||"Could not create encrypted recovery covenant.",kind:"error"});}finally{setBusy("");}}

  async function onAssess(id){setBusy(`assess-${id}`);setNotice({text:`Submitting assessment for record #${id}…`});try{let previous=0;try{previous=Number((await getLatestAssessment(id))?.assessment_id||0);}catch{}const result=await assessRecord(client,id);const hash=txHash(result);setNotice({text:"Assessment submitted. Waiting for GenLayer validator consensus…",hash});await waitForReceipt(hash);const completed=await waitFor(async()=>{const latest=await getLatestAssessment(id);return latest?.found&&Number(latest.assessment_id)>previous?latest:null;},{timeoutMs:180000,intervalMs:4000});await refresh();setNotice({text:completed?"Assessment finalized by GenLayer.":"Assessment is still processing; refresh shortly.",hash,kind:completed?"success":""});}catch(e){setNotice({text:e?.message||"Assessment failed.",kind:"error"});}finally{setBusy("");}}
  async function stateAction(action,id){setBusy(`${action}-${id}`);setNotice({text:action==="presence"?"Confirming owner presence…":"Finalizing recovery…"});try{const fn=action==="presence"?confirmPresence:finalizeRecovery;const result=await fn(client,id);const hash=txHash(result);await waitForReceipt(hash);const target=action==="presence"?"HEALTHY":"RECOVERED";let observed=null;try{observed=await waitFor(async()=>((await getRecord(id))?.state===target),{timeoutMs:45000,intervalMs:5000});}catch{}try{await refresh({force:true});}catch{}setNotice({text:action==="presence"?(observed?"Presence confirmed. Recovery challenge cancelled.":"Presence transaction submitted. Safetern will refresh the onchain state when the RPC is available."):(observed?"Recovery finalized. Successor authorization is now active.":"Recovery finalization submitted. Safetern will refresh when the RPC is available."),hash,kind:"success"});}catch(e){setNotice({text:e?.message||"Action failed.",kind:"error"});}finally{setBusy("");}}
  async function claimAccess(id){setBusy(`claim-${id}`);setNotice({text:"Claiming beneficiary recovery access…"});try{const result=await claimRecoveryAccess(client,id);const hash=txHash(result);await waitForReceipt(hash);await waitFor(async()=>{const a=await getRecoveryAccess(id);return a?.found?a:null;});await refresh();setNotice({text:"Beneficiary access claimed onchain. You can now unlock the encrypted recovery information.",hash,kind:"success"});}catch(e){setNotice({text:e?.message||"Could not claim recovery access.",kind:"error"});}finally{setBusy("");}}
  async function unlockRecovery(record){setBusy(`unlock-${record.record_id}`);setNotice({text:"Confirm the wallet signature to unlock locally."});try{const access=await getRecoveryAccess(record.record_id);if(!access?.found)throw new Error("Claim recovery access onchain first.");if(!sameAddress(account,record.beneficiary))throw new Error("Only the nominated beneficiary wallet can unlock this covenant.");const payload=await decryptRecoveryPayload({encryptedRef:record.encrypted_payload_ref,expectedHash:record.encrypted_payload_hash,account});setRevealed({record,payload});setNotice({text:"Recovery information decrypted locally in this browser.",kind:"success"});}catch(e){setNotice({text:e?.message||"Could not unlock recovery information.",kind:"error"});}finally{setBusy("");}}

  async function createIdentity(){setBusy("identity");setNotice({text:"Creating Recovery Identity locally… One wallet signature will protect the private recovery key."});try{const made=await generateRecoveryIdentity(account);const code=recipientCodeFromIdentity(made);setIdentity(made);setRecipientCode(code);setNotice({text:"Recovery Identity created. Confirm one GenLayer transaction to register the public key to this wallet."});const result=await registerRecoveryIdentity(client,code,made.fingerprint);const hash=txHash(result);setNotice({text:"Registration submitted. Waiting for GenLayer finalization…",hash});await waitForReceipt(hash);const registered=await waitFor(async()=>{const r=await getRegisteredRecoveryIdentity(account);return r?.found?r:null;});setNotice({text:registered?"Recovery Identity registered and ready.":"Identity created locally; onchain registration is still finalizing.",hash,kind:registered?"success":""});}catch(e){setNotice({text:e?.message||"Could not create Recovery Identity.",kind:"error"});}finally{setBusy("");}}
  async function importBackup(file){if(!file)return;setBusy("identity-import");try{const imported=await importIdentityBackup(file,account);setIdentity(imported);setRecipientCode(recipientCodeFromIdentity(imported));setNotice({text:"Encrypted Recovery Identity backup imported.",kind:"success"});}catch(e){setNotice({text:e?.message||"Could not import Recovery Identity.",kind:"error"});}finally{setBusy("");if(backupInput.current)backupInput.current.value="";}}

  function openCreate(){setWizardStep(0);setCreationResult(null);setBeneficiaryLookup(null);if(tab==="watch")setModal("watch");else if(tab==="protect")setModal("protect");else setModal("recover");}

  function renderCard(row){const {record,assessment,access,watchMetadata,monitoring,marketSnapshot}=row;const assessed=Boolean(assessment);const status=record.state==="CHALLENGE"||record.state==="RECOVERED"?record.state:(assessed?assessment.classification:"UNASSESSED");const [label,desc]=statusCopy[status]||[status,"Continuity state recorded onchain."];const sources=normalizeSources(record.evidence_sources_json);const secondsLeft=record.state==="CHALLENGE"?Math.max(0,Number(record.challenge_expires_at)-Math.floor(tick/1000)):0;const isOwner=sameAddress(account,record.owner);const isBeneficiary=sameAddress(account,record.beneficiary);return <article className="record-card" key={record.record_id}>
    <div className="card-top"><span className={`status status-${status.toLowerCase()}`}>{label}</span><span className="record-id">#{record.record_id}</span></div>
    <div className="card-title"><div><h3>{record.name}</h3><p>{record.protected_entity}</p></div>{record.mode!=="WATCH"&&<span className="mode-tag">{record.mode}</span>}</div>
    <p className="status-description">{assessment?.evidence_summary||desc}</p>
    {assessment&&<div className="confidence"><div><span>GenLayer confidence</span><strong>{assessment.confidence}%</strong></div><i><u style={{width:`${assessment.confidence}%`}}/></i></div>}
    {record.mode==="WATCH"&&<div className="meta-grid watch-meta-grid"><span>Watch type<b>{watchMetadata?.watch_type==="CRYPTO_TOKEN"?"Crypto token":"Project"}</b></span><span>Monitoring<b>{formatDuration(monitoring?.interval_seconds||21600)}</b></span><span>{watchMetadata?.watch_type==="CRYPTO_TOKEN"?"Token":"Signals"}<b>{watchMetadata?.watch_type==="CRYPTO_TOKEN"?(watchMetadata?.token_symbol||"—"):"Project activity"}</b></span></div>}
    {record.mode==="WATCH"&&watchMetadata?.watch_type==="CRYPTO_TOKEN"&&<div className="signal-strip"><span className={watchMetadata?.track_dex_liquidity?"active":""}>DEX liquidity</span><span className={watchMetadata?.track_exchange_delistings?"active":""}>Exchange delistings</span><span className={watchMetadata?.track_project_activity?"active":""}>Project activity</span></div>}
    {record.mode==="WATCH"&&watchMetadata?.watch_type==="CRYPTO_TOKEN"&&marketSnapshot?.available&&<div className="market-snapshot"><div><small>DEX liquidity</small><b>{formatUsd(marketSnapshot.total_liquidity_usd)}</b></div><div><small>Since last assessment</small><b className={Number(marketSnapshot.liquidity_change_percent)<-25?"market-danger":""}>{Number(marketSnapshot.previous_liquidity_usd)>0?formatPct(marketSnapshot.liquidity_change_percent):"Baseline"}</b></div><div><small>Active pools</small><b>{marketSnapshot.pool_count||0}</b></div><span>Verified during the latest GenLayer assessment · DEX Screener</span></div>}
    {record.mode==="PROTECT"&&<div className="meta-grid"><span>Recovery controller<b>{shortAddress(record.recovery_controller)}</b></span><span>Policy<b>{record.evidence_policy}</b></span><span>Challenge<b>{formatDuration(record.challenge_period_seconds)}</b></span></div>}
    {record.mode==="RECOVER"&&<div className="meta-grid"><span>Beneficiary<b>{shortAddress(record.beneficiary)}</b></span><span>Policy<b>{record.evidence_policy}</b></span><span>Encrypted payload<b>Onchain ciphertext</b></span></div>}
    {record.state==="CHALLENGE"&&<div className="challenge-box"><div><b>Challenge active</b><strong>{secondsLeft>0?`${secondsLeft}s remaining`:"Ready to finalize"}</strong></div><p>No authority or secret access changes until the challenge expires.</p></div>}
    <div className="record-foot"><span>{sources.length} evidence source{sources.length===1?"":"s"}</span><span>{assessed?"Assessed":"Not assessed yet"}</span></div>
    <div className="details-row"><details><summary>Evidence</summary>{sources.map(url=><a href={url} target="_blank" rel="noreferrer" key={url}>{url}</a>)}</details>{assessment?.reasoning&&<details><summary>Reasoning</summary><p>{assessment.reasoning}</p></details>}</div>
    {record.state==="CHALLENGE"?<div className="action-stack">{isOwner&&<button disabled={!client||busy===`presence-${record.record_id}`} className={`secondary-action ${busy===`presence-${record.record_id}`?"is-busy":""}`} onClick={()=>stateAction("presence",record.record_id)}>{busy===`presence-${record.record_id}`?<><span className="btn-spinner"/>Waiting for wallet…</>:"I'm still here — cancel recovery"}</button>}<button className={`danger-action ${busy===`finalize-${record.record_id}`?"is-busy":""}`} disabled={!client||secondsLeft>0||busy===`finalize-${record.record_id}`} onClick={()=>stateAction("finalize",record.record_id)}>{busy===`finalize-${record.record_id}`?<><span className="btn-spinner"/>Waiting for wallet…</>:secondsLeft>0?`Finalize in ${secondsLeft}s`:"Finalize recovery"}</button></div>:record.state!=="RECOVERED"&&<button className={`secondary-action full ${busy===`assess-${record.record_id}`?"is-busy":""}`} disabled={!client||busy===`assess-${record.record_id}`} onClick={()=>onAssess(record.record_id)}>{busy===`assess-${record.record_id}`?<><span className="btn-spinner"/>Waiting for wallet / GenLayer…</>:assessed?"Run new assessment":"Run assessment"}</button>}
    {record.mode==="RECOVER"&&record.state==="RECOVERED"&&<div className="recover-actions">{isBeneficiary&&!access?.found&&<button className={`primary-action full ${busy===`claim-${record.record_id}`?"is-busy":""}`} disabled={!client||busy===`claim-${record.record_id}`} onClick={()=>claimAccess(record.record_id)}>{busy===`claim-${record.record_id}`?<><span className="btn-spinner"/>Waiting for wallet…</>:"Claim beneficiary access"}</button>}{isBeneficiary&&access?.found&&<button className={`primary-action full ${busy===`unlock-${record.record_id}`?"is-busy":""}`} disabled={busy===`unlock-${record.record_id}`} onClick={()=>unlockRecovery(record)}>{busy===`unlock-${record.record_id}`?<><span className="btn-spinner"/>Waiting for signature…</>:"Unlock recovery information"}</button>}{isOwner&&!isBeneficiary&&<div className="quiet-note">Recovery is finalized. Only {shortAddress(record.beneficiary)} can claim and decrypt this payload.</div>}{!isOwner&&!isBeneficiary&&<div className="quiet-note">This encrypted payload is restricted to its nominated beneficiary.</div>}</div>}
  </article>;}

  const currentRows=tab==="watch"?watches:tab==="protect"?protects:tab==="recover"?visibleRecovers:[];
  const recentRows=[...records].slice(-4).reverse();
  const totalChallenges=records.filter(({record})=>record?.state==="CHALLENGE").length;
  const totalRecovered=records.filter(({record})=>record?.state==="RECOVERED").length;

  return <div className="app-shell"><div className="intel-bg" aria-hidden="true">
      <svg className="continuity-map" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <g className="neural-cluster neural-left">
          <path d="M120 244 C168 194 234 196 278 235 C311 264 318 315 291 352 C264 389 209 400 168 380 C126 360 101 323 105 286 C107 269 111 256 120 244Z"/>
          <path d="M156 252 C183 226 221 225 246 244 M140 286 C172 271 204 279 222 306 M158 337 C189 316 225 320 252 344"/>
          <circle cx="151" cy="254" r="5"/><circle cx="212" cy="231" r="5"/><circle cx="264" cy="267" r="5"/><circle cx="142" cy="307" r="5"/><circle cx="209" cy="302" r="5"/><circle cx="271" cy="335" r="5"/><circle cx="184" cy="365" r="5"/>
        </g>
        <g className="signal-paths">
          <path d="M276 306 C382 318 432 373 512 406 S680 430 762 390"/>
          <path d="M252 343 C343 402 401 470 492 500 S683 529 794 498"/>
          <path d="M763 390 C850 353 933 339 1020 356"/>
          <path d="M794 498 C900 508 975 486 1055 443"/>
        </g>
        <g className="data-pulses"><circle cx="410" cy="363" r="4"/><circle cx="629" cy="430" r="4"/><circle cx="891" cy="365" r="4"/><circle cx="947" cy="491" r="4"/></g>
        <g className="chain-cluster">
          <line x1="1018" y1="356" x2="1082" y2="384"/><line x1="1154" y1="412" x2="1215" y2="440"/><line x1="1055" y1="443" x2="1115" y2="468"/><line x1="1187" y1="494" x2="1254" y2="520"/>
          <g transform="translate(1080 370)"><rect width="78" height="52" rx="11"/><text x="39" y="31" textAnchor="middle">GENLAYER</text></g>
          <g transform="translate(1213 427)"><rect width="72" height="50" rx="11"/><circle cx="36" cy="25" r="8"/><path d="M31 25h10M36 20v10"/></g>
          <g transform="translate(1113 455)"><rect width="74" height="50" rx="11"/><circle cx="37" cy="25" r="4"/></g>
          <g transform="translate(1252 507)"><rect width="80" height="52" rx="11"/><circle cx="40" cy="26" r="7"/></g>
        </g>
        <g className="micro-network">
          <path d="M906 671 L956 634 L1010 658 L1064 620 L1118 650"/>
          <circle cx="906" cy="671" r="4"/><circle cx="956" cy="634" r="4"/><circle cx="1010" cy="658" r="4"/><circle cx="1064" cy="620" r="4"/><circle cx="1118" cy="650" r="4"/>
        </g>
      </svg>
      <div className="ambient-grid"/>
    </div>
    <header className="topbar"><button className="brand" onClick={()=>setTab("home")}><img src={logo} alt="Safetern"/><span>SAFETERN</span></button><nav>{["home","protect","watch","recover"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</nav><div className="header-right"><span className="network-pill"><i/>Studionet</span>{account&&<button className={`guardian-pill ${guardianStatus?.connected?"connected":""}`} onClick={()=>{setGuardianModal(true);refreshGuardianStatus(account);}} aria-label="Open Telegram Guardian"><img src={guardianMascot} alt="Safetern Guardian"/><span><b>Guardian</b><small>{guardianStatus?.connected?"Connected":guardianStatus?.pending?"Pairing":"Telegram"}</small></span><i className={guardianStatus?.connected?"guardian-dot connected":"guardian-dot"}/></button>}{account?<div className="wallet-wrap"><button className="wallet" onClick={()=>setWalletMenu(v=>!v)}>{shortAddress(account)} <span className="chev">⌄</span></button>{walletMenu&&<div className="wallet-menu"><div className="wallet-menu-head"><small>CONNECTED WALLET</small><b>{shortAddress(account)}</b></div><button onClick={()=>navigator.clipboard?.writeText(account)}>Copy full address</button>{presenceRecordId===0&&<button disabled={loading} onClick={()=>{setWalletMenu(false);refresh({force:true,address:account}).catch(()=>{});}}>Refresh records</button>}<div className="wallet-network"><i/>GenLayer Studionet</div><button className={`disconnect ${busy==="disconnect"?"is-busy":""}`} disabled={busy==="disconnect"} onClick={onDisconnect}>{busy==="disconnect"?<><span className="btn-spinner"/>Disconnecting…</>:"Disconnect wallet"}</button></div>}</div>:<button className={`wallet ${busy==="connect"?"is-busy":""}`} disabled={busy==="connect"} onClick={onConnect}>{busy==="connect"?<><span className="btn-spinner"/>Opening wallet…</>:"Connect wallet"}</button>}</div></header>
    <main className={`workspace ${tab==="home"?"home-workspace":"feature-workspace"}`}>
      {presenceRecordId>0&&<section className="emergency-presence"><div><div className="mini-label">OWNER PRESENCE · COVENANT #{presenceRecordId}</div><h3>Cancel this recovery challenge with the owner wallet.</h3><p>{presenceTarget?`${presenceTarget.name || `Covenant #${presenceRecordId}`} · ${presenceTarget.state || "Onchain"}`:"Connect the owner wallet. Safetern will read only this covenant, not the full dashboard."}</p>{presenceLookupError&&<small className="lookup-warn">{presenceLookupError}</small>}</div>{!account?<button className={`primary-action ${busy==="connect"?"is-busy":""}`} disabled={busy==="connect"} onClick={onConnect}>{busy==="connect"?<><span className="btn-spinner"/>Opening wallet…</>:"Connect owner wallet"}</button>:presenceTarget&&sameAddress(presenceTarget.owner,account)?<button className={`primary-action ${busy===`presence-${presenceRecordId}`?"is-busy":""}`} disabled={Boolean(busy)||presenceTarget.state!=="CHALLENGE"} onClick={()=>stateAction("presence",presenceRecordId)}>{busy===`presence-${presenceRecordId}`?<><span className="btn-spinner"/>Submitting…</>:presenceTarget.state==="CHALLENGE"?"I'M STILL HERE":`State: ${presenceTarget.state||"Unavailable"}`}</button>:<button className="secondary-action" disabled={Boolean(busy)} onClick={()=>loadPresenceTarget(account)}>Retry covenant check</button>}</section>}
      {tab==="home"?<>
        <section className="overview home-overview"><div><div className="eyebrow"><span/> Intelligent continuity powered by GenLayer</div><h1>Built to continue.</h1><p>Protect what you control. Monitor what you depend on. Recover what shouldn't be lost.</p></div><div className="overview-stats"><div><strong>{account?records.length:"—"}</strong><span>Your records</span></div><div><strong>{account?totalChallenges:"—"}</strong><span>Active challenges</span></div><div><strong>{account?totalRecovered:"—"}</strong><span>Recovered</span></div></div></section>
        <section className="home-products"><button onClick={()=>setTab("protect")}><span>01</span><div><b>Protect</b><small>{account?`${protects.length} covenant${protects.length===1?"":"s"}`:"Connect to view"} · Systems you control</small></div><i>→</i></button><button onClick={()=>setTab("watch")}><span>02</span><div><b>Watch</b><small>{account?`${watches.length} watch${watches.length===1?"":"es"}`:"Connect to view"} · Projects you depend on</small></div><i>→</i></button><button onClick={()=>setTab("recover")}><span>03</span><div><b>Recover</b><small>{account?`${visibleRecovers.length} covenant${visibleRecovers.length===1?"":"s"}`:"Connect to view"} · Encrypted continuity</small></div><i>→</i></button></section>
        <section className="home-section"><div className="home-section-head"><div><div className="mini-label">RECENT ACTIVITY</div><h2>Your latest Safetern records</h2></div></div>{!account?<div className="empty-state"><div className="empty-icon">◎</div><h3>Connect wallet to view your records</h3><p>Safetern makes no contract record requests while disconnected.</p><button className="primary-action" onClick={onConnect}>Connect wallet</button></div>:loading?<div className="empty-state"><span className="loader"/><h3>Reading your Safetern records</h3></div>:recentRows.length===0?<div className="empty-state"><h3>No records for this wallet</h3><p>Choose Protect, Watch or Recover to create your first Safetern record.</p></div>:<div className="recent-list">{recentRows.map(({id,record})=><button key={id} onClick={()=>setTab(record.mode==="WATCH"?"watch":record.mode==="PROTECT"?"protect":"recover")}><span className={`status-dot ${String(record.state||"UNASSESSED").toLowerCase()}`}/><div><b>{record.name}</b><small>{record.mode==="WATCH"?"Watch":record.mode==="PROTECT"?"Protect":"Recover"} · Record #{id}</small></div><strong>{statusCopy[record.state]?.[0]||record.state||"Not assessed"}</strong><i>→</i></button>)}</div>}</section>
      </>:<>
        <section className="feature-hero"><div><div className="mini-label">{meta.kicker}</div><h1>{tab==="watch"?"Watch":tab==="protect"?"Protect":"Recover"}</h1><h2>{meta.title}</h2><p>{meta.body}</p></div><button className="primary-action" onClick={openCreate}>{meta.action}</button></section>
        <section className="feature-stats"><div><strong>{currentRows.length}</strong><span>{tab==="watch"?"Watches":tab==="protect"?"Covenants":"Recovery covenants"}</span></div><div><strong>{currentRows.filter(({record})=>record.state==="CHALLENGE").length}</strong><span>Challenges</span></div><div><strong>{currentRows.filter(({record})=>record.state==="RECOVERED").length}</strong><span>Recovered</span></div></section>
        <Notice notice={notice} onClear={()=>setNotice(null)}/>
        {tab==="recover"&&<section className="recovery-identity recovery-identity-v2"><div className="identity-copy"><div className="mini-label">BENEFICIARY SETUP</div><h3>Recovery Identity</h3><p>Create this once for a beneficiary wallet. Safetern registers only the public encryption identity onchain; the private recovery key remains encrypted in the beneficiary browser.</p><div className="identity-points"><span>1</span><b>One wallet approval secures your Recovery Identity on this device.</b><span>2</span><b>One GenLayer transaction registers the public identity.</b></div></div><div className="identity-card compact">{!account?<><div className="identity-state-icon">◎</div><b>Connect the beneficiary wallet</b><p>This wallet will own the Recovery Identity.</p><button className={`primary-action ${busy==="connect"?"is-busy":""}`} disabled={busy==="connect"} onClick={onConnect}>{busy==="connect"?<><span className="btn-spinner"/>Opening wallet…</>:"Connect wallet"}</button></>:!identity?<><div className="identity-state-icon">＋</div><b>No Recovery Identity yet</b><p>{shortAddress(account)} can create and register one now.</p><button className={`primary-action ${busy==="identity"?"is-busy":""}`} disabled={busy==="identity"} onClick={createIdentity}>{busy==="identity"?<><span className="btn-spinner"/>Follow wallet prompt…</>:"Create Recovery Identity"}</button><button className="text-action" onClick={()=>backupInput.current?.click()}>Import encrypted backup</button></>:<><div className="identity-ready-row"><div className="identity-ready"><span>✓</span><div><b>Recovery Identity ready</b><small>{shortAddress(account)}</small></div></div><span className="registered-pill">REGISTERED</span></div><div className="identity-fingerprint"><span>Key fingerprint</span><code>{shortAddress(identity.fingerprint)}</code></div><p className="identity-ready-copy">Owners can now nominate this wallet and Safetern will find its public recovery key automatically.</p><div className="identity-actions"><button className="secondary-action" onClick={()=>exportIdentityBackup(identity)}>Export encrypted backup</button><details className="identity-advanced"><summary>Advanced</summary><button className="text-action" onClick={()=>navigator.clipboard?.writeText(recipientCode)}>Copy public recovery code</button></details></div></>}</div><input ref={backupInput} hidden type="file" accept="application/json" onChange={(e)=>importBackup(e.target.files?.[0])}/></section>}
        {tab==="recover"&&account&&myAssignments.length>0&&<section className="assignment-banner"><div><div className="mini-label">ASSIGNED TO THIS WALLET</div><h3>{myAssignments.length} recovery covenant{myAssignments.length===1?"":"s"} nominate {shortAddress(account)}</h3></div><span>Only this wallet can claim onchain access after recovery is finalized.</span></section>}
        <section className="feature-records"><div className="section-title"><div className="mini-label">{tab.toUpperCase()} RECORDS</div><h2>{tab==="watch"?"Your Watches":tab==="protect"?"Your continuity covenants":"Your recovery covenants"}</h2></div>{!account?<div className="empty-state"><div className="empty-icon">◎</div><h3>Connect wallet to view your records</h3><p>Protect, Watch and Recover records load only after a wallet is connected.</p><button className="primary-action" onClick={onConnect}>Connect wallet</button></div>:loading?<div className="empty-state"><span className="loader"/><h3>Reading your Safetern records</h3><p>Loading accepted Studionet state for {shortAddress(account)}…</p></div>:currentRows.length===0?<div className="empty-state"><div className="empty-icon">{tab==="watch"?"◉":tab==="protect"?"◇":"⌁"}</div><h3>{tab==="watch"?"No Watches yet":tab==="protect"?"No Protect covenants yet":"No recovery covenants for this wallet"}</h3><p>{tab==="watch"?"Create a Watch using public evidence you choose.":tab==="protect"?"Create a continuity covenant for a system you control.":"Create a Recovery Covenant as an owner, or connect a wallet that has been nominated as beneficiary."}</p><button className="primary-action" onClick={openCreate}>{meta.action}</button></div>:<div className="record-grid">{currentRows.map(renderCard)}</div>}</section>
      </>}
    </main>

    {modal==="watch"&&<WizardModal creationResult={creationResult?.kind==="watch"?creationResult:null} onSuccessDone={()=>{setModal("");setCreationResult(null);setTab("watch");}} title="Create a Watch" kicker="SAFETERN WATCH" step={wizardStep} setStep={setWizardStep} steps={["Type",watchForm.watchType==="crypto"?"Token":"Project","Signals","Evidence","Review"]} onClose={()=>setModal("")} busy={busy} onFinish={onCreateWatch} finishLabel="Create Watch" finishBusy={busy==="create-watch"}><>
      {wizardStep===0&&<div className="wizard-page"><h3>What are you monitoring?</h3><p>Choose the Watch type. Crypto Token adds liquidity and major-exchange continuity signals.</p><div className="watch-type-grid"><button type="button" className={watchForm.watchType==="project"?"selected":""} onClick={()=>setWatchForm({...watchForm,watchType:"project"})}><span className="choice-icon">◇</span><b>Project / Protocol</b><small>Website, development, status and official evidence.</small></button><button type="button" className={watchForm.watchType==="crypto"?"selected":""} onClick={()=>setWatchForm({...watchForm,watchType:"crypto"})}><span className="choice-icon">◉</span><b>Crypto Token</b><small>Add DEX liquidity and major exchange delisting monitoring.</small></button></div></div>}
      {wizardStep===1&&<div className="wizard-page"><h3>{watchForm.watchType==="crypto"?"Identify the token":"Identify the project"}</h3><p>{watchForm.watchType==="crypto"?"Use the contract address to avoid ticker-symbol confusion.":"Give Safetern a clear name for the project or protocol."}</p><div className="modal-grid"><label>Watch name<input required value={watchForm.name} onChange={e=>setWatchForm({...watchForm,name:e.target.value})} placeholder={watchForm.watchType==="crypto"?"Example: ABC Token Watch":"Example: Project X Watch"}/></label><label>Project / entity<input required value={watchForm.entity} onChange={e=>setWatchForm({...watchForm,entity:e.target.value})} placeholder="Project, protocol or token project"/></label>{watchForm.watchType==="crypto"&&<><label>Token symbol<input required value={watchForm.tokenSymbol} onChange={e=>setWatchForm({...watchForm,tokenSymbol:e.target.value.toUpperCase()})} placeholder="ABC"/></label><label>Blockchain<input required value={watchForm.blockchain} onChange={e=>setWatchForm({...watchForm,blockchain:e.target.value})} placeholder="Ethereum, Base, Solana…"/></label><label className="wide">Token contract address<input required value={watchForm.contractAddress} onChange={e=>setWatchForm({...watchForm,contractAddress:e.target.value})} placeholder="Contract / mint address"/></label></>}<label className="wide">Description<textarea value={watchForm.description} onChange={e=>setWatchForm({...watchForm,description:e.target.value})} placeholder="Why are you monitoring it?"/></label></div></div>}
      {wizardStep===2&&<div className="wizard-page"><h3>Choose continuity signals</h3><p>Safetern uses these as warning signals. None of them alone automatically means a project is abandoned.</p><div className="signal-options">{watchForm.watchType==="crypto"&&<><label className="check-card"><input type="checkbox" checked={watchForm.trackLiquidity} onChange={e=>setWatchForm({...watchForm,trackLiquidity:e.target.checked})}/><span><b>DEX liquidity</b><small>Track major liquidity deterioration or removal.</small></span></label><label className="check-card"><input type="checkbox" checked={watchForm.trackDelistings} onChange={e=>setWatchForm({...watchForm,trackDelistings:e.target.checked})}/><span><b>Major exchange delistings</b><small>Monitor Binance, Coinbase, Bybit, OKX and KuCoin announcements.</small></span></label></>}<label className="check-card"><input type="checkbox" checked={watchForm.trackProjectActivity} onChange={e=>setWatchForm({...watchForm,trackProjectActivity:e.target.checked})}/><span><b>Project activity</b><small>Official websites, GitHub, docs, status and announcements.</small></span></label></div><label className="monitor-select">Assessment cadence<select value={watchForm.monitoringInterval} onChange={e=>setWatchForm({...watchForm,monitoringInterval:e.target.value})}><option value="3600">Hourly</option><option value="21600">Every 6 hours</option><option value="43200">Every 12 hours</option><option value="86400">Daily</option><option value="604800">Weekly</option></select><small>Lightweight monitoring can trigger an assessment sooner when a major signal changes.</small></label></div>}
      {wizardStep===3&&<div className="wizard-page"><h3>Choose public evidence</h3><p>Add official sites, GitHub, documentation, status pages, governance or announcement sources GenLayer can inspect.</p><SourceFields form={watchForm} setForm={setWatchForm}/><label className="wide rule-box">Continuity rule<textarea className="rule" required value={watchForm.rule} onChange={e=>setWatchForm({...watchForm,rule:e.target.value})}/></label></div>}
      {wizardStep===4&&<Review title={watchForm.name||"Untitled Watch"} rows={[["Type",watchForm.watchType==="crypto"?"Crypto token":"Project / Protocol"],["Entity",watchForm.entity],["Token",watchForm.watchType==="crypto"?`${watchForm.tokenSymbol||"—"} · ${watchForm.blockchain||"—"}`:"—"],["Monitoring",formatDuration(watchForm.monitoringInterval)],["DEX liquidity",watchForm.watchType==="crypto"&&watchForm.trackLiquidity?"On":"—"],["Exchange delistings",watchForm.watchType==="crypto"&&watchForm.trackDelistings?"On":"—"],["Project activity",watchForm.trackProjectActivity?"On":"Off"],["Contract",watchForm.watchType==="crypto"?shortAddress(watchForm.contractAddress):"—"],["Evidence sources",watchForm.sources.filter(Boolean).length]]} note="Watch is informational only. Liquidity loss and delistings are treated as risk signals, never automatic proof of abandonment."/>}
    </></WizardModal>}

    {modal==="protect"&&<WizardModal creationResult={creationResult?.kind==="protect"?creationResult:null} onSuccessDone={()=>{setModal("");setCreationResult(null);setTab("protect");}} title="Protect a digital system" kicker="NEW COVENANT" step={wizardStep} setStep={setWizardStep} steps={["Basics","Recovery","Evidence","Review"]} onClose={()=>setModal("")} busy={busy} onFinish={onCreateProtect} finishLabel="Create Covenant" finishBusy={busy==="create-protect"}><>{wizardStep===0&&<div className="wizard-page"><h3>What are you protecting?</h3><p>Create a continuity covenant for an agent, protocol, DAO, project or digital system.</p><div className="modal-grid"><label>Covenant name<input required value={protectForm.name} onChange={e=>setProtectForm({...protectForm,name:e.target.value})} placeholder="Example: Atlas Agent Continuity"/></label><label>Protected entity<input required value={protectForm.entity} onChange={e=>setProtectForm({...protectForm,entity:e.target.value})} placeholder="Agent, protocol, DAO or project"/></label><label className="wide">Description<textarea value={protectForm.description} onChange={e=>setProtectForm({...protectForm,description:e.target.value})}/></label></div></div>}{wizardStep===1&&<div className="wizard-page"><h3>Who takes over if recovery completes?</h3><p>The recovery controller is fixed when this covenant is created. GenLayer cannot replace it.</p><div className="modal-grid"><label className="wide">Recovery controller wallet<input required pattern="0x[a-fA-F0-9]{40}" value={protectForm.recoveryController} onChange={e=>setProtectForm({...protectForm,recoveryController:e.target.value})} placeholder="0x…"/></label><label>Evidence policy<select value={protectForm.policy} onChange={e=>setProtectForm({...protectForm,policy:e.target.value})}><option>STRICT</option><option>STANDARD</option></select></label><label>Challenge period<select value={protectForm.challengeSeconds} onChange={e=>setProtectForm({...protectForm,challengeSeconds:e.target.value})}><optgroup label="⚠ TEST MODE — accelerated only"><option value="60">⚠ 60 seconds · TEST ONLY</option><option value="300">⚠ 5 minutes · TEST ONLY</option></optgroup><optgroup label="REAL COVENANTS"><option value="86400">Standard · 24 hours</option><option value="259200">Extended · 3 days</option><option value="604800">Maximum Safety · 7 days</option></optgroup></select></label>{Number(protectForm.challengeSeconds)<=300&&<div className="wide test-mode-warning"><b>⚠ TEST MODE</b><span>This accelerated challenge can finalize recovery almost immediately. Use only for controlled testing — not a real covenant.</span></div>}</div></div>}{wizardStep===2&&<div className="wizard-page"><h3>Define the continuity evidence</h3><p>Temporary inactivity and fetch failures should never be enough by themselves.</p><SourceFields form={protectForm} setForm={setProtectForm}/><label className="wide rule-box">Continuity rule<textarea className="rule" required value={protectForm.rule} onChange={e=>setProtectForm({...protectForm,rule:e.target.value})}/></label></div>}{wizardStep===3&&<Review title={protectForm.name||"Untitled Covenant"} rows={[["Entity",protectForm.entity],["Recovery controller",shortAddress(protectForm.recoveryController)],["Policy",protectForm.policy],["Challenge",formatDuration(protectForm.challengeSeconds)]]} note="An ABANDONED assessment starts the challenge. The owner can cancel it by confirming presence; finalization is permissionless after expiry."/>}</></WizardModal>}

    {modal==="recover"&&<WizardModal creationResult={creationResult?.kind==="recover"?creationResult:null} onSuccessDone={()=>{setModal("");setCreationResult(null);setTab("recover");}} title="Create encrypted recovery" kicker="RECOVERY COVENANT" step={wizardStep} setStep={setWizardStep} steps={["Basics","Beneficiary","Secret","Evidence","Review"]} onClose={()=>setModal("")} busy={busy} onFinish={onCreateRecover} finishLabel="Encrypt & create" finishBusy={busy==="create-recover"}><>{wizardStep===0&&<div className="wizard-page"><h3>What should this recovery covenant protect?</h3><p>Safetern stores encrypted recovery information, never your assets.</p><div className="modal-grid"><label>Recovery covenant name<input required value={recoverForm.name} onChange={e=>setRecoverForm({...recoverForm,name:e.target.value})}/></label><label>Protected context<input required value={recoverForm.entity} onChange={e=>setRecoverForm({...recoverForm,entity:e.target.value})}/></label><label className="wide">Public description<input value={recoverForm.description} onChange={e=>setRecoverForm({...recoverForm,description:e.target.value})}/></label></div></div>}{wizardStep===1&&<div className="wizard-page"><h3>Nominate the beneficiary</h3><p>Enter the wallet. If that wallet has registered a Safetern Recovery Identity, Safetern can fetch its public encryption key automatically.</p><div className="modal-grid"><label className="wide">Beneficiary wallet<input required pattern="0x[a-fA-F0-9]{40}" value={recoverForm.beneficiary} onChange={e=>{setRecoverForm({...recoverForm,beneficiary:e.target.value,beneficiaryCode:""});setBeneficiaryLookup(null);}} placeholder="0x…"/></label><div className="wide beneficiary-lookup"><button type="button" className={`secondary-action ${busy==="lookup-beneficiary"?"is-busy":""}`} onClick={lookupBeneficiary} disabled={busy==="lookup-beneficiary"}>{busy==="lookup-beneficiary"?<><span className="btn-spinner"/>Finding identity…</>:"Find Recovery Identity"}</button>{beneficiaryLookup&&<span className={beneficiaryLookup.found?"lookup-ok":"lookup-warn"}>{beneficiaryLookup.message}</span>}</div>{!recoverForm.beneficiaryCode&&<label className="wide">Fallback public Recovery Key Code<textarea className="code-input" value={recoverForm.beneficiaryCode} onChange={e=>setRecoverForm({...recoverForm,beneficiaryCode:e.target.value.trim()})} placeholder="Only needed if the beneficiary has not registered their identity onchain"/></label>}{recoverForm.beneficiaryCode&&<div className="wide identity-found">✓ Beneficiary encryption identity ready</div>}</div></div>}{wizardStep===2&&<div className="wizard-page"><div className="recovery-warning"><b>Never enter a full seed phrase or private key.</b><span>Use a fragment, riddle, location, passphrase clue or recovery instruction.</span></div><div className="modal-grid"><label>Payload type<select value={recoverForm.payloadType} onChange={e=>setRecoverForm({...recoverForm,payloadType:e.target.value})}><option>Recovery instructions</option><option>Passphrase fragment</option><option>Personal riddle</option><option>Location hint</option><option>Credential fragment</option><option>Custom</option></select></label><label className="wide sensitive-field">Recovery information<textarea required maxLength={1200} value={recoverForm.secret} onChange={e=>setRecoverForm({...recoverForm,secret:e.target.value})}/><small>{recoverForm.secret.length}/1200 · Encrypted locally before submission.</small></label></div></div>}{wizardStep===3&&<div className="wizard-page"><h3>Define when release is allowed</h3><p>GenLayer judges the evidence. Deterministic challenge logic controls the release.</p><div className="modal-grid"><label>Evidence policy<select value={recoverForm.policy} onChange={e=>setRecoverForm({...recoverForm,policy:e.target.value})}><option>STRICT</option><option>STANDARD</option></select></label><label>Challenge period<select value={recoverForm.challengeSeconds} onChange={e=>setRecoverForm({...recoverForm,challengeSeconds:e.target.value})}><optgroup label="⚠ TEST MODE — accelerated only"><option value="60">⚠ 60 seconds · TEST ONLY</option><option value="300">⚠ 5 minutes · TEST ONLY</option></optgroup><optgroup label="REAL COVENANTS"><option value="86400">Standard · 24 hours</option><option value="259200">Extended · 3 days</option><option value="604800">Maximum Safety · 7 days</option></optgroup></select></label>{Number(recoverForm.challengeSeconds)<=300&&<div className="wide test-mode-warning"><b>⚠ TEST MODE</b><span>This accelerated challenge can release beneficiary access almost immediately. Use only for controlled testing — not real recovery information.</span></div>}<div className="wide"><SourceFields form={recoverForm} setForm={setRecoverForm}/></div><label className="wide rule-box">Continuity rule<textarea className="rule" required value={recoverForm.rule} onChange={e=>setRecoverForm({...recoverForm,rule:e.target.value})}/></label></div></div>}{wizardStep===4&&<Review title={recoverForm.name||"Untitled Recovery Covenant"} rows={[["Beneficiary",shortAddress(recoverForm.beneficiary)],["Payload",recoverForm.payloadType],["Policy",recoverForm.policy],["Challenge",formatDuration(recoverForm.challengeSeconds)],["Evidence sources",recoverForm.sources.filter(Boolean).length]]} note="Readable recovery information stays local. Only ciphertext and its integrity hash are submitted."/>}</></WizardModal>}

    {guardianModal&&<div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e)=>{if(e.target===e.currentTarget&&!busy)setGuardianModal(false);}}><div className="guardian-modal"><div className="guardian-hero"><img src={guardianMascot} alt="Safetern Guardian mascot"/><div><div className="mini-label">TELEGRAM GUARDIAN</div><h2>Your Safetern Guardian.</h2><p>Stay reachable when continuity changes.</p></div><button className="close" onClick={()=>!busy&&setGuardianModal(false)}>×</button></div><div className="guardian-body">{!GUARDIAN_API_URL?<div className="guardian-state warning"><span>!</span><div><b>Guardian endpoint not configured</b><p>This website build needs a public HTTPS Guardian API before Telegram pairing can work for users.</p></div></div>:guardianStatus?.connected?<><div className="guardian-state connected"><span>✓</span><div><b>Guardian Connected</b><p>{shortAddress(account)} will receive meaningful Protect, Watch and Recover alerts in Telegram.</p></div></div><div className="guardian-points"><p>Challenge alerts include a direct owner-presence link.</p><p>Recovery finalization and beneficiary availability are reported automatically.</p><p>Guardian cannot sign owner-only or beneficiary-only actions for you.</p></div><button className={`danger-action full ${busy==="guardian-disconnect"?"is-busy":""}`} disabled={Boolean(busy)} onClick={disconnectGuardian}>{busy==="guardian-disconnect"?<><span className="btn-spinner"/>Confirm wallet signature…</>:"Disconnect Telegram Guardian"}</button></>:<><div className="guardian-state"><span>◎</span><div><b>{guardianStatus?.pending?"Finish pairing in Telegram":"Connect Telegram Guardian"}</b><p>Pair this wallet with @SafeternGuardianBot using a one-time wallet-authorized link.</p></div></div><div className="guardian-points"><p>Your wallet signs a connection message. No blockchain transaction is created.</p><p>The one-time Telegram link expires after 10 minutes.</p><p>Alerts are scoped to Safetern records involving this wallet.</p></div>{guardianPairUrl&&<a className="primary-action guardian-open" href={guardianPairUrl} target="_blank" rel="noreferrer">Open @SafeternGuardianBot</a>}{guardianStatus?.pending?<button className="secondary-action full" disabled={Boolean(busy)} onClick={()=>refreshGuardianStatus(account)}>{busy==="guardian-status"?<><span className="btn-spinner"/>Checking…</>:"Check connection"}</button>:<button className={`primary-action full ${busy==="guardian-connect"?"is-busy":""}`} disabled={Boolean(busy)} onClick={connectGuardian}>{busy==="guardian-connect"?<><span className="btn-spinner"/>Waiting for signature…</>:"Connect Telegram Guardian"}</button>}</>}</div></div></div>}

    {revealed&&<div className="modal-backdrop"><div className="secret-modal"><div className="secret-icon">✓</div><div className="mini-label">BENEFICIARY-ONLY RECOVERY</div><h2>{revealed.record.name}</h2><p className="secret-type">{revealed.payload.type}</p><div className="secret-content">{revealed.payload.message}</div><div className="secret-safety">Decrypted locally after onchain beneficiary access was claimed. Close this window when finished.</div><div className="modal-footer"><button className="secondary-action" onClick={()=>navigator.clipboard?.writeText(revealed.payload.message)}>Copy information</button><button className="primary-action" onClick={()=>setRevealed(null)}>Close securely</button></div></div></div>}

    <footer><span>Safetern v0.3 · Experimental software · Do not use for production secrets</span><span>Contract {shortAddress(SAFETERN_CONTRACT)} · GenLayer Studionet</span></footer>
  </div>;
}

function Review({title,rows,note}) { return <div className="wizard-page review-page"><div className="review-mark">✓</div><div className="mini-label">READY TO SUBMIT</div><h3>{title}</h3><div className="review-grid">{rows.map(([k,v])=><div key={k}><span>{k}</span><b>{String(v||"—")}</b></div>)}</div><div className="security-note">{note}</div></div>; }

function WizardModal({title,kicker,step,setStep,steps,onClose,busy,onFinish,finishLabel,finishBusy,creationResult,onSuccessDone,children}) {
  const last=step===steps.length-1;
  const success=Boolean(creationResult);
  const successTitle=creationResult?.kind==="watch"?"Watch created!":creationResult?.kind==="recover"?"Recovery Covenant created!":"Covenant created!";
  const content=<div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(e)=>{if(e.target===e.currentTarget&&!busy&&!success)onClose();}}><div className="modal wizard-modal"><div className="modal-head"><div><div className="mini-label">{success?"COMPLETED":kicker}</div><h2>{success?successTitle:title}</h2></div><button type="button" className="close" onClick={()=>{if(!busy)(success?onSuccessDone():onClose())}}>×</button></div>{success?<div className="completion-page"><div className="completion-mark">✓</div><div className="mini-label">ONCHAIN & READY</div><h3>{creationResult.name}</h3><p>{creationResult.appeared?"Safetern has confirmed the new record on GenLayer Studionet.":"The transaction was submitted and GenLayer is still finalizing it."}</p><div className="completion-details"><span><small>Record</small><b>{creationResult.recordId?`#${creationResult.recordId}`:"Finalizing"}</b></span>{creationResult.monitoringInterval&&<span><small>Monitoring</small><b>{formatDuration(creationResult.monitoringInterval)}</b></span>}<span><small>Transaction</small><b>{shortAddress(creationResult.hash)}</b></span></div><div className="completion-actions"><button className="secondary-action" onClick={()=>navigator.clipboard?.writeText(creationResult.hash)}>Copy transaction</button><button className="primary-action" onClick={onSuccessDone}>View {creationResult.kind==="watch"?"Watch":creationResult.kind==="recover"?"Recovery":"Covenant"}</button></div></div>:<><div className="wizard-progress" style={{gridTemplateColumns:`repeat(${steps.length}, minmax(0, 1fr))`}}>{steps.map((label,i)=><div key={`${label}-${i}`} className={i===step?"current":i<step?"done":""}><span>{i<step?"✓":i+1}</span><small>{label}</small></div>)}</div><form onSubmit={last?onFinish:(e)=>{e.preventDefault();setStep(v=>Math.min(steps.length-1,v+1));}}><div className="wizard-body">{children}</div><div className="modal-footer wizard-footer"><button type="button" className="text-action" onClick={()=>step===0?onClose():setStep(v=>v-1)}>{step===0?"Cancel":"Back"}</button><div className="wizard-footer-right"><span>{step+1} / {steps.length}</span><button className={`primary-action ${finishBusy?"is-busy":""}`} disabled={Boolean(busy)}>{last?(finishBusy?<><span className="btn-spinner"/>Waiting for wallet…</>:finishLabel):"Next"}</button></div></div></form></>}</div></div>;
  return createPortal(content,document.body);
}

export default App;
