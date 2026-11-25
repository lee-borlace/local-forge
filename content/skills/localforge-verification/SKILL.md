---
name: localforge-verification
description: Verify a change using existing repository capabilities without adding harness prerequisites.
---
Use lf_discover in the relevant package directory. Pick the smallest relevant existing recipe and request execution via lf_verify. Detection is not trust; obey approvals. For quick syntax checks use lf_diagnostics or available Serena diagnostics. Inspect lf_git diff_detail and check. Re-run relevant checks after edits. Call lf_finish, then report what passed, failed or was unavailable. A successful build is not proof that a bug is fixed. Never change tests to hide failures or claim an unrun check passed.
