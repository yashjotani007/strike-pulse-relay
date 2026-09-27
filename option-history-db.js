'use strict';
// Authenticated WordPress REST bridge; never log the shared secret.
const base=process.env.SP_HISTORY_URL?.replace(/\/$/,'');
const key=process.env.SP_HISTORY_KEY;
const enabled=()=>!!(base&&key);
async function request(method,body,query){
 if(!enabled())return null;
 const u=new URL(base);
 if(query)for(const [k,v] of Object.entries(query))u.searchParams.set(k,String(v));
 const r=await fetch(u,{
  method,
  headers:{'X-SP-Key':key,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(20000),
  redirect:'manual'
 });
 const contentType=r.headers.get('content-type')||'unknown';
 if(!r.ok || !contentType.toLowerCase().includes('json')){
  // Avoid logging HTML bodies, credentials, query strings or authentication headers.
  throw Error('WordPress history response: HTTP '+r.status+
   ', content-type '+contentType+', redirect '+(r.status>=300&&r.status<400?'yes':'no'));
 }
 const result=await r.json();
 return result;
}
async function save(rows,at){
 if(!enabled()||!rows.length)return false;
 const result=await request('POST',{rows,observedAt:at});
 return result?.success===true;
}
async function history(contract){
 if(!enabled())return null;
 const result=await request('GET',null,contract);
 if(!result?.success||!Array.isArray(result.points))throw Error('Invalid WordPress history response');
 return result.points;
}
module.exports={save,history,enabled};
