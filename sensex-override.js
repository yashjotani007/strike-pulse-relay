'use strict';
const express = require('express');
const https = require('https');

const ORIGINAL_GET = express.application.get;
const ORIGINAL_FETCH = global.fetch;
const PAGE = 'https://optionchainlive.com/sensex-option-chain/';

function n(v){
  if(v==null) return null;
  const s=String(v).replace(/[₹,]/g,'').replace(/K$/i,'e3').replace(/M$/i,'e6').replace(/L$/i,'e5').replace(/Cr$/i,'e7').trim();
  const x=Number(s);
  return Number.isFinite(x)?x:null;
}
function clean(v){return String(v??'').replace(/\u00a0/g,' ').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim();}
function cellValues(row){
  const cells=[];
  const re=/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
  let m; while((m=re.exec(row))) cells.push(clean(m[1]));
  return cells;
}
async function getHtml(){
  if(typeof ORIGINAL_FETCH==='function'){
    const r=await ORIGINAL_FETCH(PAGE,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8','Accept-Language':'en-US,en;q=0.9','Cache-Control':'no-cache'}});
    const t=await r.text();
    if(!r.ok) throw Error('SENSEX source HTTP '+r.status);
    return t;
  }
  return await new Promise((resolve,reject)=>https.get(PAGE,{headers:{'User-Agent':'Mozilla/5.0'}},r=>{let t='';r.on('data',c=>t+=c);r.on('end',()=>r.statusCode>=200&&r.statusCode<300?resolve(t):reject(Error('SENSEX source HTTP '+r.statusCode)));}).on('error',reject));
}
async function sensex(){
  const html=await getHtml();
  const spotMatch=html.match(/₹\s*([0-9,]+(?:\.[0-9]+)?)/);
  const spot=n(spotMatch&&spotMatch[1]);
  const rows=[];
  const trRe=/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while((m=trRe.exec(html))){
    const c=cellValues(m[1]);
    if(c.length<15) continue;
    const strike=n(c[7]);
    if(strike==null) continue;
    rows.push({
      strike,
      ce:{bid:n(c[0]),ask:n(c[1]),ltp:n(c[2]),volume:n(c[3]),oi:n(c[4]),iv:n(c[5]),change:null,oiChange:null},
      pe:{bid:n(c[8]),ask:n(c[9]),ltp:n(c[10]),volume:n(c[11]),oi:n(c[12]),iv:n(c[13]),change:null,oiChange:null}
    });
  }
  const unique=[...new Map(rows.map(r=>[r.strike,r])).values()].sort((a,b)=>a.strike-b.strike);
  if(!unique.length || spot==null) throw Error('SENSEX source returned no usable option rows');
  let atm=unique[0]; for(const r of unique) if(Math.abs(r.strike-spot)<Math.abs(atm.strike-spot)) atm=r;
  const callOI=unique.reduce((s,r)=>s+(r.ce.oi||0),0);
  const putOI=unique.reduce((s,r)=>s+(r.pe.oi||0),0);
  let maxPain=null,best=Infinity;
  for(const c of unique){let loss=0;for(const r of unique){loss+=(r.ce.oi||0)*Math.max(0,c.strike-r.strike);loss+=(r.pe.oi||0)*Math.max(0,r.strike-c.strike);}if(loss<best){best=loss;maxPain=c.strike;}}
  return {success:true,source:'optionchainlive',symbol:'SENSEX',spot,expiry:'BSE LIVE',expiries:['BSE LIVE'],atm:atm.strike,atmStrike:atm.strike,callOI,putOI,callOIChange:null,putOIChange:null,pcr:callOI?putOI/callOI:null,maxPain,totalStrikes:unique.length,rows:unique,updated:new Date().toISOString()};
}

function wrapRoute(handlers){
  return handlers.map(h=>{
    if(typeof h!=='function') return h;
    return async function(req,res,next){
      if(String(req.query?.symbol||'').toUpperCase()==='SENSEX'){
        try{return res.json(await sensex());}catch(e){console.error('[SENSEX override]',e.message);return res.status(502).json({success:false,symbol:'SENSEX',error:e.message});}
      }
      return h(req,res,next);
    };
  });
}

express.application.get=function(path,...handlers){
  if(path==='/api/option-chain') handlers=wrapRoute(handlers);
  if(path==='/api/option-expiries') handlers=handlers.map(h=>typeof h!=='function'?h:async function(req,res,next){
    if(String(req.query?.symbol||'').toUpperCase()==='SENSEX') return res.json({success:true,symbol:'SENSEX',expiries:['BSE LIVE']});
    return h(req,res,next);
  });
  return ORIGINAL_GET.call(this,path,...handlers);
};

console.log('[SENSEX override] loaded — only SENSEX routes are intercepted');
