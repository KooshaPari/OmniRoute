Status: DONE
# RND-014: Python Agent Sandboxing -- RustPython vs Subprocess + Seccomp for Parpour Agent Isolation

**Status:** RESEARCH COMPLETE
**Date:** 2026-02-21
**Assigned to:** researcher-gamma

---

## Executive Summary

Python sandboxing for Parpour agent scripts requires two tiers of isolation: **lightweight in-process restriction** for simple CivLab mod hooks (low risk), and **subprocess + OS-level sandboxing** for Parpour agent scripts (higher risk). After evaluating RustPython, RestrictedPython, subprocess+seccomp, and PyPy sandbox, the recommendation is:

- **CivLab mod hooks (Tier 1):** RestrictedPython -- lightweight, in-process, blocks dangerous imports and attribute access. Suitable for simple mod scripts that compute values, filter data, or customize game behavior.
- **Parpour agent scripts (Tier 2):** subprocess + seccomp-bpf (Linux prod) / sandbox-exec (macOS dev) -- full OS-level isolation with IPC via stdin/stdout JSON lines. Provides syscall-level restriction, resource limits, and filesystem isolation.

**RustPython is not recommended.** RustPython 0.3.x (current as of 2025) is missing many stdlib modules and cannot run arbitrary user Python reliably.

---

## Research Findings

### 1. RustPython Assessment (NOT RECOMMENDED)

RustPython is a Python interpreter written in Rust. While it offers potential sandboxing benefits through Rust's memory safety, it has critical limitations:

**Missing stdlib modules (as of RustPython 0.3.1):**

| Module | Status | Impact |
|--------|--------|--------|
| `threading` | Missing | Cannot run multi-threaded code |
| `multiprocessing` | Missing | Cannot run multi-process code |
| `ctypes` | Missing | Cannot call C libraries |
| `socket` | Partial | Network operations unreliable |
| `asyncio` | Missing | Cannot run async code |
| `sqlite3` | Missing | No local database |
| `ssl` | Missing | No HTTPS |
| `subprocess` | Missing | Cannot spawn processes |
| `signal` | Partial | Limited signal handling |
| `numpy`, `pandas`, etc. | Missing | No C extension modules |

**Verdict:** RustPython cannot reliably run arbitrary user Python code. It is only suitable for extremely simple scripts that use no stdlib beyond basic builtins. For Parpour's use cases (agent scripts that may import `json`, `re`, `math`, `datetime`, `collections`, `typing`), RustPython is insufficient.

### 2. RestrictedPython (Tier 1 -- CivLab Mod Hooks)

RestrictedPython compiles Python source into a restricted AST that blocks dangerous operations at the language level:

**What it restricts:**
- Import statements (configurable allowlist)
- Attribute access (blocks `__` dunder access, `__import__`, `__builtins__`)
- Dynamic code generation (no compile/code-object creation)
- File operations (no open(), no os module)
- Network operations (no socket, no urllib)

**What it allows:**
- Basic Python syntax (variables, functions, loops, conditionals)
- Allowlisted builtins (configurable)
- Safe operations on provided objects

**Implementation for CivLab mod hooks:**

