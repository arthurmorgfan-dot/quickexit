import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';
const {publicBuildInfo,resolveBuildIdentifier}=loadTypeScript('src/lib/build-info.ts');
const {registrationEnabled}=loadTypeScript('src/lib/supabase/config.ts');
const {authenticate}=loadTypeScript('src/lib/account/auth-flows.ts');
const {demoImportPreview}=loadTypeScript('src/lib/account/import-preview.ts');
const {decodeCloudReply}=loadTypeScript('src/lib/account/cloud-api.ts');
const {encodePaperTrading}=loadTypeScript('src/lib/paper-trading-storage.ts');
const {initialDemo,demoReducer}=loadTypeScript('src/lib/demo-trading.ts');
const sha='6a0a0e9e52517badad15932683c388c2addfe50c';
test('public build identity is SHA-only, reports dirty checkouts and rejects mismatched CI metadata',()=>{
 assert.deepEqual(publicBuildInfo(resolveBuildIdentifier(undefined,sha,true)),{identifier:`git-${sha}-dirty`,commit:sha,dirty:true,version:'0.9'});
 assert.equal(resolveBuildIdentifier(sha.toUpperCase(),sha),`git-${sha}`);
 assert.equal(resolveBuildIdentifier(), 'unidentified');
 for(const value of ['sb_secret_should_not_escape','https://private.invalid','abc','a'.repeat(41)]){
  assert.throws(()=>resolveBuildIdentifier(value),/full Git SHA/);
  assert.equal(publicBuildInfo(value).commit,null);
  assert.ok(!JSON.stringify(publicBuildInfo(value)).includes(value));
 }
 assert.throws(()=>resolveBuildIdentifier('f'.repeat(40),sha),/does not match/);
});
test('public registration requires its own exact gate plus enabled valid accounts',async()=>{
 const names=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED','NEXT_PUBLIC_QUICKEXIT_REGISTRATION_ENABLED'];
 const old=names.map(n=>process.env[n]);
 try {
  process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture';
  for(const accounts of ['false','true'])for(const signup of ['false','TRUE','1','true']){
   process.env.NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED=accounts;process.env.NEXT_PUBLIC_QUICKEXIT_REGISTRATION_ENABLED=signup;
   assert.equal(registrationEnabled(),accounts==='true'&&signup==='true');
  }
  process.env.NEXT_PUBLIC_QUICKEXIT_REGISTRATION_ENABLED='false';let calls=0;
  const client={auth:{signUp:async()=>{calls++;return {data:{session:null},error:null}},signInWithPassword:async()=>({data:{session:{user:{id:'A'}}},error:null})}};
  assert.match((await authenticate(client,'signup','a@example.test','fixture-pass-12','http://localhost:3000')).message,/registration is closed/);
  assert.equal(calls,0);
  assert.equal((await authenticate(client,'signin','a@example.test','fixture-pass-12','http://localhost:3000')).status,'signed_in');
  assert.equal((await authenticate(client,'signup','a@example.test','fixture-pass-12','http://localhost:3000',true)).status,'confirmation');
 } finally {names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i]})}
});
test('transfer preview describes the exact validated snapshot without changing receipts or notes',()=>{
 let state=demoReducer(initialDemo(),{type:'BUY',asset:'ETH',amount:10000,target:500,protection:null,autoExit:false,requestId:'preview'});
 state=demoReducer(state,{type:'SELL'});const closed=state.lastClosed;
 state=demoReducer(state,{type:'JOURNAL',tradeId:closed.id,note:'Follow my plan.'});
 const raw=encodePaperTrading({asset:'ETH',state});const preview=demoImportPreview(raw);
 assert.equal(preview.cash,state.cash);assert.equal(preview.completed,1);assert.equal(preview.receipts,1);assert.equal(preview.notes,1);assert.equal(preview.activity,state.events.length);assert.equal(preview.selectedAsset,'ETH');
 assert.equal(encodePaperTrading({asset:'ETH',state}),raw);
 state=demoReducer(state,{type:'NEW_TRADE'});
 state=demoReducer(state,{type:'BUY',asset:'SOL',amount:10000,target:500,protection:500,autoExit:true,requestId:'active-preview'});
 const active=demoImportPreview(encodePaperTrading({asset:'SOL',state}));
 assert.deepEqual(active.active,{asset:'SOL',amount:10000,target:500,protection:500,autoExit:true});
 for(const raw of [null,'broken','{}'])assert.equal(demoImportPreview(raw),null);
});
test('acknowledgements reject cross-owner data and invalid revisions while allowing later duplicate records',()=>{
 const raw=encodePaperTrading({asset:'BTC',state:initialDemo()});
 const record={userId:'A',raw,revision:2,importDecided:true};
 assert.equal(decodeCloudReply({status:'duplicate',record,committedRevision:1},'A').committedRevision,1);
 assert.equal(decodeCloudReply({status:'saved',record,committedRevision:2},'A').record.raw,raw);
 for(const value of [null,{}, {status:'arbitrary',record}, {status:'saved',record}, {status:'saved',record,committedRevision:1}, {status:'duplicate',record,committedRevision:3}, {status:'duplicate',record,committedRevision:NaN}])assert.throws(()=>decodeCloudReply(value,'A'));
 assert.throws(()=>decodeCloudReply({status:'conflict',record},'B'),/Invalid cloud record/);
});
