'use strict';
async function getOverview(){const fn=global.__SP_MARKET_INTELLIGENCE_HANDLER__;if(typeof fn!=='function')throw Error('Existing Market Intelligence feed is not initialized');const data=await fn();if(!data||data.success!==true)throw Error('Market Intelligence returned invalid data');return{...data,module:'market-analysis-overview',integration:'existing-market-intelligence'};}
module.exports={getOverview};
