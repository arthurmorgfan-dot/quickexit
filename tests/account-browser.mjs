/** Optional standalone local verification. No production route or hosted credentials.
 * QUICKEXIT_BROWSER_MODULE points to an existing external Playwright installation.
 * Auth/email are fixtures; HTTP paper handlers, client stores, UI and RLS SQL are real.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
import {loadTypeScript} from './load-typescript.mjs';
const {chromium}=await import(process.env.QUICKEXIT_BROWSER_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
const {createPaperApi}=loadTypeScript('src/lib/account/paper-api.ts');
const {initialDemo,demoReducer}=loadTypeScript('src/lib/demo-trading.ts');
const {encodePaperTrading}=loadTypeScript('src/lib/paper-trading-storage.ts');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;`);
await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/202610080001_paper_accounts.sql'),'utf8'));
// Bundle existing modules using installed TypeScript, without adding a build dependency.
const modules=new Map(),aliases={
 react:path.join(root,'node_modules/react/cjs/react.production.js'),
 'react/jsx-runtime':path.join(root,'node_modules/react/cjs/react-jsx-runtime.production.js'),
 'react-dom':path.join(root,'node_modules/react-dom/cjs/react-dom.production.js'),
 'react-dom/client':path.join(root,'node_modules/react-dom/cjs/react-dom-client.production.js'),
 scheduler:path.join(root,'node_modules/scheduler/cjs/scheduler.production.js'),
};
modules.set('next/link',{code:"module.exports=function Link(p){return require('react').createElement('a',p,p.children)}",links:{react:aliases.react}});
function collect(filename){
 if(modules.has(filename))return filename;
 const unit={code:'',links:{}};modules.set(filename,unit);
 let source=fs.readFileSync(filename,'utf8');
 if(filename.endsWith('.ts')||filename.endsWith('.tsx')||filename.endsWith('.txt'))source=ts.transpileModule(source,{fileName:filename+'.tsx',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 unit.code=source;
 for(const match of source.matchAll(/require\(["']([^"']+)["']\)/g)){
  const spec=match[1];let target=aliases[spec];
  if(spec==='next/link')target=spec;
  if(!target&&spec.startsWith('@/'))target=path.join(root,'src',spec.slice(2));
  if(!target&&spec.startsWith('.'))target=path.resolve(path.dirname(filename),spec);
  if(target&&!fs.existsSync(target)&&target!=='next/link')target=['.ts','.tsx','.js'].map(ext=>target+ext).find(fs.existsSync);
  target??=require.resolve(spec,{paths:[path.dirname(filename)]});
  unit.links[spec]=target;collect(target);
 }
 return filename;
}
const entry=collect(path.join(root,'tests/browser/account-harness.txt'));collect(aliases.react);
const bundle=`(()=>{const process={env:{NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED:'true',NEXT_PUBLIC_QUICKEXIT_REGISTRATION_ENABLED:'false'}};const units={${[...modules].map(([id,u])=>`${JSON.stringify(id)}:[function(require,module,exports){${u.code}\n},${JSON.stringify(u.links)}]`).join(',')}};const cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};const [fn,links]=units[id];fn(s=>load(links[s]),module,module.exports);return module.exports;}load(${JSON.stringify(entry)});})();`;
const css=fs.readFileSync(path.join(root,'src/app/app/workspace.css'),'utf8')+'\nbody{margin:0;padding:8px;background:#0b0e0d;color:#eef5f0;font-family:system-ui}input,button{font:inherit;max-width:100%;box-sizing:border-box}form{display:grid;gap:10px}label{display:grid;gap:6px}h1{font-size:22px}button{min-height:44px}';
let owners={},tokens=new Map(),lostOwner=null,queue=Promise.resolve();
const serialize=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job};
const identify=async id=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||''])};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');const token=/fixture_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];const user=tokens.get(token)||null;
  if(url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return}
  if(url.pathname==='/style.css'){res.setHeader('Content-Type','text/css');res.end(css);return}
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>');return}
  let body='';for await(const chunk of req)body+=chunk;
  if(url.pathname.startsWith('/fixture/')){
   let result={data:{session:user?{user}:null},error:null};
   if(url.pathname==='/fixture/login'){
    const input=JSON.parse(body);const name=input.email==='a@example.test'?'A':input.email==='b@example.test'?'B':null;
    if(!name||input.password!=='fixture-password-12')result={data:{session:null},error:{message:'Invalid fixture credentials'}};
    else {const user=owners[name];const token=crypto.randomUUID();tokens.set(token,user);res.setHeader('Set-Cookie',`fixture_session=${token}; HttpOnly; SameSite=Strict; Path=/`);result={data:{session:{user},user},error:null}}
   }
   if(url.pathname==='/fixture/logout'){tokens.delete(token);res.setHeader('Set-Cookie','fixture_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');result={data:{session:null},error:null}}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }
  if(url.pathname!=='/api/paper'){res.statusCode=404;res.end();return}
  const reply=await serialize(async()=>{
   const adapter={auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:(_column,id)=>({maybeSingle:async()=>{await identify(user?.id);return {data:(await db.query('select user_id,payload,revision,import_decided from public.paper_workspaces where user_id=$1',[id])).rows[0]||null,error:null}}})})}),rpc:async(_name,args)=>{
    await identify(user?.id);return {data:(await db.query('select public.commit_paper_workspace($1,$2,$3::jsonb,$4) as result',[args.p_expected_revision,args.p_operation_id,JSON.stringify(args.p_payload),args.p_kind])).rows[0].result,error:null};
   }};
   const api=createPaperApi(async()=>adapter);
   const request=new Request(`http://${req.headers.host}/api/paper`,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}: {})});
   return req.method==='POST'?api.POST(request):api.GET();
  });
  if(req.method==='POST'&&user?.id===lostOwner&&reply.ok){req.socket.destroy();return}
  res.statusCode=reply.status;for(const [key,value]of reply.headers)res.setHeader(key,value);res.end(await reply.text());
 }catch(error){res.statusCode=500;res.end(JSON.stringify({error:'Local fixture failed'}));console.error(error.message)}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});const results=[];
const screenshotDir=process.env.QUICKEXIT_BROWSER_SCREENSHOTS;
if(screenshotDir)fs.mkdirSync(screenshotDir,{recursive:true});
const getSnapshot=async p=>JSON.parse(await p.getByTestId('snapshot').innerText());
const status=async(p,value)=>p.waitForFunction(value=>document.querySelector('[data-testid=sync]')?.textContent===value,value);
const login=async(p,owner)=>{await p.getByRole('textbox',{name:'Email',exact:true}).fill(owner.toLowerCase()+'@example.test');await p.getByRole('button',{name:'Sign in fixture'}).click()};
try{
 for(const width of [320,390,768,1440]){
  owners={A:{id:crypto.randomUUID(),email:'a@example.test'},B:{id:crypto.randomUUID(),email:'b@example.test'}};
  await serialize(async()=>{await db.exec('reset role');for(const user of Object.values(owners))await db.query('insert into auth.users values($1)',[user.id])});
  let state=demoReducer(initialDemo(),{type:'BUY',asset:'ETH',amount:10000,target:500,protection:null,autoExit:false,requestId:crypto.randomUUID()});state=demoReducer(state,{type:'SELL'});state=demoReducer(state,{type:'JOURNAL',tradeId:state.lastClosed.id,note:'Preserve existing note.'});const seed=encodePaperTrading({asset:'ETH',state});
  const contexts=await Promise.all([1,2,3].map(()=>browser.newContext({viewport:{width,height:1000}})));
  const [c1,,cb]=contexts;await cb.addInitScript(raw=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('quickexit.paper-trading',raw);sessionStorage.setItem('seeded','1')}},seed);await c1.addInitScript(raw=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('quickexit.paper-trading',raw);sessionStorage.setItem('seeded','1')}},seed);
  const [one,two,other]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];for(const p of [one,two,other])p.on('pageerror',e=>errors.push(e.message));
  await one.goto(origin);await login(one,'A');await status(one,'import');await one.getByRole('button',{name:'Review demo transfer'}).click();await one.waitForFunction(()=>document.activeElement?.textContent==='Cancel');if(screenshotDir)await one.locator('.qw-account-panel').screenshot({path:path.join(screenshotDir,`account-import-${width}.png`)});await one.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await one.evaluate(()=>localStorage.getItem('quickexit.paper-trading')),seed);
  await one.getByRole('button',{name:'Review demo transfer'}).click();await one.getByRole('button',{name:'Confirm demo transfer'}).dblclick();await status(one,'saved');let saved=await getSnapshot(one);assert.deepEqual(saved.state.completed,state.completed);assert.deepEqual(saved.state.journal,state.journal);assert.equal(await one.evaluate(()=>localStorage.getItem('quickexit.paper-trading')),seed);
  await one.getByRole('button',{name:'Open paper trade',exact:true}).dblclick();await status(one,'saved');saved=await getSnapshot(one);assert.ok(saved.state.active);
  lostOwner=owners.A.id;await one.getByRole('button',{name:'Close paper trade',exact:true}).click();await status(one,'offline');const closed=await getSnapshot(one);lostOwner=null;await one.reload();await status(one,'saved');const restored=await getSnapshot(one);assert.deepEqual(restored.state.completed,closed.state.completed);assert.equal(restored.state.cash,closed.state.cash);
  await one.getByRole('button',{name:'Add journal note',exact:true}).click();await status(one,'saved');const updated=await getSnapshot(one);
  await two.goto(origin);await login(two,'A');await status(two,'saved');const second=await getSnapshot(two);assert.deepEqual(second.state.completed,updated.state.completed);assert.deepEqual(second.state.journal,updated.state.journal);assert.equal(second.state.cash,updated.state.cash);
  await other.goto(origin);await login(other,'B');await status(other,'import');await other.getByRole('button',{name:'Start fresh',exact:true}).click();await other.waitForFunction(()=>document.activeElement?.textContent==='Cancel');await other.getByRole('button',{name:'Confirm fresh account',exact:true}).click();await status(other,'saved');assert.equal(await other.evaluate(()=>localStorage.getItem('quickexit.paper-trading')),seed);const b=await getSnapshot(other);assert.equal(b.state.completed.filter(p=>!p.example).length,0);assert.equal(b.state.cash,1000000);
  const own=await cb.request.get(origin+'/api/paper');assert.equal((await own.json()).userId,owners.B.id);
  const forged=await cb.request.post(origin+'/api/paper',{headers:{Origin:origin},data:{id:crypto.randomUUID(),revision:0,kind:'save',userId:owners.A.id,payload:JSON.parse(seed)}});assert.equal(forged.status(),400);
  const cross=await cb.request.post(origin+'/api/paper',{headers:{Origin:'https://other.invalid'},data:{}});assert.equal(cross.status(),403);
  const anon=await browser.newContext();assert.equal((await anon.request.get(origin+'/api/paper')).status(),401);await anon.close();
  await two.getByRole('button',{name:'Choose SOL',exact:true}).click();await status(two,'saved');await one.getByRole('button',{name:'Choose SOL',exact:true}).click();await status(one,'conflict');one.once('dialog',d=>d.accept());await one.getByRole('button',{name:'Use cloud copy',exact:true}).click();await status(one,'saved');assert.equal((await getSnapshot(one)).asset,'SOL');assert.ok(await one.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('.recovery'))));
  await one.getByRole('button',{name:'Sign out',exact:true}).click();await status(one,'demo');assert.equal(await one.evaluate(()=>localStorage.getItem('quickexit.paper-trading')),seed);
  for(const p of [one,two,other])assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth)<=width);assert.deepEqual(errors,[]);
  results.push({width,twoAccounts:true,twoBrowserSessions:true,importConfirmed:true,freshAccountConfirmed:true,guestPreserved:true,lostResponseRecovery:true,receiptAndJournalRestored:true,conflicts:true,ownership:true,errors});for(const c of contexts)await c.close();
 }
 console.log(JSON.stringify({auth:'local fixture, not Supabase GoTrue',database:'actual migration in PGlite',results},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await db.close()}
