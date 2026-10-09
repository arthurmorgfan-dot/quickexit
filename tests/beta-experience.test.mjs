import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTypeScript} from './load-typescript.mjs';
const {INTRO_KEY,introductionSeen,completeIntroduction,feedbackReport}=loadTypeScript('src/lib/beta-experience.ts');
test('introduction completion survives refresh without changing a portfolio or chart preferences',()=>{
 const data=new Map([['quickexit.paper-trading','existing receipts'],['quickexit.chart-preferences','existing chart']]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 assert.equal(introductionSeen(storage),false);
 assert.equal(completeIntroduction(storage),true);
 assert.equal(introductionSeen({...storage}),true);
 assert.equal(data.get('quickexit.paper-trading'),'existing receipts');
 assert.equal(data.get('quickexit.chart-preferences'),'existing chart');
});
test('unknown introduction values and denied browser storage recover safely',()=>{
 for(const value of [null,'true','v2:complete','{'])assert.equal(introductionSeen({getItem:()=>value}),false);
 const blocked={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('full')}};
 assert.equal(introductionSeen(blocked),false);assert.equal(completeIntroduction(blocked),false);
 assert.equal(INTRO_KEY,'quickexit.introduction');
});
test('feedback validates bounds and includes only explicitly written content',()=>{
 for(const kind of ['Bug','Suggestion']){
  const report=feedbackReport(kind,'  Chart does not load after selecting ETH.  ');
  assert.equal(report,`QuickExit private beta feedback\nType: ${kind}\n\nChart does not load after selecting ETH.\n`);
 }
 for(const value of ['', 'short', 'a'.repeat(2001)])assert.equal(feedbackReport('Bug',value),null);
 assert.equal(feedbackReport('Account','a'.repeat(20)),null);
 assert.ok(feedbackReport('Bug','a'.repeat(2000)));
});
