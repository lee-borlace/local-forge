# Test results — v0.3.0

Executed `npm test` on Linux with Node.js v22.16.0. No npm runtime dependencies. The tests use disposable directories, fake executables for prerequisite provisioning and mock OpenCode v2 interfaces. They cover prior core behaviour plus the package lifecycle: first-run agent/helper reconciliation, no target-repo writes or native JSONC changes, idempotence, unowned/modified file preservation, backups, cleanup, legacy install detection, lock contention, symlink rejection, opt-in pinned Serena installation, skill and MCP registration and preserved definitions.

```
1..27
# tests 27
# pass 27
# fail 0
# cancelled 0
# skipped 0
```

Actual OpenCode v2 GitHub installation, live plugin hooks and commands, Serena/uv/package manager integration, Windows, DCP/RTK, Unity and model inference have **not** been executed in this workspace. The regression suite does not establish coding quality, a security sandbox or complete tool hook coverage. See [SMOKE-TEST.md](SMOKE-TEST.md) before unattended use. POSIX-only fake executable/symlink tests skip on Windows; native Windows validation is still required.

Package check: `npm pack --dry-run` and actual npm tarball succeeded. Extracted package entrypoint imported and read-only deployment plan ran successfully. No live OpenCode loader was available.
