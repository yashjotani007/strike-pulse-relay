'use strict';
const fs=require('fs'),path=require('path'),config=require('./config');
const {unavailable}=require('./shared');
const {getOverview}=require('./overview/overview');
const {scanStock}=require('./scanners/stock-scanner');
const {scanOptions}=require('./scanners/option-scanner');
const {getOptionChain}=require('./options/option-chain');
const {getChart}=require('./charts/chart-data');
let installed=false;
module.exports=function(app){
 if(installed)return;installed=true;
 const publicFile=path.join(__dirname,'..','public','market-analysis.js');
 app.get(config.loaderPath,(req,res)=>{
  res.set('Access-Control-Allow-Origin','*').set('Cache-Control','no-store, max-age=0, must-revalidate').type('application/javascript');
  if(!fs.existsSync(publicFile))return res.status(503).send('console.error("[Strike Pulse] Market Analysis loader unavailable");');
  return res.sendFile(publicFile);
 });
 app.get(config.apiBase+'/health',(req,res)=>res.json({success:true,module:'market-analysis',version:config.version,mode:config.mode,integrations:{marketIntelligence:typeof global.__SP_MARKET_INTELLIGENCE_HANDLER__==='function',optionChain:typeof global.__SP_LOAD_CHAIN__==='function',stockSearch:true,stockCandles:true},endpoints:['overview','stock-scan','option-chain','option-scan','chart'],generatedAt:new Date().toISOString()}));
 app.get(config.apiBase+'/overview',async(req,res)=>{try{res.json(await getOverview());}catch(e){res.status(502).json(unavailable('overview',e.message));}});
 app.get(config.apiBase+'/stock-scan',async(req,res)=>{try{res.json(await scanStock(req.query.symbol));}catch(e){res.status(502).json(unavailable('stock-scanner',e.message));}});
 app.get(config.apiBase+'/option-chain',async(req,res)=>{try{res.json(await getOptionChain(req.query.symbol,req.query.expiry));}catch(e){res.status(502).json(unavailable('option-chain',e.message));}});
 app.get(config.apiBase+'/option-scan',async(req,res)=>{try{res.json(await scanOptions(req.query.symbol,req.query.expiry));}catch(e){res.status(502).json(unavailable('option-scanner',e.message));}});
 app.get(config.apiBase+'/chart',async(req,res)=>{try{res.json(await getChart(req.query.symbol,req.query.range,req.query.interval));}catch(e){res.status(502).json(unavailable('chart-lab',e.message));}});
 app.get(config.apiBase+'/research/:module',(req,res)=>{
  const allowed=['correlation','relative-strength','historical-patterns','market-regime','volume'];
  if(!allowed.includes(req.params.module))return res.status(404).json(unavailable('research','Unknown research module'));
  return res.status(501).json({success:false,available:false,module:req.params.module,error:'Registered; verified provider workflow is not connected yet.',generatedAt:new Date().toISOString()});
 });
 console.log('[MARKET ANALYSIS] routes registered');
};
