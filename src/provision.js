// Public OpenCode lifecycle integration. No shell or nested OpenCode invocation.
import { reconcile, provisionSerena, skillDefinitions, serenaDefinition, bundle, helperPath } from './install.js';

export async function provisionPlugin(ctx,source,root){
  let deployment;
  // Concurrent startup can overlap the short synchronous file reconciliation.
  for(let i=0;;i++){try{deployment=reconcile(source);break;}catch(e){if(i>=4||!String(e.message).includes('provision.lock busy'))throw e;await new Promise(r=>setTimeout(r,150*(i+1)));}}
  const notices=[];
  if(deployment.conflicts.length)notices.push('Preserved conflicting files: '+deployment.conflicts.join(', '));
  if(deployment.agentChanged&&ctx.agent?.reload){try{await ctx.agent.reload();}catch(e){notices.push('Agent reload failed; restart OpenCode: '+e.message);}}
  else if(deployment.agentChanged)notices.push('Restart OpenCode if newly installed agents do not appear.');
  const skills=skillDefinitions(source);
  const skillCollisions=new Set();
  if(!ctx.skill?.transform)throw Error('LocalForge requires OpenCode v2 skill transform API.');
  await ctx.skill.transform(editor=>{skillCollisions.clear();for(const def of skills){if(editor.get(def.id)){skillCollisions.add(def.id);continue;}editor.add({...def});}});
  let dependency={status:'not checked'},server='not registered';
  const readDependency=async (consent,allowUv=ctx.options?.installUv===true)=>{try{dependency=await provisionSerena(source,{root,consent,installUv:consent&&allowUv});}catch(e){dependency={status:'failed',message:e.message};}};
  await readDependency(ctx.options?.installDependencies===true);
  if(!ctx.mcp?.transform)throw Error('LocalForge requires OpenCode v2 MCP transform API.');
  const name=bundle(source).serena.server;
  await ctx.mcp.transform(editor=>{
    // Preserve an already configured Serena (even if disabled). Never overwrite native MCP config.
    const existing=editor.get(name)||editor.get('serena');
    if(existing){server='existing Serena definition preserved; inspect connection and tool interface';return;}
    if(!dependency.executable){server='not registered; Serena unavailable';return;}
    editor.set(name,serenaDefinition(source,dependency.executable));server='registered (connection not yet verified)';
  });
  const status=()=>({version:deployment.version,deployment,skills:skills.map(s=>s.id),preservedSkillIds:[...skillCollisions],serena:dependency,server,helper:helperPath(),notices,limitations:'Registration is not a live connection test. Use /mcps and inspect the agent tool catalogue.'});
  if(ctx.command?.transform&&ctx.session?.synthetic){
    const say=async(sessionID,obj)=>{await ctx.session.synthetic({sessionID,text:'LocalForge\n'+JSON.stringify(obj,null,2)});};
    await ctx.command.transform(editor=>{
      editor.add({name:'localforge-status',description:'Inspect LocalForge installed files, conflicts and dependencies (no model call)',execute:async({sessionID})=>say(sessionID,status())});
      editor.add({name:'localforge-doctor',description:'Inspect LocalForge registration, dependency presence and agent availability',execute:async({sessionID})=>{let agents='unavailable',mcp='unavailable';try{agents=(await ctx.agent.list()).map(a=>a.id);}catch{}try{mcp=await ctx.mcp.list();}catch{}await say(sessionID,{...status(),agents,mcp});}});
      editor.add({name:'localforge-repair',description:'Reconcile unchanged managed files and rediscover installed Serena; no downloads',execute:async({sessionID})=>{try{deployment=reconcile(source);if(deployment.agentChanged)await ctx.agent?.reload?.();await readDependency(false);await ctx.mcp.reload();await say(sessionID,status());}catch(e){await say(sessionID,{error:e.message});}}});
      // This is an explicit user slash command, not an LLM tool. It permits only the fixed upstream install.
      editor.add({name:'localforge-setup-serena',description:'Approve installation of pinned Serena via uv, including uv if missing',execute:async({sessionID})=>{await readDependency(true,true);try{await ctx.mcp.reload();}catch(e){notices.push('MCP reload failed: '+e.message);}await say(sessionID,status());}});
    });
  }else notices.push('Runtime slash commands unavailable; use the installed helper CLI.');
  if(deployment.installed.length||deployment.updated.length||deployment.conflicts.length||dependency.status==='missing'||dependency.status==='failed')console.info('[LocalForge] '+JSON.stringify(status()));
  return status();
}
