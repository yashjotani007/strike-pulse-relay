'use strict';
// Authenticated WordPress REST bridge; never log the shared secret.
const base=process.env.SP_HISTORY_URL?.replace(/\/$/,'');
const key=process.env.SP_HISTORY_KEY;
const enabled=()=>!!(base&&key);

function endpointCandidates(){
 const urls=[base];
 try{
  const u=new URL(base);
  if(u.pathname.includes('/wp-json/')){
   const restPath=u.pathname.split('/wp-json/')[1]||'';
   const root=u.origin+u.pathname.split('/wp-json/')[0].replace(/\/$/,'');
   urls.push(root+'/index.php?rest_route=/'+restPath);
  }
 }catch{}
 return [...new Set(urls.filter(Boolean))];
}

async function request(method,body,query){
 if(!enabled())return null;
 let lastError=null;
 for(const endpoint of endpointCandidates()){
  try{
   const u=new URL(endpoint);
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
    lastError=Error('WordPress history response: HTTP '+r.status+
     ', content-type '+contentType+', redirect '+(r.status>=300&&r.status<400?'yes':'no'));
    continue;
   }
   return await r.json();
  }catch(e){lastError=e}
 }
 throw lastError||Error('WordPress history request failed');
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
