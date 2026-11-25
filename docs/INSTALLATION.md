# Installation, lifecycle and file ownership

## Normal installation from GitHub

1. Publish the repository with `package.json` and its exports at the root. Choose an appropriate repository slug and review the included MIT license.
2. Install OpenCode v2 on the server machine. Use Node.js 20+ for the independent human CLI. OpenCode loads the extension through its own runtime; no npm dependencies are needed by LocalForge.
3. `opencode plugin add github:lee-borlace/local-forge`. A bare GitHub target uses OpenCode's update behaviour; prefer a tested release tag/full commit for reproducible deployments. Use `opencode plugin list` to inspect it.
4. Start OpenCode in any repository. The plugin's `setup` reconciles global agents, config and the helper; registers skills and MCP through native transforms; then installs its tools/hooks. If agent reload has not surfaced the new agents, restart OpenCode. Select `localforge-strict` with your existing model. No target repository setup.
5. `/localforge-doctor` reports registration and prerequisite state. Use `/mcps` to confirm live connection. `/localforge-setup-serena` authorizes dependency installation if needed.

There is no npm postinstall script, no `opencode mcp add` call inside plugin setup, no duplicate plugin directory, and no requirement to clone this repository. The package may be installed before the OpenCode server first loads it: native file provisioning occurs on load, not necessarily while `plugin add` is still running.

## Dependencies and consent

If an existing `serena` executable is found, reuse it (no upgrade or version pin enforced for user installations). Existing native `serena` or `localforge_serena` server definitions are preserved, including disabled definitions; a preserved server may use a different project or tool interface, so inspect it. If there is no Serena binary, no installer runs merely because a model session starts. The explicit user command `/localforge-setup-serena` approves the following fixed dependency provisioning operations if needed:

| Dependency | Command (selected by OS and availability) |
|---|---|
| uv on Windows | `winget install --id astral-sh.uv -e --accept-package-agreements --accept-source-agreements` |
| uv on macOS | `brew install uv` |
| uv on Linux | `pipx install uv` |
| Serena | `uv tool install -p 3.13 serena-agent==2.1.0` |
| Discover uv tool binary directory if needed | `uv tool dir --bin` |

