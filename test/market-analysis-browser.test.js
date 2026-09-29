'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const PREVIEW='https://strike-pulse-analysis-preview.onrender.com';
const WORDPRESS='https://yashjotani.free.nf/wordpress/market-analysis/';
test('development dashboard: all seven sections return valid arrays',async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(PREVIEW+'/analysis-preview',{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByRole('button',{name:'Run all 7 API checks'}).click();
  await page.waitForFunction(()=>{const s=document.querySelector('#summary')?.textContent||'';return /\\d+ of 7 API requests succeeded/.test(s)},null,{timeout:120000}).catch(async e=>{throw Error('Dashboard did not finish: '+JSON.stringify({summary:await page.locator('#summary').innerText(),statuses:await page.locator('.item .status').allInnerTexts(),outputs:await page.locator('.item pre').allInnerTexts(),pageErrors:errors})+'; '+e.message)});
  const summary=await page.locator('#summary').innerText();
  const statuses=await page.locator('.item .status').allInnerTexts();
  assert.equal(statuses.length,7);
  assert.ok(statuses.every(s=>s.startsWith('PASS')),JSON.stringify({summary,statuses}));
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
},{timeout:160000});
test('original WordPress HTML: all seven sections, controls, charts and mobile layout',async(t)=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/market-analysis.js*',route=>route.continue({url:PREVIEW+'/market-analysis.js'}));
  await page.route('**/market-analysis-v3.js*',route=>route.continue({url:PREVIEW+'/market-analysis-v3.js'}));
  const response=await page.goto(WORDPRESS,{waitUntil:'domcontentloaded',timeout:90000});
  if(!response||response.status()>=400){t.diagnostic('WordPress host blocked external test browser: '+response?.status());t.skip('Requires browser access to actual WordPress page');return}
  const sections=['stock-scanner','option-scanner','chart-lab','volume-lab','correlation-lab','backtesting','statistics'];
  for(const id of sections)assert.equal(await page.locator('#'+id).count(),1,'Missing original section: '+id);
  const controls=['stock-universe','stock-timeframe','scan-pattern','minimum-price','relative-volume','option-underlying','option-expiry','option-type','moneyness','chart-symbol','chart-timeframe','chart-style','volume-symbol','volume-period','correlation-stock-a','correlation-stock-b','correlation-window','backtest-strategy','backtest-start','backtest-end','statistical-pattern','statistical-symbol','statistical-period','forward-window'];
  for(const id of controls)assert.equal(await page.locator('#'+id).count(),1,'Missing original control: '+id);
  await page.waitForTimeout(12000);
  const overflows=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  assert.ok(overflows.document<=overflows.viewport+5,'Mobile horizontal overflow '+JSON.stringify(overflows));
  for(const id of sections)assert.ok(await page.locator('#'+id+' .sp-panel').count()>0,'Missing panel: '+id);
  const volumeButton=page.locator('#volume-lab button').filter({hasText:'Analyze Volume'}).first();
  if(await volumeButton.count()){await volumeButton.evaluate(b=>b.click());await page.waitForFunction(()=>{const h=document.querySelector('#volume-lab');return !!h?.querySelector('.sp-v3-status,.sp-live-message')?.textContent},null,{timeout:45000});const message=await page.locator('#volume-lab .sp-v3-status, #volume-lab .sp-live-message').allInnerTexts();assert.ok(!message.some(s=>s.startsWith('Unavailable:')),'Volume UI failed: '+JSON.stringify(message));t.diagnostic('Volume button status: '+JSON.stringify(message))}
  assert.deepEqual(errors,[],'Browser JavaScript exceptions');
 }finally{await browser.close()}
},{timeout:160000});
