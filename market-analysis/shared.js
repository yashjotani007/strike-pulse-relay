'use strict';
function numberOrNull(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function safeSymbol(v){const s=String(v||'').trim().toUpperCase().replace(/\.NS$/,'');if(!/^[A-Z0-9][A-Z0-9&-]{0,24}$/.test(s))throw Error('Invalid NSE symbol');return s;}
function unavailable(module,error){return{success:false,available:false,module,error:error||'Data unavailable',generatedAt:new Date().toISOString()};}
function httpStatusForError(error){
 const message=String(error?.message||error||'');
 if(/Invalid NSE symbol|Invalid option symbol|symbol is required|Provide at least one symbol/i.test(message))return 400;
 if(/Index symbols are not equity stocks|Requested expiry is not a valid future NSE expiry/i.test(message))return 422;
 if(/Yahoo Finance HTTP 404|Yahoo HTTP 404|NSE did not return a future option expiry|Unknown research module/i.test(message))return 404;
 return 502;
}
module.exports={numberOrNull,safeSymbol,unavailable,httpStatusForError};