No download-and-execute script is fetched by LocalForge. System package managers, uv, Serena and language servers may download packages and write to their normal cache/install locations; review their own trust models. The package manager must already be available; otherwise install uv using [official instructions](https://docs.astral.sh/uv/getting-started/installation/). Existing user-owned PATH entries and standard uv install paths are searched; commands run outside target repos using bounded process execution. Restart the server if PATH changes. Windows executable/installer behaviour has not been live validated. No administrative privileges are requested directly by LocalForge; a system package manager may prompt.

For one-pass unattended provisioning, explicitly opt in when configuring the global plugin entry (rather than adding the package twice):

```jsonc
{
  "plugins": [
    { "package": "github:lee-borlace/local-forge", "options": { "installDependencies": true, "installUv": true } }
  ]
}
```

Merge into the existing global config; preserve its other keys/entries. `installDependencies:true` permits installing pinned Serena on startup. `installUv:true` additionally permits the fixed OS package-manager command if uv is missing. Without consent flags, missing dependencies degrade to native navigation until the user runs the explicit setup command. Failed installation is reported; a future startup with explicit opt-in may retry. No LLM decides which installers to run. Alternatively, from the installed helper, use `node "$HOME/.localforge/helper/cli.js" dependencies --with-uv` and type `yes`; then restart or use `/localforge-repair`.

Runtime Serena configuration is in `content/config/serena-mcp.json`: stdio, `--project-from-cwd`, `--agent-interface tools` (not REPL), `codemode:false`, `pool:false`, dashboards disabled. OpenCode's default MCP cwd is the workspace. Serena may need valid language/project files and installed dependencies; symbolic coverage is not guaranteed. No mandatory `serena init`, project index or custom repository files are created by LocalForge. Serena itself may create project metadata.

DCP and RTK are not installed automatically. Use an explicit, tested upstream DCP plugin version via OpenCode's native plugin manager after reviewing compatibility. RTK can be installed separately and enabled in `LF/config.json`; only selected fixed verification recipes currently use its opt-in wrapper. No custom context summarisation or automatic model changes.

## File inventory and ownership

The exact declarative payload is `manifest.json` plus `content/`. See README's full installation table. OpenCode maintains its own package/cache and package config entry. Only two Markdown agents are copied under the global OpenCode config directory. Bundled skills are registered by reading their small Markdown frontmatter and body; bundled MCP configuration is registered using `ctx.mcp.transform`. A matching existing skill or server is preserved. LocalForge never edits native JSON(C) itself.

### Helper file inventory

All paths below are relative to `LF/helper/`; the package's root `manifest.json` is authoritative.

- `LICENSE`: license required for redistributed source.
- `package.json`: ESM module metadata and version.
- `cli.js`: human command-line interface, remains available after package removal.
- `manifest.json`: inventory and versioned dependency declaration used by the CLI.
- `src/config.js`, `src/process.js`, `src/files.js`, `src/adapters.js`, `src/state.js`, `src/install.js`: shared deterministic CLI dependencies (configuration, process execution, path checks, discovery, request state, provisioning/cleanup).
- `content/config/localforge.json`, `content/config/serena-mcp.json`: default configuration and server template for CLI plan/provisioning.
- `content/agents/localforge-strict.md`, `content/agents/localforge-balanced.md`: payload copies for the CLI plan; not another plugin installation.

The helper does not contain `index.js`, `src/provision.js`, or the runtime skills. It is not discovered as an OpenCode plugin. `repair` from a source checkout can stage the payload; the installed helper itself cannot repair a damaged copy of its own files. Use `/localforge-repair` from the installed plugin package for repair. No global PATH change or wrapper executable is installed by LocalForge. A `shell` request reports the exact helper path to invoke.

### Reconciliation

Each startup acquires a short exclusive `LF/provision.lock`. Existing files identical to the package are reused (unowned identical files are never claimed). An unchanged file previously owned by LocalForge can be updated; its old bytes are backed up before replacement. A changed/unowned file is preserved and reported as a conflict, not overwritten. Missing managed files are recreated. Removed payloads are deleted only when still byte-identical to the recorded hash. The manifest records only owned files; user config is copy-once, not managed for deletion. New defaults are merged by `loadConfig` without rewriting user config. If multiple startup processes race, the runtime retries briefly; a stale lock after crash is left for explicit human inspection/removal. Managed path symlinks/junctions are rejected. This is best-effort local file ownership, not protection from an adversarial process running as the same user; an interrupted update can leave an orphan identical file (preserved rather than silently adopted). Backups are local and not automatically restored.

Do not manually copy a second plugin into `OC/plugins`. In-place package update is owned by OpenCode; the plugin reconciles its content at the next load. A user-modified agent must be manually merged, or moved aside for the packaged version to be restored. `/localforge-status` shows conflicts and paths. The same manifest is shared across locations on one server machine; do not load two different LocalForge package versions simultaneously. Exact Git refs are pinned; for update semantics see OpenCode's documentation.

## Remove

`opencode plugin remove github:lee-borlace/local-forge` (use the installed package target), close/restart OpenCode, then run:

```powershell
node "$HOME/.localforge/helper/cli.js" cleanup
```

Type `yes` only after reviewing the operation. For non-default `LOCALFORGE_HOME`, use its helper path. Runtime registrations disappear on unload. The helper deletes only files matching its recorded hash in the managed global agent/helper paths; modified or unowned files remain. It intentionally leaves config, backups, sessions, requests, Serena/uv and all native MCP config. Empty directories may remain. Remove retained data manually if desired. No unload callback deletes configuration: unloading can also happen during a reload/update, not just removal. Run cleanup only after removal or startup will restore managed files.

## Migrate from v0.1 or v0.2

If only the old ZIP exists and was never installed, nothing is required. Otherwise close OpenCode; use the old `node cli.js uninstall` from v0.2 source (interactive), or remove the old copied plugin manually after backing up any customizations. Remove the remaining `OC/plugins/localforge` directory if it exists, inspect any native MCP entries and old copied skills; v0.3 preserves existing Serena definitions and skill IDs. Keep your `LF/config.json` and session data. If the old `LF/install-manifest.json` remains, move it aside after inspecting the old managed files; v0.3 refuses legacy manifests to prevent claiming ownership incorrectly. The new package refuses to provision while a legacy copied plugin is present. Existing modified agents/skills must be reconciled manually. Then install v0.3 normally.

## Development and troubleshooting

From a source checkout `node cli.js plan` or `node cli.js repair --dry-run` shows the file plan without changes; `node cli.js repair` stages only native files and the helper (not the runtime plugin). For package development configure the absolute source directory as a plugin through OpenCode's documented `plugins` array. `npm test` runs offline tests. `npm pack --dry-run` lists the package. The installed helper's `doctor` checks local binaries and detected recipes, not a real model round trip. `/localforge-doctor` reports runtime agent/MCP registry status. Neither claims that a connection or coding outcome is correct without live verification.

## Using alongside other OpenCode setups

LocalForge changes no OpenCode JSON, default agent, model or provider, and its profile defaults to `off`, so it does not alter another setup until you select `localforge-strict` or `localforge-balanced` (or a configured profile matches the model). Under those profiles the `context` hook removes every tool that is not native, an `lf_*` tool, a read-only Serena tool or listed in `extraTools` in `LF/config.json`; tools from other plugins (for example web or delete tools) are hidden unless added there. Check that a permission block such as `"*": "deny"` in your global configuration does not also deny the `lf_*` tools and that subagents offered to a LocalForge agent are acceptable under its shell policy; both are items in docs/SMOKE-TEST.md.
