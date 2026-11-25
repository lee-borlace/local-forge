# Research and upstream integration references

Public documentation checked while designing v0.2 and v0.3 (25 November 2026). External links are references, not bundled source code or proof that LocalForge improves task success. Upstream interfaces can change.

- OpenCode v2 server plugin API: https://opencode.ai/docs/build/plugins/server — tool transforms, direct custom tools, session context, permission assertions/evaluation and MCP configuration.
- OpenCode plugin discovery: https://opencode.ai/docs/plugins/ ; package structure: https://opencode.ai/docs/build/plugins ; native tools: https://opencode.ai/docs/tools ; permissions: https://opencode.ai/docs/permissions .
- OpenCode V1/V2 migration: https://opencode.ai/docs/build/plugins/migrate-v1 . v1 hooks and config differ; this implementation targets v2 only.
- Serena: https://github.com/oraios/serena ; client integration: https://oraios.github.io/serena/02-usage/030_clients.html ; running: https://oraios.github.io/serena/02-usage/020_running.html ; tools: https://oraios.github.io/serena/01-about/035_tools.html . Existing symbolic navigation and references. External process installed by default, not vendored.
- Rust Token Killer: https://github.com/rtk-ai/rtk . Upstream Windows/v2 integration has had compatibility issues: https://github.com/rtk-ai/rtk/issues/3463 and https://github.com/rtk-ai/rtk/issues/4311 . Direct routing is optional; built-in clipping works independently.
- Dynamic Context Pruning: https://github.com/Tarquinen/opencode-dynamic-context-pruning . DCP implements model-driven compression and dedupe; newer versions may differ. Not bundled. OpenCode message format and API compatibility matter; see https://github.com/anomalyco/opencode/issues/51265 and https://github.com/anomalyco/opencode/issues/55271 .
- SWE-agent paper: https://arxiv.org/abs/2405.15793 . Agent-oriented interfaces and feedback; motivates task-specific tools rather than raw shell.
- Agentless: https://arxiv.org/abs/2407.01489 . Predefined localization/repair/validation pipeline rather than unconstrained autonomy.
- Aider repository map: https://aider.chat/2023/10/22/repomap.html . Token-budgeted code structure retrieval.
- Anthropic, Writing effective tools: https://www.anthropic.com/research/writing-tools-for-agents ; Effective context engineering: https://www.anthropic.com/research/effective-context-engineering-for-ai-agents ; Effective harnesses for long-running agents: https://www.anthropic.com/research/effective-harnesses-for-long-running-agents .
- OpenAI Harness Engineering: https://openai.com/index/harness-engineering/ . Mechanical constraints and navigable project knowledge.
- Superpowers: https://github.com/obra/superpowers . Candidate workflow guidance, not mandatory.
- Oh My Pi: https://github.com/can1357/oh-my-pi . Candidate upstream editing alternative; custom hashline implementation removed in v0.2.
- SWE-bench: https://github.com/SWE-bench/SWE-bench and Harbor: https://github.com/laude-institute/harbor . Candidate model evaluation infrastructure (not integrated).

## Engineering decisions

Prefer conservative independent core over bundling unvalidated versions of every interesting plugin. No proprietary code or third-party source vendored. Use existing symbolic tools where available rather than write a custom language parser. Use process-level bounds, managed-file hashes, context guardrails and out-of-band shell fallback to minimize model decisions. Existing benchmark results do not establish improved outcomes on this user's particular Qwen model/Unity/Windows setup; evaluate locally.

- Native agents: https://opencode.ai/docs/agents ; skills: https://opencode.ai/docs/skills ; MCP native config/CLI: https://opencode.ai/docs/mcp-servers ; native plugin discovery: https://opencode.ai/docs/plugins ; native output config: https://opencode.ai/docs/config .
- Pinned Serena package: https://pypi.org/project/serena-agent/2.1.0/ ; optional DCP release: https://github.com/Tarquinen/opencode-dynamic-context-pruning/releases/tag/v3.2.1 .

- v0.3 packaging and lifecycle: https://opencode.ai/docs/build/plugins/ and https://opencode.ai/docs/plugins/ (GitHub package targets, native package lifecycle); https://opencode.ai/docs/build/plugins/server/ (setup, agent reload, skill/MCP/command transforms, synthetic messages); https://oraios.github.io/serena/02-usage/050_configuration.html (explicit tools interface instead of REPL).
