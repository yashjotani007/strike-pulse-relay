'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {events}=require('../market-analysis-v3');
const DAY=86400000;
function candles(n=55){return Array.from({length:n},(_,i)=>({t:Date.UTC(2026,0,1)+i*DAY,o:100+i*.1,h:101+i*.1,l:99+i*.1,c:100+i*.1,v:1000}))}
test('volume spike requires a genuine historical volume increase',()=>{
 const rows=candles();assert.equal(events(rows,'volume-spike').length,0);
 rows[35].v=3000;const hits=events(rows,'volume-spike');assert.equal(hits.length,1);assert.equal(hits[0].index,35);
});
test('previous day high requires actual close beyond prior high',()=>{
 const rows=candles();rows[30].c=rows[29].h+2;
 assert.ok(events(rows,'previous-high').some(x=>x.index===30));
});
test('unknown pattern fails closed rather than returning invented events',()=>{
 assert.throws(()=>events(candles(),'unknown-pattern'),/Pattern not implemented/);
});
