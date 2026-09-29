// One-time startup diagnostic for the fixed public WordPress PHP test file.
// Never include credentials or HTML response bodies in logs.
setTimeout(async()=>{
 try {
  const r=await fetch('https://yashjotani.free.nf/wordpress/test.php',{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(15000)});
  const type=r.headers.get('content-type')||'unknown';
  let valid=false;
  if(type.includes('json')){const d=await r.json();valid=d?.success===true&&d?.message==='PHP file is reachable';}
  console.log('[WP PHP CONNECTIVITY]',JSON.stringify({httpStatus:r.status,contentType:type,jsonValid:valid}));
 }catch(e){console.log('[WP PHP CONNECTIVITY]',e.name+': '+e.message);}
},12000);
require("./market-analysis-v2.js");
require("./market-analysis-v3.js");
require("./market-analysis-extended.js");
require("./market-analysis-loader.js");
require("./market-analysis-api.js");
require("./market-terminal-loader-route.js");
require("./stock-search-api.js");
require("./market-intelligence-api.js");
require("./market-intelligence-loader-route.js");
require("./market-intelligence-page-route.js");
require("./oi-analysis-route.js");
require("./oi-analysis-loader-route.js");
require("./server-original.js");
