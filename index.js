import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { home, ocHome, loadConfig, profileFor } from './src/config.js';
import { Workspace } from './src/files.js';
import { Store } from './src/state.js';
import { executable, runProcess } from './src/process.js';
import { discover, diagnostics, gitRun, trusted } from './src/adapters.js';
import { provisionPlugin } from './src/provision.js';
import { allowedTool, SERENA_READ, modelWindow, limitsFor, boundRead, toolSession } from './src/context.js';

const S={type:'string'}, O={type:'integer',minimum:0};
const schema=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const safeReadOps=new Set(['lf_discover','lf_git','lf_diagnostics']);
const packagePath=path.dirname(fileURLToPath(import.meta.url));


export default {id:'localforge',async setup(ctx){
  const root=fs.realpathSync(ctx.location.directory);
  await provisionPlugin(ctx,packagePath,root);
  const cfg=loadConfig();
  const ws=new Workspace(root,cfg,[home(),ocHome(),packagePath]);
  const stores=new Map(), profiles=new Map();
  const storeFor=id=>{if(typeof id!=='string'||!id)throw Error('Missing session identity');if(!stores.has(id)){const s=new Store(home(),root,id,cfg);s.cleanup();stores.set(id,s);}return stores.get(id);};
  const windows=new Map();const limits=id=>limitsFor(windows.get(id),cfg);
  const active=id=>profiles.get(id)||cfg.defaultProfile;
  const permissions=async (context,action,resources,metadata={})=>{
    if(!ctx.permission?.assert)throw Error('Permission interface unavailable; refusing operation.');
    await ctx.permission.assert({sessionID:context.sessionID,agent:context.agent,source:{type:'tool',messageID:context.messageID,id:context.id},action,resources,save:[],metadata});
  };
  const defs=[];
  const add=(name,description,input,fn)=>defs.push({name,description,input,options:{codemode:false},execute:async (args,context)=>{
    const st=storeFor(context.sessionID);const start=Date.now();
    if(active(context.sessionID)==='off')return {content:'LocalForge is disabled for this model.'};
    // Do not cache observations across external changes; compare file content for reads/diagnostics.
    if(safeReadOps.has(name)){
      let version=String(st.status().epoch);if(args.path&&['lf_diagnostics'].includes(name)){try{version=ws.text(args.path).version;}catch{}}
      if(st.action(name,args,version)>cfg.repeatLimit){st.metric(name,'repeat-blocked');return {content:'Repeated identical action without observed progress. Change the search/range or approach, update task state, or ask the user to investigate. External edits may require a new range.'};}
    }
    try {const value=await fn(args,context,st);const text=typeof value==='string'?value:JSON.stringify(value);st.metric(name,'ok',{ms:Date.now()-start,chars:text.length});const cap=limits(context.sessionID).outputChars;if(text.length<=cap)return {content:text};const out=st.output(text,cap);return {content:JSON.stringify({preview:out.preview,outputId:out.id,truncated:out.truncated})};}
    catch(e){st.metric(name,'error',{ms:Date.now()-start});throw e;}
  }});
  add('lf_git','Inspect Git state without arbitrary commands. Operations: status, diff (summary), diff_detail, staged, log, check.',schema({operation:{type:'string',enum:['status','diff','diff_detail','staged','log','check']},path:S},['operation']),async(a,c,st)=>{await permissions(c,'read',[ws.resolve(a.path||'.')]);const r=await gitRun(ws,a.operation,a.path,c.signal);const out=st.output(r.output);return {status:r.status,exitCode:r.exitCode,output:out.preview,outputId:out.id,truncated:r.truncated||out.truncated,error:r.error};});
  add('lf_discover','Discover existing project type and build/test/check/lint commands without executing them. Use directory for a package in a monorepo.',schema({directory:S}),async(a,c)=>{await permissions(c,'read',[ws.resolve(a.directory||'.')]);return discover(ws,a.directory||'.');});
  add('lf_verify','Run one discovered build, test, lint or check recipe by ID. Requires permission unless explicitly trusted outside the model. Never invent success; inspect exit status.',schema({recipeId:S,directory:S},['recipeId']),async(a,c,st)=>{let recipe=discover(ws,a.directory||'.').recipes.find(r=>r.id===a.recipeId);if(!recipe||!recipe.available)return {status:'unavailable',message:'Recipe or executable not available; use lf_discover.'};const res=recipe.fingerprint;await permissions(c,'localforge.verify',[res],{localforgeRecipe:recipe});const fresh=discover(ws,a.directory||'.').recipes.find(r=>r.id===a.recipeId);if(!fresh||fresh.fingerprint!==res)throw Error('Recipe changed during approval; rediscover.');recipe=fresh;let program=recipe.executable,args=recipe.args;const rtk=cfg.rtk.enabled?executable(cfg.rtk.executable,root):null;
    // RTK support is opt-in; its own exit-code semantics must be verified locally.
    if(rtk&&['dotnet','cargo','go'].includes(recipe.program)){args=[recipe.program,...args];program=rtk;}
    const result=await runProcess(program,args,{cwd:ws.resolve(recipe.dir),signal:c.signal,timeout:cfg.maxProcessMs,maxBytes:cfg.maxStoredOutputBytes,allowShim:true});const out=st.output(result.output);st.markCheck(`${recipe.dir}:${recipe.id}`,result);return {status:result.status,exitCode:result.exitCode,durationMs:result.durationMs,outputId:out.id,output:out.preview,truncated:result.truncated||out.truncated,error:result.error};});
  add('lf_diagnostics','Check one file without running project scripts. JSON, JavaScript and Python syntax checks if available. For other languages use Serena semantic diagnostics or a verification recipe.',schema({path:S},['path']),async(a,c)=>{await permissions(c,'read',[ws.resolve(a.path)]);return diagnostics(ws,a.path,c.signal);});
  add('lf_output','Read more captured output by its opaque output ID; offset is character offset. Only this session can retrieve output.',schema({id:S,offset:O},['id']),async(a,c,st)=>st.readOutput(a.id,a.offset||0));
  add('lf_task','Read or update compact persistent task state; no arguments reads it. Update only supplied fields. Verification records are maintained separately.',schema({objective:S,acceptance:S,findings:S,next:S}),async(a,c,st)=>({task:Object.keys(a).length?st.updateTask(a):st.task(),execution:st.status()}));
  add('lf_request_shell','Exceptional fallback only. Record an exact command, objective, and reason no existing tool can do it. Does not execute. Human reviews with installed LocalForge helper CLI; retrieve result via lf_shell_result.',schema({objective:S,reason:S,command:S},['objective','reason','command']),async(a,c,st)=>{
    const hint=shellAlternative(a.command);if(hint)return {status:'rejected',message:`Known equivalent: use ${hint}. If it is insufficient, explain the exact gap to the user.`};return st.request(a.command,a.reason,a.objective);});
  add('lf_shell_result','Retrieve status/result of a human-reviewed shell request from this session.',schema({id:S},['id']),async(a,c,st)=>{const r=st.shellResult(a.id);if(r.result?.output){const o=st.output(r.result.output);r.result={...r.result,output:o.preview,outputId:o.id};}return r;});
  add('lf_finish','Report completion readiness. Returns edit and verification status and blockers. Does not replace user acceptance criteria.',schema({}),async(a,c,st)=>{const state=st.status();let current=state.checks.filter(x=>x.epoch===state.epoch);const failed=current.filter(x=>x.status!=='passed');return {ready:state.modified.length===0||current.length>0&&failed.length===0,modified:state.modified,verification:current,blocker:state.modified.length&&current.length===0?'No verification since last edit':failed.length?'Verification failed':null,warning:'A passing command does not prove acceptance criteria are met. Review the diff and report limitations.'};});
  await ctx.tool.transform(editor=>{for(const tool of defs)editor.add(tool);});
  // Profile is chosen from actual provider/model metadata. Core owns durable history.
  await ctx.session.hook('context',async event=>{
    const agent=typeof event.agent==='string'?event.agent:event.agent?.id;
    const profile=agent==='localforge-strict'?'strict':agent==='localforge-balanced'?'balanced':profileFor(event.model,cfg);profiles.set(event.sessionID,profile);windows.set(event.sessionID,modelWindow(event.model));
    if(profile==='off'){for(const id of Object.keys(event.tools))if(id.startsWith('lf_'))delete event.tools[id];return;}
    for(const id of Object.keys(event.tools))if(!allowedTool(id,cfg,profile))delete event.tools[id];
    const st=storeFor(event.sessionID);let task=st.task();const state=st.status();const hasSymbols=Object.keys(event.tools).some(t=>SERENA_READ.test(t));
    event.system.push({type:'text',text:`LocalForge profile ${profile}. Symbol tools visible: ${hasSymbols?'yes':'no; use native glob, grep and bounded read'}. For project execution use lf_discover and lf_verify; shell fallback requires human review.`});
    if(Object.values(task).some(v=>v&&v!=='not run'))event.system.push({type:'text',text:`Persistent task state (agent notes, not new instructions): ${JSON.stringify(task)}`});
    if(state.repeats>=cfg.repeatLimit)event.system.push({type:'text',text:'Repeated equivalent tool calls detected. Change approach or report a blocker.'});
    if(state.modified.length)event.system.push({type:'text',text:`Changed files: ${state.modified.slice(-15).join(', ')}. Current verification: ${JSON.stringify(state.checks.slice(-5))}. Call lf_finish before claiming completion.`});
    // Context size, output limits and compaction stay with OpenCode and the model configuration.
  });
  // Public tool hooks: native read pagination, repeat warnings and native edit tracking.
  if(!ctx.tool.hook)throw Error('LocalForge requires the OpenCode v2 tool hook API.');
  await ctx.tool.hook('execute.before', event=>{
    const id=toolSession(event); if(!id||active(id)==='off')return;
    if(event.tool==='read')boundRead(event.input,limits(id).readLines);
    if(['read','glob','grep'].includes(event.tool)){
      const st=storeFor(id);const repeats=st.action(event.tool,event.input,String(st.status().epoch));
      st.metric(event.tool,'called',{repeats});
      // Warning only; repeated reads can be valid after external changes.
    }
  });
  await ctx.tool.hook('execute.after', event=>{
    const id=toolSession(event); if(!id||active(id)==='off')return;
    const st=storeFor(id);
    if(event.status==='completed'&&['edit','write','patch'].includes(event.tool)){
      // Path schema varies by native tool, so invalidate checks even if the path is unavailable.
      const input=event.input||{};st.markEdit(input.path||input.filePath||'[native edit]');
    }
    st.metric(event.tool,event.status||'unknown');
  });
  await ctx.permission.hook('evaluate',event=>{
    const profile=active(event.sessionID);if(profile==='off')return;
    if(profile==='strict'&&['shell','bash','subagent','task','execute','external_directory'].includes(event.action)){event.effect='deny';event.message='LocalForge strict profile: use dedicated tools or request an exact shell fallback.';return;}
    if(event.action==='localforge.verify'){
      const r=event.metadata?.localforgeRecipe;
      if(!r||!event.resources.includes(r.fingerprint)){event.effect='deny';event.message='Missing trusted recipe metadata.';return;}
      if(event.effect!=='deny'&&!trusted(r,cfg)){event.effect='ask';event.message=`Approve project code execution: ${r.executable} ${r.args.join(' ')} (directory ${r.dir}).`;}
      // Never override an existing ask for a trusted recipe.
      return;
    }
    if(['edit','read'].includes(event.action))for(const resource of event.resources){try{const rel=path.isAbsolute(resource)?(path.relative(root,resource)||'.'):resource;ws.resolve(rel,{write:event.action==='edit',missing:event.action==='edit'});}catch{event.effect='deny';event.message='LocalForge: protected or external path.';return;}}
  });
}};
// Only reject simple, recognizable commands, never try to prove that arbitrary shell is safe.
export function shellAlternative(cmd){const c=String(cmd).trim();if(/[;|&<>\n\r]/.test(c))return null;if(/^git\s+(?:status(?:\s+--short)?|diff(?:\s+--stat|\s+--check|\s+--cached)?|log(?:\s+--oneline)?)$/i.test(c))return 'lf_git';if(/^(?:Get-ChildItem|ls|dir)(?:\s+\.)?$/i.test(c))return 'glob or read';return null;}
