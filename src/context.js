// Only behaviour that cannot be provided by static native configuration lives here.
// Tool output caps adapt to the active model's declared window. maxReadLines/maxOutputChars are ceilings only;
// they are lowered for small windows and unchanged for large or unknown ones (no invented model size).
const SHARE=8, TOKENS_PER_LINE=12, CHARS_PER_TOKEN=3.5, MIN_LINES=10, MIN_CHARS=2000;
export function modelWindow(model){const l=model?.limit;const n=Number.isFinite(l?.input)&&l.input>0?l.input:l?.context;return Number.isFinite(n)&&n>0?n:null;}
export function limitsFor(window,cfg){if(!window)return {readLines:cfg.maxReadLines,outputChars:cfg.maxOutputChars};const tokens=window/SHARE;return {readLines:Math.max(Math.min(cfg.maxReadLines,Math.floor(tokens/TOKENS_PER_LINE)),MIN_LINES),outputChars:Math.max(Math.min(cfg.maxOutputChars,Math.floor(tokens*CHARS_PER_TOKEN)),Math.min(MIN_CHARS,cfg.maxOutputChars))};}
export const SERENA_READ = /^(?:serena|localforge_serena)_(?:get_symbols_overview|find_symbol|find_referencing_symbols|find_declaration|find_implementations|get_diagnostics_for_file|get_diagnostics_for_symbol|get_type_hierarchy|list_dir|find_file|search_for_pattern)$/;
export const OWN_TOOLS = new Set(['lf_git','lf_discover','lf_verify','lf_diagnostics','lf_output','lf_task','lf_request_shell','lf_shell_result','lf_finish']);
const NATIVE = new Set(['read','glob','grep','edit','write','patch','skill','question']);
export function allowedTool(id,cfg,profile){if(profile==='off')return true;if(OWN_TOOLS.has(id)||NATIVE.has(id)||SERENA_READ.test(id))return true;if(cfg.extraTools.includes(id))return true;if(profile==='balanced'&&id==='shell')return true;return false;}
export function boundRead(input,max){if(!input||typeof input!=='object')return;input.limit=Number.isInteger(input.limit)&&input.limit>0?Math.min(input.limit,max):max;}
export function toolSession(event){return event.sessionID||event.context?.sessionID||event.session?.id;}
