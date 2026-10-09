import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { SUPPORTED_INTERVALS, INTERVALS, WINDOWS, chartPoints, movingAverage, withChartGaps, validateHistory, historyTtl } = loadTypeScript("src/lib/market/models.ts");
const { createExchangeProvider, createMarketService } = loadTypeScript("src/lib/market/service.ts");
const { createMarketApi } = loadTypeScript("src/lib/market/api.ts");
const { createChartPreferencesStore, decodeChartPreferences, DEFAULT_CHART_PREFERENCES, CHART_PREFERENCES_KEY } = loadTypeScript("src/lib/market/chart-preferences.ts");
const { createIntelligenceReader } = loadTypeScript("src/lib/market/intelligence-reader.ts");
const { fetchMarket } = loadTypeScript("src/lib/market/client.ts");
const now = 1800000000000;
const candle = (time, close = 110) => ({time,open:100,high:Math.max(120,close),low:90,close,volume:2});
const envelope = data => ({data,fetchedAt:now,stale:false,source:"Coinbase Exchange"});
const history = (asset = "BTC", t = "1m") => {
  const { granularity, seconds } = WINDOWS[t];
  const end = Math.floor(now / 1000 / granularity) * granularity;
  const start = end - seconds;
  return {asset,timeframe:t,granularity,start,end,candles:[candle(start),candle(end)],gaps:seconds/granularity-1};
};
const stats = {open:100,last:110,high:120,low:90,volume:2};

test("five native intervals use correct granularity, bounded windows and explicit unsupported 4h", async () => {
  assert.deepEqual(INTERVALS,["1m","5m","15m","1h","4h","1d"]);
  assert.deepEqual(SUPPORTED_INTERVALS,["1m","5m","15m","1h","1d"]);
  assert.equal(WINDOWS['4h'],undefined);
  let calls=0;
  const provider=createExchangeProvider(async url=>{
    calls++;
    const u=new URL(url),g=Number(u.searchParams.get('granularity'));
    const start=Date.parse(u.searchParams.get('start'))/1000,end=Date.parse(u.searchParams.get('end'))/1000;
    assert.ok((end-start)/g<=299);
    return Response.json([[end,90,120,100,110,2],[start,90,120,100,110,2]]);
  },()=>now,async()=>{});
  for(const [i,t] of SUPPORTED_INTERVALS.entries()) {
    assert.equal(WINDOWS[t].granularity,[60,300,900,3600,86400][i]);
    const h=await provider.history('SOL',t);
    assert.equal(h.asset,'SOL'); assert.equal(h.candles.length,2); assert.equal(h.gaps,238);
    assert.equal(validateHistory(h,'SOL',t,now).candles.length,2);
  }
  assert.equal(calls,5);
  let apiCalls=0;
  const api=createMarketApi({history:async(asset,t)=>{apiCalls++;return envelope(history(asset,t));}});
  for(const asset of ['BTC','ETH','SOL']) for(const t of SUPPORTED_INTERVALS) assert.equal((await api(new Request(`http://local/api/market?asset=${asset}&kind=history&timeframe=${t}`))).status,200);
  assert.equal((await api(new Request('http://local/api/market?asset=BTC&kind=history&timeframe=4h'))).status,400);
  assert.equal(apiCalls,15);
});

test("all chart types project the same observed data and whitespace never invents prices",()=>{
  const c=[candle(60),candle(180)];
  assert.deepEqual(chartPoints(c,'line'),chartPoints(c,'area'));
  assert.deepEqual(chartPoints(c,'candles'),chartPoints(c,'bars'));
  const points=withChartGaps(chartPoints(c,'line'),60);
  assert.deepEqual(points,[{time:60,value:110},{time:120},{time:180,value:110}]);
  assert.deepEqual(withChartGaps([],60),[]);
  assert.equal(c.length,2);
});

test("moving averages require contiguous complete windows and restart after gaps",()=>{
  const c=[candle(60,100),candle(120,110),candle(180,120),candle(300,130),candle(360,140),candle(420,150)];
  assert.deepEqual(movingAverage(c,3,60),[{time:180,value:110},{time:420,value:140}]);
  assert.deepEqual(movingAverage(c,20,60),[]);
  assert.deepEqual(movingAverage([],20,60),[]);
  assert.throws(()=>movingAverage(c,0,60));
  assert.throws(()=>movingAverage(c,2,0));
});

test("history validation rejects incorrect identities, ordering, boundaries, values and gap counts",()=>{
  const h=history();
  for(const bad of [
    {...h,asset:'ETH'}, {...h,timeframe:'5m'}, {...h,granularity:300}, {...h,gaps:0},
    {...h,candles:[...h.candles].reverse()}, {...h,candles:[h.candles[0],h.candles[0]]},
    {...h,candles:[candle(h.end+60)]}, {...h,candles:[{...h.candles[0],volume:-1},h.candles[1]]},
    {...h,start:h.start+60}, {...h,end:h.end+60}, {...h,candles:[{...h.candles[0],close:NaN},h.candles[1]]}
  ]) assert.throws(()=>validateHistory(bad,'BTC','1m',now));
  assert.deepEqual(validateHistory(h,'BTC','1m',now+61000).candles,h.candles); // request crosses a bucket boundary
  const empty={...h,candles:[],gaps:240};
  assert.equal(validateHistory(empty,'BTC','1m',now).candles.length,0);
});

