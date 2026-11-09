'use strict';
const express=require('express');
const registerRoutes=require('./routes');
if(!express.application.__strikePulseMarketAnalysisInstalled){
 const originalListen=express.application.listen;
 express.application.listen=function(...args){registerRoutes(this);return originalListen.apply(this,args);};
 express.application.__strikePulseMarketAnalysisInstalled=true;
}
console.log('[MARKET ANALYSIS] modular research package loaded');
