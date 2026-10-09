import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadTypeScript} from './load-typescript.mjs';
const {workspaceView}=loadTypeScript('src/lib/workspace-navigation.ts');
const {initialDemo}=loadTypeScript('src/lib/demo-trading.ts');
const {default:Positions}=loadTypeScript('src/components/workspace/Positions.tsx');
const {default:PortfolioAllocation}=loadTypeScript('src/components/workspace/PortfolioAllocation.tsx');
test('landing defaults to Markets and legacy view names resolve without changing authentication mode',()=>{
 for(const value of [null,'','unknown','demo=1'])assert.equal(workspaceView(value),'Markets');
 for(const value of ['Home','Positions','Portfolio'])assert.equal(workspaceView(value),'Portfolio');
 for(const value of ['Activity','History'])assert.equal(workspaceView(value),'History');
 for(const value of ['Trade','Settings','Cash Out'])assert.equal(workspaceView(value),value);
});
test('Portfolio and History reuse positions while showing their respective sections',()=>{
 const props={active:null,completed:[],journal:{},onNote(){},disabled:true,onMonitor(){}};
 const portfolio=renderToStaticMarkup(React.createElement(Positions,{...props,showCompleted:false}));
 assert.ok(portfolio.includes('Active positions'));assert.ok(!portfolio.includes('Completed positions'));
 const history=renderToStaticMarkup(React.createElement(Positions,{...props,showActive:false}));
 assert.ok(history.includes('Completed positions'));assert.ok(!history.includes('Active positions'));
});
test('allocation uses existing capital, distinguishes principal from P&L and handles empty funds',()=>{
 const state=initialDemo();const before=JSON.stringify(state);
 const html=renderToStaticMarkup(React.createElement(PortfolioAllocation,{state}));
 assert.ok(html.includes('100.0%'));assert.ok(html.includes('SIMULATED EUR'));assert.ok(html.includes('Unrealized P&amp;L'));assert.equal(JSON.stringify(state),before);
 const empty=renderToStaticMarkup(React.createElement(PortfolioAllocation,{state:{...state,cash:0}}));assert.ok(!empty.includes('NaN'));assert.ok(!empty.includes('Infinity'));
});
test('workspace renders Markets landing and consolidated desktop/mobile navigation while auth is unresolved',()=>{
 const {default:Workspace}=loadTypeScript('src/components/workspace/Workspace.tsx');
 const html=renderToStaticMarkup(React.createElement(Workspace));
 assert.ok(html.includes('Practice real decisions'));assert.ok(html.includes('Checking account'));
 assert.ok(html.includes('Portfolio'));assert.ok(html.includes('History'));
 assert.ok(!html.includes('>Home<'));assert.ok(!html.includes('>Positions<'));assert.ok(!html.includes('>Activity<'));
 assert.ok(!html.includes('class="qx-portfolio-value"'));
});
test('legacy Home URL resolves to Portfolio and preserves only an explicitly selected demo mode',async()=>{
 const {LegacyHomeRedirect:LegacyHome}=loadTypeScript('src/app/app/home/page.tsx');
 for(const [params,target] of [[{},'/app?view=Portfolio'],[{demo:'1'},'/app?view=Portfolio&demo=1'],[{demo:'0'},'/app?view=Portfolio']]){
  await assert.rejects(()=>LegacyHome({searchParams:Promise.resolve(params)}),e=>e.digest?.includes(target));
 }
});
