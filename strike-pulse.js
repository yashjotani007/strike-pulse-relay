/* STRIKE PULSE — ROOT LIVE PRICE REPAIR */
(function(){
  'use strict';
  var PRICE_API='https://strike-pulse-relay.onrender.com/api/prices';
  var priceTimer=null;

  function repairPrices(){
    fetch(PRICE_API+'?t='+Date.now(),{cache:'no-store'})
      .then(function(r){
        if(!r.ok) throw new Error('Price API HTTP '+r.status);
        return r.json();
      })
      .then(function(j){
        var d=(j&&j.data&&typeof j.data==='object')?j.data:(j||{});
        var markets=j&&j.markets&&typeof j.markets==='object'?j.markets:(d.markets||{});
        var values={
          nifty:markets.nifty&&markets.nifty.price!=null?markets.nifty.price:(d.nifty!=null?d.nifty:d.nifty50),
          banknifty:markets.banknifty&&markets.banknifty.price!=null?markets.banknifty.price:(d.banknifty!=null?d.banknifty:d.bankNifty),
          finnifty:markets.finnifty&&markets.finnifty.price!=null?markets.finnifty.price:(d.finnifty!=null?d.finnifty:d.finNifty),
          vix:markets.vix&&markets.vix.price!=null?markets.vix.price:(d.vix!=null?d.vix:d.indiaVix),
          sensex:markets.sensex&&markets.sensex.price!=null?markets.sensex.price:(d.sensex!=null?d.sensex:(d.SENSEX!=null?d.SENSEX:d.bseSensex))
        };
        var cards=document.querySelectorAll('.sp-market-card[data-market-card]');
        if(!cards.length){console.error('[StrikePulse] Market cards not found');return;}
        cards.forEach(function(card){
          var key=(card.getAttribute('data-market-card')||'').toLowerCase();
          var value=values[key];
          var price=card.querySelector('.sp-price');
          if(!price||value==null||!isFinite(Number(value)))return;
          price.textContent=Number(value).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
          price.classList.remove('sp-price-loading');
          var changeEl=card.querySelector('.sp-change');
          var change=markets[key]&&markets[key].change!=null?markets[key].change:(d[key+'Change']);
          if(changeEl&&change!=null&&isFinite(Number(change))){
            var n=Number(change);
            changeEl.textContent=n>0?'▲ +'+Math.abs(n).toFixed(2)+'%':n<0?'▼ -'+Math.abs(n).toFixed(2)+'%':'● 0.00%';
            changeEl.classList.remove('sp-up','sp-down','sp-positive','sp-negative','sp-flat');
            changeEl.classList.add(n>0?'sp-up':n<0?'sp-down':'sp-flat');
          }
          var updated=card.querySelector('.sp-updated');
          if(updated)updated.textContent='Updated '+new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())+' IST';
        });
        console.log('[StrikePulse] ROOT LIVE PRICES UPDATED',values);
      })
      .catch(function(err){console.error('[StrikePulse] ROOT PRICE ERROR:',err);});
  }

  function start(){repairPrices();if(priceTimer)clearInterval(priceTimer);priceTimer=setInterval(repairPrices,5000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

(function(){
  'use strict';
  var BASE='https://strike-pulse-relay.onrender.com/api';
  var $=function(s){return document.querySelector(s)};
  var $$=function(s){return document.querySelectorAll(s)};
  var symbol='NIFTY';
  var fmt=function(v,d){d=d==null?0:d;return v==null||v===''||isNaN(Number(v))?'--':Number(v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d})};
  var marketOpen=function(){var p=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()),day='',hour=0,min=0;p.forEach(function(x){if(x.type==='weekday')day=x.value;if(x.type==='hour')hour=+x.value;if(x.type==='minute')min=+x.value});return ['Mon','Tue','Wed','Thu','Fri'].indexOf(day)>=0&&hour*60+min>=555&&hour*60+min<930};
  var status=function(){var live=marketOpen();$$('.sp-market-status').forEach(function(e){e.classList.remove('sp-live','sp-open','sp-closed');e.classList.add(live?'sp-live':'sp-closed');e.textContent=live?'LIVE':'CLOSED'});var s=$('#spChainStatus');if(s){s.className='sp-table-live '+(live?'sp-live':'sp-closed');s.innerHTML='<span class="sp-live-dot"></span>'+ (live?'LIVE':'CLOSED')}};
  var load=function(sym){symbol=(sym||'NIFTY').toUpperCase();var b=$('#spOptionChainBody');if(b)b.innerHTML='<tr><td colspan="11" class="sp-table-loading">Loading live option chain...</td></tr>';fetch(BASE+'/option-chain?symbol='+encodeURIComponent(symbol)+'&t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(function(d){if(!d.success)throw Error(d.error||'API failed');var rows=d.rows||[];$('#spSelectedSymbol')&&($('#spSelectedSymbol').textContent=d.symbol||symbol);$('#spSpot')&&($('#spSpot').textContent=fmt(d.spot,2));$('#spATM')&&($('#spATM').textContent=fmt(d.atmStrike!=null?d.atmStrike:d.atm));$('#spExpiry')&&($('#spExpiry').textContent=d.expiry||'--');$('#spCallOI')&&($('#spCallOI').textContent=fmt(d.callOI));$('#spPutOI')&&($('#spPutOI').textContent=fmt(d.putOI));$('#spPCR')&&($('#spPCR').textContent=d.pcr==null?'--':Number(d.pcr).toFixed(2));$('#spMaxPain')&&($('#spMaxPain').textContent=fmt(d.maxPain));if(b)b.innerHTML=rows.map(function(x){var c=x.ce||{},p=x.pe||{};var cc=Number(c.oiChange)||0,pc=Number(p.oiChange)||0;return '<tr class="'+(+x.strike===+(d.atmStrike!=null?d.atmStrike:d.atm)?'sp-chain-atm':'')+'"><td>'+fmt(c.oi)+'</td><td class="'+(cc>0?'sp-positive':cc<0?'sp-negative':'sp-flat')+'">'+(cc>0?'+':'')+fmt(cc)+'</td><td>'+fmt(c.ltp,2)+'</td><td>'+fmt(c.iv,2)+'</td><td>'+fmt(c.volume)+'</td><td class="sp-chain-strike">'+fmt(x.strike)+'</td><td>'+fmt(p.ltp,2)+'</td><td>'+fmt(p.iv,2)+'</td><td>'+fmt(p.volume)+'</td><td class="'+(pc>0?'sp-positive':pc<0?'sp-negative':'sp-flat')+'">'+(pc>0?'+':'')+fmt(pc)+'</td><td>'+fmt(p.oi)+'</td></tr>'}).join('');status()}).catch(function(e){console.error('[StrikePulse] OPTION ERROR',e);if(b)b.innerHTML='<tr><td colspan="11" class="sp-table-loading">Live data unavailable for '+symbol+'</td></tr>';status()})};
  function init(){if(window.__StrikePulseRootInitialized)return;window.__StrikePulseRootInitialized=true;$$('.sp-symbol-btn').forEach(function(b){b.onclick=function(){load(b.dataset.symbol)}});var sb=$('#spSearchBtn'),si=$('#spSymbolSearch');if(sb)sb.onclick=function(){var q=(si&&si.value||'').trim();if(q)load(q)};status();load('NIFTY');setInterval(status,1000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
