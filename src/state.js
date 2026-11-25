import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { digest, writeJson, readJson } from './config.js';
import { compactOutput } from './process.js';
const validId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
export class Store {
  constructor(base,root,session,cfg){this.base=base;this.root=root;this.session=String(session);this.cfg=cfg;this.dir=path.join(base,'sessions',digest(root).slice(0,24),digest(this.session).slice(0,24));fs.mkdirSync(this.dir,{recursive:true,mode:0o700});}
  task(){return readJson(path.join(this.dir,'task.json'),{objective:'',acceptance:'',findings:'',next:'',verification:'not run'});}
  updateTask(input){const task=this.task();for(const k of ['objective','acceptance','findings','next'])if(Object.hasOwn(input,k)){if(typeof input[k]!=='string')throw Error(`${k} must be a string`);task[k]=input[k];}if(JSON.stringify(task).length>this.cfg.maxTaskChars)throw Error('Task state exceeds budget. Replace stale findings with a concise summary.');writeJson(path.join(this.dir,'task.json'),task);return task;}
  status(){return readJson(path.join(this.dir,'status.json'),{epoch:0,modified:[],checks:[],lastAction:null,repeats:0});}
  updateStatus(fn){const st=this.status();fn(st);writeJson(path.join(this.dir,'status.json'),st);return st;}
  action(name,input,version=''){const fingerprint=digest(JSON.stringify([name,input,version]));const st=this.updateStatus(s=>{s.repeats=s.lastAction===fingerprint?s.repeats+1:1;s.lastAction=fingerprint;});return st.repeats;}
  markEdit(file){this.updateStatus(s=>{s.epoch++;s.modified=[...new Set([...s.modified,file])].slice(-100);s.checks=[];});}
  markCheck(kind,result){this.updateStatus(s=>{s.checks=[...s.checks.filter(c=>c.kind!==kind),{kind,status:result.status,epoch:s.epoch,at:new Date().toISOString()}].slice(-20);});}
  output(text){const id=crypto.randomBytes(16).toString('hex');const file=path.join(this.dir,'outputs',id+'.txt');fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const data=Buffer.from(text);fs.writeFileSync(file,data.subarray(0,this.cfg.maxStoredOutputBytes),{mode:0o600,flag:'wx'});return {id,preview:compactOutput(text,this.cfg.maxOutputChars-1000),storedBytes:Math.min(data.length,this.cfg.maxStoredOutputBytes),truncated:data.length>this.cfg.maxStoredOutputBytes};}
  readOutput(id,offset=0){if(!validId(id)||!Number.isInteger(offset)||offset<0)throw Error('Invalid output ID or offset.');const file=path.join(this.dir,'outputs',id+'.txt');const text=fs.readFileSync(file,'utf8');const page=text.slice(offset,offset+this.cfg.maxOutputChars-500);return {id,offset,next:offset+page.length<text.length?offset+page.length:null,text:page};}
  metric(tool,status,extra={}){if(!this.cfg.telemetry)return;try{fs.appendFileSync(path.join(this.dir,'metrics.jsonl'),JSON.stringify({at:new Date().toISOString(),tool,status,...extra})+'\n',{mode:0o600});}catch{}}
  request(command,reason,objective){if(typeof command!=='string'||!command.trim()||command.length>12000||command.includes('\0'))throw Error('Invalid shell command.');if(typeof reason!=='string'||!reason.trim()||typeof objective!=='string'||!objective.trim())throw Error('Explain why existing tools are insufficient.');const id=crypto.randomBytes(16).toString('hex');writeJson(path.join(this.base,'requests',id+'.json'),{id,root:this.root,session:this.session,command,reason:reason.slice(0,2000),objective:objective.slice(0,1000),created:new Date().toISOString(),state:'pending'});return {id,state:'pending',message:`Human review required: node "${path.join(this.base,'helper','cli.js')}" shell ${id}. No command has run. After approval, retrieve result with lf_shell_result.`};}
  shellResult(id){if(!validId(id))throw Error('Invalid request ID.');const r=readJson(path.join(this.base,'requests',id+'.json'),null);if(!r||r.root!==this.root||r.session!==this.session)throw Error('Request does not belong to this session.');return {id,state:r.state,result:r.result??null};}
  cleanup(){const dir=path.join(this.dir,'outputs');try{for(const f of fs.readdirSync(dir)){const p=path.join(dir,f);if(Date.now()-fs.statSync(p).mtimeMs>this.cfg.outputRetentionDays*86400000)fs.unlinkSync(p);}}catch{}}
}
export function readRequest(base,id){if(!validId(id))throw Error('Invalid request ID.');const file=path.join(base,'requests',id+'.json');const r=readJson(file,null);if(!r)throw Error('Unknown request.');return {file,r};}
