const express = require('express');
const fs = require('fs');
const path = require('path');

if (!express.application.__strikePulseOIAnalysisRoute) {
  const originalListen = express.application.listen;

  express.application.listen = function (...args) {
    const app = this;
    const file = path.join(process.cwd(), 'public', 'oi-analysis.js');

    app.get('/oi-analysis.js', (req, res) => {
      res.type('application/javascript');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      if (!fs.existsSync(file)) return res.status(404).send('OI Analysis JS file not found');
      res.sendFile(file);
    });

    return originalListen.apply(app, args);
  };

  express.application.__strikePulseOIAnalysisRoute = true;
  console.log('[OI Analysis] route loaded — /oi-analysis.js');
}
