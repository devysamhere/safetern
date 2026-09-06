import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const trimmed=line.trim(); if(!trimmed||trimmed.startsWith("#")) continue;
  const i=trimmed.indexOf("="); if(i<1) continue;
  const key=trimmed.slice(0,i).trim(), value=trimmed.slice(i+1).trim(); if(!(key in process.env)) process.env[key]=value;
}
const token=String(process.env.TELEGRAM_BOT_TOKEN||"").trim();
const chatId=String(process.env.TELEGRAM_CHAT_ID||"").trim();
if(!token||!chatId){console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in monitor/.env first.");process.exit(1);}
const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:chatId,text:"Safetern Guardian is connected.\n\nAutonomous Watch notifications are ready."})});
const data=await response.json();
if(!data.ok){console.error(data.description||"Telegram test failed");process.exit(1);}
console.log("Telegram Guardian test message sent.");
