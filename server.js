const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;
const NSE = "https://www.nseindia.com";
const YAHOO = "https://query1.finance.yahoo.com";
const HEADERS = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36","Accept-Language":"en-US,en;q=0.9","Accept":"application/json,text/plain,*/*","Referer":"https://www.nseindia.com/option-chain"};
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");if(req.method==="OPTIONS")return res.sendStatus(204);next();});
let cookies="",cookieAt=0;
const cache=new Map(),pending=new Map();
const price={success:true,nifty:null,niftyChange:null,banknifty:null,bankniftyChange:null,finnifty:null,finniftyChange:null,vix:null,vixChange:null,sensex:null,sensexChange:null,vwap:null,updated:null,source:"nse"};
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
function getCookies(r){if(typeof r.headers.getSetCookie==="function")return r.headers.getSetCookie().map(x=>x.split(";")[0]).filter(Boolean).join("; ");const x=r.headers.get("set-cookie")||"";return x?x.split(/,(?=[^;,=]+=[^;,=]+)/).map(v=>v.split(";")[0].trim()).filter(Boolean).join("; "):"";}
async function warm(force=false){if(!force&&cookies&&Date.now()-cookieAt<240000)return cookies;let r=await fetch(NSE+"/",{headers:HEADERS});cookies=getCookies(r);try{r=await fetch(NSE+"/option-chain",{headers:{...HEADERS,Accept:"text/html"}});const c=getCookies(r);if(c)cookies=c;}catch{}cookieAt=Date.now();return cookies;}
async function nse(path,retry=true){try{const c=await warm(false);const r=await fetch(NSE+path,{headers:{...HEADERS,...(c?{Cookie:c}:{}),"X-Requested-With":"XMLHttpRequest"}});const t=await r.text();if([401,403,404].includes(r.status)&&retry){cookies="";await warm(true);return nse(path,false);}if(!r.ok)throw Error(`NSE HTTP ${r.status}: ${t.slice(0,160)}`);return JSON.parse(t);}catch(e){if(retry){cookies="";try{await warm(true);const r=await fetch(NSE+path,{headers:{...HEADERS,Cookie:cookies,"X-Requested-With":"XMLHttpRequest"}});const t=await r.text();if(r.ok)return JSON.parse(t);}catch{}}throw e;}}
async function yahooPrice(symbol){const r=await fetch(YAHOO+"/v8/finance/chart/"+encodeURIComponent(symbol)+"?range=1d&interval=1m",{headers:{"User-Agent":HEADERS["User-Agent"]}});if(!r.ok)throw Error(`Yahoo HTTP ${r.status}`);const body=await r.json();const result=body?.chart?.result?.[0];const meta=result?.meta||{};const last=num(meta.regularMarketPrice);const prev=num(meta.previousClose);if(last==null)throw Error("Yahoo price unavailable");return {last,change:last!=null&&prev?((last-prev)/prev)*100:null};}
async function yahooIntraday(symbol="^NSEI"){const r=await fetch(YAHOO+"/v8/finance/chart/"+encodeURIComponent(symbol)+"?range=1d&interval=5m",{headers:{"User-Agent":HEADERS["User-Agent"]}});if(!r.ok)throw Error(`Yahoo intraday HTTP ${r.status}`);const body=await r.json();const result=body?.chart?.result?.[0],q=result?.indicators?.quote?.[0];if(!q)throw Error("Yahoo intraday data unavailable");const ts=result.timestamp||[],high=q.high||[],low=q.low||[],close=q.close||[];const points=[];let sum=0,count=0;for(let i=0;i<Math.min(ts.length,high.length,low.length,close.length);i++){const h=num(high[i]),l=num(low[i]),x=num(close[i]);if(h==null||l==null||x==null)continue;const typical=(h+l+x)/3;sum+=typical;count++;points.push({t:ts[i]*1000,price:x,vwap:sum/count});}if(!points.length)throw Error("No valid intraday points");return {vwap:points[points.length-1].vwap,spot:points[points.length-1].price,points};}
async function yahooVWAP(symbol="^NSEI"){return (await yahooIntraday(symbol)).vwap;}
function isNseOpen(){const now=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));const day=now.getDay(),mins=now.getHours()*60+now.getMinutes();return day>=1&&day<=5&&mins>=555&&mins<930;}
async function updatePrices(){let updated=false;try{const body=await nse("/api/allIndices");const list=Array.isArray(body?.data)?body.data:[];const aliases={nifty:["NIFTY 50","NIFTY"],banknifty:["NIFTY BANK","BANK NIFTY","NIFTY BANK 50"],finnifty:["NIFTY FINANCIAL SERVICES","NIFTY FIN SERVICE","FINNIFTY","NIFTY FINANCIAL SERVICES 25/50","NIFTY FIN SERVICE 25/50"],vix:["INDIA VIX","INDIA VIX INDEX"],sensex:["SENSEX","BSE SENSEX","S&P BSE SENSEX","BSE SENSEX 30"]};for(const [key,names] of Object.entries(aliases)){const item=list.find(v=>{const idx=String(v?.index||"").trim().toUpperCase();return names.some(n=>idx===n)||key==="finnifty"&&idx.includes("FINANCIAL SERVICES")||key==="finnifty"&&idx.includes("FIN SERVICE")||key==="vix"&&idx.includes("INDIA VIX");});if(item){const last=num(item.last??item.lastPrice??item.value);if(last!=null){price[key]=last;price[key+"Change"]=num(item.percentChange??item.pChange??item.change);updated=true;}}}if(updated)price.source="nse";}catch(e){console.log("NSE prices",e.message);}const yahooMap={nifty:"^NSEI",banknifty:"^NSEBANK",vix:"^INDIAVIX",sensex:"^BSESN"};for(const [key,symbol] of Object.entries(yahooMap)){if(price[key]==null){try{const q=await yahooPrice(symbol);price[key]=q.last;price[key+"Change"]=q.change;price.source="nse+yahoo-fallback";updated=true;}catch(e){console.log("Yahoo",key,e.message);}}}if(price.finnifty==null){try{const body=await nse("/api/allIndices");const list=Array.isArray(body?.data)?body.data:[];const item=list.find(v=>String(v?.index||"").toUpperCase().includes("FINANCIAL SERVICES")||String(v?.index||"").toUpperCase().includes("FIN SERVICE"));const last=num(item?.last??item?.lastPrice??item?.value);if(last!=null){price.finnifty=last;price.finniftyChange=num(item?.percentChange??item?.pChange??item?.change);price.source="nse";updated=true;}}catch(e){console.log("FINNIFTY retry",e.message);}}try{price.vwap=await yahooVWAP("^NSEI");}catch(e){console.log("Yahoo VWAP",e.message);}if(updated||price.vwap!=null)price.updated=new Date().toISOString();console.log("STRIKE PULSE PRICES:",price.nifty,price.banknifty,price.finnifty,price.vix,price.sensex,"VWAP:",price.vwap);}
function normalize(body,expiry){const candidates=[body?.records?.data,body?.filtered?.data,body?.data?.data,body?.data?.filtered?.data,body?.data,body?.rows,body?.optionChain,body?.options];const data=candidates.find(Array.isArray)||[];const map=new Map();for(const item of data){if(!item)continue;if(expiry&&item.expiryDate&&String(item.expiryDate)!==String(expiry))continue;const strike=num(item.strikePrice??item.strike??item.strike_price);if(strike==null)continue;if(!map.has(strike))map.set(strike,{strike,ce:null,pe:null});const row=map.get(strike);const ce=item.CE??item.ce??item.call??item.calls;const pe=item.PE??item.pe??item.put??item.puts;if(ce&&typeof ce==="object")row.ce={...ce};if(pe&&typeof pe==="object")row.pe={...pe};}return {spot:num(body?.records?.underlyingValue??body?.underlyingValue??body?.data?.underlyingValue),rows:[...map.values()].sort((a,b)=>a.strike-b.strike)};}
function maxPain(rows){let best=null,loss=Infinity;for(const candidate of rows){let total=0;for(const row of rows){const ceOI=num(row.ce?.openInterest)||0,peOI=num(row.pe?.openInterest)||0;if(candidate.strike>row.strike)total+=ceOI*(candidate.strike-row.strike);if(candidate.strike<row.strike)total+=peOI*(row.strike-candidate.strike);}if(total<loss){loss=total;best=candidate.strike;}}return best;}
async function contractInfo(symbol){const body=await nse(`/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`);const root=body?.records||body?.data||body||{};return [...new Set(root?.expiryDates||body?.expiryDates||[])];}
function toRows(source){const pick=(obj,keys)=>{for(const k of keys)if(obj?.[k]!==undefined&&obj?.[k]!==null)return num(obj[k]);return null;};return source.map(x=>({strike:x.strike,ce:{ltp:pick(x.ce,["lastPrice","ltp","LTP"]),change:pick(x.ce,["change"]),oi:pick(x.ce,["openInterest","oi","OI"]),oiChange:pick(x.ce,["changeinOpenInterest","oiChange","changeOI"]),volume:pick(x.ce,["totalTradedVolume","volume","Volume"]),iv:pick(x.ce,["impliedVolatility","iv","IV"]),bid:pick(x.ce,["bidprice","bidPrice","bid"]),ask:pick(x.ce,["askPrice","askprice","ask"])},pe:{ltp:pick(x.pe,["lastPrice","ltp","LTP"]),change:pick(x.pe,["change"]),oi:pick(x.pe,["openInterest","oi","OI"]),oiChange:pick(x.pe,["changeinOpenInterest","oiChange","changeOI"]),volume:pick(x.pe,["totalTradedVolume","volume","Volume"]),iv:pick(x.pe,["impliedVolatility","iv","IV"]),bid:pick(x.pe,["bidprice","bidPrice","bid"]),ask:pick(x.pe,["askPrice","askprice","ask"])}}));}
function hasRealStrikeVariation(rows){const strikes=new Set(rows.map(x=>x.strike).filter(x=>x!=null));if(strikes.size<2)return false;const ceLtp=new Set(rows.map(x=>x.ce?.ltp).filter(x=>x!=null));const peLtp=new Set(rows.map(x=>x.pe?.ltp).filter(x=>x!=null));const ceOI=new Set(rows.map(x=>x.ce?.oi).filter(x=>x!=null));const peOI=new Set(rows.map(x=>x.pe?.oi).filter(x=>x!=null));return ceLtp.size>1||peLtp.size>1||ceOI.size>1||peOI.size>1;}
async function loadChain(symbol,expiry,full=true){symbol=String(symbol||"NIFTY").toUpperCase();let expiries=[];try{expiries=await contractInfo(symbol);}catch(e){console.log("expiry",symbol,e.message);}const exp=expiry||expiries[0]||null;const type=["NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY","NIFTYNXT50"].includes(symbol)?"Indices":"Equity";const v3=`/api/option-chain-v3?type=${type}&symbol=${encodeURIComponent(symbol)}`;const standard=`/api/option-chain-${type==="Indices"?"indices":"equities"}?symbol=${encodeURIComponent(symbol)}`;const paths=[];if(exp)paths.push(v3+`&expiry=${encodeURIComponent(exp)}`);paths.push(v3);if(exp)paths.push(standard+`&expiry=${encodeURIComponent(exp)}`);paths.push(standard);let lastError;for(const path of paths){try{const body=await nse(path);const normalized=normalize(body,exp);if(!normalized.rows.length)throw Error("No option rows");const spot=normalized.spot||(symbol==="NIFTY"?price.nifty:symbol==="BANKNIFTY"?price.banknifty:symbol==="FINNIFTY"?price.finnifty:null);if(!spot)throw Error("Spot unavailable");let atmIndex=0,distance=Infinity;normalized.rows.forEach((row,i)=>{const d=Math.abs(row.strike-spot);if(d<distance){distance=d;atmIndex=i;}});const source=full?normalized.rows:normalized.rows.slice(Math.max(0,atmIndex-5),atmIndex+6);const rows=toRows(source);if(rows.length>=5&&!hasRealStrikeVariation(rows))throw Error("Upstream returned repeated values for all strikes");const callOI=rows.reduce((sum,row)=>sum+(row.ce.oi||0),0);const putOI=rows.reduce((sum,row)=>sum+(row.pe.oi||0),0);return {success:true,source:"nse",symbol,spot,expiry:exp,expiries,atm:normalized.rows[atmIndex].strike,atmStrike:normalized.rows[atmIndex].strike,callOI,putOI,callOIChange:rows.reduce((sum,row)=>sum+(row.ce.oiChange||0),0),putOIChange:rows.reduce((sum,row)=>sum+(row.pe.oiChange||0),0),pcr:callOI?putOI/callOI:null,maxPain:maxPain(normalized.rows),totalStrikes:normalized.rows.length,rows,updated:new Date().toISOString()};}catch(e){lastError=e;console.log("option",symbol,e.message);}}throw lastError||Error("Option chain unavailable");}
const POPULAR=["RELIANCE","HDFCBANK","ICICIBANK","SBIN","INFY","TCS","BHARTIARTL","ITC","LT","AXISBANK","KOTAKBANK","M&M","BAJFINANCE","HINDUNILVR","MARUTI","SUNPHARMA","ADANIENT","ADANIPORTS","NTPC","POWERGRID","TATAMOTORS","TATASTEEL","JSWSTEEL","HCLTECH","WIPRO","TECHM","COALINDIA","ONGC","BEL","TRENT","ETERNAL","INDUSINDBK","BANKBARODA","PNB","CANBK","RECLTD","PFC","IRFC","HAL","DLF","VBL","PIDILITIND","ASIANPAINT","ULTRACEMCO","GRASIM","NESTLEIND","TITAN","BAJAJFINSV","BAJAJ-AUTO","EICHERMOT","HEROMOTOCO","TVSMOTOR","DRREDDY","CIPLA","APOLLOHOSP","DIVISLAB","BPCL","IOC","GAIL","VEDL","HINDALCO","JINDALSTEL","SAIL","TATAPOWER","AMBUJACEM","ACC","ABB","SIEMENS","INDIGO","IRCTC","LICI","HDFCLIFE","SBILIFE","MOTHERSON","DABUR","COLPAL","GODREJCP","CHOLAFIN","SHRIRAMFIN","OFSS","PERSISTENT","COFORGE","MPHASIS","LTIM","BHEL","NHPC","IEX","IDEA","YESBANK"];
app.get("/",(req,res)=>res.json({success:true,message:"Strike Pulse Relay is running",source:price.source,lastUpdate:price.updated}));
app.get("/vwap.js",(req,res)=>{res.type("application/javascript").send(`(()=>{'use strict';
const API="https://strike-pulse-relay.onrender.com/api/vwap";
const $=id=>document.getElementById(id);
let currentSymbol="NIFTY",lastPoints=[];
const fmt=n=>Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const set=(id,val)=>{const e=$(id);if(e)e.textContent=val};
function selected(){
 const e=document.getElementById("spSelectedSymbol");
 return String(e?.textContent||window.StrikePulseSelectedSymbol||currentSymbol||"NIFTY").trim().toUpperCase().replace(/\s+/g,"");
}
function title(symbol){set("spVwapTitle","VWAP • "+symbol);set("spVwapSymbol",symbol)}
function draw(points){
 const p=$("spVwapPriceLine"),v=$("spVwapLine");if(!p||!v||!points?.length)return;
 const vals=points.flatMap(x=>[+x.price,+x.vwap]).filter(Number.isFinite);if(!vals.length)return;
 const min=Math.min(...vals),max=Math.max(...vals),pad=(max-min)||1,n=points.length-1;
 const xy=(x,y)=>x.toFixed(1)+","+(280-((y-min)/pad)*250).toFixed(1);
 p.setAttribute("points",points.map((x,i)=>xy(30+(i/(n||1))*940,+x.price)).join(" "));
 v.setAttribute("points",points.map((x,i)=>xy(30+(i/(n||1))*940,+x.vwap)).join(" "));
}
function tooltip(){
 const chart=$("spVwapChart"),svg=$("spVwapSvg");if(!chart||!svg||chart.dataset.spTip)return;
 chart.dataset.spTip="1";chart.style.position="relative";
 const tip=document.createElement("div");tip.id="spVwapTooltip";tip.style.cssText="display:none;position:absolute;z-index:99;pointer-events:none;padding:9px 11px;background:#020617;border:1px solid #334155;border-radius:8px;color:#fff;font:12px Arial;line-height:1.55;box-shadow:0 8px 30px rgba(0,0,0,.45)";
 const line=document.createElement("div");line.id="spVwapCrosshair";line.style.cssText="display:none;position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.45);pointer-events:none;z-index:90";
 chart.append(line,tip);
 const move=e=>{if(!lastPoints.length)return;const r=chart.getBoundingClientRect();const x=Math.max(0,Math.min(r.width,e.clientX-r.left));const i=Math.round((x/r.width)*(lastPoints.length-1));const d=lastPoints[i];if(!d)return;
 const time=d.t?new Date(d.t).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"--";
 line.style.display="block";line.style.left=x+"px";tip.style.display="block";tip.style.left=Math.min(x+12,r.width-170)+"px";tip.style.top="12px";
 tip.innerHTML="<b>"+currentSymbol+"</b><br>Time: "+time+"<br>Price: "+fmt(+d.price)+"<br>VWAP: "+fmt(+d.vwap);
 };
 chart.addEventListener("mousemove",move);chart.addEventListener("touchmove",e=>{if(e.touches[0])move(e.touches[0])},{passive:true});
 chart.addEventListener("mouseleave",()=>{tip.style.display="none";line.style.display="none"});chart.addEventListener("touchend",()=>{tip.style.display="none";line.style.display="none"});
}
async function load(forceSymbol){
 try{
  currentSymbol=String(forceSymbol||selected()||"NIFTY").toUpperCase();title(currentSymbol);
  const r=await fetch(API+"?symbol="+encodeURIComponent(currentSymbol)+"&t="+Date.now(),{cache:"no-store"});
  const j=await r.json();if(!r.ok||!j.success)throw Error(j.error||"VWAP unavailable");
  const d=j.data,s=+d.spot,v=+d.vwap,diff=s-v,pct=v?diff/v*100:0;
  set("spVwapSpot",fmt(s));set("spVwapValue",fmt(v));set("spVwapDifference",(diff>=0?"+":"")+diff.toFixed(2)+" ("+(pct>=0?"+":"")+pct.toFixed(2)+"%)");
  set("spVwapPosition",s>v?"ABOVE VWAP":s<v?"BELOW VWAP":"AT VWAP");
  set("spVwapStatus",d.marketOpen?"Live VWAP data active":"Market closed");set("spVwapUpdated",d.marketOpen?"Updated "+new Date(d.updated).toLocaleTimeString("en-IN"):"Market Closed");
  document.querySelectorAll(".sp-vwap-live").forEach(e=>e.textContent=d.marketOpen?"● LIVE":"● CLOSED");
  lastPoints=Array.isArray(d.points)?d.points:[];draw(lastPoints);tooltip();const m=$("spVwapChartMessage");if(m)m.style.display=lastPoints.length?"none":"block";
 }catch(e){set("spVwapStatus","VWAP data temporarily unavailable");console.error("STRIKE PULSE VWAP ERROR:",e)}
}
function init(){
 load();
 document.addEventListener("click",()=>setTimeout(()=>{const s=selected();if(s&&s!==currentSymbol)load(s)},100));
 const observer=new MutationObserver(()=>{const s=selected();if(s&&s!==currentSymbol)load(s)});
 const target=$("spSelectedSymbol");if(target)observer.observe(target,{childList:true,subtree:true,characterData:true});
 setInterval(()=>load(currentSymbol),30000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();`);});
app.get("/api/vwap",async(req,res)=>{try{const symbol=String(req.query.symbol||"NIFTY").toUpperCase(),yahooSymbol=symbol==="NIFTY"?"^NSEI":symbol==="BANKNIFTY"?"^NSEBANK":symbol;const intraday=await yahooIntraday(yahooSymbol);const spot=symbol==="NIFTY"?(price.nifty??intraday.spot):symbol==="BANKNIFTY"?(price.banknifty??intraday.spot):intraday.spot;const points=intraday.points.map(x=>({price:x.price,vwap:x.vwap,t:new Date(x.t).toISOString()}));res.json({success:true,data:{symbol,spot,vwap:intraday.vwap,points,marketOpen:isNseOpen(),updated:new Date().toISOString()}});}catch(e){res.status(500).json({success:false,error:e.message});}});
app.get("/api/prices",async(req,res)=>{if(!price.nifty||!price.banknifty||!price.finnifty||!price.vix||!price.sensex)await updatePrices();if(price.vwap==null){try{price.vwap=await yahooVWAP("^NSEI");price.updated=new Date().toISOString();}catch(e){console.log("VWAP request",e.message);}}res.json({...price,data:{...price},markets:{nifty:{price:price.nifty,change:price.niftyChange},banknifty:{price:price.banknifty,change:price.bankniftyChange},finnifty:{price:price.finnifty,change:price.finniftyChange},vix:{price:price.vix,change:price.vixChange},sensex:{price:price.sensex,change:price.sensexChange}}});});
app.get("/api/option-symbols",(req,res)=>{const q=String(req.query.q||"").toUpperCase().trim();const exact=[...new Set([...POPULAR,"NIFTY","BANKNIFTY","FINNIFTY","MIDCPNIFTY"])];res.json({success:true,symbols:exact.filter(x=>!q||x.includes(q)).slice(0,40)});});
app.get("/api/option-expiries",async(req,res)=>{try{const symbol=String(req.query.symbol||"NIFTY").toUpperCase();res.json({success:true,symbol,expiries:await contractInfo(symbol)});}catch(e){res.status(500).json({success:false,error:e.message});}});
app.get("/api/option-chain",async(req,res)=>{const symbol=String(req.query.symbol||"NIFTY").toUpperCase();const expiry=req.query.expiry?String(req.query.expiry):null;const full=String(req.query.full??"true")!=="false";const key=`${symbol}|${expiry||"AUTO"}|${full}`;const cached=cache.get(key);if(cached&&Date.now()-cached.at<5000)return res.json(cached.data);if(pending.has(key)){try{return res.json(await pending.get(key));}catch(e){return res.status(500).json({success:false,error:e.message});}}const promise=Promise.race([loadChain(symbol,expiry,full),new Promise((_,reject)=>setTimeout(()=>reject(Error("Option chain upstream timeout")),25000))]);pending.set(key,promise);try{const data=await promise;cache.set(key,{at:Date.now(),data});res.json(data);}catch(e){res.status(500).json({success:false,error:e.message});}finally{pending.delete(key);}});
app.get("/api/nifty-option-chain",async(req,res)=>{try{const symbol=String(req.query.symbol||"NIFTY").toUpperCase();const data=await loadChain(symbol,req.query.expiry?String(req.query.expiry):null,false);res.json(data);}catch(e){res.status(500).json({success:false,error:e.message});}});
// BSE SENSEX option chain relay
let bseCookies="",bseCookieAt=0;
const BSE_BASE="https://www.bseindia.com",BSE_API="https://api.bseindia.com/BseIndiaAPI/api";
function mergeCookies(oldCookie,newCookie){const m=new Map();for(const part of String(oldCookie||"").split(";")){const i=part.indexOf("=");if(i>0)m.set(part.slice(0,i).trim(),part.trim())}for(const part of String(newCookie||"").split(";")){const i=part.indexOf("=");if(i>0)m.set(part.slice(0,i).trim(),part.trim())}return [...m.values()].join("; ")}
async function warmBse(force=false){
 if(!force&&bseCookies&&Date.now()-bseCookieAt<240000)return bseCookies;
 const baseHeaders={"User-Agent":HEADERS["User-Agent"],"Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9","Referer":"https://www.google.com/"};
 let r=await fetch(BSE_BASE+"/",{headers:baseHeaders,redirect:"follow"}); bseCookies=mergeCookies(bseCookies,getCookies(r));
 r=await fetch(BSE_BASE+"/markets/Derivatives/DeriReports/DeriOptionchain.html",{headers:{...baseHeaders,Referer:BSE_BASE+"/",...(bseCookies?{Cookie:bseCookies}:{})},redirect:"follow"}); bseCookies=mergeCookies(bseCookies,getCookies(r)); bseCookieAt=Date.now(); return bseCookies;
}
async function bseGet(url){
 const cookie=await warmBse(false);
 const headers={"User-Agent":HEADERS["User-Agent"],"Accept":"application/json, text/plain, */*","Accept-Language":"en-US,en;q=0.9","Origin":"https://www.bseindia.com","Referer":"https://www.bseindia.com/markets/Derivatives/DeriReports/DeriOptionchain.html","X-Requested-With":"XMLHttpRequest",...(cookie?{Cookie:cookie}:{})};
 let r=await fetch(url,{headers}); if([401,403,500].includes(r.status)){await warmBse(true);r=await fetch(url,{headers:{...headers,Cookie:bseCookies}})} const t=await r.text(); if(!r.ok)throw Error("BSE HTTP "+r.status+": "+t.slice(0,120)); try{return JSON.parse(t)}catch{throw Error("BSE returned non-JSON: "+t.slice(0,80).replace(/\s+/g," "))};
}
async function bseSensexChain(){
 const urls=[
  BSE_API+"/DerivOptionChain/w?flag=1&assetType=I&symbol=SENSEX",
  BSE_API+"/DerivOptionChain/w?flag=0&assetType=I&symbol=SENSEX",
  BSE_API+"/DerivOptionChain/w?flag=1&symbol=SENSEX",
  BSE_API+"/DerivOptionChain/w?flag=1&assetType=I&symbol=SENSEX&strExpDate=",
  BSE_API+"/GetOptionChainData/w?symbol=SENSEX&assetType=I"
 ];
 let last;
 for(const u of urls){try{
   const j=await bseGet(u);
   const raw=j?.Table||j?.data||j?.Data||j?.Table1||[];
   if(!Array.isArray(raw)||!raw.length)throw Error("No BSE option rows");
   const rows=raw.map(x=>{const strike=num(x.StrikePrice??x.Strike_Price??x.Strike??x.strikePrice);return strike==null?null:{strike,ce:{ltp:num(x.C_Last_Trd_Price??x.CELTP??x.CallLTP),oi:num(x.C_Open_Interest??x.CEOI??x.CallOI),oiChange:num(x.C_Absolute_Change_OI??x.CEOIChange??x.CallOIChange),volume:num(x.C_Vol_Traded??x.CEVolume??x.CallVolume),iv:num(x.C_IV??x.CEIV??x.CallIV)},pe:{ltp:num(x.Last_Trd_Price??x.PELTP??x.PutLTP),oi:num(x.Open_Interest??x.PEOI??x.PutOI),oiChange:num(x.Absolute_Change_OI??x.PEOIChange??x.PutOIChange),volume:num(x.Vol_Traded??x.PEVolume??x.PutVolume),iv:num(x.IV??x.PEIV??x.PutIV)}}}).filter(Boolean);
   if(rows.length<2)throw Error("Invalid BSE option data");
   const spotData=await bseGet("https://api.bseindia.com/RealTimeBseIndiaAPI/api/GetSensexData/w").catch(()=>null);
   const spot=num(spotData?.Table?.[0]?.LTP??spotData?.Table?.[0]?.ltp??price.sensex)||price.sensex||(await yahooPrice("^BSESN")).last;
   let atm=rows[0].strike; rows.forEach(x=>{if(Math.abs(x.strike-spot)<Math.abs(atm-spot))atm=x.strike});
   const callOI=rows.reduce((s,x)=>s+(x.ce.oi||0),0),putOI=rows.reduce((s,x)=>s+(x.pe.oi||0),0);
   return {success:true,source:"bse",symbol:"SENSEX",spot,expiry:raw[0]?.End_TimeStamp??raw[0]?.ExpiryDate??"BSE LIVE",atm,atmStrike:atm,callOI,putOI,pcr:callOI?putOI/callOI:null,maxPain:maxPain(rows),rows:rows.filter(x=>Math.abs(x.strike-atm)<=1000),updated:new Date().toISOString()};
 }catch(e){last=e;console.log("BSE SENSEX",u,e.message)}} 
 // BSE may block cloud IPs or return HTML. Return spot-based status instead of fake option data.
 const spot=price.sensex||(await yahooPrice("^BSESN")).last;
 throw last||Error("BSE SENSEX option chain unavailable; spot "+spot);
}
app.get("/api/sensex-option-chain",async(req,res)=>{try{res.json(await bseSensexChain())}catch(e){res.status(502).json({success:false,error:e.message})}});

updatePrices();
setInterval(updatePrices,15000);
app.listen(PORT,"0.0.0.0",()=>console.log("Strike Pulse Relay running on "+PORT));
