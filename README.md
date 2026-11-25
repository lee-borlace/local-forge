# LocalForge

**A global, repository-agnostic OpenCode 2 extension for smaller local coding models.** LocalForge integrates existing tooling, installs readable native agent definitions, and adds a small enforcement layer where instructions alone are insufficient. It is not a new coding agent or an OS security sandbox.

Status: v0.3.0, development preview. Offline tests pass; real OpenCode 2, Serena, Windows and model-quality validation are still required.

## Install

The repository is published at [lee-borlace/local-forge](https://github.com/lee-borlace/local-forge):

```powershell
opencode plugin add github:lee-borlace/local-forge
```

OpenCode installs the package globally and loads it on startup. LocalForge's own `setup()` provisions native agents and a human CLI, loads the bundled skills, registers an existing Serena installation, and activates custom hooks. There is no clone or separate LocalForge install script to run. If new agents are not shown, restart OpenCode once. Use the **localforge-strict** agent with your existing local model; **localforge-balanced** retains approval-gated direct shell. Ordinary agents keep their existing OpenCode behaviour unless explicitly mapped to a LocalForge profile.

Run `/localforge-doctor` in OpenCode. If Serena is missing, run `/localforge-setup-serena` to explicitly approve installation of pinned Serena and uv if needed. This uses the extension's provisioning code, not model-generated shell. The extension still works without Serena through native bounded search/read. See [installation](docs/INSTALLATION.md) for an opt-in unattended configuration and the exact prerequisite commands. DCP and RTK are optional, not installed by default.

**Existing v0.1/v0.2 installations:** migrate first. Do not load two copies of LocalForge; see [migration](docs/INSTALLATION.md#migrate-from-v01-or-v02).

## What the extension provides

| Capability | Implementation |
|---|---|
| Symbol-first navigation | Serena MCP; native glob/grep/read fallback |
| Editing | Native OpenCode edit/write/patch |
| Working methodology | Bundled native Markdown agents and skills |
| Shell policy | Native permissions + per-request tool filtering; exceptional human-reviewed CLI fallback |
| Project discovery | Read-only manifest detection, fixed verification recipes |
| Context economy | Native reads and custom outputs capped in proportion to the active model's declared window (static ceilings when it is not exposed), curated tool catalogue, optional upstream DCP. LocalForge sets no context size and leaves compaction to OpenCode. |
| Diagnostics | Existing Serena diagnostics where exposed; standalone JSON/JS/Python checks; discovered builds/tests |
| State and evidence | Persistent session scratchpad, observed edit/verification tracking, repeat detection and local metrics |
| Lifecycle | Native OpenCode package installation/update/removal; LocalForge managed-file reconciliation |

The harness never requires a target repository to contain LocalForge instructions, scripts or configuration. Detection of a build/test script is not approval to execute it. `lf_finish` is advisory, not a hard completion gate. See [design](docs/DESIGN.md) and [roadmap](docs/ROADMAP.md).

## Inspect exactly what will be installed

`content/` is the declarative source of truth. `manifest.json` lists every agent, skill, config template, pinned Serena dependency and exact helper file copied by provisioning. No `postinstall` hook or nested OpenCode CLI call is used.

| Repository payload | Deployment | Purpose |
|---|---|---|
| `content/agents/localforge-strict.md` | Copied to global `agents/` | Strict profile instructions and native permissions |
| `content/agents/localforge-balanced.md` | Copied to global `agents/` | Balanced profile instructions and native permissions |
| `content/skills/localforge-navigation/SKILL.md` | Runtime skill registration | Symbol-first code discovery |
| `content/skills/localforge-debugging/SKILL.md` | Runtime skill registration | Evidence-first debugging |
| `content/skills/localforge-verification/SKILL.md` | Runtime skill registration | Evidence-based completion |
| `content/config/serena-mcp.json` | Runtime MCP registration | Individual symbol tools, stdio, pooling off, project discovery |
| `content/config/localforge.json` | Copy once to LocalForge state | Editable defaults, never overwritten on update |

The bundled skills and MCP definition are **not** copied to OpenCode's global skills folder or written to its JSONC. Existing skill IDs and existing `serena`/`localforge_serena` definitions are preserved. The two agents must be physical files because the current public agent editor supports updating, removing and selecting existing agents, not adding them. The plugin attempts an agent reload only when files change. Native OpenCode owns the package cache; LocalForge never installs a second copy of its plugin under `plugins/`.

### Exact persistent locations

`OC` = `OPENCODE_CONFIG_DIR`, else `$XDG_CONFIG_HOME/opencode`, else `~/.config/opencode`. `LF` = `LOCALFORGE_HOME`, else `~/.localforge`. On Windows `~` resolves to your user profile. Environment overrides must be set for the process running OpenCode. The machine running the OpenCode server owns these locations, not necessarily the client machine.

| Path | Created or modified | Why |
|---|---|---|
| `OC/agents/localforge-strict.md` | On load/update | Native strict agent |
| `OC/agents/localforge-balanced.md` | On load/update | Native balanced agent |
| `LF/config.json` | First load only, preserved thereafter | User configuration |
| `LF/install-manifest.json` | As managed files change | Hashes and package version for updates and cleanup |
| `LF/helper/` | Exact files in `manifest.json` helper list | Stable human CLI for reviewing shell requests, dependencies, diagnostics and cleanup even after removing the plugin |
| `LF/provision.lock`, `LF/dependencies.lock` | Temporary during reconciliation/install | Prevent concurrent LocalForge writers |
| `LF/backups/<timestamp-id>/<path-hash>/<filename>` | Only when replacing an unchanged owned file | Restore previous version |
| `LF/sessions/<repo-hash>/<session-hash>/` | Active LocalForge session | Task state, verification records, local metrics, bounded output files |
| `LF/requests/<id>.json` and temporary `.lock` | On exceptional shell request/approval | Exact command awaiting separate human execution |

OpenCode itself writes the package configuration/cache when you install/update/remove it. LocalForge does not edit `opencode.json(c)`, `cli.json(c)`, other agents, global instructions, or target-repository files as part of provisioning. Serena may create `.serena/` metadata and its own user caches, and may download language servers; those are upstream behaviours. See [full file inventory](docs/INSTALLATION.md#helper-file-inventory) and [data handling](docs/SECURITY.md).

## Why custom code exists

| Module | Responsibility and reason |
|---|---|
| `index.js` | OpenCode public hooks and nine narrow tools; runtime per-model filtering, permissions, read limits, edit observation, metrics, completion evidence cannot be enforced by Markdown |
| `src/provision.js` | Plugin lifecycle glue: agent reload, skill/MCP registration and user commands; native config alone cannot safely reconcile packaged payloads |
| `src/install.js` | Hash-based reconciliation, manifest, locks, backup, cleanup and fixed prerequisite installation; no code generation or arbitrary script execution |
| `src/config.js` | Resolve global paths, validate config, choose profile, atomic JSON and SHA-256; shared by runtime and human CLI |
| `src/context.js` | Tool allowlist, read/output caps scaled to the model's declared window; native tools retained, not reimplemented |
| `src/files.js` | Path/credential guard and bounded text access for custom diagnostics/discovery; not a general file editing tool |
| `src/process.js` | Fixed-argv process wrapper, timeout, bounded captured output and concise presentation; avoids model-authored shell for routine commands |
| `src/adapters.js` | Discover project capabilities and fixed build/test/check recipes, Git read-only actions, standalone diagnostics |
| `src/state.js` | Session-scoped persistent task state, observed checks, outputs, loop counters and one-shot shell request records |
| `cli.js` | Human-only CLI for explicit shell approval, trust, dependency provisioning, status, cleanup and manual source-checkout repair |

Nine model-facing tools: `lf_git`, `lf_discover`, `lf_verify`, `lf_diagnostics`, `lf_output`, `lf_task`, `lf_request_shell`, `lf_shell_result`, `lf_finish`. The model cannot invoke the provisioning/cleanup CLI as an ordinary LocalForge tool. No LLM is used for provisioning, project detection, output clipping, tool filtering or permission checks.

## Management

| Action | Command |
|---|---|
| Inspect installation | `/localforge-status` |
| Check agent and MCP registration | `/localforge-doctor` |
| Repair missing managed files, rediscover Serena without installing | `/localforge-repair` |
| Approve installing missing prerequisites | `/localforge-setup-serena` |
| Update | `opencode plugin update github:lee-borlace/local-forge` |
| Remove runtime package | `opencode plugin remove github:lee-borlace/local-forge` |

On removal, close OpenCode instances, then clean up only unchanged LocalForge-owned files using the retained helper. PowerShell with the default state path:

```powershell
node "$HOME/.localforge/helper/cli.js" cleanup
```

Use the same helper for `doctor`, `status`, `plan`, `report`, `trust <recipe-id> [directory]`, `shell <request-id>`, and `dependencies --with-uv`. `cleanup` intentionally retains user settings, logs, requests, backups and shared external dependencies. Modified or unowned files are never deleted. See [installation](docs/INSTALLATION.md) for details.

## Development

```sh
npm test
npm pack --dry-run
```

Public API documentation: [OpenCode plugin packaging](https://opencode.ai/docs/build/plugins/), [server plugin API](https://opencode.ai/docs/build/plugins/server/), [plugin management](https://opencode.ai/docs/plugins/), [Serena](https://github.com/oraios/serena). The mock tests exercise contract-shaped interfaces, not real OpenCode. [Smoke tests](docs/SMOKE-TEST.md) are required before claiming live support. [Research and references](docs/REFERENCES.md) explain the original design motivation. MIT license for LocalForge source; third-party software retains its own licenses and is not vendored.
