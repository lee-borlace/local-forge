# Design: use existing mechanisms first

Goal: make local coding reliable and economical across arbitrary repositories without modifying them. Prefer native config, then upstream extensions, then reusable skills, then narrow custom code only where needed. Public v2 APIs only; no private internals or fork.

## Ownership and flow

1. Native agent selection activates strict/balanced permissions and concise instructions. Existing project instructions still apply. Detailed workflows are native opt-in skills, not hard-coded system prompts.
2. The package setup reconciles global agent files and the human CLI, registers bundled skills and the Serena MCP template via public transforms, then OpenCode starts the Serena process in the workspace if available. Serena handles symbols and language tooling. No custom repository index is produced.
3. Public `session.hook('context')` filters the model-facing tool set for the selected profile. Strict has native filesystem tools, read-only Serena tools, narrow LocalForge tools, no shell/Code Mode/subagents. Balanced can expose native shell subject to approval. Off hides custom tools without changing native config.
4. Public `tool.hook('execute.before')` caps native read limit while preserving offset. `execute.after` observes native edits to invalidate previous checks. Hooks depend on runtime providing session identity and correct tool ID; live compatibility must be validated. Repeat warnings are advisory, not a reliable measure of semantic progress.
5. Narrow tools use path checks, deterministic discovery, structured argv and bounded results. `lf_verify` asks OpenCode permissions using recipe identity. `lf_request_shell` persists an exact request; only human CLI confirmation executes it. Ordinary shell is never unlocked in strict mode.
6. State, metrics, verification status and bounded captured output are stored outside target repo. `lf_finish` is advisory: only observed edits/checks are represented; tests may pass without satisfying requirements. Native compaction is upstream, DCP is optional. No custom history manipulation.

## Why not just skills?

Skills are correct for methodology, but an agent can ignore them. They cannot cap a native read, hide competing tools per request, log actual execution, invalidate verification after an edit or ensure shell requires external approval. These require documented hooks or custom tools. Static native permissions are the first line of defence; plugin permission logic is supplemental, not an OS boundary. Custom Git and verification wrappers avoid adding a general-purpose command interpreter or a large Git MCP catalogue. Reassess if an upstream tool offers a narrower safe equivalent.

## Repository discovery and degradation

No discovery executes project code. Node scripts, single .NET solution/project, Python, Go, Rust, Terraform and Unity EditMode candidates are detected; Make/CMake and Java are recognized but no generic command is guessed. For monorepos choose a subdirectory. Missing executable/dependencies, invalid configs, no tests, ambiguous solution and unsupported language are normal. Use native search and diff review if stronger checks are unavailable; report unavailable, not passed. Additional recipes may be defined in user-owned `<LF>/config.json` with explicit absolute repository root and relative dir; no target repo config required. Recipe discovery does not imply trust. Unity test result parsing and semantic diagnostics are not fully implemented.

## Configuration-first revision

Removed duplicate filesystem read/list/search/edit/create and hashline editing from v0.1. Removed custom history-pruning and auto-compaction experiment. In v0.3 the declarative MCP definition and skills are registered through documented runtime transforms; only native agent files and the stable helper are physically copied. OpenCode owns package installation and updates. Moved workflow prompts and baseline permissions to Markdown agents/skills. Use OpenCode's own output and model configuration, native compaction and optional DCP. Retained narrow process, state, install and enforcement code. No custom model-specific inference parser; future diagnostics should use upstream APIs rather than guess.

## Provisioning lifecycle (v0.3)

The package contains all declarative content and an explicit manifest. On setup, `src/install.js` reconciles only named files under global agents and LocalForge state using hash ownership and a short lock; `src/provision.js` registers skills, MCP and user commands. Runtime registrations disappear on unload. Agent files persist until explicit cleanup because an unload may be a reload or update. Missing Serena degrades gracefully; a user command or explicit plugin options authorize fixed dependency installs. No native JSON(C) mutation, nested OpenCode invocation, postinstall script or second plugin copy.
