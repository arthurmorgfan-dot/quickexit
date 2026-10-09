import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './load-typescript.mjs';
const {sortMarketRows}=loadTypeScript('src/lib/market/markets-view.ts');
const {initialDemo}=loadTypeScript('src/lib/demo-trading.ts');
const {default:MarketsExperience}=loadTypeScript('src/components/workspace/MarketsExperience.tsx');
test('market sorting preserves inputs and places unavailable observations last',()=>{
 const rows=[{name:'Solana',price:10,change:-2},{name:'Bitcoin',price:100,change:1},{name:'Ethereum'}];
 assert.deepEqual(sortMarketRows(rows,'price').map(r=>r.name),['Bitcoin','Solana','Ethereum']);
 assert.deepEqual(sortMarketRows(rows,'change').map(r=>r.name),['Bitcoin','Solana','Ethereum']);
 assert.deepEqual(sortMarketRows(rows,'name').map(r=>r.name),['Bitcoin','Ethereum','Solana']);
 assert.deepEqual(sortMarketRows(rows,'default'),rows);assert.equal(rows[0].name,'Solana');
});
test('uninitialized and loading cloud accounts show no portfolio balance and perform no writes when rendered',()=>{
 let writes=0;
 const w={state:initialDemo(),account:{id:'fixture-A'},ready:false,checkingAuth:false,syncStatus:'import',syncMessage:'Choose a starting portfolio',importAvailable:true,chooseImport:()=>writes++,demoRaw:null};
 for(const checkingAuth of [false,true]){
  const html=renderToStaticMarkup(React.createElement(MarketsExperience,{workspace:{...w,checkingAuth},onTrade:()=>writes++,onResults:()=>writes++}));
  assert.ok(!html.includes('class="qx-portfolio-value"'));assert.ok(html.includes('Choose a starting portfolio'));assert.ok(html.includes(checkingAuth?'CHECKING ACCOUNT':'CLOUD · SIMULATED'));
 }
 assert.equal(writes,0);
});
test('demo and initialized cloud portfolios use the existing calculated balance',()=>{
 for(const account of [null,{id:'fixture-A'}]){
  const html=renderToStaticMarkup(React.createElement(MarketsExperience,{workspace:{state:initialDemo(),account,ready:true,checkingAuth:false,importAvailable:false},onTrade:()=>{},onResults:()=>{}}));
  assert.ok(html.includes('class="qx-portfolio-value"'));assert.ok(html.includes('Available cash'));assert.ok(html.includes(account?'CLOUD · SIMULATED':'DEMO · LOCAL'));
 }
});
test('empty Trade state explains confirmation without monetary placeholders or render actions',()=>{
 const {default:TradeAccountState}=loadTypeScript('src/components/workspace/TradeAccountState.tsx');let calls=0;
 for(const canChoose of [true,false]){
  const html=renderToStaticMarkup(React.createElement(TradeAccountState,{canChoose,onPortfolio:()=>calls++}));
  assert.ok(!html.includes('€'));assert.ok(!html.includes('<input'));assert.ok(html.includes('View portfolio controls'));assert.ok(html.includes(canChoose?'explicitly confirm':'verification'));
 }
 assert.equal(calls,0);
});
test('uncertain session panel shows restoration status without demo identity or a balance',()=>{
 const message='Session restoration unavailable. Your account data has not been changed.';
 const html=renderToStaticMarkup(React.createElement(MarketsExperience,{workspace:{state:initialDemo(),account:null,ready:false,checkingAuth:true,authError:message},onTrade:()=>{throw Error('Unexpected action')},onResults:()=>{}}));
 assert.ok(html.includes(message));assert.ok(html.includes('CHECKING ACCOUNT'));assert.ok(!html.includes('DEMO · LOCAL'));assert.ok(!html.includes('qx-portfolio-value'));assert.ok(html.includes('disabled=""'));
});
