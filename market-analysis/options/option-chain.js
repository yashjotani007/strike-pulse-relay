'use strict';
async function getOptionChain(input,expiry){
 const symbol=String(input||'NIFTY').trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(symbol))throw Error('Invalid option symbol');
 const load=global.__SP_LOAD_CHAIN__;if(typeof load!=='function')throw Error('Existing option-chain relay is not initialized');
 const chain=await load(symbol,expiry?String(expiry):null,true);
 if(!chain||chain.success!==true)throw Error('Option-chain provider returned no verified data');
 if(String(chain.symbol||'').toUpperCase()!==symbol)throw Error('Option-chain underlying mismatch');
 const date=chain.expiry&&Date.parse(chain.expiry),today=Date.now();
 if(date&&date<new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})).setHours(0,0,0,0))throw Error('NSE returned an expired option contract. Select a future expiry; stale expiry is not displayed as current.');
 return{...chain,module:'market-analysis-option-chain',generatedAt:new Date().toISOString()};
}
module.exports={getOptionChain};