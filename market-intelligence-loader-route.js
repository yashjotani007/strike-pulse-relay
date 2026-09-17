'use strict';
const express = require('express');

// Compatibility shim for the existing Market page script tag.
// The Market page already loads this URL, so it now loads the SAME common
// Strike Pulse loader used by Home and Option Chain instead of maintaining
// a second Market Intelligence implementation.
const LOADER = String.raw`(function(){
'use strict';
if(window.__StrikePulseCommonLoaderBridge__)return;
window.__StrikePulseCommonLoaderBridge__=true;
var src='https://yashjotani007.github.io/strike-pulse-relay/strike-pulse.js';
var s=document.createElement('script');
s.src=src+'?bridge='+Date.now();
s.async=false;
s.onload=function(){console.log('[StrikePulse] common loader bridged from Market page')};
s.onerror=function(e){console.error('[StrikePulse] common loader bridge failed',e)};
(document.head||document.documentElement).appendChild(s);
})();`;

const ORIGINAL_USE=express.application.use;
let installed=false;
express.application.use=function(...args){
  if(!installed){
    installed=true;
    ORIGINAL_USE.call(this,function(req,res,next){
      if(req.method==='GET' && req.path==='/market-intelligence-loader.js'){
        return res.status(200).type('application/javascript').set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store').send(LOADER);
      }
      next();
    });
  }
  return ORIGINAL_USE.call(this,...args);
};
console.log('[MARKET INTELLIGENCE] Market page bridged to common Strike Pulse loader');
