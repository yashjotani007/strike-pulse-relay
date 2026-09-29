'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const m=require('../lib/market-analysis-math');
test('correlation respects alignment and constant-series null',()=>{
 assert.ok(Math.abs(m.pearson([1,2,3,4],[2,4,6,8])-1)<1e-12);
 assert.ok(Math.abs(m.pearson([1,2,3,4],[8,6,4,2])+1)<1e-12);
 assert.equal(m.pearson([1,1,1],[2,3,4]),null);
});
test('returns align on common timestamps, not array index',()=>{
 const a=[{t:1,c:100},{t:2,c:110},{t:3,c:121}];
 const b=[{t:1,c:50},{t:2,c:55},{t:4,c:66}];
 assert.deepEqual(m.alignedReturns(a,b).dates,[2]);
});
test('beta and rolling correlation handle insufficient samples',()=>{
 assert.ok(Math.abs(m.beta([2,4,6],[1,2,3])-2)<1e-12);
 assert.deepEqual(m.rollingCorrelation([1,2,3,4],[4,3,2,1],3).slice(0,2),[null,null]);
});
test('drawdown uses historical peaks and no fabricated values',()=>{
 const r=m.drawdown([100,120,90,135]);
 assert.ok(Math.abs(r.maximum+0.25)<1e-12);
 assert.equal(m.drawdown([]),null);
 assert.equal(m.zscore([3,3,3]),null);
});
test('forward statistics preserve zero, negative and positive observations',()=>{
 assert.deepEqual(m.summarizeForwardReturns([-2,0,1,3]),{occurrences:4,positiveFrequency:0.5,medianReturn:0.5});
 assert.deepEqual(m.summarizeForwardReturns([]),{occurrences:0,positiveFrequency:null,medianReturn:null});
});
