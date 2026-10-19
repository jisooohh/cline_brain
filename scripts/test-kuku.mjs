import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'kuku-tests-'));
try {
 await build({entryPoints:['scripts/kuku-roundtrip.test.ts'],outfile:join(dir,'tests.cjs'),bundle:true,platform:'node',format:'cjs',define:{'import.meta.env.DEV':'false'},logLevel:'warning'});
 const result=spawnSync(process.execPath,['--test',join(dir,'tests.cjs')],{stdio:'inherit'});process.exitCode=result.status??1;
}finally{rmSync(dir,{recursive:true,force:true});}
