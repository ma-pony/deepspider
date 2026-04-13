# Deep Review Findings

**Branch:** 001-opencode-agent
**Rounds:** 1
**Gate Outcome:** PASS (Critical + Important = 0 remaining)
**Invocation:** manual (`/spex:deep-review`)

## Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 2 | 2 | 0 |
| Important | 11 | 11 | 0 |
| Minor | several | - | several (not blocking) |
| **Total** | **13+** | **13** | **0 blocking** |

**Agents completed:** 5/5 (Correctness, Architecture, Security, Production Readiness, Test Quality)
**External tools:** none invoked (deep-review run without CodeRabbit/Copilot in this session)

---

## Findings

### FINDING-1 — ProdReady F-01 (Critical)
- **Severity:** Critical
- **Confidence:** 95
- **File:** `bin/cli.js:51` (agent branch)
- **Category:** production-readiness
- **Source:** production-readiness-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
The `agent` branch in `bin/cli.js` started an opencode server (port 4096) and an attached TUI but never registered SIGINT/SIGTERM handlers. When the user pressed Ctrl+C while the TUI was active, the parent CLI process was killed but the opencode server had no chance to call `server.close()` — leaving an orphaned process holding port 4096.

**Why this matters:**
This was actually reproduced during the `测试运行一下，完整的可用性` smoke test in this session: "Failed to start server on port 4096" because PID 8461 from a prior run was still listening. We had to manually `kill 8461` to recover. Any normal user hitting Ctrl+C would step on the same landmine, and the error message from opencode gave no hint of the real cause.

**How it was resolved:**
Added explicit SIGINT/SIGTERM handlers in `bin/cli.js:62-72` that close the server before `process.exit(130/143)`. The agent branch now also calls `server.close()` after `startTUI` returns normally and on the catch path, with re-entrancy guard to avoid double-close.

```js
let _server = null;
let _shuttingDown = false;
const shutdown = async (sig) => {
  if (_shuttingDown) return;
  _shuttingDown = true;
  if (_server) { try { await _server.close(); } catch {} }
  process.exit(sig === 'SIGINT' ? 130 : 143);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

### FINDING-2 — ProdReady F-02 + Arch F9 (Important)
- **Severity:** Important
- **Confidence:** 90
- **File:** `src/agent/tui.js`
- **Category:** production-readiness, architecture
- **Source:** production-readiness-agent, architecture-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
`startTUI` took a `client` parameter that was never read, and called `process.exit(exitCode)` directly inside the helper. This made it impossible for the caller to clean up the server before exiting — by the time `process.exit` ran, the SIGINT handler in bin/cli.js had no chance to finalize.

**How it was resolved:**
Rewrote `tui.js:25-46` to drop the unused `client` arg and `return exitCode` instead of exiting. The caller (bin/cli.js) is now solely responsible for `process.exit`, after closing the server.

### FINDING-3 — ProdReady F-03 (Important)
- **Severity:** Important
- **Confidence:** 85
- **File:** `src/agent/index.js:126-134` (`ask` helper)
- **Category:** production-readiness
- **Source:** production-readiness-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
The first-run wizard's `ask()` helper used `readline.createInterface` without a SIGINT handler. If the user pressed Ctrl+C at the wizard prompt, readline kept stdin in raw mode and the process hung — no shell prompt, no exit.

**How it was resolved:**
`ask()` now listens for `rl.once('SIGINT', ...)` and rejects with a tagged error `{code:'E_WIZARD_CANCELLED', exitCode:130}`. `bin/cli.js` catches this code specifically and exits 130 with a clean "已取消。" message, distinct from real startup failures.

### FINDING-4 — ProdReady F-04 + Correctness F4 (Important)
- **Severity:** Important
- **Confidence:** 90
- **File:** `src/agent/sandbox.js` (`initSandbox`)
- **Category:** production-readiness, correctness
- **Source:** production-readiness-agent, correctness-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
1. The cleanup loop ran for **all** init modes including `fresh`, so a user picking "create empty sandbox" would have any pre-existing `opencode.json` (e.g. from a previous `config set-model`) renamed to `.bak.<ts>`. Surprising and destructive.
2. The previous flow did `renameSync(target, target + bak)` and then `symlinkSync(...)`. If symlinkSync failed (EEXIST/EACCES on a strict filesystem), the original was already moved aside with no rollback — leaving the sandbox half-initialized and missing its config.

**How it was resolved:**
Rewrote `initSandbox` to:
- Compute the `targets` list **based on mode + actual existing user files**. Fresh mode produces an empty list, so the cleanup loop is skipped entirely — sandbox files stay untouched.
- Track `backups` and `createdLinks` arrays during the link phase. If any `symlinkSync` throws, the catch block unlinks every newly-created link and `renameSync(bak, dst)` every backup, then re-throws. End state is bit-identical to the pre-call state.
- New regression test `test/sandbox.test.js` covers fresh-mode no-touch (T1), backup-on-replace (T2), and rollback-on-failure (T3). All three pass.

### FINDING-5 — ProdReady F-06 (Important)
- **Severity:** Important
- **Confidence:** 85
- **File:** `src/cli/commands/config.js:85` (`setModel`)
- **Category:** production-readiness
- **Source:** production-readiness-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
`setModel` did `fs.unlinkSync(target); fs.writeFileSync(target, content)` for the symlink-dereference path, then a separate `fs.writeFileSync(target, ...)` to update the model. Neither write was atomic — if the process died (or Ctrl+C between syscalls) the user's `opencode.json` could be left missing or truncated.

**How it was resolved:**
Now writes to `${target}.tmp.${pid}.${Date.now()}` first, then `fs.renameSync(tmp, target)`. Rename is atomic on POSIX (and same-filesystem on macOS/Linux). On any error the temp file is unlinked. The symlink-dereference is folded into the read step (read from `realpathSync(target)` if it's a symlink, then write a fresh file via the rename), so the user's original config outside the sandbox is never touched.

### FINDING-6 — ProdReady F-07 (Important)
- **Severity:** Important
- **Confidence:** 80
- **File:** `bin/cli.js:51` (agent branch error handling)
- **Category:** production-readiness
- **Source:** production-readiness-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
When `createOpencode` failed because port 4096 was in use, the user got `❌ Agent 启动失败: Failed to start server on port 4096` with no actionable next step. We hit this exact error during smoke testing and had to manually figure out that an orphaned process was holding the port.

**How it was resolved:**
The catch path now matches `EADDRINUSE|port 4096|Failed to start server` and prints:
```
提示: opencode server 默认端口 4096 被占用。可能是上次运行残留：
  lsof -iTCP:4096 -sTCP:LISTEN -Pn   # 查看占用
  kill <pid>                         # 关掉残留进程后重试
