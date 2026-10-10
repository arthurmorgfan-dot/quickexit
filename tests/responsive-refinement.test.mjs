import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './load-typescript.mjs';
const {initialDemo}=loadTypeScript('src/lib/demo-trading.ts');
const {default:Performance}=loadTypeScript('src/components/workspace/Performance.tsx');
const {default:MarketCard}=loadTypeScript('src/components/workspace/MarketCard.tsx');
test('empty performance remains factual, compact and does not alter demo state',()=>{
 const state=initialDemo();const before=JSON.stringify(state);
 const html=renderToStaticMarkup(React.createElement(Performance,{state}));
 assert.ok(html.includes('qw-performance-empty'));
 assert.ok(html.includes('Your history starts with your first completed trade.'));
 assert.ok(!html.includes('<svg'));
 assert.equal(JSON.stringify(state),before);
});
test('demo market keeps chart controls and disclosures while using compact empty presentation',()=>{
 const html=renderToStaticMarkup(React.createElement(MarketCard,{asset:'BTC',setAsset(){},locked:false,price:60000,live:false}));
 assert.ok(html.includes('qw-market-empty'));
 assert.ok(html.includes('all trading remains simulated'));
 assert.ok(html.includes('Candle interval'));
 assert.ok(html.includes('Market charts use real observations.'));
});
test('populated performance retains recorded exits and excludes example trades',()=>{
 const {demoReducer}=loadTypeScript('src/lib/demo-trading.ts');
 const active=demoReducer(initialDemo(),{type:'BUY',asset:'BTC',amount:10000,target:500,protection:null,autoExit:true,now:1000});
 const closed=demoReducer(active,{type:'MOVE',mode:'target'});
 const before=JSON.stringify(closed);
 const html=renderToStaticMarkup(React.createElement(Performance,{state:closed}));
 assert.match(html, /Completed trades<\/dt><dd>1<\/dd>/);
 assert.ok(!html.includes('qw-performance-empty'));
 assert.ok(html.includes('No completed trades in this range.')); // SSR clock is unresolved; browser QA checks the recorded chart after hydration.
 assert.equal(JSON.stringify(closed),before);
});
test('active Demo portfolio explains simulated valuation rather than requiring live quotes',()=>{
 const {demoReducer}=loadTypeScript('src/lib/demo-trading.ts');
 const {default:MarketsExperience}=loadTypeScript('src/components/workspace/MarketsExperience.tsx');
 const state=demoReducer(initialDemo(),{type:'BUY',asset:'BTC',amount:10000,target:500,protection:null,autoExit:true,now:1000});
 const html=renderToStaticMarkup(React.createElement(MarketsExperience,{workspace:{state,market:{mode:'demo'},account:null,ready:true,checkingAuth:false},onTrade(){},onResults(){}}));
 assert.ok(html.includes('Prices and outcomes are simulated.'));
 assert.ok(!html.includes('Fresh quotes are required to trade.'));
});
