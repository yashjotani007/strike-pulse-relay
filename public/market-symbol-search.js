/* Strike Pulse Market — searchable index selector. Independent of market-data code. */
(()=>{'use strict';
const symbols=[{key:'nifty',name:'NIFTY 50',alias:'NIFTY NSE INDEX'},{key:'banknifty',name:'BANK NIFTY',alias:'NIFTY BANK BANKNIFTY'},{key:'finnifty',name:'FIN NIFTY',alias:'NIFTY FINANCIAL SERVICES FINNIFTY'},{key:'sensex',name:'SENSEX',alias:'BSE SENSEX 30'}];
function init(){
 const root=document.getElementById('sp-market-terminal');if(!root||root.querySelector('#sp3-symbol-search'))return;
 const toolbar=root.querySelector('.sp3-terminal-toolbar');if(!toolbar)return;
 const wrap=document.createElement('div');wrap.className='sp3-symbol-search';wrap.innerHTML='<label for="sp3-symbol-search">SEARCH INDEX</label><div class="sp3-symbol-search-box"><span aria-hidden="true">⌕</span><input id="sp3-symbol-search" type="search" placeholder="Search NIFTY, BANK NIFTY, FIN NIFTY, SENSEX" autocomplete="off" aria-autocomplete="list" aria-controls="sp3-symbol-results" aria-expanded="false" role="combobox"><kbd>/</kbd></div><div id="sp3-symbol-results" role="listbox" hidden></div>';
 toolbar.parentNode.insertBefore(wrap,toolbar);
 const input=wrap.querySelector('input'),list=wrap.querySelector('#sp3-symbol-results');let matches=[],active=0;
 function close(){list.hidden=true;input.setAttribute('aria-expanded','false');}
 function choose(key){const btn=root.querySelector('[data-sp3-symbol="'+key+'"]');if(btn){btn.click();input.value=symbols.find(s=>s.key===key).name;close();input.blur();root.querySelector('#sp3-price-chart')?.scrollIntoView({behavior:'smooth',block:'nearest'});}}
 function draw(){const q=input.value.trim().toLowerCase();matches=symbols.filter(s=>(s.name+' '+s.alias).toLowerCase().includes(q));active=0;list.replaceChildren();if(!matches.length){const empty=document.createElement('div');empty.className='sp3-search-empty';empty.textContent='No supported index found. Stock charts are not connected yet.';list.appendChild(empty);}else matches.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===active));b.textContent=s.name;b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>choose(s.key));list.appendChild(b)});list.hidden=false;input.setAttribute('aria-expanded','true');}
 input.addEventListener('input',draw);input.addEventListener('focus',draw);
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();input.blur()}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)draw();else{active=(active+(e.key==='ArrowDown'?1:-1)+matches.length)%Math.max(1,matches.length);list.querySelectorAll('[role=option]').forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));}}else if(e.key==='Enter'){e.preventDefault();if(matches[active])choose(matches[active].key)}});
 document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close()});
 document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();input.focus()}});
 const style=document.createElement('style');style.textContent=`
.sp3 .sp3-symbol-search{position:relative;z-index:8;padding:17px 21px 0;background:#fbfdff}
.sp3 .sp3-symbol-search>label{display:block;margin-bottom:7px;color:#71839b;font-size:10px;font-weight:800;letter-spacing:1.1px}
.sp3 .sp3-symbol-search-box{display:flex;align-items:center;gap:10px;border:1px solid #c7d8ec;border-radius:11px;padding:9px 12px;background:#fff;box-shadow:0 4px 18px rgba(12,44,80,.04)}
.sp3 .sp3-symbol-search-box:focus-within{border-color:#2878f0;box-shadow:0 0 0 3px rgba(40,120,240,.13)}
.sp3 .sp3-symbol-search-box>span{font-size:22px;color:#2878f0;line-height:1}
.sp3 #sp3-symbol-search{min-width:0;width:100%;padding:3px 0;border:0!important;outline:0!important;box-shadow:none!important;background:transparent;color:#142c48;font:600 13px Inter,system-ui,sans-serif}
.sp3 #sp3-symbol-search::placeholder{color:#8194aa;font-weight:400}
.sp3 .sp3-symbol-search kbd{border:1px solid #e0e9f4;border-radius:5px;padding:2px 7px;color:#71839b;background:#f2f6fb}
.sp3 #sp3-symbol-results{position:absolute;top:calc(100% - 2px);left:21px;right:21px;padding:5px;border:1px solid #c7d8ec;border-radius:10px;background:#fff;box-shadow:0 18px 35px rgba(11,29,52,.17);max-height:240px;overflow:auto}
.sp3 #sp3-symbol-results[hidden]{display:none}
.sp3 #sp3-symbol-results button{display:block;width:100%;padding:12px 14px;text-align:left;border:0;border-radius:7px;background:#fff;color:#142c48;font-weight:750;font-size:12px}
.sp3 #sp3-symbol-results button:hover,.sp3 #sp3-symbol-results button[aria-selected=true]{background:#eaf3ff;color:#236ac8}
.sp3 .sp3-search-empty{padding:12px;color:#71839b;font-size:12px}
@media(max-width:560px){.sp3 .sp3-symbol-search{padding:12px 13px 0}.sp3 #sp3-symbol-results{left:13px;right:13px}.sp3 .sp3-symbol-search kbd{display:none}}
`;document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();