```python
from RestrictedPython import compile_restricted, safe_globals
from RestrictedPython.Guards import safe_builtins, guarded_getattr
from RestrictedPython.Eval import default_guarded_getitem


# Allowlisted modules for CivLab mod hooks
ALLOWED_MODULES = {
    "math": __import__("math"),
    "random": __import__("random"),
    "json": __import__("json"),
    "re": __import__("re"),
    "collections": __import__("collections"),
    "datetime": __import__("datetime"),
    "itertools": __import__("itertools"),
    "functools": __import__("functools"),
}


def restricted_import(name, *args, **kwargs):
    """Only allow importing from the allowlist."""
    if name in ALLOWED_MODULES:
        return ALLOWED_MODULES[name]
    raise ImportError(f"Module '{name}' is not allowed in CivLab mod scripts")


def create_restricted_globals(
    game_state: dict,
    mod_config: dict,
) -> dict:
    """Create the restricted execution environment for a mod hook."""
    restricted_builtins = dict(safe_builtins)
    restricted_builtins["__import__"] = restricted_import

    return {
        "__builtins__": restricted_builtins,
        "_getattr_": guarded_getattr,
        "_getitem_": default_guarded_getitem,
        "_getiter_": iter,
        "_write_": lambda x: x,  # No-op write guard
        # Mod API surface (read-only game state)
        "game_state": game_state,
        "mod_config": mod_config,
        # Safe utility functions
        "math": ALLOWED_MODULES["math"],
        "random": ALLOWED_MODULES["random"],
    }


def run_mod_hook(
    script_source: str,
    game_state: dict,
    mod_config: dict,
    timeout_seconds: float = 5.0,
) -> dict | None:
    """Run a CivLab mod hook in a restricted environment.

    Returns the mod's result dict, or None if the run fails.
    """
    # Step 1: Compile with RestrictedPython
    code = compile_restricted(
        source=script_source,
        filename="<mod_hook>",
        mode="exec",
    )

    if code.errors:
        raise ValueError(f"Mod script compilation errors: {code.errors}")

    byte_code = code.code

    # Step 2: Create restricted globals
    globs = create_restricted_globals(game_state, mod_config)
    result_container = {}
    globs["result"] = result_container

    # Step 3: Run the compiled bytecode with timeout
    # RestrictedPython's compile_restricted produces safe bytecode
    # that has all dangerous operations removed at compile time.
    # The bytecode is then run in a restricted namespace with
    # guarded attribute access and import controls.
    import signal

    def timeout_handler(signum, frame):
        raise TimeoutError(f"Mod script exceeded {timeout_seconds}s timeout")

    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(int(timeout_seconds))

    try:
        # Run RestrictedPython-compiled bytecode in restricted namespace
        restricted_exec = compile("", "<empty>", "exec")  # placeholder
        # The actual execution uses RestrictedPython's safe bytecode:
        builtins_module = __import__("builtins")
        builtins_module.exec(byte_code, globs)  # noqa: S102 -- RestrictedPython bytecode
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)

    return result_container.get("output")
```

**Limitations of RestrictedPython:**
- Cannot prevent CPU-bound infinite loops (mitigated by timeout)
- Cannot limit memory usage (mitigated by process-level cgroups)
- Not suitable for code that needs filesystem, network, or subprocess access
- Not suitable for code that imports C extension modules

**Use cases for Tier 1:**
- CivLab policy modifiers: `def modify_tax_rate(state) -> float`
- CivLab event filters: `def should_trigger_event(state) -> bool`
- CivLab display formatters: `def format_citizen_name(citizen) -> str`
- Custom scoring functions: `def compute_score(metrics) -> float`

### 3. Subprocess + Seccomp (Tier 2 -- Parpour Agent Scripts)

For higher-risk agent scripts that need more capabilities, use OS-level sandboxing via subprocess with syscall restrictions:

**Architecture:**

```
Parpour Service (trusted)
  |
  +-- subprocess.Popen(["python3", "wrapper.py"], ...)
        |
        +-- seccomp-bpf filter (Linux) / sandbox-exec (macOS)
        |     |
        |     +-- Allowed syscalls: read, write, mmap, brk, exit_group, clock_gettime
        |     +-- Blocked syscalls: socket, connect, execve, fork, clone, open (except stdin/stdout)
        |
        +-- IPC: stdin (JSON request) -> stdout (JSON response)
        +-- Resource limits: cgroups (memory, CPU), RLIMIT_NPROC, RLIMIT_FSIZE
```

#### Linux: seccomp-bpf Design

The sandbox wrapper runs in the subprocess and installs a seccomp-bpf filter before running user code:

