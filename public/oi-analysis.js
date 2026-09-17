(function () {
  'use strict';
  if (window.__StrikePulseOIAnalysisLoaded) return;
  window.__StrikePulseOIAnalysisLoaded = true;

  const BASE = 'https://strike-pulse-relay.onrender.com/api';
  const REFRESH_MS = 15000;
  let symbol = 'NIFTY', timer = null, loading = false;
  const $ = (s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const root=()=>$('.sp-oi-intel');
  const n=v=>{if(v===null||v===undefined||v==='')return null;const x=Number(String(v).replace(/,/g,'').replace(/%/g,''));return Number.isFinite(x)?x:null};
  const fmt=(v,d=0)=>{const x=n(v);return x===null?'--':x.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})};
  const signed=(v,d=0)=>{const x=n(v);return x===null?'--':(x>0?'+':'')+fmt(x,d)};
  const text=(e,v)=>{if(e)e.textContent=v==null||v===''?'--':String(v)};
  const set=(s,v,r=document)=>$$(s,r).forEach((e,i)=>e.textContent=Array.isArray(v)?(v[i]??'--'):v);
  function first(o,keys){for(const k of keys)if(o&&o[k]!==undefined&&o[k]!==null&&o[k]!=='')return o[k];return null}
  function unwrap(b){if(!b||typeof b!=='object')return{};return b.data&&typeof b.data==='object'&&!Array.isArray(b.data)?b.data:b}
  function normalize(body){
    const raw=unwrap(body);
    const source=(Array.isArray(raw.rows)&&raw.rows)||(Array.isArray(raw.data)&&raw.data)||(Array.isArray(raw.records?.data)&&raw.records.data)||(Array.isArray(raw.filtered?.data)&&raw.filtered.data)||(Array.isArray(raw.optionChain)&&raw.optionChain)||(Array.isArray(raw.options)&&raw.options)||(Array.isArray(body?.rows)&&body.rows)||[];
    const rows=source.map(item=>{const ce=item?.CE||item?.ce||item?.call||item?.calls||{},pe=item?.PE||item?.pe||item?.put||item?.puts||{};return{strike:n(first(item,['strike','strikePrice','strike_price','StrikePrice'])),ce:{oi:n(first(ce,['oi','openInterest','OI','open_interest'])),oiChange:n(first(ce,['oiChange','changeinOpenInterest','changeOI','OIChange','change_in_oi'])),ltp:n(first(ce,['ltp','lastPrice','LTP','lastTradedPrice','price'])),change:n(first(ce,['change','pChange','percentChange'])),volume:n(first(ce,['volume','totalTradedVolume','Volume','totalVolume'])),iv:n(first(ce,['iv','impliedVolatility','IV']))},pe:{oi:n(first(pe,['oi','openInterest','OI','open_interest'])),oiChange:n(first(pe,['oiChange','changeinOpenInterest','changeOI','OIChange','change_in_oi'])),ltp:n(first(pe,['ltp','lastPrice','LTP','lastTradedPrice','price'])),change:n(first(pe,['change','pChange','percentChange'])),volume:n(first(pe,['volume','totalTradedVolume','Volume','totalVolume'])),iv:n(first(pe,['iv','impliedVolatility','IV']))}}).filter(r=>r.strike!==null).sort((a,b)=>a.strike-b.strike);
    return{success:body?.success!==false,symbol:String(body?.symbol||raw?.symbol||symbol).toUpperCase(),spot:n(first(raw,['spot','spotPrice','underlyingValue','underlying','indexPrice','underlying_value']))??n(body?.records?.underlyingValue)??n(body?.spot),expiry:body?.expiry??raw?.expiry??body?.expiryDate??raw?.expiryDate??null,expiries:body?.expiries||raw?.expiries||[],atm:n(body?.atmStrike??body?.atm??raw?.atmStrike??raw?.atm),callOI:n(body?.callOI??raw?.callOI),putOI:n(body?.putOI??raw?.putOI),callOIChange:n(body?.callOIChange??raw?.callOIChange),putOIChange:n(body?.putOIChange??raw?.putOIChange),pcr:n(body?.pcr??raw?.pcr),maxPain:n(body?.maxPain??raw?.maxPain),rows}
  }
  function calc(d){
    const rows=d.rows,step=rows.length>1?Math.abs(rows[1].strike-rows[0].strike):50;
    const atm=d.atm??(rows.length&&d.spot!=null?rows.reduce((a,r)=>Math.abs(r.strike-d.spot)<Math.abs(a.strike-d.spot)?r:a,rows[0]).strike:null);
    const near=rows.filter(r=>atm==null||Math.abs(r.strike-atm)<=Math.max(step*4,150));
    const sum=(s,f,a=rows)=>a.reduce((x,r)=>x+(n(r?.[s]?.[f])||0),0);
    const callOI=d.callOI??sum('ce','oi'),putOI=d.putOI??sum('pe','oi'),callChg=d.callOIChange??sum('ce','oiChange'),putChg=d.putOIChange??sum('pe','oiChange'),pcr=d.pcr??(callOI?putOI/callOI:null);
    const state=(s,r)=>{const o=n(r?.[s]?.oiChange),p=n(r?.[s]?.change);if(o==null||p==null)return'NEUTRAL';if(o>0&&p<0)return'WRITING';if(o<0&&p>0)return'COVERING';if(o>0&&p>0)return'LONG BUILDUP';if(o<0&&p<0)return'LONG UNWINDING';return'NEUTRAL'};
    const behaviour=s=>{const c={'WRITING':0,'COVERING':0,'LONG BUILDUP':0,'LONG UNWINDING':0,'NEUTRAL':0};rows.forEach(r=>c[state(s,r)]++);const z=Object.entries(c).filter(x=>x[0]!=='NEUTRAL').sort((a,b)=>b[1]-a[1])[0]||['NEUTRAL',0];return{state:z[0],count:z[1],counts:c}};
    const cb=behaviour('ce'),pb=behaviour('pe');
    const walls={call:rows.filter(r=>r.ce.oi!=null).sort((a,b)=>b.ce.oi-a.ce.oi).slice(0,3),put:rows.filter(r=>r.pe.oi!=null).sort((a,b)=>b.pe.oi-a.pe.oi).slice(0,3)};
    const activity=near.flatMap(r=>[{side:'CE',strike:r.strike,type:state('ce',r),oi:r.ce.oi,oiChange:r.ce.oiChange,change:r.ce.change},{side:'PE',strike:r.strike,type:state('pe',r),oi:r.pe.oi,oiChange:r.pe.oiChange,change:r.pe.change}]).filter(x=>x.oiChange!=null).sort((a,b)=>Math.abs(b.oiChange)-Math.abs(a.oiChange));
    const pressure=near.map(r=>({strike:r.strike,ce:n(r.ce.oiChange)||0,pe:n(r.pe.oiChange)||0,total:Math.abs(n(r.ce.oiChange)||0)+Math.abs(n(r.pe.oiChange)||0)})).sort((a,b)=>b.total-a.total).slice(0,6);
    let structure='BALANCED STRUCTURE';if(cb.state==='WRITING'&&pb.state==='WRITING')structure='TWO-SIDED WRITING';else if(cb.state==='WRITING')structure='CALL-SIDE PRESSURE';else if(pb.state==='WRITING')structure='PUT-SIDE SUPPORT';else if(pcr!=null&&pcr>1.15)structure='PUT-HEAVY STRUCTURE';else if(pcr!=null&&pcr<0.85)structure='CALL-HEAVY STRUCTURE';
    return{...d,rows,near,atm,step,callOI,putOI,callChg,putChg,pcr,cb,pb,walls,activity,pressure,structure,expiry:d.expiry||d.expiries?.[0]||'--'}
  }
  const label=()=>symbol==='BANKNIFTY'?'BANK NIFTY':symbol==='FINNIFTY'?'FIN NIFTY':symbol==='MIDCPNIFTY'?'MIDCAP':symbol;
  function render(d){
    const r=root();if(!r||!d.rows.length)throw Error('No option-chain rows received');
    set('.sp-oi-kicker',`${label()} • OI POSITIONING`,r);set('.sp-oi-live-pill','LIVE OI',r);
    const core=$('.sp-pulse-core',r);text($('strong',core),d.structure);text($('span',core),`${d.near.length} near-ATM strikes analysed`);
    set('.sp-pulse-orbit.orbit-ce',`CE ${fmt(d.callOI)}`,r);set('.sp-pulse-orbit.orbit-pe',`PE ${fmt(d.putOI)}`,r);
    const copy=$('.sp-pulse-copy',r);if(copy){text($('h2',copy),`${label()} • ${d.structure}`);text($('p',copy),`Spot ${fmt(d.spot,2)} • ATM ${fmt(d.atm)} • PCR ${d.pcr==null?'--':d.pcr.toFixed(2)} • Expiry ${d.expiry}`)}
    $$('.sp-oi-behaviour-card',r).forEach((c,i)=>{const b=i?d.pb:d.cb;c.className=c.className.replace(/\bis-[a-z-]+\b/g,'').trim();c.classList.add('is-'+b.state.toLowerCase().replace(/ /g,'-'));text($('.sp-behaviour-result',c),b.state);const s=$$('.sp-behaviour-row strong',c);if(s[0])s[0].textContent=`${b.count} strikes show ${b.state.toLowerCase()} characteristics`;if(s[1])s[1].textContent=`${b.count} activity`;const bar=$('.sp-behaviour-track span',c);if(bar)bar.style.width=Math.max(12,Math.min(100,b.count/Math.max(1,d.rows.length)*100))+'%'});
    const mc=$$('.sp-matrix-cell',r),cnt={'LONG BUILDUP':0,'SHORT COVERING':0,'SHORT BUILDUP':0,'LONG UNWINDING':0};d.near.forEach(x=>['ce','pe'].forEach(s=>{const o=x[s].oiChange,p=x[s].change,k=o>0&&p<0?'SHORT BUILDUP':o<0&&p>0?'SHORT COVERING':o>0&&p>0?'LONG BUILDUP':o<0&&p<0?'LONG UNWINDING':null;if(k)cnt[k]++}));Object.keys(cnt).forEach((k,i)=>{const c=mc[i];if(c){text($('strong',c),k);text($('span',c),`${cnt[k]} signals near ATM`);c.dataset.state=k.toLowerCase().replace(/ /g,'-')}});text($('.sp-matrix-note',r),`Near-ATM scan: ${d.near.length} strikes • Spot ${fmt(d.spot,2)} • ATM ${fmt(d.atm)}`);
    const wl=$$('.sp-wall-level',r);if(wl[0])wl[0].textContent=d.walls.call[0]?`CALL WALL • ${fmt(d.walls.call[0].strike)} • ${fmt(d.walls.call[0].ce.oi)}`:'CALL WALL • --';if(wl[1])wl[1].textContent=d.walls.put[0]?`PUT WALL • ${fmt(d.walls.put[0].strike)} • ${fmt(d.walls.put[0].pe.oi)}`:'PUT WALL • --';set('.sp-wall-label',`ATM ${fmt(d.atm)}`,r);
    const total=Math.abs(d.callChg)+Math.abs(d.putChg)||1,ce=Math.round(Math.abs(d.callChg)/total*100),pe=100-ce,m=$('.sp-shift-meter',r);if(m)m.style.setProperty('--sp-shift',ce+'%');set('.sp-shift-copy strong',[`${ce}% CE`,`${pe}% PE`],r);text($('.sp-shift-copy p',r),`${signed(d.callChg)} Call OI change vs ${signed(d.putChg)} Put OI change across the near-ATM zone.`);
    const acts=$$('.sp-activity-item',r);d.activity.slice(0,acts.length||6).forEach((x,i)=>{const e=acts[i];if(!e)return;const s=$$('strong',e),sp=$$('span',e);if(s[0])s[0].textContent=`${x.side} ${fmt(x.strike)} • ${x.type}`;if(sp[0])sp[0].textContent=`OI ${signed(x.oiChange)}`;if(sp[1])sp[1].textContent=`Price ${signed(x.change,2)}%`});
    const pr=$$('.sp-pressure-row',r);d.pressure.forEach((x,i)=>{const e=pr[i];if(!e)return;const s=$$('span',e);if(s[0])s[0].textContent=fmt(x.strike);if(s[1])s[1].textContent=`CE ${signed(x.ce)} • PE ${signed(x.pe)}`;const bar=$('i',e);if(bar)bar.style.width=Math.min(100,Math.max(4,x.total/Math.max(1,d.pressure[0]?.total||1)*100))+'%'});
    const an=[];d.rows.forEach(x=>['ce','pe'].forEach(s=>{const z=x[s];if(z.oiChange!=null&&z.oi!=null&&Math.abs(z.oiChange)>Math.max(1,z.oi*.12))an.push({strike:x.strike,side:s.toUpperCase(),change:z.oiChange})}));an.sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));$$('.sp-anomaly-card',r).forEach((e,i)=>{const x=an[i];if(!x)return;text($('strong',e),`${x.side} ${fmt(x.strike)} • OI spike`);text($('p',e),`${signed(x.change)} OI change detected near the active zone.`)});
    set('.sp-expiry-line',`EXPIRY • ${d.expiry}`,r);set('.sp-expiry-points',[`Spot ${fmt(d.spot,2)}`,`ATM ${fmt(d.atm)}`,`Max Pain ${fmt(d.maxPain)}`],r);const story=$('.sp-story',r);if(story)text($('p',story),`${label()} is showing ${d.cb.state.toLowerCase()} on calls and ${d.pb.state.toLowerCase()} on puts. Near-ATM OI shift is ${d.callChg>=d.putChg?'more call-side':'more put-side'}, with PCR ${d.pcr==null?'--':d.pcr.toFixed(2)}.`);
    window.__SP_OI_ANALYSIS_LAST__=d;document.documentElement.dataset.spOiReady='1';
  }
  async function load(){if(loading||!root())return;loading=true;try{const res=await fetch(`${BASE}/option-chain?symbol=${encodeURIComponent(symbol)}&_=${Date.now()}`,{cache:'no-store'});const body=await res.json();if(!res.ok||body?.success===false)throw Error(body?.error||body?.message||`HTTP ${res.status}`);render(calc(normalize(body)));console.log(`[OI Analysis] ${symbol}: live values loaded`)}catch(e){console.error('[OI Analysis] load failed:',e);document.documentElement.dataset.spOiReady='0'}finally{loading=false}}
  function bind(){const r=root();if(!r)return;$$('.sp-oi-market-switch button,.sp-oi-market-switch [data-symbol],[data-oi-symbol]',r).forEach(t=>{if(t.dataset.spOiBound)return;t.dataset.spOiBound='1';t.addEventListener('click',()=>{const v=String(t.dataset.symbol||t.dataset.oiSymbol||t.textContent||'').toUpperCase();symbol=v.includes('BANK')?'BANKNIFTY':v.includes('FIN')?'FINNIFTY':v.includes('MID')?'MIDCPNIFTY':v.includes('SENSEX')?'SENSEX':'NIFTY';load()})})}
  function start(){if(!root())return setTimeout(start,300);bind();load();clearInterval(timer);timer=setInterval(()=>{bind();load()},REFRESH_MS)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
