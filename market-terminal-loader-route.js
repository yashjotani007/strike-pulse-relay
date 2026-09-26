'use strict';
// Stable, no-cache Market Terminal loader. WordPress needs only one permanent script URL.
const express=require('express'),fs=require('fs'),path=require('path');
const previousUse=express.application.use;
express.application.use=function(...args){
 previousUse.call(this,(req,res,next)=>{
  const p=req.path;
  if(req.method!=='GET'||!['/market-terminal.js','/market-terminal-core.js','/market-terminal-search.js'].includes(p))return next();
  res.set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store, max-age=0, must-revalidate').type('application/javascript');
  if(p==='/market-terminal.js')return res.send(`(()=>{'use strict';if(window.__SP_MARKET_STABLE_LOADER__)return;window.__SP_MARKET_STABLE_LOADER__=true;const base='https://strike-pulse-relay.onrender.com';const load=(file,done)=>{const s=document.createElement('script');s.src=base+file+'?v='+Date.now();s.onload=done||null;s.onerror=()=>console.error('[StrikePulse] failed:',file);document.head.appendChild(s)};load('/market-terminal-core.js',()=>load('/market-terminal-search.js'));})();`);
  const file=path.join(__dirname,'public',p==='/market-terminal-core.js'?'strike-pulse-market-final.js':'market-symbol-search.js');
  try{return res.send(fs.readFileSync(file,'utf8'))}catch(e){return res.status(500).send('console.error("Market terminal unavailable")')}
 });
 return previousUse.call(this,...args);
};
console.log('[MARKET TERMINAL] stable loader routes ready');