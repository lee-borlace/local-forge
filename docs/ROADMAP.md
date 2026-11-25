# Roadmap and explicit non-goals

## P0: validate current distribution
- Run Windows/OpenCode v2/Serena integration smoke tests; verify actual tool hooks, native code-mode deny, native agent prompt/permission semantics and runtime MCP/skill registration, user commands and first-load agent reload. Check source paths and directory isolation. Fix any compatibility issues using public APIs.
- Confirm GitHub package installation, first-load provisioning and update/remove lifecycle against actual OpenCode and OS package manager, including existing JSONC, updates, cleanup and partial-failure recovery. Verify native global config paths. Improve diagnostics of missing integrations.
- Check actual local model context and tool-call round trip. Prefer upstream configuration/doctor capabilities; avoid custom inference abstraction until a real gap exists.

## P1: off-the-shelf first
- Validate DCP 3.2.1 and profile interactions; optional, no custom pruning reimplementation. Validate RTK direct wrappers or upstream v2 integration and raw-output escape hatch. Consider upstream hashline plugin only if native editing demonstrably fails. No custom hashline code retained.
- Investigate upstream syntax/semantic diagnostics after native edits. Existing `lf_diagnostics` only supports JSON, JS, Python syntax; use Serena if available. No mandatory project scripts or dependencies.
- Improve narrow typed commands based on recorded shell requests, not speculative tool proliferation. Prefer established safe upstream tools, keep tool catalogue small. Build/test result parsers and Unity XML isolation/validation need work.
- Improve loop detection (currently consecutive equivalent actions only, advisory on native tools); account for external edits and multi-step cycles. Add verification gate only if stable public API permits it; `lf_finish` is advisory today. Checkpoints via native Git/OpenCode preferred.
- Add automated evaluation fixtures and compare model task success against vanilla OpenCode; no claim of performance improvement until measured.

## P2: optional enhancements
Version-aware docs through local dependency inspection or opt-in Context7; optional model-specific reasoning budgets via native provider config; output indexing via upstream Context Mode; benchmark runner; optional escalation explicitly approved by the user. No cloud transfer, swarms or self-modifying harness by default. No repository preparation, broad custom indexing, private APIs, forced project test scripts or unsupported claims of autonomous success.
