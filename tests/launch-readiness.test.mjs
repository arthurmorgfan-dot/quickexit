import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const {createRequestLimit}=loadTypeScript('src/lib/request-limit.ts');
const {createMarketApi}=loadTypeScript('src/lib/market/api.ts');
const {createPaperApi}=loadTypeScript('src/lib/account/paper-api.ts');
const {createPasswordApi}=loadTypeScript('src/lib/account/password-api.ts');
const {createPaperTradingStore}=loadTypeScript('src/lib/paper-trading-store.ts');
test('request budgets bound bursts, refill, do not refill after clock reversal, and bound owner keys',()=>{
 let now=10000;const limit=createRequestLimit({capacity:2,perSecond:1,maxKeys:2,now:()=>now});
 assert.equal(limit('a'),0);assert.equal(limit('a'),0);assert.equal(limit('a'),1);
 now=9000;assert.equal(limit('a'),1);now=11000;assert.equal(limit('a'),0);
 assert.equal(limit('b'),0);assert.equal(limit('c'),2);now=14000;assert.equal(limit('c'),0);
 assert.throws(()=>createRequestLimit({capacity:0,perSecond:1}));
});
test('market budget cannot be bypassed with spoofed IPs or new resource keys and never calls provider when denied',async()=>{
 let calls=0;const api=createMarketApi({quote:async()=>{calls++;return {data:{price:1,updatedAt:Date.now()}};}},createRequestLimit({capacity:1,perSecond:1,now:()=>10000}));
 assert.equal((await api(new Request('https://quickexit.net/api/market?asset=BTC&kind=quote'))).status,200);
 const r=await api(new Request('https://quickexit.net/api/market?asset=ETH&kind=quote',{headers:{'x-forwarded-for':'fake'}}));
 assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'1');assert.equal(calls,1);
});
test('paper global budget rejects before auth work; owner budget uses provider-verified identity',async()=>{
 let calls=0;const gate=createRequestLimit({capacity:1,perSecond:1,now:()=>10000});
 const denied=createPaperApi(async()=>{calls++;return null;},()=>0,gate);
 assert.equal((await denied.GET()).status,503);assert.equal((await denied.GET()).status,429);assert.equal(calls,1);
 let selected=0;const api=createPaperApi(async()=>({auth:{getUser:async()=>({data:{user:{id:'verified-owner'}},error:null})},from:()=>{selected++;throw Error('not reached');}}),id=>{assert.equal(id,'verified-owner');return 7;},()=>0);
 const result=await api.GET();assert.equal(result.status,429);assert.equal(result.headers.get('retry-after'),'7');assert.equal(selected,0);
});
test('password budget rejects before reading a body or changing a password',async()=>{
 let calls=0;const api=createPasswordApi(async()=>{calls++;return null;},()=>20);
 const response=await api(new Request('https://quickexit.net/api/auth/password',{method:'POST',headers:{origin:'https://quickexit.net','content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'20');assert.equal(calls,0);
});
test('unavailable or restored live feeds cannot buy/sell with recently cached quotes; fresh verified feed restores actions',()=>{
 const map=new Map();const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const store=createPaperTradingStore(()=>storage);store.hydrate();store.setMarketMode('live');
 const quotes=Object.fromEntries(['BTC','ETH','SOL'].map(a=>[a,{price:100,updatedAt:Date.now()}]));store.receiveMarketQuotes(quotes);
 const buy={type:'BUY',asset:'BTC',amount:10000,target:500,protection:null,autoExit:false,requestId:'launch-live'};
 store.setMarketStatus('unavailable');store.dispatch(buy);assert.equal(store.getSnapshot().state.active,null);assert.equal(store.getSnapshot().state.cash,1000000);
 store.receiveMarketQuotes(quotes);store.dispatch(buy);assert.ok(store.getSnapshot().state.active);
 const position=store.getSnapshot().state.active, cash=store.getSnapshot().state.cash;
 store.setMarketStatus('unavailable');store.dispatch({type:'SELL'});assert.deepEqual(store.getSnapshot().state.active,position);assert.equal(store.getSnapshot().state.cash,cash);
 const other=createPaperTradingStore(()=>storage);other.hydrate();assert.equal(other.getSnapshot().marketStatus,'idle');other.dispatch({type:'SELL'});assert.deepEqual(other.getSnapshot().state.active,position);
 other.receiveMarketQuotes(quotes);other.dispatch({type:'SELL'});assert.equal(other.getSnapshot().state.active,null);assert.ok(other.getSnapshot().state.lastClosed.execution.exit);
});
