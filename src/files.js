import fs from 'node:fs';
import path from 'node:path';
import { digest, inPath } from './config.js';
export function secretName(s) { return /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|id_(?:rsa|ed25519|ecdsa)(?:\..*)?|credentials(?:\.json)?|secrets\.json)$/i.test(s) && !/\.example$|\.sample$|\.template$/i.test(s) || /\.(?:pfx|p12|key|pem)$/i.test(s); }
export class Workspace {
  constructor(root,cfg,protectedPaths=[]) { this.root=fs.realpathSync(root); this.cfg=cfg; this.protected=protectedPaths.map(p=>path.resolve(p)); }
  resolve(rel,{write=false,missing=false}={}) {
    if(typeof rel!=='string'||!rel||rel.includes('\0')) throw Error('Provide a repository-relative path.');
    if(path.isAbsolute(rel)||path.win32.isAbsolute(rel)||rel.includes(':')||rel.split(/[\\/]/).includes('..')||process.platform==='win32'&&rel.split(/[\\/]/).some(p=>p!=='.'&&/[. ]$/.test(p))) throw Error('Path must stay inside the repository.');
    const target=path.resolve(this.root,rel);
    if(!inPath(this.root,target)||this.protected.some(p=>inPath(p,target))) throw Error('Protected or external path.');
    const parts=path.relative(this.root,target).split(path.sep).filter(Boolean);
    if(parts.some(p=>['.git','.hg','.svn','.serena','.localforge'].includes(p.toLowerCase())||secretName(p))) throw Error('Protected metadata or credential path.');
    if(write&&parts.some(p=>p.toLowerCase()==='.opencode'||/^opencode\.jsonc?$/i.test(p)||p.toLowerCase()==='agents.md')) throw Error('Agent configuration/instructions require human changes.');
    let cur=this.root;
    for(const p of parts) {cur=path.join(cur,p); try { const st=fs.lstatSync(cur); if(st.isSymbolicLink()) throw Error('Symbolic links/junctions are not followed.'); if(!inPath(this.root,fs.realpathSync(cur))) throw Error('External path.'); } catch(e){if(e.code==='ENOENT'&&missing) continue; throw e;}}
    return target;
  }
  relative(p){return path.relative(this.root,p).split(path.sep).join('/')||'.';}
  text(rel){const p=this.resolve(rel); const st=fs.statSync(p); if(!st.isFile()) throw Error('Not a regular file.'); if(st.size>this.cfg.maxFileBytes) throw Error('File exceeds the safe text size. Use a narrower external operation.'); const b=fs.readFileSync(p); if(b.includes(0)) throw Error('Binary file; use a relevant specialised tool.'); let text; try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);}catch{throw Error('Non-UTF-8 text is unsupported.');} return {p,text,version:digest(b)}; }
}
