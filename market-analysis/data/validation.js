'use strict';
const {numberOrNull,safeSymbol}=require('../shared');
function validCandles(rows){if(!Array.isArray(rows))return[];return rows.map(x=>({timestamp:numberOrNull(x.timestamp??(x.t?x.t*1000:null)),open:numberOrNull(x.open),high:numberOrNull(x.high),low:numberOrNull(x.low),close:numberOrNull(x.close),volume:numberOrNull(x.volume)})).filter(x=>x.timestamp!=null&&x.open>0&&x.high>=x.low&&x.low>0&&x.close>0);}
module.exports={numberOrNull,safeSymbol,validCandles};
