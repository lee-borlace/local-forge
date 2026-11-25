import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { digest } from './config.js';
import { executable, runProcess } from './process.js';
const has=(dir,name)=>fs.existsSync(path.join(dir,name));
function safeRead(ws,file){try{return ws.text(file).text;}catch{return null;}}
function manifest(ws,files){return digest(JSON.stringify(files.map(f=>[f,safeRead(ws,f)])));}
export function discover(ws,dir='.'){
  const root=ws.resolve(dir); if(!fs.statSync(root).isDirectory())throw Error('Project directory must be a directory.'); const p=ws.relative(root); const rel=f=>p==='.'?f:`${p}/${f}`;
  const recipes=[]; const types=[];const files=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.name);
  function add(id,kind,program,args,inputs=[]){const exe=executable(program,ws.root); const key=digest(JSON.stringify([ws.root,p,id,exe,args,manifest(ws,inputs.map(rel))]));recipes.push({id,kind,program,args,executable:exe,dir:p,available:!!exe,fingerprint:key});}
  const pkg=safeRead(ws,rel('package.json'));if(pkg!==null){types.push('node');try{const j=JSON.parse(pkg);const pm=has(root,'pnpm-lock.yaml')?'pnpm':has(root,'yarn.lock')?'yarn':has(root,'bun.lock')||has(root,'bun.lockb')?'bun':'npm';for(const kind of ['build','test','lint','check','typecheck','format'])if(typeof j.scripts?.[kind]==='string')add(`node-${kind}`,kind,pm,['run',kind],['package.json','pnpm-lock.yaml','package-lock.json','yarn.lock','bun.lock']);}catch{}}
  if(has(root,'Assets')&&has(root,'ProjectSettings')){types.push('unity');const unity=process.env.LOCALFORGE_UNITY_EDITOR||'Unity';add('unity-editmode','test',unity,['-batchmode','-nographics','-projectPath',root,'-runTests','-testPlatform','EditMode','-testResults',path.join(os.tmpdir(),`localforge-unity-${digest(ws.root).slice(0,16)}.xml`),'-logFile','-'],['ProjectSettings/ProjectVersion.txt','Packages/manifest.json']);}
  else if(files.some(f=>/\.(sln|slnx|csproj|fsproj)$/.test(f))){types.push('dotnet');const selected=files.filter(f=>/\.(sln|slnx)$/.test(f));const projects=files.filter(f=>/\.(csproj|fsproj)$/.test(f));const target=selected.length===1?selected[0]:!selected.length&&projects.length===1?projects[0]:null;if(target){add('dotnet-build','build','dotnet',['build',`./${target}`,'--no-restore'],[target,'Directory.Build.props','Directory.Build.targets','global.json']);add('dotnet-test','test','dotnet',['test',`./${target}`,'--no-restore'],[target,'Directory.Build.props','Directory.Build.targets','global.json']);}}
  if(has(root,'pyproject.toml')||has(root,'pytest.ini')||has(root,'setup.py')){types.push('python');add('python-test','test',process.platform==='win32'?'python':'python3',['-m','pytest','-q'],['pyproject.toml','pytest.ini','setup.py','conftest.py']);}
  if(has(root,'Cargo.toml')){types.push('rust');add('rust-check','check','cargo',['check','--locked'],['Cargo.toml','Cargo.lock']);add('rust-test','test','cargo',['test','--locked'],['Cargo.toml','Cargo.lock']);}
  if(has(root,'go.mod')){types.push('go');add('go-test','test','go',['test','./...'],['go.mod','go.sum']);add('go-vet','lint','go',['vet','./...'],['go.mod','go.sum']);}
  if(files.some(f=>f.endsWith('.tf'))){types.push('terraform');add('terraform-validate','check','terraform',['validate','-no-color'],files.filter(f=>f.endsWith('.tf')));add('terraform-fmt-check','lint','terraform',['fmt','-check','-diff','-no-color'],[]);}
  if(has(root,'Makefile')||has(root,'CMakeLists.txt'))types.push('make/cmake');
  if(has(root,'pom.xml')||has(root,'build.gradle')||has(root,'build.gradle.kts'))types.push('java');
  for(const o of ws.cfg.recipeOverrides){if(o.root!==ws.root||o.dir!==p||typeof o.id!=='string'||!Array.isArray(o.args)||o.args.some(a=>typeof a!=='string'))continue;add(o.id,o.kind||'custom',o.program,o.args,Array.isArray(o.inputs)?o.inputs:[]);}
  return {directory:p,types:types.length?types:['generic'],git:!!executable('git',ws.root)&&has(ws.root,'.git'),recipes,notes:['Detected commands are candidates, not proof of installed dependencies or working tests.','Execution may run arbitrary repository code and requires approval or explicit local trust.']};
}
export async function diagnostics(ws,rel,signal){const ext=path.extname(rel).toLowerCase();const {p,text}=ws.text(rel);if(ext==='.json'){try{JSON.parse(text.replace(/^\uFEFF/,''));return {status:'passed',kind:'JSON syntax'};}catch(e){return {status:'failed',kind:'JSON syntax',message:e.message};}}
  if(['.js','.mjs','.cjs'].includes(ext)){const exe=executable('node',ws.root);if(exe){const r=await runProcess(exe,['--check',p],{cwd:ws.root,signal,timeout:5000,maxBytes:8192});return {kind:'JavaScript syntax only',status:r.status,message:r.output.slice(0,2000)};}}
  if(ext==='.py'){const exe=executable(process.platform==='win32'?'python':'python3',ws.root);if(exe){const code='import ast,sys,tokenize; p=sys.argv[1]; f=tokenize.open(p); ast.parse(f.read(),filename=p)';const r=await runProcess(exe,['-I','-S','-c',code,p],{cwd:ws.root,signal,timeout:5000,maxBytes:8192});return {kind:'Python syntax only',status:r.status,message:r.output.slice(0,2000)};}}
  return {status:'unavailable',kind:'syntax/semantic diagnostics',message:'Use Serena diagnostics if available, otherwise run a discovered verification recipe.'};
}
export function trusted(recipe,cfg){return cfg.trustedProjects.some(t=>t===recipe.fingerprint);}
export const gitOperations={status:['status','--short','--untracked-files=normal'],diff:['diff','--no-ext-diff','--no-textconv','--stat'],diff_detail:['diff','--no-ext-diff','--no-textconv','--unified=3'],staged:['diff','--cached','--no-ext-diff','--no-textconv','--unified=3'],log:['log','--oneline','--no-decorate','-15'],check:['diff','--check','--no-ext-diff','--no-textconv']};
export async function gitRun(ws,op,rel,signal){if(!Object.hasOwn(gitOperations,op))throw Error('Unknown Git operation.');const exe=executable('git',ws.root);if(!exe)throw Error('Git unavailable.');const args=['-c','core.fsmonitor=false','-c','core.hooksPath='+path.join(ws.root,'.localforge-disabled-hooks'),'--no-pager',...gitOperations[op]];if(rel){ws.resolve(rel);args.push('--',rel);}return runProcess(exe,args,{cwd:ws.root,signal,timeout:ws.cfg.maxProcessMs,maxBytes:ws.cfg.maxStoredOutputBytes});}
