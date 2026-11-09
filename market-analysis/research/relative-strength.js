'use strict';
function relativeStrength(a0,a1,b0,b1){const v=[a0,a1,b0,b1].map(Number);if(v.some(x=>!Number.isFinite(x)||x<=0))return null;const assetReturn=(v[1]/v[0]-1)*100,benchmarkReturn=(v[3]/v[2]-1)*100;return{assetReturn,benchmarkReturn,relativeReturn:assetReturn-benchmarkReturn};}
module.exports={relativeStrength};
