// Optional local browser verification; requires a separately installed Playwright.
// Start the local production build first. No hosted accounts or data are touched.
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.QUICKEXIT_BROWSER_MODULE || 'playwright');
import assert from 'node:assert/strict';
const b=await chromium.launch({headless:true});const results=[];
for(const width of [320,390,768,1440]){
 const c=await b.newContext({viewport:{width,height:1000},hasTouch:width<700});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:3000/app?demo=1');await p.waitForFunction(()=>!document.querySelector('.qe-workspace')?.hasAttribute('inert'));
 const skip=p.getByRole('button',{name:'Skip introduction'});if(await skip.count())await skip.click();
 await p.getByRole('heading',{name:'Markets',exact:true,level:1}).waitFor();
 await p.getByRole('heading',{name:'Practice real decisions in real markets.'}).waitFor();assert.equal(await p.locator('.qx-portfolio-value').count(),1);await p.getByLabel('Sort markets').selectOption('name');assert.equal(await p.locator('.qm-table tbody tr').first().locator('strong').first().textContent(),'Bitcoin');assert.equal(await p.locator('.qm-feature').count(),3);assert.equal(await p.locator('.qm-table tbody tr').count(),3);
 await p.waitForFunction(()=>document.querySelectorAll('.qm-table-chart svg').length===3,{},{timeout:45000});
 const btc=p.getByRole('group',{name:'BTC history range'});
 for(const range of ['1H','1W','1M','1Y']) {
  await btc.getByRole('button',{name:range,exact:true}).click();await p.waitForFunction(range=>document.querySelector('.qm-feature svg title')?.textContent.includes(range),range,{timeout:30000});
 }
 await btc.getByRole('button',{name:'1D',exact:true}).click();
 const search=p.getByRole('searchbox');await search.fill('eth');assert.equal(await p.locator('.qm-table tbody tr').count(),1);await search.fill('noasset');assert.equal(await p.locator('.qm-table tbody tr').count(),0);await search.fill('');
 await p.getByRole('button',{name:'Gainers',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Gainers',exact:true}).getAttribute('aria-pressed'),'true');await p.getByRole('button',{name:'All',exact:true}).click();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth)<=width);
 if(width===1440)assert.ok((await p.locator('.qm-discovery').boundingBox()).y<900);
 if(width<600){assert.ok(await p.locator('.qx-mobile-account').isVisible());assert.ok((await p.locator('.qx-mobile-account').boundingBox()).y<(await p.locator('.qm-featured').boundingBox()).y);}
 await p.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
 await p.screenshot({path:`${tmpdir()}/quickexit-v111-${width}.png`,fullPage:true});
 await c.setOffline(true);await p.getByRole('status').filter({hasText:'Offline · last known data'}).waitFor();assert.equal(await p.locator('.qm-table tbody tr td:nth-child(3)').filter({hasText:'Unavailable'}).count(),3);await c.setOffline(false);
 const trade=p.getByRole('button',{name:'Trade Ethereum ETH',exact:true});await trade.focus();await p.keyboard.press('Enter');await p.getByRole('heading',{name:'Make your next move.'}).waitFor();
 await p.reload();await p.waitForFunction(()=>!document.querySelector('.qe-workspace')?.hasAttribute('inert'));await p.getByRole('button',{name:'Trade Ethereum ETH',exact:true}).click();await p.locator('#asset-choice').waitFor({state:'visible'});assert.equal(await p.locator('#asset-choice').inputValue(),'ETH');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth)<=width);assert.deepEqual(errors,[]);
 results.push({width,realCharts:true,rangeSwitch:true,searchFilters:true,offline:true,keyboardTrade:true,assetPersistence:true,overflow:false,errors});await c.close();
}
console.log(JSON.stringify(results,null,2));await b.close();
