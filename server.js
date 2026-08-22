const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;
const NSE_BASE = "https://www.nseindia.com";
const H = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36","Accept-Language":"en-US,en;q=0.9","Accept":"application/json,text/plain,*/*","Referer":"https://www.nseindia.com/option-chain"};
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Cache-Control","no-store");if(req.method==="OPTIONS")return res.sendStatus(204);next();});
let cookies="",cookieAt=0,optionCache=null,optionAt=0,optionPromise=null;
const price={success:true,nifty:null,niftyChange:null,banknifty:null,bankniftyChange:null,finnifty:null,finniftyChange:null,vix:null,vixChange:null,updated:null,source:"nse"};
function cookiesFrom(r){if(typeof r.headers.getSetCookie==="function")return r.headers.getSetCookie().map(x=>x.split(";")[0]).filter(Boolean).join("; ");const x=r.headers.get("set-cookie")||"";return x?x.split(/,(?=[^;,=]+=[^;,]+)/).map(v=>v.split(";")[0].trim()).filter(Boolean).join("; "):"";}
async function warm(force=false){if(!force&&cookies&&Date.now()-cookieAt<240000)return cookies;let r=await fetch(NSE_BASE+"/",{headers:H});cookies=cookiesFrom(r);try{r=await fetch(NSE_BASE+"/option-chain?symbol=NIFTY",{headers:{...H,Accept:"text/html"}});const c=cookiesFrom(r);if(c)cookies=c;}catch{}cookieAt=Date.now();return cookies;}
async function getJson(path,retry=true){try{const c=await warm(false);const r=await fetch(NSE_BASE+path,{headers:{...H,...(c?{Cookie:c}:{}),"X-Requested-With":"XMLHttpRequest"},redirect:"follow"});const t=await r.text();if([401,403,404].includes(r.status)&&retry){cookies="";await warm(true);return getJson(path,false);}if(!r.ok)throw Error(`NSE HTTP ${r.status}: ${t.slice(0,120)}`);return JSON.parse(t);}catch(e){if(retry){cookies="";try{await warm(true);const r=await fetch(NSE_BASE+path,{headers:{...H,Cookie:cookies,"X-Requested-With":"XMLHttpRequest"}});const t=await r.text();if(r.ok)return JSON.parse(t);}catch{} }throw e;}}
const num=v=>Number.isFinite(Number(v))?Number(v):null;
async function updatePrices(){try{const b=await getJson("/api/allIndices");const a=b?.data||[];const f=n=>a.find(x=>String(x?.index||"").trim()===n);for(const [k,n] of Object.entries({nifty:"NIFTY 50",banknifty:"NIFTY BANK",finnifty:"NIFTY FINANCIAL SERVICES",vix:"INDIA VIX"})){const x=f(n);if(x){price[k]=num(x.last);price[k+"Change"]=num(x.percentChange);}}price.updated=new Date().toISOString();}catch(e){console.log("price",e.message)}}
function normalize(b,expiry){const root=b?.records||b?.data||b;const rows=Array.isArray(root?.data)?root.data:[];const map=new Map();for(const x of rows){if(expiry&&x?.expiryDate&&x.expiryDate!==expiry)continue;const s=num(x?.strikePrice);if(s==null)continue;if(!map.has(s))map.set(s,{strike:s,ce:null,pe:null});if(x.CE)map.get(s).ce=x.CE;if(x.PE)map.get(s).pe=x.PE;}return {spot:num(root?.underlyingValue??b?.underlyingValue),rows:[...map.values()].sort((a,b)=>a.strike-b.strike)};}
function build(b,expiry){const z=normalize(b,expiry);if(!z.rows.length)throw Error("NIFTY option chain data not available");const spot=z.spot||price.nifty;if(!spot)throw Error("NIFTY spot unavailable");let ai=0,d=Infinity;z.rows.forEach((x,i)=>{const q=Math.abs(x.strike-spot);if(q<d){d=q;ai=i;}});const rows=z.rows.slice(Math.max(0,ai-5),ai+6).map(x=>({strike:x.strike,ce:{ltp:num(x.ce?.lastPrice),oi:num(x.ce?.openInterest),oiChange:num(x.ce?.changeinOpenInterest),volume:num(x.ce?.totalTradedVolume)},pe:{ltp:num(x.pe?.lastPrice),oi:num(x.pe?.openInterest),oiChange:num(x.pe?.changeinOpenInterest),volume:num(x.pe?.totalTradedVolume)}}));const callOI=rows.reduce((s,x)=>s+(x.ce.oi||0),0),putOI=rows.reduce((s,x)=>s+(x.pe.oi||0),0);return {success:true,source:"nse",spot,expiry,atmStrike:z.rows[ai].strike,callOI,putOI,callOIChange:rows.reduce((s,x)=>s+(x.ce.oiChange||0),0),putOIChange:rows.reduce((s,x)=>s+(x.pe.oiChange||0),0),pcr:callOI?putOI/callOI:null,rows,updated:new Date().toISOString()};}
async function loadOption(){
  let info;
  try{info=await getJson("/api/option-chain-contract-info?symbol=NIFTY");}catch(e){console.log("contract-info failed",e.message);}
  const expiry=info?.expiryDates?.[0]||info?.records?.expiryDates?.[0]||null;
  const paths=[];
  if(expiry)paths.push(`/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=${encodeURIComponent(expiry)}`);
  paths.push(`/api/option-chain-v3?type=Indices&symbol=NIFTY`);
  if(expiry)paths.push(`/api/option-chain-indices?symbol=NIFTY&expiry=${encodeURIComponent(expiry)}`);
  paths.push(`/api/option-chain-indices?symbol=NIFTY`);
  let last=null;
  for(const path of paths){try{console.log("option try",path);const body=await getJson(path);const result=build(body,expiry);optionCache=result;optionAt=Date.now();return result;}catch(e){last=e;console.log("option failed",e.message);}}
  throw last||Error("NIFTY option chain data not available");
}
app.get("/",(q,r)=>r.json({success:true,message:"Strike Pulse Relay is running",source:"nse",lastUpdate:price.updated}));
app.get("/api/prices",async(q,r)=>{if(!price.nifty)await updatePrices();r.json({...price,data:price});});
app.get("/api/nifty-option-chain",async(q,r)=>{if(optionCache&&Date.now()-optionAt<10000)return r.json(optionCache);if(optionPromise){try{return r.json(await optionPromise)}catch(e){return r.status(500).json({success:false,error:e.message})}}optionPromise=Promise.race([loadOption(),new Promise((_,rej)=>setTimeout(()=>rej(Error("Option chain upstream timeout")),25000))]);try{r.json(await optionPromise)}catch(e){r.status(500).json({success:false,error:e.message})}finally{optionPromise=null}});
updatePrices();setInterval(updatePrices,15000);app.listen(PORT,"0.0.0.0",()=>console.log("Strike Pulse Relay running on "+PORT));