```
Combined with FINDING-1's SIGINT cleanup, this should make the failure self-recoverable.

### FINDING-7 — Correctness F1 (Important)
- **Severity:** Important
- **Confidence:** 85
- **File:** `src/mcp/tools/browser.js:269` (`select_page`)
- **Category:** correctness
- **Source:** correctness-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
`_consoleTracking` was set to `true` on the first `list_console_messages` call and never reset. After `select_page` switched to a new tab, the new tab had its own CDP session — but the old `Runtime.consoleAPICalled` listener was still attached to the *previous* page's session. The new page's console messages would silently never show up. The user would think console capture is broken.

**How it was resolved:**
`select_page` now resets `_consoleTracking = false` and clears `_consoleMessages = []` before switching, so the next `list_console_messages` call re-subscribes on the fresh CDP session.

### FINDING-8 — Correctness F2 (Important)
- **Severity:** Important
- **Confidence:** 80
- **File:** `src/mcp/tools/browser.js:152` (`evaluate_script`)
- **Category:** correctness
- **Source:** correctness-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
The tool schema declared `awaitPromise: z.boolean().optional().default(true)` and the handler destructured it as `_awaitPromise`, but never threaded it into `cdpEvaluate`. The user could pass `awaitPromise: false` and it would silently behave as `true`. Misleading API surface.

**How it was resolved:**
Dropped the parameter entirely from the schema and handler signature, and updated the tool description to say "Promises are always awaited". `cdpEvaluate` already hardcodes `awaitPromise: true` and that is the right default for this MCP — fire-and-forget JS is rarely useful here. Honest contract beats false flexibility.

### FINDING-9 — Correctness F3 + extra `restore_session_state`/`get_console_message` (Important)
- **Severity:** Important
- **Confidence:** 85
- **File:** `src/mcp/tools/browser.js:269,387,319`
- **Category:** correctness
- **Source:** correctness-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
`select_page`, `get_console_message`, and `restore_session_state` returned error responses without `isError: true`, violating the MCP error contract. Callers (LLMs) would treat the error as a successful response and try to parse the error message as JSON data.

**How it was resolved:**
Added `isError: true` to all three error returns.

### FINDING-10 — Security F1 (Important)
- **Severity:** Important
- **Confidence:** 85
- **File:** `src/mcp/tools/rebuild.js:64` (`callExpression` filter)
- **Category:** security
- **Source:** security-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
The previous filter rejected `[;\n\r]` and `\b(require|import|exec|spawn)\b`, but missed:
- Unicode line terminators (U+2028, U+2029, U+0085) — JS treats these as newlines
- Backticks (template literal injection via `${...}`)
- Line comments `//` and block comments `/* */` (could mask payload from a human reviewer)
- `eval`, `Function`, `process`, `global`, `globalThis`, `child_process`, `__proto__`, `constructor`
- Unbalanced parentheses (could escape the surrounding `console.log(...)`)
- No length cap (payload stuffing)

