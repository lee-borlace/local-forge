// Reconcile only native agent files and a standalone human CLI. OpenCode owns the plugin package.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { home, ocHome, digest, writeJson, readJson, inPath } from './config.js';
import { executable, runProcess } from './process.js';
const mf=()=>path.join(home(),'install-manifest.json');
const helper=()=>path.join(home(),'helper');
export const helperPath=()=>path.join(helper(),'cli.js');
const versionOf=source=>readJson(path.join(source,'package.json'),{}).version;
export const bundle=source=>readJson(path.join(source,'manifest.json'),null);
const hash=f=>fs.existsSync(f)?digest(fs.readFileSync(f)):null;
function safeTarget(base,target){
  if(!inPath(base,target)||base===target)throw Error('Invalid managed path: '+target);
  // Reject symlink/junction components, including dangling symlinks. User chooses the base via environment.
  for(let p=target;;p=path.dirname(p)){
    try{const s=fs.lstatSync(p);if(s.isSymbolicLink())throw Error('Symlink/junction in managed path: '+p);if(p!==target&&!s.isDirectory())throw Error('Not a directory: '+p);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(p===base)break;
  }
  return target;
}
function managedBase(file){for(const base of [path.join(ocHome(),'agents'),helper()])if(inPath(base,file)&&file!==base)return base;return null;}
function validatedTarget(file){const base=managedBase(file);if(!base)throw Error('Unmanaged destination: '+file);return safeTarget(base===helper()?home():ocHome(),file);}
function planned(source){const b=bundle(source);return [...b.agents.map(f=>[path.join(source,'content','agents',f),path.join(ocHome(),'agents',f)]),...b.helper.map(f=>[path.join(source,f),path.join(helper(),f)])].map(([from,to])=>({from,path:validatedTarget(to),hash:hash(from)}));}
function lock(name,fn){fs.mkdirSync(home(),{recursive:true,mode:0o700});safeTarget(home(),path.join(home(),name));const p=path.join(home(),name);let fd;try{fd=fs.openSync(p,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error(`LocalForge ${name} busy; retry after the other process exits. If crashed, remove ${p} manually only after checking no process is active.`);throw e;}try{fs.writeFileSync(fd,String(process.pid));return fn();}finally{fs.closeSync(fd);fs.unlinkSync(p);}}
async function dependencyLock(fn){fs.mkdirSync(home(),{recursive:true,mode:0o700});const p=safeTarget(home(),path.join(home(),'dependencies.lock'));let fd;try{fd=fs.openSync(p,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Dependency provisioning already active (or stale dependencies.lock). Retry later.');throw e;}try{fs.writeFileSync(fd,String(process.pid));return await fn();}finally{fs.closeSync(fd);fs.unlinkSync(p);}}
function atomicCopy(from,to,expected){validatedTarget(to);fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});if(hash(to)!==expected)throw Error('File changed during provisioning: '+to);if(expected===null){fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);return;}const tmp=to+'.'+crypto.randomUUID()+'.tmp';try{fs.copyFileSync(from,tmp,fs.constants.COPYFILE_EXCL);if(hash(to)!==expected)throw Error('File changed during provisioning: '+to);fs.renameSync(tmp,to);}finally{try{fs.unlinkSync(tmp);}catch{}}}
function prior(){const m=readJson(safeTarget(home(),mf()),null);if(m&&m.schemaVersion!==1)throw Error('Legacy LocalForge install detected. Run the v0.2 uninstall and remove its plugin directory before installing v0.3. See docs/INSTALLATION.md.');return m;}
function assertNoLegacy(){const legacy=path.join(ocHome(),'plugins','localforge','package.json');if(fs.existsSync(legacy))throw Error('Legacy copied LocalForge plugin detected. Remove/uninstall v0.2 before using the packaged plugin; see docs/INSTALLATION.md.');}
export function plan(source){const items=planned(source);return {version:versionOf(source),agents:items.filter(f=>inPath(path.join(ocHome(),'agents'),f.path)).map(f=>f.path),helper:items.filter(f=>inPath(helper(),f.path)).map(f=>f.path),config:path.join(home(),'config.json'),manifest:mf(),runtimeSkills:bundle(source).skills,mcp:bundle(source).serena,notes:'No native JSON(C) edits. No copied plugin. Dependencies require explicit consent.'};}
export function reconcile(source){assertNoLegacy();return lock('provision.lock',()=>{
  const old=prior(), oldMap=new Map((old?.files||[]).map(f=>[f.path,f.hash]));
  const items=planned(source);const installed=[],updated=[],reused=[],conflicts=[],retained=[],owned=new Map(oldMap);
  const backupRoot=path.join(home(),'backups',new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());
  const persist=()=>{const next={schemaVersion:1,version:versionOf(source),files:[...owned].map(([path,hash])=>({path,hash}))};if(JSON.stringify(readJson(mf(),null))!==JSON.stringify(next))writeJson(mf(),next);};
  for(const f of items){if(!f.hash)throw Error('Missing package payload: '+f.from);const current=hash(f.path),previous=oldMap.get(f.path);if(current===f.hash){reused.push(f.path);continue;}if(current!==null&&current!==previous){conflicts.push(f.path);continue;}if(current!==null){const backup=safeTarget(home(),path.join(backupRoot,digest(f.path).slice(0,16),path.basename(f.path)));fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});fs.copyFileSync(f.path,backup,fs.constants.COPYFILE_EXCL);}
    atomicCopy(f.from,f.path,current);owned.set(f.path,f.hash);persist();(current===null?installed:updated).push(f.path);
  }
  // Removed payloads: only remove files we own and that have not been modified.
  const desired=new Set(items.map(x=>x.path));for(const [f,h] of oldMap){if(desired.has(f))continue;validatedTarget(f);if(hash(f)===h){fs.unlinkSync(f);owned.delete(f);}else if(!fs.existsSync(f)){owned.delete(f);}else{retained.push(f);}}
  const config=safeTarget(home(),path.join(home(),'config.json'));let configCreated=false;if(!fs.existsSync(config)){fs.copyFileSync(path.join(source,bundle(source).defaultConfig),config,fs.constants.COPYFILE_EXCL);try{fs.chmodSync(config,0o600);}catch{}configCreated=true;}
  persist();return {version:versionOf(source),installed,updated,reused,conflicts,retained,config,configCreated,helper:helperPath(),manifest:mf(),agentChanged:[...installed,...updated].some(f=>inPath(path.join(ocHome(),'agents'),f)),backup:updated.length?backupRoot:null};
});}
export function cleanup(){return lock('provision.lock',()=>{const m=prior();if(!m)return {removed:[],retained:[],notes:'No managed files.'};const removed=[],retained=[];for(const f of m.files){validatedTarget(f.path);if(!fs.existsSync(f.path))continue;if(hash(f.path)!==f.hash){retained.push(f.path);continue;}fs.unlinkSync(f.path);removed.push(f.path);}fs.unlinkSync(mf());return {removed,retained,notes:'User config, session state, backups, Serena/uv and existing native MCP configuration remain. Remove the package from OpenCode first.'};});}
// Prerequisites: fixed programs/arguments only; never execute a repository script.
export function findProgram(name,root){const suffix=process.platform==='win32'?'.exe':'';const candidates=[name,path.join(os.homedir(),'.local','bin',name+suffix),path.join(os.homedir(),'.cargo','bin',name+suffix)];if(process.env.LOCALAPPDATA)candidates.push(path.join(process.env.LOCALAPPDATA,'Microsoft','WinGet','Links',name+suffix));for(const c of candidates){const p=executable(c,root);if(p&&!/\.(cmd|bat)$/i.test(p))return p;}return null;}
async function checked(program,args){const r=await runProcess(program,args,{cwd:os.homedir(),timeout:600000,maxBytes:131072});if(r.status!=='passed')throw Error(`${path.basename(program)} ${args.join(' ')} failed (${r.status}): ${r.output.slice(-1500)} ${r.error||''}`);return r.output;}
export async function provisionSerena(source,{root,consent=false,installUv=false}={}){
  const b=bundle(source).serena;let serena=findProgram('serena',root);if(serena)return {status:'available',executable:serena};if(!consent)return {status:'missing',message:'Serena not found. Run /localforge-setup-serena to approve installation, or enable installDependencies in plugin options.'};
  return dependencyLock(async()=>{serena=findProgram('serena',root);if(serena)return {status:'available',executable:serena};let uv=findProgram('uv',root);
    if(!uv&&installUv){const choices=process.platform==='win32'?['winget',['install','--id','astral-sh.uv','-e','--accept-package-agreements','--accept-source-agreements']]:process.platform==='darwin'?['brew',['install','uv']]:['pipx',['install','uv']];const pm=findProgram(choices[0],root);if(!pm)throw Error('No supported package manager found. Install uv from https://docs.astral.sh/uv/getting-started/installation/ first.');await checked(pm,choices[1]);uv=findProgram('uv',root);}
    if(!uv)throw Error('uv missing. Install uv or explicitly allow uv provisioning (installUv:true). Restart OpenCode if PATH changed.');await checked(uv,['tool','install','-p',b.python,b.package]);serena=findProgram('serena',root);if(!serena){const bin=(await checked(uv,['tool','dir','--bin'])).trim();if(path.isAbsolute(bin))serena=executable(path.join(bin,'serena'+(process.platform==='win32'?'.exe':'')),root);}if(!serena)throw Error('Serena installation finished but executable not found; restart OpenCode.');return {status:'installed',executable:serena};
  });
}
export function skillDefinitions(source){return bundle(source).skills.map(id=>{const file=path.join(source,'content','skills',id,'SKILL.md');const raw=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');const m=raw.match(/^---\nname: ([^\n]+)\ndescription: ([^\n]+)\n---\n([\s\S]*)$/);if(!m||m[1]!==id)throw Error('Invalid bundled skill: '+id);return {id,name:m[1],description:m[2],path:file,content:m[3].trim()};});}
export function serenaDefinition(source,program){const b=bundle(source).serena,template=readJson(path.join(source,b.template),null);return {...template,command:[program,...template.command.slice(1)]};}
