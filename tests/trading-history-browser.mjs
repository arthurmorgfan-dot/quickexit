/** Separate Demo-only browser QA; never connects to the retained preservation context. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadTypeScript} from './load-typescript.mjs';
const {chromium}=await import(process.env.QUICKEXIT_BROWSER_MODULE || 'playwright');
const base=process.env.QUICKEXIT_TEST_URL || 'http://127.0.0.1:3001';
assert.equal(new URL(base).origin,'http://127.0.0.1:3001');
const output=process.env.QUICKEXIT_SCREENSHOT_DIR || 'docs/screenshots/v0.11.6';
await fs.mkdir(output,{recursive:true});
const {initialDemo,demoReducer}=loadTypeScript('src/lib/demo-trading.ts');
const {encodePaperTrading,decodePaperTrading,PAPER_TRADING_KEY}=loadTypeScript('src/lib/paper-trading-storage.ts');
let populated=initialDemo();
for(const [asset,result] of [['BTC','target'],['ETH','fall'],['SOL','even']]){
 populated=demoReducer(populated,{type:'BUY',asset,amount:10000,target:500,protection:null,autoExit:result==='target',now:Date.now()-60000});
 if(result!=='even')populated=demoReducer(populated,{type:'MOVE',mode:result});
 if(populated.active)populated=demoReducer(populated,{type:'SELL'});
}
populated={...populated,playing:false};
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const width of [390,768,1440])for(const fixture of ['empty','examples','populated']){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});
  let external=0;const errors=[];
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.origin!==base){external++;return route.abort();}
   if(u.pathname.startsWith('/api/market'))return route.fulfill({status:503,json:{error:'Demo-only local review'}});
   if(u.pathname.startsWith('/api/paper')||u.pathname.startsWith('/auth')||u.pathname==='/signin'||u.pathname==='/signup')return route.abort();
   return route.continue();
  });
  const raw=encodePaperTrading({asset:'BTC',state:fixture==='populated'?populated:{...initialDemo(),playing:false},market:{mode:'demo',quotes:{}}});
  assert.ok(decodePaperTrading(raw));
  await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:PAPER_TRADING_KEY,raw});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/app?demo=1&view=History',{waitUntil:'networkidle'});
  await page.locator('.qh-history').waitFor();
  if(fixture==='examples')await page.getByLabel('Records',{exact:true}).selectOption('examples');
  const actualCount=populated.completed.filter(p=>!p.example).length;
  assert.equal(await page.locator('.qh-metrics div').nth(1).locator('dd').innerText(),fixture==='populated'?String(actualCount):'0');
  if(fixture==='empty')await page.getByText('No completed trades to show.',{exact:true}).waitFor();
  if(fixture==='examples')assert.equal(await page.locator('.qh-trades [data-receipt-id]:visible').count(),3);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:`${output}/${fixture}-History-${width}.png`,fullPage:true});
  if(fixture==='populated'){
   assert.equal(await page.locator('.qh-activity .qw-activity-list:visible li').count(),5);
   await page.locator('.qh-earlier-activity summary').click();
   assert.equal(await page.locator('.qh-activity .qw-activity-list:visible li').count(),populated.events.length);
   await page.locator('.qh-earlier-activity summary').click();
  }
  if(fixture!=='empty'){
   const receipt=page.locator('.qh-trades [data-receipt-id]:visible').first();const id=await receipt.getAttribute('data-receipt-id');
   await receipt.focus();await page.keyboard.press('Enter');
   await page.locator('.qw-trade-receipt h3').waitFor();
   assert.equal(await page.locator('.qw-trade-receipt h3').evaluate(e=>e===document.activeElement),true);
   if(fixture==='populated'){
    const before=decodePaperTrading(await page.evaluate(key=>localStorage.getItem(key),PAPER_TRADING_KEY));
    await page.getByRole('textbox',{name:/Trading journal/}).fill('Demo-only review note');
    await page.getByRole('button',{name:'Save note',exact:true}).click();
    const after=decodePaperTrading(await page.evaluate(key=>localStorage.getItem(key),PAPER_TRADING_KEY));
    assert.equal(after.state.journal[id],'Demo-only review note');assert.deepEqual(after.state.completed,before.state.completed);assert.equal(after.state.cash,before.state.cash);
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/receipt-History-${width}.png`,fullPage:true});
   }else assert.equal(await page.getByRole('textbox',{name:/Trading journal/}).count(),0);
   await page.getByRole('button',{name:'← Back to completed trades',exact:true}).click();
   assert.equal(await page.locator(`[data-receipt-id="${id}"]:visible`).evaluate(e=>e===document.activeElement),true);
   if(fixture==='populated'){
    await page.getByLabel('Asset',{exact:true}).selectOption('ETH');assert.equal(await page.locator('.qh-trades [data-receipt-id]:visible').count(),1);
    await page.getByLabel('Result',{exact:true}).selectOption('profit');assert.equal(await page.locator('.qh-trades [data-receipt-id]:visible').count(),0);
    await page.getByRole('button',{name:'Clear filters',exact:true}).click();
    const day=new Date().toLocaleDateString('en-CA');
    await page.getByLabel('From',{exact:true}).fill(day);await page.getByLabel('To',{exact:true}).fill(day);
    assert.equal(await page.locator('.qh-trades [data-receipt-id]:visible').count(),actualCount);
    await page.getByLabel('To',{exact:true}).fill('2020-01-01');await page.getByText('Choose an end date on or after the start date.').waitFor();
   }
  }
  assert.equal(external,0);assert.deepEqual(errors,[]);
  results.push({width,fixture,overflow:false,pageErrors:errors,externalRequests:external,receiptFocus:fixture!=='empty'});
  await context.close();
 }
}finally{await browser.close();}
await fs.writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