test("chart preferences persist independently of paper balances, restore safely and reject unsupported selections",()=>{
  const data=new Map([['quickexit.paper-trading','untouched-receipt-data']]);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const first=createChartPreferencesStore(()=>storage); first.reload();
  assert.deepEqual(first.getSnapshot().preferences,DEFAULT_CHART_PREFERENCES);
  first.update({type:'bars',interval:'1d',volume:true,sma20:true,sma50:true});
  const second=createChartPreferencesStore(()=>storage); second.reload();
  assert.deepEqual(second.getSnapshot().preferences,{type:'bars',interval:'1d',volume:true,sma20:true,sma50:true});
  first.update({interval:'4h'}); assert.equal(first.getSnapshot().preferences.interval,'1d');
  assert.equal(data.get('quickexit.paper-trading'),'untouched-receipt-data');
  assert.equal(JSON.parse(data.get(CHART_PREFERENCES_KEY)).version,1);
  for(const raw of [null,'{bad',JSON.stringify({version:99}),JSON.stringify({version:1,type:'candles',interval:'4h',volume:false,sma20:false,sma50:false})]) assert.deepEqual(decodeChartPreferences(raw),DEFAULT_CHART_PREFERENCES);
  const unavailable=createChartPreferencesStore(()=>{throw Error('denied');});unavailable.reload();unavailable.update({type:'area'});
  assert.equal(unavailable.getSnapshot().preferences.type,'area'); assert.equal(unavailable.getSnapshot().saved,false);
});

test("client cache reuses history across chart remounts and statistics across intervals; expiry refreshes",async()=>{
  let clock=now,calls=0;
  const reader=createIntelligenceReader(async(asset,kind,signal,t)=>{calls++;return envelope(kind==='history'?history(asset,t):stats);},()=>clock);
  const signal=new AbortController().signal;
  const a=await reader('BTC','history',signal,'1m');
  assert.equal(await reader('BTC','history',signal,'1m'),a);
  await reader('BTC','stats',signal); await reader('BTC','stats',signal);
  await reader('BTC','history',signal,'5m');
  assert.equal(calls,3);
  clock+=61000;await reader('BTC','history',signal,'1m');assert.equal(calls,4);
  await reader('BTC','history',signal,'5m');assert.equal(calls,4);
  assert.equal(historyTtl('1m'),60000);assert.equal(historyTtl('1d'),300000);
});

test("client cache rejects malformed history and honors retry cooldown without caching failures as fresh",async()=>{
  let clock=now,calls=0,fail=false;
  const reader=createIntelligenceReader(async()=>{calls++;if(fail)throw Object.assign(Error('offline'),{retryAfter:45});return envelope(history());},()=>clock);
  const signal=new AbortController().signal;
  await reader('BTC','history',signal,'1m');clock+=61000;fail=true;
  assert.equal((await reader('BTC','history',signal,'1m')).stale,true);
  const cached=await reader('BTC','history',signal,'1m'); assert.equal(cached.stale,true);assert.equal(cached.fetchedAt,now);assert.equal(calls,2);
  clock+=46000;assert.equal((await reader('BTC','history',signal,'1m')).stale,true);assert.equal(calls,3);
  clock+=86400001;await assert.rejects(reader('BTC','history',signal,'1m'));
  const bad=createIntelligenceReader(async()=>envelope({...history(),asset:'ETH'}),()=>now);
  await assert.rejects(bad('BTC','history',signal,'1m'));
  await assert.rejects(bad('BTC','history',signal,'1m'));
});

test("server caches new interval history, coalesces requests, and marks failures stale",async()=>{
  let clock=now,calls=0,fail=false;
  const market=createMarketService({history:async()=>{calls++;if(fail)throw Error('offline');return history();}},()=>clock);
  const [a,b]=await Promise.all([market.history('BTC','1m'),market.history('BTC','1m')]);assert.deepEqual(a,b);assert.equal(calls,1);
  clock+=61000;fail=true;
  assert.equal((await market.history('BTC','1m')).stale,true);
  await market.history('BTC','1m');assert.equal(calls,2);
});

test("client request reports safe Retry-After for rate limits and preserves abort behavior",async()=>{
  const saved=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response('private-details',{status:429,headers:{'Retry-After':'45'}});
    await assert.rejects(fetchMarket('BTC','history',new AbortController().signal,'1m'),e=>e.retryAfter===45&&!e.message.includes('private-details'));
    const controller=new AbortController();controller.abort();
    globalThis.fetch=async(_,options)=>{options.signal.throwIfAborted();};
    await assert.rejects(fetchMarket('BTC','history',controller.signal,'1m'));
  } finally {globalThis.fetch=saved;}
});

test("aborted history requests cannot populate cache or cool down a later valid request",async()=>{
  let resolve,calls=0;
  const reader=createIntelligenceReader(()=>{calls++;return new Promise(done=>{resolve=done;});},()=>now);
  const controller=new AbortController();
  const pending=reader('BTC','history',controller.signal,'1m');
  controller.abort();resolve(envelope(history()));
  await assert.rejects(pending);
  const next=reader('BTC','history',new AbortController().signal,'1m');
  resolve(envelope(history()));await next;assert.equal(calls,2);
  await assert.rejects(reader('DOGE','history',new AbortController().signal,'1m'));
  await assert.rejects(reader('BTC','history',new AbortController().signal,'4h'));
});
