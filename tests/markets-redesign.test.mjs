import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTypeScript } from './load-typescript.mjs';
const {sparklinePath, verifiedChange, matchesMovement, historyLabel}=loadTypeScript('src/lib/market/markets-view.ts');
const {default:Markets}=loadTypeScript('src/components/workspace/Markets.tsx');
const {default:Sparkline}=loadTypeScript('src/components/workspace/MarketSparkline.tsx');
const now=1800000000000;
const candles=[0,60,180].map((t,i)=>({time:now/1000+t,close:100+i,open:100+i,low:100+i,high:100+i,volume:1}));
const stats={data:{change:5},fetchedAt:now,stale:false,source:'Coinbase Exchange'};
test('market movements exclude stale, offline, failed and future statistics; filters do not invent gainers',()=>{
 assert.equal(verifiedChange(stats,now),5);
 for(const s of [{...stats,stale:true},{...stats,fetchedAt:now-120001},{...stats,fetchedAt:now+1}]) assert.equal(verifiedChange(s,now),undefined);
 assert.equal(verifiedChange(stats,now,true),undefined); assert.equal(verifiedChange(stats,now,false,true),undefined);
 assert.equal(matchesMovement(undefined,'Gainers'),false); assert.equal(matchesMovement(0,'Losers'),false);
 assert.equal(matchesMovement(-1,'Losers'),true); assert.equal(matchesMovement(undefined,'All'),true);
});
test('sparklines preserve timestamp spacing and break at absent candles',()=>{
 const p=sparklinePath(candles,60); assert.equal((p.match(/M/g)||[]).length,2); assert.ok(p.includes('L68.00,'));
 assert.equal(sparklinePath([],60),''); assert.equal(sparklinePath([candles[0]],60),'');
 assert.ok(sparklinePath(candles.map(c=>({...c,close:100})),60).includes(',35.00'));
});
test('history freshness distinguishes observations from stale and missing data',()=>{
 const history={data:{candles:[candles[0]],granularity:60},fetchedAt:now,stale:false};
 assert.equal(historyLabel(history,now,'1H'),'Observed history');
 assert.equal(historyLabel(history,now+60001,'1H'),'Last known history');
 assert.equal(historyLabel(history,now,'1H',false,true),'Last known history');
 assert.equal(historyLabel(undefined,now,'1D'),'History unavailable');
});
test('market components render supported assets, accessible table/actions and honest empty charts',()=>{
 const html=renderToStaticMarkup(React.createElement(Markets,{onSelect:()=>{},disabled:false,activeAsset:null}));
 for(const name of ['Bitcoin','Ethereum','Solana']) assert.ok(html.includes('Trade '+name));
 assert.ok(html.includes('<table')); assert.ok(html.includes('aria-label="Market filters"'));
 assert.ok(html.includes('Connecting to Coinbase')); assert.ok(!html.includes('Market Cap'));
 const empty=renderToStaticMarkup(React.createElement(Sparkline,{label:'BTC'})); assert.ok(empty.includes('History unavailable')); assert.ok(!empty.includes('<path'));
 const chart=renderToStaticMarkup(React.createElement(Sparkline,{history:{data:{candles,granularity:60}},label:'BTC 24h'})); assert.ok(chart.includes('role="img"')); assert.ok(chart.includes('are not filled.'));
});