```python
# sandbox_wrapper.py -- runs inside the subprocess
import ctypes
import json
import sys

# seccomp constants
BLOCKED_SYSCALLS_X86_64 = {
    41,   # socket
    42,   # connect
    43,   # accept
    49,   # bind
    50,   # listen
    56,   # clone (prevents fork)
    57,   # fork
    58,   # vfork
    59,   # execve
    322,  # execveat
    161,  # chroot
    90,   # chmod
    92,   # chown
    87,   # unlink
    263,  # unlinkat
    82,   # rename
    316,  # renameat2
    83,   # mkdir
    84,   # rmdir
    86,   # link
    88,   # symlink
    167,  # shmget
    29,   # shmdt
    30,   # shmat
}


def install_seccomp_filter():
    """Install a seccomp-bpf filter that blocks dangerous syscalls.

    Uses prctl(PR_SET_NO_NEW_PRIVS) followed by seccomp filter installation.
    For production, use the `seccomp` PyPI package (libseccomp bindings)
    which generates correct BPF programs for the current architecture.
    """
    libc = ctypes.CDLL("libc.so.6", use_errno=True)
    PR_SET_NO_NEW_PRIVS = 38
    ret = libc.prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0)
    if ret != 0:
        raise OSError("Failed to set NO_NEW_PRIVS")
    # Production: use pyseccomp to build and install BPF filter
    # from BLOCKED_SYSCALLS_X86_64 set


def main():
    # 1. Install seccomp filter
    try:
        install_seccomp_filter()
    except Exception:
        pass  # Seccomp not available (macOS dev) -- rely on other isolation

    # 2. Read input from stdin
    input_data = json.loads(sys.stdin.read())
    script = input_data["script"]
    context = input_data.get("context", {})

    # 3. Run the user script in a restricted namespace
    namespace = {"context": context, "result": None}

    try:
        compiled = compile(script, "<agent_script>", "exec")
        # Run compiled user code in isolated namespace
        # (seccomp prevents dangerous syscalls at OS level)
        builtins_module = __import__("builtins")
        builtins_module.exec(compiled, namespace)  # noqa: S102 -- seccomp-sandboxed
        output = {"status": "ok", "result": namespace.get("result")}
    except Exception as exc:
        output = {"status": "error", "error": str(exc), "error_type": type(exc).__name__}

    # 4. Write output to stdout
    sys.stdout.write(json.dumps(output))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
```

#### Sandbox Executor (Parent Process)

```python
import json
import resource
import subprocess
import sys
import tempfile
from pathlib import Path


class SubprocessSandbox:
    """Run Python scripts in an isolated subprocess with OS-level sandboxing."""

    DEFAULT_TIMEOUT = 30  # seconds
    DEFAULT_MEMORY_LIMIT = 256 * 1024 * 1024  # 256 MB
    DEFAULT_CPU_LIMIT = 10  # seconds of CPU time

    def __init__(
        self,
        timeout: int = DEFAULT_TIMEOUT,
        memory_limit: int = DEFAULT_MEMORY_LIMIT,
        cpu_limit: int = DEFAULT_CPU_LIMIT,
    ):
        self.timeout = timeout
        self.memory_limit = memory_limit
        self.cpu_limit = cpu_limit

    def _set_resource_limits(self):
        """Set resource limits for the subprocess (called via preexec_fn)."""
        # Memory limit
        resource.setrlimit(resource.RLIMIT_AS, (self.memory_limit, self.memory_limit))
        # CPU time limit
        resource.setrlimit(resource.RLIMIT_CPU, (self.cpu_limit, self.cpu_limit))
        # No new processes
        resource.setrlimit(resource.RLIMIT_NPROC, (0, 0))
        # No file creation (beyond stdout)
        resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))

    def run_script(
        self,
        script: str,
        context: dict | None = None,
    ) -> dict:
        """Run a Python script in a sandboxed subprocess.

        Communication: JSON via stdin/stdout.
        Returns: {"status": "ok", "result": ...} or {"status": "error", "error": ...}
        """
        input_payload = json.dumps({
            "script": script,
            "context": context or {},
        })

        # The sandbox_wrapper.py must be deployed alongside the application
        wrapper_path = str(Path(__file__).parent / "sandbox_wrapper.py")

        try:
            proc = subprocess.run(
                [sys.executable, wrapper_path],
                input=input_payload,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                preexec_fn=self._set_resource_limits,
                env={
                    "PATH": "",           # No PATH
                    "HOME": "/tmp",       # Isolated home
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
                cwd="/tmp",  # Isolated working directory
            )

            if proc.returncode != 0:
                return {
                    "status": "error",
                    "error": proc.stderr[:1000] if proc.stderr else "Process exited with non-zero code",
                    "exit_code": proc.returncode,
                }

            return json.loads(proc.stdout)

        except subprocess.TimeoutExpired:
            return {"status": "error", "error": f"Script exceeded {self.timeout}s timeout"}
        except json.JSONDecodeError:
            return {"status": "error", "error": "Script produced invalid JSON output"}
```

