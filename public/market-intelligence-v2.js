/* Strike Pulse — Market page live-data layer v2 */
(function(){'use strict';
const API='https://strike-pulse-relay.onrender.com/api/market-intelligence',PRICE_API='https://strike-pulse-relay.onrender.com/api/prices';
const $=id=>document.getElementById(id),text=(id,v)=>{const e=$(id);if(e&&v!=null)e.textContent=v};
const pct=v=>Number.isFinite(Number(v))?`${Number(v)>=0?'+':''}${Number(v).toFixed(2)}%`:'—';
function meter(s){const v=Math.max(0,Math.min(100,Number(s)||50));text('spmi-score',String(v));text('spmi-final-score',`${v}/100`);const p=$('spmi-meter-pointer'),f=$('spmi-meter-fill');if(p)p.style.left=`${v}%`;if(f)f.style.width=`${v}%`}
function bias(d){text('spmi-bias',d.bias);text('spmi-final-bias',d.bias);text('spmi-momentum',d.momentum);text('spmi-breadth-state',d.breadth&&d.breadth.advances>d.breadth.declines?'Healthy':'Weak')}
function breadth(b){if(!b)return;text('spmi-advances',Number(b.advances||0).toLocaleString('en-IN'));text('spmi-declines',Number(b.declines||0).toLocaleString('en-IN'));text('spmi-unchanged',Number(b.unchanged||0).toLocaleString('en-IN'));const t=(b.advances||0)+(b.declines||0)+(b.unchanged||0)||1,bar=document.querySelectorAll('.spmi-breadth .spmi-progress span');if(bar[0])bar[0].style.width=`${b.advances/t*100}%`;if(bar[1])bar[1].style.width=`${b.declines/t*100}%`;if(bar[2])bar[2].style.width=`${b.unchanged/t*100}%`}
function vix(v){if(!Number.isFinite(Number(v)))return;v=Number(v);text('spmi-vix',v.toFixed(2));text('spmi-vix-big',v.toFixed(2));const state=v>=20?'HIGH':v>=13?'MODERATE':'LOW',badge=document.querySelector('.spmi-vol-badge');if(badge)badge.textContent=state;text('spmi-vol-state',state[0]+state.slice(1).toLowerCase())}
function heat(ss){if(!Array.isArray(ss))return;const cards=[...document.querySelectorAll('.spmi-heat')];ss.forEach((s,i)=>{const c=cards[i];if(!c)return;c.querySelector('small').textContent=s.name;c.querySelector('strong').textContent=pct(s.value);c.querySelector('span').textContent=s.status;c.classList.remove('spmi-positive-strong','spmi-positive','spmi-neutral','spmi-negative');const v=Number(s.value);c.classList.add(!Number.isFinite(v)||Math.abs(v)<=.15?'spmi-neutral':v>=1?'spmi-positive-strong':v>0?'spmi-positive':'spmi-negative')})}
function prices(d){[['spmi-nifty',d.nifty],['spmi-banknifty',d.banknifty],['spmi-finnifty',d.finnifty],['spmi-vix',d.vix]].forEach(([id,v])=>{if(Number.isFinite(Number(v)))text(id,Number(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}))});const rows=document.querySelectorAll('.spmi-snapshot-row');[d.niftyChange,d.bankniftyChange,d.finniftyChange,d.vixChange].forEach((v,i)=>{const e=rows[i]?.querySelector('em');if(e&&Number.isFinite(Number(v))){e.textContent=pct(v);e.classList.toggle('spmi-up',Number(v)>=0);e.classList.toggle('spmi-down',Number(v)<0)}})}
function setMarketStatus(status,clock){
  ['spmi-session-status','spmi-market-status'].forEach(id=>{const e=$(id);if(e)e.textContent=status});
  document.querySelectorAll('.spmi-market-status,.spmi-market-live').forEach(e=>{if(e.dataset.spmiClock!=='true')e.textContent=status});
  const clockEls=document.querySelectorAll('#spmi-clock,#spmi-live-clock,.spmi-clock,.spmi-live-clock,[data-spmi-clock]');
  clockEls.forEach(e=>e.textContent=clock);
  document.querySelectorAll('.spmi *').forEach(e=>{if(e.children.length===0){const t=(e.textContent||'').trim();if(t==='MARKET LIVE'||/^\d{2}:\d{2}:\d{2}$/.test(t)){e.textContent=/^\d{2}:\d{2}:\d{2}$/.test(t)?clock:status}}});
}
function session(){
  const now=new Date(),parts=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(now);
  const get=k=>parts.find(x=>x.type===k)?.value||'';
  const day=get('weekday'),h=Number(get('hour')||0),m=Number(get('minute')||0),s=Number(get('second')||0),mins=h*60+m;
  const isWeekday=!['Sat','Sun'].includes(day);
  let status='MARKET CLOSED';
  if(isWeekday&&mins>=540&&mins<555)status='PRE-MARKET';
  else if(isWeekday&&mins>=555&&mins<930)status='MARKET OPEN';
  const clock=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  [555,660,780,870,930].forEach((x,i)=>document.querySelectorAll('.spmi-time-item')[i]?.classList.toggle('active',isWeekday&&mins>=x));
  setMarketStatus(status,clock);
}
async function load(){try{const [a,b]=await Promise.all([fetch(`${API}?t=${Date.now()}`,{cache:'no-store'}),fetch(`${PRICE_API}?t=${Date.now()}`,{cache:'no-store'})]);if(a.ok){const d=await a.json();if(d.success){meter(d.score);bias(d);breadth(d.breadth);vix(d.vix);heat(d.sectors)}}if(b.ok){const d=await b.json();if(d.success!==false)prices(d)}}catch(e){console.warn('[StrikePulse] Market Intelligence:',e.message)}}
function boot(){session();load();setInterval(load,15000);setInterval(session,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot()
})();