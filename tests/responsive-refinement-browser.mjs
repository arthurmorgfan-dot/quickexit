/** Optional local-only QA. Uses existing external Playwright; adds no project dependency.
 * Runs fresh Demo contexts with all non-loopback and market requests blocked.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadTypeScript} from './load-typescript.mjs';
const {chromium}=await import(process.env.QUICKEXIT_BROWSER_MODULE || 'playwright');
const base=process.env.QUICKEXIT_TEST_URL || 'http://127.0.0.1:3000';
assert.equal(new URL(base).hostname,'127.0.0.1');
const output=process.env.QUICKEXIT_SCREENSHOT_DIR || '/private/tmp/quickexit-v114-review';
await fs.mkdir(output,{recursive:true});
const {initialDemo,demoReducer}=loadTypeScript('src/lib/demo-trading.ts');
const {encodePaperTrading,decodePaperTrading,PAPER_TRADING_KEY}=loadTypeScript('src/lib/paper-trading-storage.ts');
const empty={...initialDemo(),completed:[],playing:false};
let populated=demoReducer(initialDemo(),{type:'BUY',asset:'BTC',amount:10000,target:500,protection:null,autoExit:true,now:Date.now()-60000});
populated=demoReducer(populated,{type:'MOVE',mode:'target'});
const completedId=populated.completed.find(p=>!p.example).id;
populated=demoReducer(populated,{type:'BUY',asset:'ETH',amount:25000,target:1000,protection:null,autoExit:false,now:Date.now()-1000});
populated={...populated,playing:false};
const browser=await chromium.launch({headless:true});const results=[];
try {
 for(const width of [390,768,1440]) for(const [fixture,state] of [['empty',empty],['populated',populated]]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
  let external=0;const errors=[];
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='127.0.0.1'){external++;return route.abort();}
   if(url.pathname.startsWith('/api/market'))return route.fulfill({status:503,json:{error:'Local visual test: market data unavailable'}});
   return route.continue();
  });
  const raw=encodePaperTrading({asset:'ETH',state,market:{mode:'demo',quotes:{}}});
  assert.ok(decodePaperTrading(raw), 'Fixture must pass the production decoder');
  // The initializer writes only the owned Demo key in this fresh ephemeral context.
  await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:PAPER_TRADING_KEY,raw});
  for(const view of ['Markets','Trade','Portfolio','History']){
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(`${base}/app?demo=1&view=${view}`);
   await page.waitForFunction(()=>document.querySelector('.qe-workspace')&&!document.querySelector('.qe-workspace').hasAttribute('inert'));
   await page.waitForTimeout(400);
   await page.mouse.click(width-3,105);
   await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
   await page.waitForTimeout(100);
   await page.screenshot({path:`${output}/${fixture}-${view}-${width}.png`,fullPage:true});
   const nav=page.locator(width<=700?'.qw-bottom-nav':'.qw-sidebar');
   await nav.locator('[aria-current="page"]').waitFor();
   assert.ok((await nav.locator('[aria-current="page"]').innerText()).includes(view));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(view==='Markets'){
    assert.equal(await page.locator('.qm-ranges').evaluateAll(nodes=>nodes.some(e=>e.scrollWidth>e.clientWidth)),false);
    await page.getByRole('searchbox').fill('ETH');assert.equal(await page.locator('.qm-table tbody tr').count(),1);
    await page.getByRole('searchbox').fill('');
    await page.getByRole('combobox',{name:'Sort markets'}).selectOption('name');
    assert.match(await page.locator('.qm-table tbody tr').first().innerText(),/Bitcoin/);
    await page.getByRole('button',{name:'Gainers',exact:true}).click();
    assert.equal(await page.locator('.qm-table tbody tr').count(),0);
    await page.getByRole('button',{name:'All',exact:true}).click();
    await page.getByRole('combobox',{name:'Sort markets'}).selectOption('default');
    const range=page.getByRole('group',{name:'BTC history range'}).getByRole('button',{name:'1W',exact:true});
    await range.click();assert.equal(await range.getAttribute('aria-pressed'),'true');
   }
   if(view==='Trade'&&fixture==='empty'){
    if(width<1001)assert.ok(await page.locator('.qw-trade-form').evaluate(e=>e.getBoundingClientRect().top)<await page.locator('.qw-market').evaluate(e=>e.getBoundingClientRect().top));
    assert.equal(await page.locator('.qw-portfolio-stats').count(),0);
    await page.getByRole('button',{name:'Buy & Auto-Exit',exact:true}).click();
    await page.getByRole('button',{name:'Confirm Paper Trade',exact:true}).waitFor();
    // Dismiss without submitting; this checks the confirmation remains mandatory.
    await page.getByRole('button',{name:'Go Back',exact:true}).click();
   }
   if(view==='Portfolio'){
    assert.equal(await page.locator('.qw-portfolio-stats .qw-stat').first().locator('span').innerText(),'Total simulated portfolio value');
    assert.equal(await page.locator('.qw-performance-chart').count(),fixture==='populated'?1:0);
   }

   if(view==='History'&&fixture==='populated'){
    const receipt=page.locator(`[data-receipt-id="${completedId}"]:visible`).first();
    await receipt.click();await page.getByRole('textbox',{name:/Trading journal/}).fill('Local Demo QA note');
    await page.getByRole('button',{name:'Save note',exact:true}).click();
    await page.getByText('Note updated · see workspace save status',{exact:true}).waitFor();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.waitForTimeout(100);
    await page.screenshot({path:`${output}/populated-Receipt-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'← Back to completed trades',exact:true}).click();
    await page.waitForTimeout(100);
    assert.equal(await receipt.isVisible(),true);
    assert.ok(await page.locator('.qw-positions-table').count());
   }
   results.push({width,fixture,view,overflow:false});console.log(JSON.stringify({width,fixture,view}));await page.close();
  }
  assert.deepEqual(errors,[]);assert.equal(external,0);await context.close();
 }
 await fs.writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({pages:results.length,errors:0,externalRequests:0}));
} finally {await browser.close();}