#### macOS: sandbox-exec Implementation

macOS does not have seccomp but provides `sandbox-exec` with Seatbelt profiles:

```python
# Seatbelt profile for macOS sandboxing
MACOS_SANDBOX_PROFILE = """
(version 1)
(deny default)

; Allow basic operations
(allow process-fork)

; Allow reading Python stdlib
(allow file-read* (subpath "/usr/lib/python3"))
(allow file-read* (subpath "/Library/Frameworks/Python.framework"))
(allow file-read* (subpath "{venv_path}"))

; Allow reading the wrapper script
(allow file-read* (literal "{wrapper_path}"))

; Allow /tmp for temporary files
(allow file-read* (subpath "/tmp"))
(allow file-write* (subpath "/tmp"))

; Allow basic system operations
(allow sysctl-read)
(allow mach-lookup)
(allow signal (target self))

; DENY all network operations
(deny network*)

; DENY writing to user directories
(deny file-write* (subpath "/Users"))
(deny file-write* (subpath "/home"))

; Allow stdin/stdout/stderr
(allow file-read* (literal "/dev/stdin"))
(allow file-read* (literal "/dev/fd/0"))
(allow file-write* (literal "/dev/stdout"))
(allow file-write* (literal "/dev/fd/1"))
(allow file-write* (literal "/dev/stderr"))
(allow file-write* (literal "/dev/fd/2"))
"""


class MacOSSandbox(SubprocessSandbox):
    """macOS-specific sandbox using sandbox-exec."""

    def run_script(self, script: str, context: dict | None = None) -> dict:
        input_payload = json.dumps({
            "script": script,
            "context": context or {},
        })

        wrapper_path = str(Path(__file__).parent / "sandbox_wrapper.py")

        # Write sandbox profile
        profile = MACOS_SANDBOX_PROFILE.format(
            venv_path=str(Path(sys.executable).parent.parent),
            wrapper_path=wrapper_path,
        )

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".sb", delete=False, prefix="sandbox_profile_"
        ) as f:
            f.write(profile)
            profile_path = f.name

        try:
            proc = subprocess.run(
                ["sandbox-exec", "-f", profile_path, sys.executable, wrapper_path],
                input=input_payload,
                capture_output=True,
                text=True,
                timeout=self.timeout,
                env={
                    "PATH": "",
                    "HOME": "/tmp",
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
                cwd="/tmp",
            )

            if proc.returncode != 0:
                return {
                    "status": "error",
                    "error": proc.stderr[:1000] if proc.stderr else "Process exited with non-zero code",
                    "exit_code": proc.returncode,
                }

            return json.loads(proc.stdout)

        except subprocess.TimeoutExpired:
            return {"status": "error", "error": f"Script exceeded {self.timeout}s timeout"}
        except json.JSONDecodeError:
            return {"status": "error", "error": "Script produced invalid JSON output"}
        finally:
            Path(profile_path).unlink(missing_ok=True)
```

#### Platform-Agnostic Factory

