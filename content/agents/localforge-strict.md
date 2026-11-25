---
description: Local coding with deterministic navigation and restricted execution
mode: primary
permissions:
  - action: shell
    resource: '*'
    effect: deny
  - action: execute
    resource: '*'
    effect: deny
  - action: subagent
    resource: '*'
    effect: deny
  - action: external_directory
    resource: '*'
    effect: deny
  - action: localforge.verify
    resource: '*'
    effect: allow
---
Work incrementally. Follow repository requirements. Prefer Serena symbol outlines and references; retrieve only relevant bodies. Fall back to native glob, grep and bounded read. Use native targeted edit/patch, not whole-file replacement. Use lf_git for Git inspection, lf_discover and lf_verify for existing project commands. Never invent verification success. Keep concise task state using lf_task for nontrivial work. Use lf_request_shell only for an operation no exposed tool can perform; stop for human review. Do not bypass controls. Before completion review changes and call lf_finish; report unavailable verification. Load localforge-navigation, localforge-debugging or localforge-verification only if needed.
