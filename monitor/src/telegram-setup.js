import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 1) continue;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim();
  if (!(key in process.env)) process.env[key] = value;
}
const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is empty in monitor/.env");
  process.exit(1);
}
const api = `https://api.telegram.org/bot${token}`;
async function call(method, payload = {}) {
  const response = await fetch(`${api}/${method}`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(payload) });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || `Telegram ${response.status}`);
  return data.result;
}
const me = await call("getMe");
console.log(`Bot connected: @${me.username}`);
console.log("Open Telegram and send /start to that bot.");
const rl = readline.createInterface({ input:process.stdin, output:process.stdout });
await rl.question("After sending /start, press Enter here... ");
rl.close();
const updates = await call("getUpdates", { timeout:0, allowed_updates:["message"] });
const chats = [];
for (const update of updates || []) {
  const chat = update?.message?.chat;
  if (!chat?.id) continue;
  if (!chats.some(item => String(item.id) === String(chat.id))) chats.push(chat);
}
if (!chats.length) {
  console.error("No Telegram chat found. Send /start to the bot and run this command again.");
  process.exit(1);
}
console.log("\nChat(s) found:");
for (const chat of chats) console.log(`TELEGRAM_CHAT_ID=${chat.id}    ${chat.first_name || chat.title || ""}`.trim());
console.log("\nCopy the TELEGRAM_CHAT_ID value for your chat into monitor/.env.");
