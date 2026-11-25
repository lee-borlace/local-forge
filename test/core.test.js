import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {DEFAULTS,loadConfig,profileFor,digest,writeJson} from '../src/config.js';
import {Workspace} from '../src/files.js';
import {Store} from '../src/state.js';
import {discover,diagnostics,gitRun} from '../src/adapters.js';
import {runProcess,compactOutput} from '../src/process.js';
import {boundRead,allowedTool} from '../src/context.js';
import {shellAlternative} from '../index.js';
function fixture(t,extra={}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lf-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const root=path.join(dir,'repo');fs.mkdirSync(root);return {dir,root,ws:new Workspace(root,{...DEFAULTS,...extra})};}
function file(root,name,content){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);}
const h=s=>digest(s).slice(0,10);
test('protected paths, traversal, absolute paths and agent configuration blocked',t=>{const {root,ws}=fixture(t);for(const p of ['../outside','/etc/passwd','C:\\secrets','.git/config','.env','thing:stream'])assert.throws(()=>ws.resolve(p,{missing:true}));for(const p of ['.opencode/plugin.js','opencode.json','AGENTS.md','agents.md'])assert.throws(()=>ws.resolve(p,{write:true,missing:true}));assert.ok(root);});
test('symlinks cannot escape checkout',t=>{const {dir,root,ws}=fixture(t);file(dir,'outside','secret');try{fs.symlinkSync(path.join(dir,'outside'),path.join(root,'link'));}catch(e){if(e.code==='EPERM')return t.skip('symlinks not permitted');throw e;}assert.throws(()=>ws.text('link'),/Symbolic/);});
test('binary data rejected',t=>{const {root,ws}=fixture(t);file(root,'bin.dat',Buffer.from([0,1,2]));assert.throws(()=>ws.text('bin.dat'),/Binary/);});
test('project detection is read-only and trusts no scripts automatically',t=>{const {root,ws}=fixture(t);file(root,'package.json',JSON.stringify({scripts:{test:'node -e "throw Error()"',build:'echo build'}}));const before=fs.readdirSync(root);const d=discover(ws);assert.ok(d.types.includes('node'));assert.ok(d.recipes.some(r=>r.id==='node-test'));assert.deepEqual(fs.readdirSync(root),before);assert.equal(ws.cfg.trustedProjects.length,0);});
test('recipe fingerprint changes when manifest changes',t=>{const {root,ws}=fixture(t);file(root,'package.json','{"scripts":{"test":"echo a"}}');const f=discover(ws).recipes[0].fingerprint;file(root,'package.json','{"scripts":{"test":"echo b"}}');assert.notEqual(discover(ws).recipes[0].fingerprint,f);});
test('generic projects work with no repository preparation',t=>{const {root,ws}=fixture(t);file(root,'notes.txt','hello');assert.deepEqual(discover(ws).types,['generic']);assert.equal(ws.text('notes.txt').text,'hello');});
test('JSON and JS diagnostic results distinguish unavailable and failed',async t=>{const {root,ws}=fixture(t);file(root,'x.json','{');file(root,'x.js','function () {');file(root,'x.cs','class X{}');assert.equal((await diagnostics(ws,'x.json')).status,'failed');assert.equal((await diagnostics(ws,'x.js')).status,'failed');assert.equal((await diagnostics(ws,'x.cs')).status,'unavailable');});
test('structured process returns accurate exit status, not shell evaluation',async t=>{const {root}=fixture(t);const r=await runProcess(process.execPath,['-e','console.log(process.argv[1]); process.exit(3)','a; echo nope'],{cwd:root});assert.equal(r.exitCode,3);assert.equal(r.status,'failed');assert.match(r.output,/a; echo nope/);});
test('process timeout and cancellation',async t=>{const {root}=fixture(t);const r=await runProcess(process.execPath,['-e','setTimeout(()=>{},10000)'],{cwd:root,timeout:100});assert.equal(r.status,'timeout');const ac=new AbortController();const p=runProcess(process.execPath,['-e','setTimeout(()=>{},10000)'],{cwd:root,signal:ac.signal});ac.abort();assert.equal((await p).status,'cancelled');});
test('bounded process output reports capture truncation',async t=>{const {root}=fixture(t);const r=await runProcess(process.execPath,['-e','console.log("x".repeat(50000))'],{cwd:root,maxBytes:1000});assert.equal(r.truncated,true);assert.equal(r.output.length,1000);assert.ok(compactOutput('a\n'.repeat(8000),1000).length<1000);});
test('task/output isolation by repo and session',t=>{const {dir,root}=fixture(t);const a=new Store(dir,root,'a',DEFAULTS), b=new Store(dir,root,'b',DEFAULTS);a.updateTask({objective:'fix it'});assert.equal(a.task().objective,'fix it');assert.equal(b.task().objective,'');const id=a.output('details').id;assert.equal(a.readOutput(id).text,'details');assert.throws(()=>b.readOutput(id));assert.throws(()=>a.readOutput('../bad'));});
test('verification status invalidated by edits',t=>{const {dir,root}=fixture(t);const a=new Store(dir,root,'a',DEFAULTS);a.markCheck('test',{status:'passed'});assert.equal(a.status().checks.length,1);a.markEdit('a');assert.equal(a.status().checks.length,0);assert.equal(a.status().epoch,1);});
test('identical actions count only when observed state matches',t=>{const {dir,root}=fixture(t);const a=new Store(dir,root,'a',DEFAULTS);assert.equal(a.action('read',{p:'x'},'1'),1);assert.equal(a.action('read',{p:'x'},'1'),2);assert.equal(a.action('read',{p:'x'},'2'),1);});
test('shell fallback creates only a pending record and rejects other session access',t=>{const {dir,root}=fixture(t);const a=new Store(dir,root,'a',DEFAULTS),b=new Store(dir,root,'b',DEFAULTS);const request=a.request('touch NEVER','no dedicated tool','create file');assert.equal(a.shellResult(request.id).state,'pending');assert.equal(fs.existsSync(path.join(root,'NEVER')),false);assert.throws(()=>b.shellResult(request.id));assert.equal(shellAlternative('git status'),'lf_git');assert.equal(shellAlternative('git diff HEAD~2'),null);});
test('strict model profile hides shell, code mode, subagents, unknown tools',()=>{for(const tool of ['shell','execute','subagent','webfetch','other_tool','serena_replace_symbol_body'])assert.equal(allowedTool(tool,DEFAULTS,'strict'),false);for(const tool of ['edit','read','lf_request_shell','localforge_serena_find_symbol'])assert.equal(allowedTool(tool,DEFAULTS,'strict'),true);assert.equal(profileFor({providerID:'anthropic',id:'whatever'},DEFAULTS),'off');assert.equal(profileFor({providerID:'local',id:'qwen'},{...DEFAULTS,profiles:[{provider:'local',profile:'strict'}]}),'strict');assert.equal(profileFor({providerID:'unknown',id:'qwen'},DEFAULTS),'off');});
test('git inspection works in disposable repository',async t=>{const {root,ws}=fixture(t);const g=spawnSync('git',['init','-q'],{cwd:root});if(g.status!==0)return t.skip('git unavailable');file(root,'note.txt','hello');const r=await gitRun(ws,'status');assert.equal(r.status,'passed');assert.match(r.output,/note.txt/);});
test('native read pagination capped with existing offset preserved',()=>{const a={path:'a',offset:120,limit:2000};boundRead(a,120);assert.deepEqual(a,{path:'a',offset:120,limit:120});const b={path:'b'};boundRead(b,120);assert.equal(b.limit,120);const c={limit:3};boundRead(c,120);assert.equal(c.limit,3);});

import {modelWindow,limitsFor} from '../src/context.js';
test('tool caps adapt to the model window and stay at ceilings when it is unknown', () => {
  assert.deepEqual(limitsFor(null,DEFAULTS),{readLines:DEFAULTS.maxReadLines,outputChars:DEFAULTS.maxOutputChars});
  assert.deepEqual(limitsFor(modelWindow({limit:{context:131072,output:8192}}),DEFAULTS),{readLines:120,outputChars:8000});
  const small=limitsFor(modelWindow({limit:{context:8192,input:4096,output:2048}}),DEFAULTS);
  assert.equal(small.readLines,42);assert.equal(small.outputChars,2000);
  assert.equal(modelWindow({limit:{context:0}}),null);assert.equal(modelWindow(undefined),null);
  assert.equal('effectiveContextTokens' in DEFAULTS,false);
});

import {serenaDefinition} from '../src/install.js';
test('Serena MCP definition pins the protocol revision Serena serves', () => {
  const def=serenaDefinition(path.resolve('.'),'serena');
  assert.equal(def.protocol,'2026-07-28');assert.equal(def.command[0],'serena');assert.equal(def.type,'local');
});
