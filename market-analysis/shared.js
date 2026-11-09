'use strict';
function numberOrNull(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function safeSymbol(v){const s=String(v||'').trim().toUpperCase().replace(/\.NS$/,'');if(!/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(s))throw Error('Invalid NSE symbol');return s;}
function unavailable(module,error){return{success:false,available:false,module,error:error||'Data unavailable',generatedAt:new Date().toISOString()};}
module.exports={numberOrNull,safeSymbol,unavailable};
