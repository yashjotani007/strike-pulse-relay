'use strict';
// Isolated NSE stock lookup and verified 5-minute OHLCV; no option-chain changes.
const express=require('express'),originalUse=express.application.use;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134 Safari/537.36';
const cache=new Map();
let nseUniverse={at:0,rows:[]};
async function nseStocks(){
 const now=Date.now();
 if(nseUniverse.rows.length&&now-nseUniverse.at<6*60*60*1000)return nseUniverse.rows;
 try{
  const r=await fetch('https://archives.nseindia.com/content/equities/EQUITY_L.csv',{headers:{'User-Agent':UA,'Accept':'text/csv'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('NSE directory HTTP '+r.status);
  const csv=await r.text();
  const lines=csv.split(/\\r?\\n/).filter(Boolean),rows=[];
  const parse=line=>{const out=[];let cur='',quote=false;for(const ch of line){if(ch==='"')quote=!quote;else if(ch===','&&!quote){out.push(cur.trim());cur='';}else cur+=ch;}out.push(cur.trim());return out};
  const head=parse(lines[0]).map(x=>x.replace(/^"|"$/g,'').toUpperCase());
  const si=head.indexOf('SYMBOL'),ni=head.indexOf('NAME OF COMPANY');
  if(si<0)throw Error('NSE directory format changed');
  for(let i=1;i<lines.length;i++){
   const p=parse(lines[i]),symbol=String(p[si]||'').replace(/^"|"$/g,'').trim().toUpperCase(),name=String(p[ni]||symbol).replace(/^"|"$/g,'').trim();
   if(/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(symbol))rows.push({symbol,name,exchange:'NSE'});
  }
  if(rows.length<100)throw Error('NSE directory too small');
  nseUniverse={at:now,rows};return rows;
 }catch(e){
  return nseUniverse.rows;
 }
}
async function yahoo(path){const r=await fetch('https://query1.finance.yahoo.com'+path,{headers:{'User-Agent':UA,'Accept':'application/json'},signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('Market provider HTTP '+r.status);return r.json()}
const numeric=x=>x==null||x===''?null:Number.isFinite(+x)?+x:null;
async function stock(symbol){
 ifasync function search(q){
 const term=String(q||'').trim().slice(0,50).toUpperCase();
 if(term.length<1)return[];
 let universe=await nseStocks();
 if(universe.length){
  const exact=universe.filter(x=>x.symbol===term);
  const prefix=universe.filter(x=>x.symbol.startsWith(term)&&x.symbol!==term);
  return [...exact,...prefix].slice(0,25);
 }
 const common=['RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK','SBIN','ITC','BHARTIARTL','LT','WIPRO','AXISBANK','KOTAKBANK','HINDUNILVR','BAJFINANCE','MARUTI','TATAMOTORS','TATASTEEL','ADANIENT','SUNPHARMA','NTPC','POWERGRID','ONGC','HCLTECH','TECHM','TITAN','ULTRACEMCO','ASIANPAINT','NESTLEIND','JSWSTEEL','M&M'];
 return common.filter(s=>s.startsWith(term)).map(symbol=>({symbol,name:symbol,exchange:'NSE'})).slice(0,25);
};