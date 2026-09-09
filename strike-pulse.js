/* Strike Pulse home-page frontend */
(function(){
  'use strict';
  if(window.__StrikePulseRootLoaded)return;
  window.__StrikePulseRootLoaded=true;

  var API='https://strike-pulse-relay.onrender.com/api';
  var selected='NIFTY';
  var busy=false;

  function el(id){return document.getElementById(id);}
  function set(id,value){var e=el(id);if(e)e.textContent=value;}
  function num(v,d){var n=Number(v);return Number.isFinite(n)?n.toLocaleString('en-IN',{minimumFractionDigits:d||0,maximumFractionDigits:d||0}):'—';}
  function timeIST(){return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());}

  function marketOpen(){
    var p=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(new Date()).reduce(function(a,x){a[x.type]=x.value;return a},{});
    var s=Number(p.hour)*3600+Number(p.minute)*60+Number(p.second);
    return ['Mon','Tue','Wed','Thu','Fri'].indexOf(p.weekday)>=0&&s>=33300&&s<55800;
  }

  function updateStatus(){
    var live=marketOpen();
    document.querySelectorAll('.sp-market-status').forEach(function(e){
      e.classList.remove('sp-live','sp-open','sp-closed');
      e.classList.add(live?'sp-live':'sp-closed');
      e.textContent=live?'LIVE':'CLOSED';
    });
  }

  function updateMarketCard(card,item,updated){
    if(!card||!item)return;
    var price=Number(item.price);
    var change=Number(item.change);
    var p=card.querySelector('.sp-price');
    var c=card.querySelector('.sp-change');
    var u=card.querySelector('.sp-updated');
    if(p)p.textContent=Number.isFinite(price)?num(price,2):'—';
    if(c){
      c.textContent=Number.isFinite(change)?(change>0?'▲ +':change<0?'▼ ':'● ')+Math.abs(change).toFixed(2)+'%':'—';
      c.classList.remove('sp-positive','sp-negative','sp-flat');
      c.classList.add(change>0?'sp-positive':change<0?'sp-negative':'sp-flat');
    }
    if(u)u.textContent=updated?'Updated '+new Date(updated).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'Updated '+timeIST()+' IST';
  }

  async function updatePrices(){
    try{
      var r=await fetch(API+'/prices?t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      var j=await r.json();
      var d=j.data||j;
      var m=j.markets||{};
      ['nifty','banknifty','finnifty','vix','sensex'].forEach(function(k){
        var item=m[k]||{price:d[k],change:d[k+'Change']};
        document.querySelectorAll('.sp-market-card[data-market-card="'+k+'"],.sp-market-'+k).forEach(function(card){updateMarketCard(card,item,d.updated);});
      });
      updateStatus();
    }catch(e){console.error('[StrikePulse] PRICE ERROR',e);}
  }

  function fiveStrikes(rows,atm){
    if(!Array.isArray(rows))return [];
    var clean=rows.filter(function(r){return r&&Number.isFinite(Number(r.strike));});
    clean.sort(function(a,b){return Number(a.strike)-Number(b.strike);});
    if(clean.length<=5)return clean;
    var a=Number(atm);
    var center=0;
    if(Number.isFinite(a)){
      var best=Infinity;
      clean.forEach(function(r,i){
        var distance=Math.abs(Number(r.strike)-a);
        if(distance<best){best=distance;center=i;}
      });
    }else{
      center=Math.floor(clean.length/2);
    }
    var start=Math.max(0,Math.min(center-2,clean.length-5));
    return clean.slice(start,start+5);
  }

  function oiValue(o,keys){
    if(!o)return null;
    for(var i=0;i<keys.length;i++)if(o[keys[i]]!==undefined&&o[keys[i]]!==null&&o[keys[i]]!=='')return o[keys[i]];
    return null;
  }

  function renderHomeRows(rows,atm){
    var body=el('sp-chain-body');
    if(!body)return;

    var five=fiveStrikes(rows,atm);
    if(!five.length){
      body.innerHTML='<tr><td colspan="7">Live option-chain data unavailable</td></tr>';
      return;
    }

    body.innerHTML=five.map(function(x){
      var ce=x.ce||x.call||{};
      var pe=x.pe||x.put||{};
      var callOI=oiValue(ce,['oi','openInterest']);
      var callChg=oiValue(ce,['oiChange','changeinOpenInterest','changeOI']);
      var callLTP=oiValue(ce,['ltp','lastPrice']);
      var putLTP=oiValue(pe,['ltp','lastPrice']);
      var putChg=oiValue(pe,['oiChange','changeinOpenInterest','changeOI']);
      var putOI=oiValue(pe,['oi','openInterest']);
      return '<tr>'+
        '<td>'+num(callOI)+'</td>'+
        '<td>'+num(callChg)+'</td>'+
        '<td>'+num(callLTP,2)+'</td>'+
        '<td class="sp-chain-strike"><b>'+num(x.strike)+'</b></td>'+
        '<td>'+num(putLTP,2)+'</td>'+
        '<td>'+num(putChg)+'</td>'+
        '<td>'+num(putOI)+'</td>'+
      '</tr>';
    }).join('');
  }

  async function loadHomeChain(){
    var body=el('sp-chain-body');
    if(!body||busy)return;
    busy=true;
    try{
      body.innerHTML='<tr><td colspan="7">Loading...</td></tr>';
      var r=await fetch(API+'/option-chain?symbol=NIFTY&t='+Date.now(),{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      var j=await r.json();
      var d=j.data&&typeof j.data==='object'&&!Array.isArray(j.data)?j.data:j;
      var rows=Array.isArray(j.rows)?j.rows:Array.isArray(d.rows)?d.rows:[];

      var spot=j.spot??d.spot;
      var atm=j.atmStrike??j.atm??d.atmStrike??d.atm;
      var callOI=j.callOI??d.callOI;
      var putOI=j.putOI??d.putOI;
      var pcr=j.pcr??d.pcr;
      var maxPain=j.maxPain??d.maxPain;
      var expiry=j.expiry??d.expiry??'—';

      set('sp-chain-spot',num(spot,2));
      set('sp-chain-atm',num(atm));
      set('sp-call-oi',num(callOI));
      set('sp-put-oi',num(putOI));
      set('sp-pcr',pcr==null?'—':Number(pcr).toFixed(2));
      set('sp-max-pain',num(maxPain));
      set('sp-chain-expiry',expiry);
      set('sp-chain-updated','Updated '+timeIST()+' IST');

      renderHomeRows(rows,atm);
      console.log('[StrikePulse] Home option chain loaded:',fiveStrikes(rows,atm).map(function(x){return x.strike;}));
    }catch(e){
      console.error('[StrikePulse] HOME OPTION CHAIN ERROR',e);
      body.innerHTML='<tr><td colspan="7">Live option-chain data unavailable</td></tr>';
    }finally{
      busy=false;
    }
  }

  function start(){
    updatePrices();
    setInterval(updatePrices,5000);
    setInterval(updateStatus,1000);
    loadHomeChain();
    setInterval(loadHomeChain,30000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
