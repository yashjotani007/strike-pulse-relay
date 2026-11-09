'use strict';
function correlation(a,b){const p=[];for(let i=0;i<Math.min(a?.length||0,b?.length||0);i++){const x=Number(a[i]),y=Number(b[i]);if(Number.isFinite(x)&&Number.isFinite(y))p.push([x,y]);}if(p.length<3)return null;const mx=p.reduce((s,x)=>s+x[0],0)/p.length,my=p.reduce((s,x)=>s+x[1],0)/p.length;let c=0,vx=0,vy=0;for(const[x,y]of p){c+=(x-mx)*(y-my);vx+=(x-mx)**2;vy+=(y-my)**2;}return vx&&vy?c/Math.sqrt(vx*vy):null;}
module.exports={correlation};
