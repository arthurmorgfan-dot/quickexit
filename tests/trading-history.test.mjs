import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './load-typescript.mjs';
const {filterTrades,initialHistoryFilters}=loadTypeScript('src/lib/trading-history.ts');
const {initialDemo}=loadTypeScript('src/lib/demo-trading.ts');
const {default:TradingHistory}=loadTypeScript('src/components/workspace/TradingHistory.tsx');
const closed=(id,asset,profit,date)=>({id,asset,profit,status:'closed',amount:10000,target:500,protection:null,autoExit:true,entryPrice:60000,reason:'manual',...(date?{execution:{exit:{closedAt:date}}}:{legacy:true})});
test('history filters preserve records and distinguish examples, actual results and assets',()=>{
 const records=[...initialDemo().completed,closed(1,'BTC',400),closed(2,'ETH',-200),closed(3,'SOL',0)];
 const before=JSON.stringify(records);
 assert.equal(filterTrades(records,initialHistoryFilters).length,3);
 assert.equal(filterTrades(records,{...initialHistoryFilters,records:'examples'}).length,3);
 assert.deepEqual(filterTrades(records,{...initialHistoryFilters,result:'profit'}).map(p=>p.id),[1]);
 assert.deepEqual(filterTrades(records,{...initialHistoryFilters,result:'loss',asset:'ETH'}).map(p=>p.id),[2]);
 assert.deepEqual(filterTrades(records,{...initialHistoryFilters,result:'even'}).map(p=>p.id),[3]);
 assert.equal(JSON.stringify(records),before);
});
test('date filters include local day endpoints and exclude undated/illustrative records',()=>{
 const start=new Date('2026-10-09T00:00:00').getTime(),end=new Date('2026-10-09T23:59:59.999').getTime();
 const records=[closed(1,'BTC',1,start),closed(2,'ETH',2,end),closed(3,'SOL',3,end+1),closed(4,'BTC',4),...initialDemo().completed];
 const filters={...initialHistoryFilters,records:'all',from:'2026-10-09',to:'2026-10-09'};
 assert.deepEqual(filterTrades(records,filters).map(p=>p.id),[1,2]);
 assert.equal(filterTrades(records,{...filters,to:'2026-10-08'}).length,0);
});
test('example-only and empty history do not fabricate performance or personal trades',()=>{
 for(const completed of [[],initialDemo().completed]){
  const state={...initialDemo(),completed};const before=JSON.stringify(state);
  const html=renderToStaticMarkup(React.createElement(TradingHistory,{state,cloud:false,onNote(){},disabled:false}));
  assert.match(html,/No completed trades to show/);assert.match(html,/Examples excluded/);assert.match(html,/Win rate<\/dt><dd>—/);assert.match(html,/Completed trades<\/dt><dd>0/);
  assert.equal(JSON.stringify(state),before);
 }
});
test('overview reuses actual realized calculations and distinguishes account history',()=>{
 const state={...initialDemo(),completed:[...initialDemo().completed,closed(1,'BTC',400),closed(2,'ETH',-200)]};
 const html=renderToStaticMarkup(React.createElement(TradingHistory,{state,cloud:true,onNote(){},disabled:true}));
 assert.match(html,/ACCOUNT · SIMULATED/);assert.match(html,/50.0%/);assert.match(html,/Completed trades<\/dt><dd>2/);assert.match(html,/\+€2.00/);assert.match(html,/Date not recorded/);
});
test('account activity labels and earlier-event numbering remain accurate',()=>{
 const {default:ActivityList}=loadTypeScript('src/components/workspace/ActivityList.tsx');
 const events=[{id:2,kind:'sell',text:'Recorded exit'},{id:1,kind:'buy',text:'Recorded entry'}];
 const html=renderToStaticMarkup(React.createElement(ActivityList,{events,scope:'Account',startIndex:5,totalCount:7}));
 assert.ok(html.includes('Account paper activity'));assert.ok(!html.includes('demo session'));assert.ok(html.includes('>02<'));assert.ok(html.includes('>01<'));
});
