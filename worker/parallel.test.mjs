import test from 'node:test';
import assert from 'node:assert/strict';
import { parallelRequest } from './adapters.mjs';
test('Parallel search sends result limits inside current advanced_settings contract', async () => {
 const original=globalThis.fetch; let sent;
 try {globalThis.fetch=async (_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({results:[{title:'Tauri',url:'https://tauri.app'}]})};};
 const result=await parallelRequest('test-only','search',{search_queries:['Tauri official documentation'],max_results:1});
 assert.equal(sent.max_results,undefined);assert.equal(sent.advanced_settings.max_results,1);assert.equal(sent.mode,'basic');assert.equal(result.results.length,1);
 }finally{globalThis.fetch=original;}
});
