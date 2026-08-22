const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;
const NSE_BASE = "https://www.nseindia.com";
const NSE_HEADERS = {
  "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
  "Accept-Language":"en-US,en;q=0.9,hi;q=0.8",
  "Accept":"application/json,text/plain,*/*",
  "Cache-Control":"no-cache",
  "Pragma":"no-cache"
};
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Cache-Control","no-store,no-cache,must-revalidate,proxy-revalidate");
  if(req.method==="OPTIONS") return res.sendStatus(204);
  next();
});
const liveData={success:true,nifty:null,niftyChange:null,banknifty:null,bankniftyChange:null,finnifty:null,finniftyChange:null,vix:null,vixChange:null,updated:null,source:"none"};
let nseCookies="",nseCookieTime=0,optionPromise=null,optionCache=null,optionCacheTime=0;
function cookieHeader(r){if(typeof r.headers.getSetCookie==="function")return r.headers.getSetCookie().map(x=>x.split(";")[0].trim()).filter(Boolean).join("; ");const raw=r.headers.get("set-cookie")||"";return raw?raw.split(/,(?=[^;,=]+=[^;,]+)/).map(x=>x.split(";")[0].trim()).filter(Boolean).join("; "):"";}
async function getNSECookies(force=false){if(!force&&nseCookies&&Date.now()-nseCookieTime<300000)return nseCookies;const home=await fetch(`${NSE_BASE}/`,{headers:NSE_HEADERS,redirect:"follow"});const first=cookieHeader(home);let cookies=first;try{const page=await fetch(`${NSE_BASE}/option-chain?symbol=NIFTY`,{headers:{...NSE_HEADERS,Accept:"text/html,application/xhtml+xml",Referer:`${NSE_BASE}/`},redirect:"follow"});const second=cookieHeader(page);if(second){const map=new Map();for(const item of `${first}; ${second}`.split(";")){const i=item.indexOf("=");if(i>0)map.set(item.slice(0,i).trim(),item.slice(i+1).trim());}cookies=[...map.entries()].map(([k,v])=>`${k}=${v}`).join("; ");}}catch(e){console.log("[NSE] cookie warmup",e?.message||e);}nseCookies=cookies;nseCookieTime=Date.now();return cookies;}
function parseJson(text){const raw=String(text||"").trim();try{return JSON.parse(raw);}catch(_){}const a=raw.indexOf("{");const b=raw.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(raw.slice(a,b+1));}catch(_) {}}throw new Error(`Invalid JSON: ${raw.slice(0,160)}`);}
async function nseJson(path,retry=true){try{const cookies=await getNSECookies(false);const r=await fetch(`${NSE_BASE}${path}`,{headers:{...NSE_HEADERS,Referer:`${NSE_BASE}/option-chain`,"X-Requested-With":"XMLHttpRequest",...(cookies?{Cookie:cookies}:{})},redirect:"follow"});const text=await r.text();if([401,403,404].includes(r.status)&&retry){nseCookies="";await getNSECookies(true);return nseJson(path,false);}if(!r.ok)throw new Error(`NSE HTTP ${r.status}: ${text.slice(0,160)}`);return parseJson(text);}catch(e){console.log(`[NSE] failed ${path}:`,e?.message||e);throw e;}}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function updatePrice(m,p,c){const n=num(p);if(!n||n<=0)return;liveData[m]=n;liveData[`${m}Change`]=num(c);liveData.updated=new Date().toISOString();liveData.source="nse";}
async function updatePrices(){try{const b=await nseJson("/api/allIndices");const a=Array.isArray(b?.data)?b.data:[];const f=(...names)=>a.find(x=>names.includes(String(x?.index||"").trim()));const v={nifty:f("NIFTY 50"),banknifty:f("NIFTY BANK"),finnifty:f("NIFTY FINANCIAL SERVICES"),vix:f("INDIA VIX")};for(const [m,x] of Object.entries(v))if(x)updatePrice(m,x.last,x.percentChange);}catch(e){console.error("[NSE] price error",e?.message||e);}}
app.get("/",(q,r)=>r.json({success:true,message:"Strike Pulse Relay is running",source:liveData.source,lastUpdate:liveData.updated}));
app.get("/api/prices",async(q,r)=>{if(!liveData.nifty)await updatePrices();r.json({success:true,nifty:liveData.nifty,niftyChange:liveData.niftyChange,banknifty:liveData.banknifty,bankniftyChange:liveData.bankniftyChange,finnifty:liveData.finnifty,finniftyChange:liveData.finniftyChange,vix:liveData.vix,vixChange:liveData.vixChange,updated:liveData.updated,source:liveData.source,data:liveData});});
function normalize(body){const root=body?.records||body?.data||body;const rows=Array.isArray(root?.data)?root.data:[];const expiry=root?.expiryDates?.[0]||body?.expiryDates?.[0]||null;const current=expiry?rows.filter(x=>x?.expiryDate===expiry):rows;const map=new Map();for(const x of current){const strike=num(x?.strikePrice);if(strike===null)continue;if(!map.has(strike))map.set(strike,{strike,ce:null,pe:null});if(x?.CE)map.get(strike).ce=x.CE;if(x?.PE)map.get(strike).pe=x.PE;}return {expiry,underlying:num(root?.underlyingValue??body?.underlyingValue),rows:[...map.values()].sort((a,b)=>a.strike-b.strike)};}
function build(body){const n=normalize(body);if(!n.rows.length)throw new Error("NIFTY option chain data not available");const spot=n.underlying||liveData.nifty;if(!Number.isFinite(spot))throw new Error("NIFTY price not available");let ai=0,dist=Infinity;n.rows.forEach((x,i)=>{const d=Math.abs(x.strike-spot);if(d<dist){dist=d;ai=i;}});const rows=n.rows.slice(Math.max(0,ai-5),ai+6).map(x=>({strike:x.strike,ce:{ltp:num(x.ce?.lastPrice),oi:num(x.ce?.openInterest),oiChange:num(x.ce?.changeinOpenInterest),volume:num(x.ce?.totalTradedVolume)},pe:{ltp:num(x.pe?.lastPrice),oi:num(x.pe?.openInterest),oiChange:num(x.pe?.changeinOpenInterest),volume:num(x.pe?.totalTradedVolume)}}));const callOI=rows.reduce((s,x)=>s+(x.ce.oi||0),0),putOI=rows.reduce((s,x)=>s+(x.pe.oi||0),0);return {success:true,source:"nse",spot,expiry:n.expiry,atmStrike:n.rows[ai].strike,callOI,putOI,callOIChange:rows.reduce((s,x)=>s+(x.ce.oiChange||0),0),putOIChange:rows.reduce((s,x)=>s+(x.pe.oiChange||0),0),pcr:callOI?putOI/callOI:null,rows,updated:new Date().toISOString()};}
async function loadOption(){
  const info=await nseJson("/api/option-chain-contract-info?symbol=NIFTY");
  const expiry=info?.expiryDates?.[0]||info?.records?.expiryDates?.[0];
  if(!expiry)throw new Error("NIFTY expiry date not available");
  console.log("[NSE] option expiry",expiry);
  const path=`/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=${encodeURIComponent(expiry)}`;
  const body=await nseJson(path);
  const result=build(body);optionCache=result;optionCacheTime=Date.now();return result;
}
app.get("/api/nifty-option-chain",async(q,r)=>{if(optionCache&&Date.now()-optionCacheTime<10000)return r.json(optionCache);if(optionPromise){try{return r.json(await optionPromise);}catch(e){return r.status(500).json({success:false,error:e?.message||String(e)});}}optionPromise=Promise.race([loadOption(),new Promise((_,rej)=>setTimeout(()=>rej(new Error("Option chain upstream timeout")),20000))]);try{return r.json(await optionPromise);}catch(e){return r.status(500).json({success:false,error:e?.message||String(e)});}finally{optionPromise=null;}});
updatePrices();setInterval(updatePrices,15000);
app.listen(PORT,"0.0.0.0",()=>console.log(`Strike Pulse Relay running on port ${PORT}`));