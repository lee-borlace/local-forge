# Test results — v0.3.0

Executed `npm test` on Windows 11 with Node.js (v0.3.0 plus the context-budget removal below). The earlier Linux run (27 tests, 27 passing, 0 skipped) predates it. No npm runtime dependencies. The tests use disposable directories, fake executables for prerequisite provisioning and mock OpenCode v2 interfaces. They cover prior core behaviour plus the package lifecycle: first-run agent/helper reconciliation, no target-repo writes or native JSONC changes, idempotence, unowned/modified file preservation, backups, cleanup, legacy install detection, lock contention, symlink rejection, opt-in pinned Serena installation, skill and MCP registration and preserved definitions.

```
# tests 28
# pass 24
# fail 0
# cancelled 0
# skipped 4
```

The 4 skipped tests need POSIX fake executables or Windows symlink privileges; they are skipped on this host and still need a run elsewhere. The one added test covers `modelWindow`/`limitsFor` (adaptive read and output caps) with a mocked model object only; whether the live v2 `context` hook supplies `event.model.limit` is **unverified** and is item 2a of docs/SMOKE-TEST.md.

Actual OpenCode v2 GitHub installation, live plugin hooks and commands, Serena/uv/package manager integration, Windows, DCP/RTK, Unity and model inference have **not** been executed in this workspace. The regression suite does not establish coding quality, a security sandbox or complete tool hook coverage. See [SMOKE-TEST.md](SMOKE-TEST.md) before unattended use. POSIX-only fake executable/symlink tests skip on Windows; native Windows validation is still required.

Package check: `npm pack --dry-run` and actual npm tarball succeeded. Extracted package entrypoint imported and read-only deployment plan ran successfully. No live OpenCode loader was available.
