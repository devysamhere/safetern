const enc = new TextEncoder();
const dec = new TextDecoder();
const IDENTITY_PREFIX = "safetern:recovery-identity:v1:";
const ENVELOPE_PREFIX = "safetern:inline:v1:";

function bytesToB64(bytes) {
  let binary = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64ToBytes(value) {
  const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function jsonToCode(value) { return bytesToB64(enc.encode(JSON.stringify(value))); }
function codeToJson(value) { return JSON.parse(dec.decode(b64ToBytes(value.trim()))); }

async function sha256Bytes(value) {
  const bytes = typeof value === "string" ? enc.encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

export async function sha256Hex(value) {
  const hash = await sha256Bytes(value);
  return `0x${Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function aesKeyFromSignature(signature) {
  const raw = await sha256Bytes(signature);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function signPersonal(account, message) {
  if (!window.ethereum) throw new Error("No browser wallet detected.");
  return window.ethereum.request({ method: "personal_sign", params: [message, account] });
}

function identityStorageKey(address) { return `${IDENTITY_PREFIX}${String(address).toLowerCase()}`; }

async function recoverPersonalSigner(message, signature) {
  if (!window.ethereum) throw new Error("A compatible browser wallet is required to verify the Recovery Key Code.");
  try {
    return await window.ethereum.request({ method: "personal_ecRecover", params: [message, signature] });
  } catch {
    throw new Error("Your wallet could not verify the Recovery Key Code signature.");
  }
}

export async function generateRecoveryIdentity(account) {
  if (!account) throw new Error("Connect the beneficiary wallet first.");
  const pair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const fingerprint = await sha256Hex(JSON.stringify(publicJwk));

  // One wallet signature only. This signature never becomes public; it is
  // used solely as the local encryption key for the beneficiary's private
  // Recovery Identity. The subsequent onchain registration transaction is
  // what binds the public key to the beneficiary wallet.
  const unlockMessage = `Safetern Recovery Identity Unlock v2\nWallet: ${account.toLowerCase()}\nPublicKeyHash: ${fingerprint}`;
  const unlockSignature = await signPersonal(account, unlockMessage);
  const wrappingKey = await aesKeyFromSignature(unlockSignature);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedPrivate = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    enc.encode(JSON.stringify(privateJwk)),
  );
  const identity = {
    version: 2,
    address: account,
    publicJwk,
    fingerprint,
    unlockMessage,
    encryptedPrivate: { iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(encryptedPrivate)) },
    createdAt: Date.now(),
  };
  localStorage.setItem(identityStorageKey(account), JSON.stringify(identity));
  return identity;
}

export function getRecoveryIdentity(account) {
  if (!account) return null;
  try { return JSON.parse(localStorage.getItem(identityStorageKey(account)) || "null"); } catch { return null; }
}

export function removeRecoveryIdentity(account) {
  if (account) localStorage.removeItem(identityStorageKey(account));
}

export function recipientCodeFromIdentity(identity) {
  if (!identity) return "";
  if (Number(identity.version || 1) >= 2) {
    return jsonToCode({
      version: 2,
      address: identity.address,
      publicJwk: identity.publicJwk,
      fingerprint: identity.fingerprint,
    });
  }
  return jsonToCode({
    version: 1,
    address: identity.address,
    publicJwk: identity.publicJwk,
    fingerprint: identity.fingerprint,
    attestationMessage: identity.attestationMessage,
    attestationSignature: identity.attestationSignature,
  });
}

export function exportIdentityBackup(identity) {
  if (!identity) throw new Error("No Recovery Identity is available.");
  const blob = new Blob([JSON.stringify(identity, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `safetern-recovery-identity-${String(identity.address).slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importIdentityBackup(file, connectedAccount) {
  const text = await file.text();
  const identity = JSON.parse(text);
  if (!identity?.address || !identity?.publicJwk || !identity?.encryptedPrivate) throw new Error("Invalid Safetern Recovery Identity backup.");
  if (connectedAccount && identity.address.toLowerCase() !== connectedAccount.toLowerCase()) throw new Error("This Recovery Identity belongs to a different wallet.");
  if (Number(identity.version || 1) < 2) {
    const recovered = await recoverPersonalSigner(identity.attestationMessage, identity.attestationSignature);
    if (recovered.toLowerCase() !== identity.address.toLowerCase()) throw new Error("Recovery Identity signature is invalid.");
  }
  localStorage.setItem(identityStorageKey(identity.address), JSON.stringify(identity));
  return identity;
}

export async function verifyRecipientCode(code, beneficiaryAddress) {
  let bundle;
  try { bundle = codeToJson(code); } catch { throw new Error("The beneficiary Recovery Identity is invalid."); }
  if (!bundle?.address || !bundle?.publicJwk || !bundle?.fingerprint) throw new Error("Incomplete beneficiary Recovery Identity.");
  if (bundle.address.toLowerCase() !== String(beneficiaryAddress).toLowerCase()) throw new Error("Recovery Identity does not belong to the nominated beneficiary wallet.");

  // Legacy v1 codes carried a wallet attestation signature. v2 identities are
  // bound by register_recovery_identity onchain, so no second personal_sign is
  // exposed publicly or required during identity creation.
  if (Number(bundle.version || 1) < 2) {
    if (!bundle.attestationSignature || !bundle.attestationMessage) throw new Error("Incomplete legacy Recovery Key Code.");
    const recovered = await recoverPersonalSigner(bundle.attestationMessage, bundle.attestationSignature);
    if (recovered.toLowerCase() !== bundle.address.toLowerCase()) throw new Error("Beneficiary Recovery Key Code signature is invalid.");
  }
  const fingerprint = await sha256Hex(JSON.stringify(bundle.publicJwk));
  if (fingerprint.toLowerCase() !== String(bundle.fingerprint).toLowerCase()) throw new Error("Beneficiary encryption key fingerprint does not match.");
  return bundle;
}

export function validateRecoverySecret(secret) {
  const value = String(secret || "").trim();
  if (!value) throw new Error("Enter the recovery information to encrypt.");
  if (value.length > 1200) throw new Error("Recovery information is limited to 1,200 characters in this build.");
  const words = value.split(/\s+/).filter(Boolean);
  if ([12, 15, 18, 21, 24].includes(words.length) && words.every((w) => /^[a-zA-Z]+$/.test(w))) {
    throw new Error("Safetern blocks complete seed phrases. Store only a fragment, clue, location, riddle, or recovery instruction.");
  }
  if (/^(0x)?[a-fA-F0-9]{64}$/.test(value.replace(/\s+/g, ""))) {
    throw new Error("Safetern blocks full private keys. Store a safer recovery fragment or instruction instead.");
  }
  return value;
}

export async function encryptRecoveryPayload({ secret, payloadType, beneficiaryCode, beneficiaryAddress }) {
  const plaintext = validateRecoverySecret(secret);
  const bundle = await verifyRecipientCode(beneficiaryCode, beneficiaryAddress);
  const publicKey = await crypto.subtle.importKey("jwk", bundle.publicJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const rawAesKey = new Uint8Array(await crypto.subtle.exportKey("raw", aesKey));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = JSON.stringify({ version: 1, type: payloadType, message: plaintext, createdAt: Date.now() });
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, enc.encode(payload));
  const wrappedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawAesKey);
  const envelope = {
    version: 1,
    algorithm: "RSA-OAEP-256+A256GCM",
    beneficiary: bundle.address,
    keyFingerprint: bundle.fingerprint,
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(ciphertext)),
    wrappedKey: bytesToB64(new Uint8Array(wrappedKey)),
  };
  const encoded = jsonToCode(envelope);
  const ref = `${ENVELOPE_PREFIX}${encoded}`;
  return { ref, hash: await sha256Hex(ref) };
}

async function unlockPrivateKey(identity, account) {
  if (!identity) throw new Error("No Safetern Recovery Identity found for this wallet. Import your encrypted backup first.");
  if (identity.address.toLowerCase() !== String(account).toLowerCase()) throw new Error("Recovery Identity belongs to another wallet.");
  const signature = await signPersonal(account, identity.unlockMessage);
  const wrappingKey = await aesKeyFromSignature(signature);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(identity.encryptedPrivate.iv) },
    wrappingKey,
    b64ToBytes(identity.encryptedPrivate.ciphertext),
  );
  const privateJwk = JSON.parse(dec.decode(decrypted));
  return crypto.subtle.importKey("jwk", privateJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
}

export async function decryptRecoveryPayload({ encryptedRef, expectedHash, account }) {
  if (!encryptedRef?.startsWith(ENVELOPE_PREFIX)) throw new Error("Unsupported Safetern recovery payload format.");
  const actualHash = await sha256Hex(encryptedRef);
  if (expectedHash && actualHash.toLowerCase() !== String(expectedHash).toLowerCase()) throw new Error("Encrypted recovery payload failed its integrity check.");
  const identity = getRecoveryIdentity(account);
  const privateKey = await unlockPrivateKey(identity, account);
  const envelope = codeToJson(encryptedRef.slice(ENVELOPE_PREFIX.length));
  if (String(envelope.beneficiary).toLowerCase() !== String(account).toLowerCase()) throw new Error("This encrypted payload is not addressed to the connected beneficiary wallet.");
  if (identity.fingerprint.toLowerCase() !== String(envelope.keyFingerprint).toLowerCase()) throw new Error("Your Recovery Identity does not match the key used for this covenant.");
  const rawAesKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, b64ToBytes(envelope.wrappedKey));
  const aesKey = await crypto.subtle.importKey("raw", rawAesKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(envelope.iv) }, aesKey, b64ToBytes(envelope.ciphertext));
  return JSON.parse(dec.decode(plaintext));
}
