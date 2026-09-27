'use strict';
// Permanent no-cache loader for WordPress Market Analysis.
const express=require('express'),fs=require('fs'),path=require('path');
const previousUse=express.application.use;
express.application.use=function(...args){
 previousUse.call(this,(req,res,next)=>{
  if(req.method==='OPTIONS'&&['/market-analysis.js','/market-analysis-core.js'].includes(req.path)){res.set('Access-Control-Allow-Origin','*');return res.sendStatus(204)}
  if(req.method!=='GET'||!['/market-analysis.js','/market-analysis-core.js'].includes(req.path))return next();
  res.set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store, max-age=0, must-revalidate').type('application/javascript');
  if(req.path==='/market-analysis.js')return res.send("(()=>{'use strict';if(window.__SP_ANALYSIS_LOADER__)return;window.__SP_ANALYSIS_LOADER__=true;const s=document.createElement('script');s.src='https://strike-pulse-relay.onrender.com/market-analysis-core.js?v='+Date.now();s.onerror=()=>console.error('[Strike Pulse] Market Analysis failed to load');document.head.appendChild(s)})();");
  try{return res.send(fs.readFileSync(path.join(__dirname,'public','market-analysis-final.js'),'utf8'))}catch(e){return res.status(500).send('console.error("Market Analysis unavailable")')}
 });
 return previousUse.call(this,...args);
};
console.log('[MARKET ANALYSIS] stable loader ready');