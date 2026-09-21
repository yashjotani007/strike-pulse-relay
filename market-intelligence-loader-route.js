'use strict';
const express = require('express');

const LOADER = String.raw`(function(){
'use strict';
if(window.__StrikePulseMarketPageBridge__)return;
window.__StrikePulseMarketPageBridge__=true;

var common='https://yashjotani007.github.io/strike-pulse-relay/strike-pulse.js';
var page='https://yashjotani007.github.io/strike-pulse-relay/market-intelligence-page.js';

function loadPage(){
  if(document.querySelector('script[data-sp-market-page]'))return;
  var s=document.createElement('script');
  s.src=page+'?page='+Date.now();
  s.async=false;
  s.dataset.spMarketPage='1';
  s.onload=function(){console.log('[StrikePulse] dedicated Market Intelligence page loaded')};
  s.onerror=function(e){console.error('[StrikePulse] dedicated Market Intelligence page failed',e)};
  (document.head||document.documentElement).appendChild(s);
}

if(document.querySelector('script[data-sp-market-common]')){
  loadPage();
}else{
  var s=document.createElement('script');
  s.src=common+'?bridge='+Date.now();
  s.async=false;
  s.dataset.spMarketCommon='1';
  s.onload=loadPage;
  s.onerror=function(e){console.error('[StrikePulse] common loader bridge failed',e);loadPage()};
  (document.head||document.documentElement).appendChild(s);
}
})();`;

const ORIGINAL_USE=express.application.use;
let installed=false;

express.application.use=function(...args){
  if(!installed){
    installed=true;
    ORIGINAL_USE.call(this,function(req,res,next){
      if(req.method==='GET'&&req.path==='/market-intelligence-loader.js'){
        return res.status(200)
          .type('application/javascript')
          .set('Access-Control-Allow-Origin','*')
          .set('Cache-Control','no-store')
          .send(LOADER);
      }
      next();
    });
  }
  return ORIGINAL_USE.call(this,...args);
};

console.log('[MARKET INTELLIGENCE] dedicated page loader ready');