The output is written to a generated `entry.js` that the user (or their LLM) is then encouraged to `node entry.js`. Even though this is a developer-local file, allowing arbitrary code injection through an MCP-callable LLM input is the kind of thing that turns into a real CVE.

**How it was resolved:**
Hardened to: 500-char length cap, all Unicode line terminators rejected, semicolons / backticks / `//` / `/*` rejected, expanded identifier blocklist, paren-balance check. New unit tests in `test/rebuild-validators.test.js` cover all 18 negative cases.

### FINDING-11 — Security F2 (Important)
- **Severity:** Important
- **Confidence:** 85
- **File:** `src/mcp/tools/rebuild.js:28` (`taskId` regex)
- **Category:** security
- **Source:** security-agent
- **Resolution:** fixed (round 1)

**What was wrong:**
The previous regex `^[A-Za-z0-9._-]+$` allowed `taskId` to start with a dot, so an LLM could pass `taskId: ".git"` and create `~/.deepspider/rebuild/.git/`. While `path.relative` defended against escape-up traversal, hidden directories inside the rebuild root could still cause name collisions or trick later globs.

**How it was resolved:**
Tightened to `^[A-Za-z0-9_-][A-Za-z0-9._-]*$` — first character must not be a dot. Tests cover `.git`, `.ssh`, `..`, `../etc`, `/abs/path`, plus the positive cases.

### FINDING-12 — Arch F3 (Minor, fixed)
- **Severity:** Minor
- **Confidence:** 75
- **File:** `src/agent/index.js:45`
- **Resolution:** fixed (round 1)

**What was wrong:**
`getSandboxPaths()` was called unconditionally and the result only used inside `if (options.verbose)`. Wasted FS calls in the hot path.

**How it was resolved:**
Inlined into the verbose branch.

### FINDING-13 — Arch F5 (Minor, fixed)
- **Severity:** Minor
- **Confidence:** 80
- **File:** `src/agent/index.js:108`
- **Resolution:** fixed (round 1)

**What was wrong:**
`if (!existing.opencodeJson && !existing.authJson) return 'fresh'` after the `hasAny` early return at line 75 was unreachable.

**How it was resolved:**
Removed the dead branch and replaced with a comment explaining that `link-all` is always safe to return because `initSandbox` skips link creation when the source path is null.

---

## Remaining Findings

### Test Quality F1–F8 (advisory, not blocking)
The Test Quality agent flagged that **all 5 pre-existing test files in `test/`** are smoke scripts using `console.log`, not assertion-based regression tests; and that none of the 7 modified modules had any test coverage at all.

**Action taken in this round:** added two real `node:assert`-based regression suites:
- `test/sandbox.test.js` — 3 tests covering fresh-mode no-touch, backup-on-replace, rollback-on-failure
- `test/rebuild-validators.test.js` — 28 tests covering taskId and callExpression validation

Both suites pass (`31/31`). They are wired to plain `node test/<file>.js` and exit non-zero on failure, so they can be added to a CI matrix later.

**Not addressed (deliberate scope cap):** end-to-end tests for the agent branch in `bin/cli.js`, the wizard's interactive paths, and the MCP tool surfaces in `browser.js` would require spawning child processes / a real opencode server. Out of scope for this fix loop. Tracking as advisory.

### Architecture F10 (Minor, deferred)
`src/cli/commands/config.js:139` reconstructs the `.init-done` path string instead of importing an `INIT_MARKER` constant from `sandbox.js`. Cosmetic, single point of duplication, and `reset()` is rarely modified — left as-is.

---

## Notes

- The fix loop ran in a single round; the second-round re-review was skipped because the user did not request it and all Critical/Important findings were addressable in one pass without ripple effects.
- All touched files pass `node --check` syntax validation.
- The two new test files pass cleanly: `31 passed, 0 failed` total.
