'use strict';

const store = require('../option-history-db');

async function optionHistory(q) {
  if (!store.enabled()) {
    return {
      success: false,
      error: 'history_store_not_configured',
      message: 'Option history storage is not configured. Set SP_HISTORY_URL and SP_HISTORY_KEY on the relay service, and ensure the WordPress REST endpoint exists.'
    };
  }

  const contract = {};
  for (const [key, value] of Object.entries(q || {})) {
    if (value == null || String(value).trim() === '') continue;
    contract[key] = String(value).trim();
  }

  const points = await store.history(contract);
  return {
    success: true,
    points,
    count: points.length,
    source: 'WordPress option-history store',
    updated: new Date().toISOString()
  };
}

module.exports = {
  '/api/analysis/option-history': optionHistory
};
