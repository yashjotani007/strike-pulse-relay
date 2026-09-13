/* Strike Pulse — lightweight server-side API cache + request coalescing
   Loaded before server.js so the existing server/API logic stays untouched. */
'use strict';

const express = require('express');
const originalGet = express.application.get;

const cache = new Map();
const pending = new Map();

const TTL = {
  prices: 4000,
  option: 15000,
  contract: 60000,
  symbols: 60000
};

function ttlFor(path) {
  if (/\/api\/prices(?:\/|$)/i.test(path)) return TTL.prices;
  if (/\/api\/option-symbols(?:\/|$)/i.test(path)) return TTL.symbols;
  if (/\/api\/option-chain-contract-info(?:\/|$)/i.test(path)) return TTL.contract;
  if (/\/api\/(?:nifty-option-chain|option-chain|option-chain-v3|option-chain-indices|option-chain-equities)(?:\/|$)/i.test(path)) return TTL.option;
  return 0;
}

function keyFor(req) {
  return req.originalUrl || req.url;
}

function wrapHandler(path, handler) {
  if (typeof handler !== 'function') return handler;
  const ttl = ttlFor(String(path));
  if (!ttl) return handler;

  return async function strikePulseCachedHandler(req, res, next) {
    const key = keyFor(req);
    const now = Date.now();
    const hit = cache.get(key);

    if (hit && hit.expires > now) {
      res.status(hit.status);
      if (hit.type === 'json') return res.json(hit.body);
      return res.send(hit.body);
    }
    if (hit) cache.delete(key);

    if (pending.has(key)) {
      try {
        const result = await pending.get(key);
        res.status(result.status);
        if (result.type === 'json') return res.json(result.body);
        return res.send(result.body);
      } catch (err) {
        return next(err);
      }
    }

    let resolvePending;
    let rejectPending;
    const wait = new Promise((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    pending.set(key, wait);

    let sent = false;
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const save = (type, body) => {
      if (sent) return;
      sent = true;
      const result = {status: res.statusCode || 200, type, body};
      cache.set(key, {expires: Date.now() + ttl, ...result});
      pending.delete(key);
      resolvePending(result);
    };

    res.json = function(body) {
      save('json', body);
      return originalJson(body);
    };

    res.send = function(body) {
      save('send', body);
      return originalSend(body);
    };

    try {
      const result = handler(req, res, next);
      if (result && typeof result.then === 'function') await result;
      if (!sent) {
        pending.delete(key);
        resolvePending({status: res.statusCode || 204, type: 'send', body: ''});
      }
      return result;
    } catch (err) {
      pending.delete(key);
      rejectPending(err);
      return next(err);
    }
  };
}

express.application.get = function(path, ...handlers) {
  if (typeof path !== 'string') return originalGet.call(this, path, ...handlers);
  const wrapped = handlers.map(h => wrapHandler(path, h));
  return originalGet.call(this, path, ...wrapped);
};

console.log('[StrikePulse] performance cache enabled: prices 4s, options 15s, metadata 60s');
