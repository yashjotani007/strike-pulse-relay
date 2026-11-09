'use strict';
const {safeSymbol}=require('../shared');
function normalizeWatchlist(input){if(!Array.isArray(input))throw Error('Watchlist must be an array');return[...new Set(input.map(safeSymbol))].slice(0,100);}
module.exports={normalizeWatchlist};
