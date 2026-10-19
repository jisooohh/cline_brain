import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store.mjs';
import { Engine } from './engine.mjs';
async function done(engine) { for(let i=0;i<200 && engine.active;i++) await new Promise(r => setTimeout(r,5)); assert.equal(engine.active,null); }
test('document Codex receives current draft and only active project memories, saves suggested result with source run', async () => {
 const root=mkdtempSync(join(tmpdir(),'clinebrain-document-')); const store=new Store(root);
 try {
  const a=store.saveBrain({project:'A',title:'Decision',body:'ACTIVE_CONTEXT',status:'active'});
  store.saveBrain({project:'A',title:'Archived',body:'ARCHIVED_SECRET',status:'archived'});
  store.saveBrain({project:'B',title:'Other',body:'OTHER_PROJECT',status:'active'});
  let input;
  const engine=new Engine(store,()=>{},{codex:{start:async(prompt,emit)=>{input=prompt;emit({type:'thread.started'});return '# Result\nUses ACTIVE_CONTEXT.';}}});
  const run=engine.startDocument({mode:'solo',project:'A',instruction:'Summarize',document:{...a,body:'CURRENT_UNSAVED',dirty:true}});
  assert.throws(()=>engine.startDocument({}),/project/);
  await done(engine);
  assert.match(input,/CURRENT_UNSAVED/);assert.match(input,/ACTIVE_CONTEXT/);
  assert.doesNotMatch(input,/ARCHIVED_SECRET|OTHER_PROJECT/);
  const result=store.get('brain',run.memoryId);
  assert.equal(result.status,'proposed');assert.equal(result.runId,run.id);assert.equal(run.status,'completed');
  assert.equal(store.get('brain',a.id).body,'ACTIVE_CONTEXT');
 } finally {store.close();rmSync(root,{recursive:true,force:true});}
});
test('failed or cancelled document tasks never save a successful output', async () => {
 const root=mkdtempSync(join(tmpdir(),'clinebrain-document-'));const store=new Store(root);
 try {
  const engine=new Engine(store,()=>{},{codex:{start:async()=>{throw new Error('CLI failed');}}});
  const input={mode:'solo',project:'A',instruction:'Summarize',document:{project:'A',title:'Draft',body:'Text'}};
  const failed=engine.startDocument(input);await done(engine);assert.equal(failed.status,'failed');assert.equal(store.all('brain').length,0);
  engine.deps.codex={start:async(_p,_e,signal)=>new Promise((_r,reject)=>signal.addEventListener('abort',()=>reject(new Error('Cancelled')))),cancel(){}};
  const cancelled=engine.startDocument(input);await new Promise(r=>setTimeout(r,0));engine.cancel(cancelled.id);await done(engine);assert.equal(cancelled.status,'cancelled');assert.equal(store.all('brain').length,0);
 }finally{store.close();rmSync(root,{recursive:true,force:true});}
});