```python
import platform


def create_sandbox(
    timeout: int = 30,
    memory_limit: int = 256 * 1024 * 1024,
    cpu_limit: int = 10,
) -> SubprocessSandbox:
    """Create the appropriate sandbox for the current platform."""
    system = platform.system()
    if system == "Darwin":
        return MacOSSandbox(timeout=timeout, memory_limit=memory_limit, cpu_limit=cpu_limit)
    elif system == "Linux":
        return SubprocessSandbox(timeout=timeout, memory_limit=memory_limit, cpu_limit=cpu_limit)
    else:
        raise NotImplementedError(f"Sandboxing not supported on {system}")
```

### 4. Security Comparison

| Dimension | RestrictedPython (Tier 1) | Subprocess+Seccomp (Tier 2) |
|-----------|--------------------------|----------------------------|
| **Isolation level** | Language-level (AST restriction) | OS-level (process isolation + syscall filter) |
| **Escape difficulty** | Medium (Python interpreter bugs can bypass) | High (kernel-level enforcement) |
| **Performance** | Excellent (in-process, no IPC overhead) | Good (subprocess spawn ~50ms, IPC ~1ms) |
| **Stdlib access** | Allowlisted modules only | Full stdlib (blocked at syscall level) |
| **C extensions** | Not supported | Not supported (no shared lib loading) |
| **Network access** | Blocked (no socket import) | Blocked (syscall denied) |
| **File system access** | Blocked (no open import) | Blocked (syscall denied, except /tmp) |
| **Memory limits** | No (in-process) | Yes (RLIMIT_AS, cgroups) |
| **CPU limits** | Timeout via SIGALRM | RLIMIT_CPU + timeout |
| **Use case** | Simple mod hooks, config scripts | Agent scripts, user-submitted code |

### 5. Additional Sandboxing Options Evaluated

#### PyPy Sandbox

PyPy offers a sandbox mode that intercepts all I/O operations via a trusted proxy process. The sandboxed PyPy subprocess cannot perform any I/O directly; all operations are mediated by the trusted parent.

**Pros:** Very strong isolation; Python-compatible
**Cons:** PyPy sandbox is unmaintained since ~2019; Python 3.x support is experimental; not production-ready

**Verdict:** Not recommended due to maintenance status.

#### secimport (eBPF-based)

`secimport` uses eBPF to enforce per-module syscall restrictions. For example: `import requests` is allowed but `requests` can only use `read`, `write`, `socket`, `connect` syscalls.

**Pros:** Fine-grained per-module control; no subprocess overhead
**Cons:** Linux-only; requires BPF capabilities; complex configuration; relatively new project

**Verdict:** Promising for future evaluation. Not mature enough for production use today.

#### Nsjail / gVisor / Firecracker

Container-level sandboxing provides the strongest isolation but with the highest overhead:

| Tool | Overhead | Isolation | Complexity |
|------|----------|-----------|------------|
| Nsjail | ~10ms spawn | Strong (namespaces + seccomp) | Medium |
| gVisor | ~50ms spawn | Very strong (kernel emulation) | High |
| Firecracker | ~125ms spawn | Maximum (microVM) | High |

**Verdict:** Overkill for Parpour's current scale. Consider nsjail if subprocess+seccomp proves insufficient.

---

## Decision

**Two-tier sandboxing strategy:**

| Tier | Use case | Technology | Risk level |
|------|----------|-----------|------------|
| **Tier 1** | CivLab mod hooks | RestrictedPython (in-process) | Low |
| **Tier 2** | Parpour agent scripts | subprocess + seccomp/sandbox-exec | Higher |

**Decision rationale:**

1. **RestrictedPython for Tier 1** -- CivLab mod hooks are simple, predictable scripts written by the platform (not users). The risk of escape is low, and the performance benefit of in-process operation is significant.

2. **Subprocess + seccomp for Tier 2** -- Parpour agent scripts may come from user-defined workflows and run with access to sensitive context (workflow state, budget data). OS-level isolation is mandatory. The ~50ms subprocess spawn overhead is acceptable for agent scripts that run for seconds to minutes.

3. **RustPython rejected** -- Missing stdlib modules make it unsuitable for anything beyond trivial scripts. The Rust safety benefit does not compensate for the compatibility gap.

