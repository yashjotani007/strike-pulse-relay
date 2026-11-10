'use strict';
const {getOptionChain}=require('../options/option-chain');
async function scanOptions(symbol,expiry){
 const c=await getOptionChain(symbol,expiry),rows=(c.rows||[]).map(r=>({strike:r.strike,call:r.ce?{ltp:r.ce.ltp??null,bid:r.ce.bid??null,ask:r.ce.ask??null,oi:r.ce.oi??null,oiChange:r.ce.oiChange??null,volume:r.ce.volume??null,iv:r.ce.iv??null}:null,put:r.pe?{ltp:r.pe.ltp??null,bid:r.pe.bid??null,ask:r.pe.ask??null,oi:r.pe.oi??null,oiChange:r.pe.oiChange??null,volume:r.pe.volume??null,iv:r.pe.iv??null}:null}));
 return{success:true,available:rows.length>0,symbol:c.symbol,spot:c.spot,expiry:c.expiry,atm:c.atm??c.atmStrike??null,atmStrike:c.atmStrike??c.atm??null,pcr:c.pcr,maxPain:c.maxPain,totalStrikes:c.totalStrikes??rows.length,rows,source:c.source,generatedAt:new Date().toISOString()};
}
module.exports={scanOptions};
