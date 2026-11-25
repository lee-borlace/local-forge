import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const home = () => path.resolve(process.env.LOCALFORGE_HOME || path.join(os.homedir(), '.localforge'));
export const ocHome = () => path.resolve(process.env.OPENCODE_CONFIG_DIR || path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode'));
export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const DEFAULTS = Object.freeze({
  defaultProfile: 'off',
  profiles: [],
  maxReadLines: 120, maxOutputChars: 8000, maxFileBytes: 2097152,
  maxProcessMs: 120000, maxStoredOutputBytes: 1048576,
  repeatLimit: 3,
  rtk: { enabled: false, executable: 'rtk' },
  extraTools: [], trustedProjects: [], recipeOverrides: [],
  telemetry: true, maxTaskChars: 6000, outputRetentionDays: 7,
});
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true, mode:0o700});
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(value,null,2)+'\n', {mode:0o600,flag:'wx'}); fs.renameSync(tmp,file); }
  finally { try { fs.unlinkSync(tmp); } catch {} }
}
export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')); }
  catch(e) { if(e.code==='ENOENT') return fallback; throw e; }
}
export function loadConfig(dir=home()) {
  const raw=readJson(path.join(dir,'config.json'),{});
  const cfg={...DEFAULTS,...raw,rtk:{...DEFAULTS.rtk,...raw.rtk}};
  const bounds={maxReadLines:[10,500],maxOutputChars:[1000,50000],maxFileBytes:[1024,10000000],maxProcessMs:[1000,1800000],maxStoredOutputBytes:[8192,10000000],repeatLimit:[2,20],maxTaskChars:[1000,20000],outputRetentionDays:[1,90]};
  for(const [k,[lo,hi]] of Object.entries(bounds)) if(!Number.isFinite(cfg[k])||cfg[k]<lo||cfg[k]>hi) throw Error(`Invalid configuration: ${k} must be ${lo}–${hi}`);
  for(const p of [cfg.defaultProfile,...cfg.profiles.map(p=>p.profile)]) if(!['strict','balanced','off'].includes(p)) throw Error(`Unknown profile: ${p}`);
  for(const k of ['profiles','extraTools','trustedProjects','recipeOverrides']) if(!Array.isArray(cfg[k])) throw Error(`${k} must be an array`);
  return cfg;
}
export function profileFor(model,cfg) {
  for(const p of cfg.profiles) if((!p.provider||p.provider===model?.providerID)&&(!p.modelContains||String(model?.id||'').toLowerCase().includes(p.modelContains.toLowerCase()))) return p.profile;
  return cfg.defaultProfile;
}
export function inPath(root,target) {
  const r=path.relative(root,target); return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));
}
export function canonical(p) { return fs.realpathSync(path.resolve(p)); }
