'use strict';
const {Pool}=require('pg');
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:2,connectionTimeoutMillis:8000}):null;
let ready;
async function init(){
 if(!pool)return false;
 if(!ready)ready=pool.query(`CREATE TABLE IF NOT EXISTS sp_option_observations(
 symbol text NOT NULL,expiry text NOT NULL,strike numeric NOT NULL,type text NOT NULL,
 observed_at timestamptz NOT NULL,premium numeric,oi numeric,volume numeric,iv numeric,spread numeric,
 PRIMARY KEY(symbol,expiry,strike,type,observed_at))`).then(()=>true).catch(e=>{ready=null;console.error('[OPTION HISTORY DB]',e.message);return false});
 return ready;
}
async function save(rows,at){
 if(!await init())return false;
 const t=Number.isFinite(Date.parse(at))?new Date(at):new Date();
 const values=[],params=[];
 for(const x of rows){if(!Number.isFinite(+x.strike))continue;
 const i=values.length*10;values.push(x);params.push(x.symbol,x.expiry,x.strike,x.type,t,x.ltp??null,x.oi??null,x.volume??null,x.iv??null,x.spread??null);
 if(values.length>=100)break;
 }
 for(let start=0;start<rows.length;start+=100){
 const batch=rows.slice(start,start+100).filter(x=>Number.isFinite(+x.strike));
 if(!batch.length)continue;
 const args=[],slots=[];
 batch.forEach((x,i)=>{args.push(x.symbol,x.expiry,x.strike,x.type,t,x.ltp??null,x.oi??null,x.volume??null,x.iv??null,x.spread??null);slots.push('('+Array.from({length:10},(_,k)=>'$'+(i*10+k+1)).join(',')+')')});
 await pool.query('INSERT INTO sp_option_observations(symbol,expiry,strike,type,observed_at,premium,oi,volume,iv,spread) VALUES '+slots.join(',')+' ON CONFLICT DO NOTHING',args);
 }
 return true;
}
async function history({symbol,expiry,strike,type}){
 if(!await init())return null;
 const r=await pool.query('SELECT EXTRACT(EPOCH FROM observed_at)*1000 AS t,premium,oi,volume,iv,spread FROM sp_option_observations WHERE symbol=$1 AND expiry=$2 AND strike=$3 AND type=$4 ORDER BY observed_at DESC LIMIT 300',[symbol,expiry,strike,type]);
 return r.rows.reverse().map(x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v===null?null:Number(v)])));
}
module.exports={save,history,enabled:()=>!!pool};
