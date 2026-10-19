import test from 'node:test';import assert from 'node:assert/strict';import {ClineAdapter} from './cline-adapter.mjs';
test('Cline adapter uses gateway key and no tools, returns only completed output',async()=>{
 let config;const adapter=new ClineAdapter('test','qwen/test',c=>{config=c;return {run:async()=>({status:'completed',outputText:'answer',runId:'session'})};});
 assert.equal(await adapter.start('context',()=>{},new AbortController().signal),'answer');assert.equal(config.providerId,'cline');assert.equal(config.apiKey,'test');assert.deepEqual(config.tools,[]);
 const failed=new ClineAdapter('test','model',()=>({run:async()=>({status:'failed',outputText:'partial',error:Error('denied')})}));await assert.rejects(failed.start('x',()=>{},new AbortController().signal),/denied/);
});
test('Cline adapter propagates cancellation to SDK and never returns aborted text',async()=>{
 const controller=new AbortController();let aborted=false,finish;const adapter=new ClineAdapter('test','model',()=>({run:()=>new Promise(r=>{finish=r;}),abort:()=>{aborted=true;finish({status:'completed',outputText:'partial'});}}));
 const task=adapter.start('x',()=>{},controller.signal);controller.abort();await assert.rejects(task);assert.equal(aborted,true);
});

test('Cline retries rate limits twice with visible events, then succeeds', async () => {
 let attempts=0;const delays=[],events=[];
 const adapter=new ClineAdapter('test','model',()=>({run:async()=>++attempts<3 ? {status:'failed',error:Error('status 429 upstream')} : {status:'completed',outputText:'ok',runId:'s'}}),async ms=>delays.push(ms));
 assert.equal(await adapter.start('x',e=>events.push(e),new AbortController().signal),'ok');assert.deepEqual(delays,[2000,5000]);assert.equal(events.filter(e=>e.type==='agent.retry').length,2);
});
test('Cline exhausts rate limits with concise error and cancels retry waits', async () => {
 let attempts=0;
 const adapter=new ClineAdapter('test','model',()=>({run:async()=>{attempts++;throw Error('429 secret upstream response');}}),async()=>{});
 await assert.rejects(adapter.start('x',()=>{},new AbortController().signal),/Two retries did not succeed/);assert.equal(attempts,3);
 const controller=new AbortController();attempts=0;
 const cancelled=new ClineAdapter('test','model',()=>({run:async()=>{attempts++;throw Error('429');}}),async(_ms,signal)=>{controller.abort();signal.throwIfAborted();});
 await assert.rejects(cancelled.start('x',()=>{},controller.signal));assert.equal(attempts,1);
});