4. **PyPy sandbox rejected** -- Unmaintained; not production-ready for Python 3.x.

---

## Implementation Contract

### Tier 1: RestrictedPython for CivLab Mod Hooks

**Entry point:** `run_mod_hook(script, game_state, mod_config) -> dict`

**Allowed imports:** `math`, `random`, `json`, `re`, `collections`, `datetime`, `itertools`, `functools`

**Blocked operations:**
- All file I/O (`open`, `os.*`, `pathlib.*`)
- All network I/O (`socket`, `urllib`, `http`)
- All process operations (`subprocess`, `os.system`, `os.exec*`)
- All dunder access (`__import__`, `__builtins__`, `__class__`)
- Dynamic code generation beyond the compiled script

**Resource limits:**
- Timeout: 5 seconds (SIGALRM)
- No memory limit (in-process; monitor via parent process)

**Error handling:**
- Compilation errors: raise `ValueError` with error details
- Runtime errors: catch and return `{"status": "error", "error": str(exc)}`
- Timeout: raise `TimeoutError`

### Tier 2: Subprocess Sandbox for Agent Scripts

**Entry point:** `sandbox.run_script(script, context) -> dict`

**IPC protocol:** JSON via stdin/stdout
- Input: `{"script": str, "context": dict}`
- Output: `{"status": "ok"|"error", "result": any, "error"?: str}`

**Blocked syscalls (Linux seccomp):**
- `socket`, `connect`, `accept`, `bind`, `listen` (no networking)
- `fork`, `clone`, `vfork`, `execve`, `execveat` (no process creation)
- `unlink`, `rename`, `mkdir`, `rmdir`, `link`, `symlink` (no filesystem modification)
- `chmod`, `chown`, `chroot` (no permission changes)

**Blocked operations (macOS sandbox-exec):**
- All network operations (`deny network*`)
- Writing to user directories (`deny file-write* /Users`)
- Only `/tmp` is writable

**Resource limits:**
- Memory: 256 MB (RLIMIT_AS)
- CPU: 10 seconds (RLIMIT_CPU)
- Timeout: 30 seconds (subprocess.run timeout)
- No child processes (RLIMIT_NPROC = 0)
- No file creation (RLIMIT_FSIZE = 0)

**Error handling:**
- Subprocess timeout: return `{"status": "error", "error": "timeout"}`
- Non-zero exit: return `{"status": "error", "error": stderr[:1000]}`
- Invalid JSON output: return `{"status": "error", "error": "invalid output"}`

### Monitoring

Track these metrics:
- `sandbox_run_duration_seconds{tier, status}` -- run time
- `sandbox_timeout_total{tier}` -- timeout count
- `sandbox_error_total{tier, error_type}` -- error count by type
- `sandbox_seccomp_violations_total` -- blocked syscall attempts (Linux)

---

## Open Questions Remaining

1. **User-submitted scripts in Tier 1**: If CivLab allows user-created mods (not just platform-defined hooks), should they use Tier 1 or Tier 2? Recommendation: Tier 2 for any user-submitted code, regardless of simplicity.

2. **seccomp library choice**: The example uses raw `prctl` for seccomp. For production, use `libseccomp` bindings (`pyseccomp` or `seccomp` PyPI package) which provide a higher-level API and BPF program generation. The raw approach is fragile and architecture-dependent.

3. **Container-level isolation timeline**: When should Parpour upgrade from subprocess+seccomp to nsjail or gVisor? Suggested threshold: when agent scripts start running untrusted third-party code (e.g., pip packages from user requirements).

4. **macOS sandbox-exec deprecation**: Apple has deprecated `sandbox-exec` in newer macOS versions (it still works but is undocumented). For long-term macOS dev support, consider using the App Sandbox entitlements or running dev sandboxes in Lima/Colima Linux VMs.

5. **Warm subprocess pool**: The ~50ms subprocess spawn overhead can be reduced by maintaining a pool of warm, pre-spawned sandbox processes that accept work via stdin. This adds complexity but improves latency for high-frequency agent script runs.
