import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from './store.mjs';
import { Engine } from './engine.mjs';
const pause = ms => new Promise(r => setTimeout(r, ms));
const input = (project='A') => ({project,instruction:'Write a brief',document:{project,title:'Draft',body:'CURRENT_DOC'}});
async function finish(e) { for(let i=0;i<500 && e.activeRuns.size;i++) await pause(5); assert.equal(e.activeRuns.size,0); }
function fixture(fn) { return async () => { const root=mkdtempSync(join(tmpdir(),'brain-team-'));const s=new Store(root);try {await fn(s);}finally{s.close();rmSync(root,{recursive:true,force:true});} }; }
test('two teams overlap with distinct sessions, bounded processes, isolated context and real synthesis inputs', fixture(async s => {
 s.saveBrain({project:'A',title:'A memory',body:'ONLY_A',status:'active'});
 s.saveBrain({project:'B',title:'B memory',body:'ONLY_B',status:'active'});
 let current=0, peak=0; const calls=[];
 const e=new Engine(s,()=>{},{codexFactory: node => ({start:async(prompt,emit,_signal,options)=>{
   current++;peak=Math.max(peak,current);calls.push({prompt,node:{...node},options});emit({type:'thread.started',thread_id:node.id});await pause(20);current--;return `REPORT_${node.role}`;
 }})});
 const a=e.startDocument(input('A'));const b=e.startDocument(input('B'));
 await finish(e);
 assert.equal(peak,6);assert.equal(calls.length,8);assert.equal(a.status,'completed');assert.equal(b.status,'completed');
 assert.equal(new Set([...a.agents,...b.agents].map(n=>n.sessionId)).size,8);
 for (const run of [a,b]) {
  const lead=run.agents[0];assert.equal(lead.status,'completed');
  assert.match(lead.input,/REPORT_Context analyst/);assert.match(lead.input,/REPORT_Writer/);assert.match(lead.input,/REPORT_Critical reviewer/);
  for(const n of run.agents) {assert.equal(n.model,'gpt-6-luna');assert.match(n.input,/CURRENT_DOC/);assert.match(n.input,run.project==='A'?/ONLY_A/:/ONLY_B/);assert.doesNotMatch(n.input,run.project==='A'?/ONLY_B/:/ONLY_A/);}
  assert.equal(s.get('brain',run.memoryId).status,'proposed');
 }
}));
test('cancelling one team removes queued children and does not cancel another team', fixture(async s => {
 const e=new Engine(s,()=>{},{codexFactory: () => ({start:(_p,_ev,signal)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve('result'),35);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('cancelled'));},{once:true});})})});
 const a=e.startDocument({...input(),workers:6});const b=e.startDocument({...input('B'),workers:3});
 await pause(5);assert.ok(e.pool.queue.length);e.cancel(b.id);await finish(e);
 assert.equal(a.status,'completed');assert.equal(b.status,'cancelled');assert.ok(b.agents.every(n=>n.status==='cancelled'));assert.equal(b.memoryId,undefined);assert.equal(e.pool.used,0);assert.equal(e.pool.queue.length,0);
}));
test('subagent failure preserves partial reports and blocks synthesis; restart recovers agent states', fixture(async s => {
 const e=new Engine(s,()=>{},{codexFactory: node=>({start:async()=>{if(node.role==='Writer')throw new Error('auth failed');return 'partial';}})});
 const run=e.startDocument(input());await finish(e);assert.equal(run.status,'failed');assert.equal(run.agents[0].status,'blocked');assert.equal(run.memoryId,undefined);assert.equal(run.agents[1].output,'partial');
 s.put('run',{id:'unfinished',status:'running',agents:[{id:'worker',status:'running'},{id:'lead',status:'waiting'}]});
 const reopened=new Store(s.root);try{const recovered=reopened.get('run','unfinished');assert.equal(recovered.status,'interrupted');assert.ok(recovered.agents.every(n=>n.status==='interrupted'));}finally{reopened.close();}
}));
test('stopping one running subagent leaves siblings running and prevents a false combined success', fixture(async s => {
 const e=new Engine(s,()=>{},{codexFactory: () => ({start:(_p,_ev,signal)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve('surviving report'),30);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Stopped'));},{once:true});})})});
 const run=e.startDocument(input());await pause(5);assert.equal(e.cancel(run.id,run.agents[2].id),true);await finish(e);
 assert.equal(run.agents[2].status,'cancelled');assert.equal(run.agents[1].status,'completed');assert.equal(run.agents[3].status,'completed');assert.equal(run.status,'failed');assert.equal(run.memoryId,undefined);
}));
test('mixed Cline workers get distinct models, identical captured context and Codex lead receives reports',fixture(async s=>{
 const settings=s.settings();settings.providerId='cline';s.put('settings',settings);
 const calls=[];const e=new Engine(s,()=>{},{clineFactory:node=>({start:async(p,ev)=>{calls.push({node,p});ev({type:'thread.started',thread_id:node.id});return 'CLINE_REPORT_'+node.model;}}),codexFactory:()=>({start:async p=>{assert.match(p,/CLINE_REPORT_deepseek/);assert.match(p,/CLINE_REPORT_qwen/);return 'FINAL';}})});e.secrets.cline='test-key';
 const run=e.startDocument({...input(),workerBackend:'cline',workers:6});await finish(e);
 assert.equal(run.status,'completed');assert.equal(calls.length,6);assert.equal(new Set(calls.map(c=>c.node.model)).size,6);assert.ok(calls.every(c=>c.p.includes('CURRENT_DOC')));assert.ok(run.agents.slice(1).every(n=>n.backend==='cline'&&n.mark!=='codex'));assert.equal(run.agents[0].backend,'codex');assert.equal(s.get('brain',run.memoryId).body,'FINAL');
}));
test('mixed Cline validation fails before starting if credentials or selected model are invalid',fixture(async s=>{
 const e=new Engine(s);assert.throws(()=>e.startDocument({...input(),workerBackend:'cline'}),/Cline API key/);
 e.secrets.cline='test';const st=s.settings();st.providerId='cline';s.put('settings',st);
 assert.throws(()=>e.startDocument({...input(),workerBackend:'cline',workerModels:['invented']}),/supported budget model/);assert.equal(e.activeRuns.size,0);
}));
test('Cline child cancellation does not cancel siblings and blocks synthesis',fixture(async s=>{
 const st=s.settings();st.providerId='cline';s.put('settings',st);
 const e=new Engine(s,()=>{},{clineFactory:()=>({start:(_p,_ev,signal)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>resolve('REPORT'),35);signal.addEventListener('abort',()=>{clearTimeout(t);reject(Error('cancelled'));},{once:true});})}),codexFactory:()=>({start:async()=>{throw Error('Lead must not execute');}})});e.secrets.cline='test';
 const run=e.startDocument({...input(),workerBackend:'cline'});await pause(5);e.cancel(run.id,run.agents[1].id);await finish(e);assert.equal(run.agents[1].status,'cancelled');assert.equal(run.agents[2].status,'completed');assert.equal(run.agents[0].status,'blocked');assert.equal(run.memoryId,undefined);
}));
