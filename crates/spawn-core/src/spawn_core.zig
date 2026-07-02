//! spawn_core — low-level scheduling/spawn hot core.
//!
//! Exported over a plain C ABI so any caller (Rust, C, …) can link against
//! the static lib without a language-specific runtime.
//!
//! # Why Zig for this layer
//!
//! * Direct syscall / libc access — `std.c` pthread, posix_spawn, waitpid,
//!   setpriority — with no abstraction penalty.
//! * Explicit heap allocator (`std.heap.c_allocator`) — allocation failure is
//!   a return value, not a panic or a hidden unwinder.
//! * Zero-ceremony C ABI: `export fn` emits an unmangled symbol immediately
//!   consumable by Rust `extern "C"` without bindgen.
//! * The semaphore uses POSIX mutex + condvar, which map 1-to-1 onto two
//!   `std.c` calls — no async executor, no hidden thread pool.
//! * `posix_spawn` (macOS) / `fork`+`exec` (Linux) + `waitpid` are trivial
//!   `std.c` / `std.posix` calls at exactly the right abstraction level.
//!
//! # FFI boundary contract (Rust side)
//!
//! * All functions return `i32`: 0 = success, negative errno on failure,
//!   positive PID for `spc_spawn`.
//! * `spc_semaphore_try_acquire` returns 0 = acquired, 1 = no slot, < 0 error.
//! * Semaphore objects are heap-allocated; callers receive an opaque pointer
//!   and MUST call `spc_semaphore_destroy` when done.
//! * `SpawnParams` is `extern struct` — layout matches C struct conventions.

const std = @import("std");
const builtin = @import("builtin");
const is_macos = builtin.os.tag == .macos;
const is_linux = builtin.os.tag == .linux;

// ---------------------------------------------------------------------------
// Semaphore — POSIX mutex + condvar counting semaphore
// ---------------------------------------------------------------------------
//
// We use a plain integer `count` protected by a pthread mutex, signalled with
// a condvar.  This is the textbook POSIX semaphore implementation; we roll our
// own so the Zig core has no OS-semaphore dependency and works identically on
// macOS and Linux.

const Semaphore = struct {
    mutex: std.c.pthread_mutex_t,
    cond: std.c.pthread_cond_t,
    count: usize,
    max: usize,
};

/// Allocate and initialise a counting semaphore with `max` permits.
/// Returns an opaque pointer on success, null on allocation failure.
export fn spc_semaphore_new(max: usize) callconv(.c) ?*anyopaque {
    const sem = std.heap.c_allocator.create(Semaphore) catch return null;
    sem.* = .{
        .mutex = std.c.PTHREAD_MUTEX_INITIALIZER,
        .cond = std.c.PTHREAD_COND_INITIALIZER,
        .count = max,
        .max = max,
    };
    return @ptrCast(sem);
}

/// Acquire one permit, blocking until a slot is free.
/// Returns 0 on success, negative errno on error.
export fn spc_semaphore_acquire(ptr: *anyopaque) callconv(.c) i32 {
    const sem: *Semaphore = @ptrCast(@alignCast(ptr));
    const rc = std.c.pthread_mutex_lock(&sem.mutex);
    if (rc != .SUCCESS) return -@as(i32, @intCast(@intFromEnum(rc)));
    while (sem.count == 0) {
        const wrc = std.c.pthread_cond_wait(&sem.cond, &sem.mutex);
        if (wrc != .SUCCESS) {
            _ = std.c.pthread_mutex_unlock(&sem.mutex);
            return -@as(i32, @intCast(@intFromEnum(wrc)));
        }
    }
    sem.count -= 1;
    _ = std.c.pthread_mutex_unlock(&sem.mutex);
    return 0;
}

/// Try to acquire one permit without blocking.
/// Returns 0 if acquired, 1 if no permits available, negative errno on error.
export fn spc_semaphore_try_acquire(ptr: *anyopaque) callconv(.c) i32 {
    const sem: *Semaphore = @ptrCast(@alignCast(ptr));
    const rc = std.c.pthread_mutex_lock(&sem.mutex);
    if (rc != .SUCCESS) return -@as(i32, @intCast(@intFromEnum(rc)));
    const got: i32 = if (sem.count > 0) blk: {
        sem.count -= 1;
        break :blk 0;
    } else 1;
    _ = std.c.pthread_mutex_unlock(&sem.mutex);
    return got;
}

/// Release one permit, waking one waiter.
/// Returns 0 on success, negative errno on error.
export fn spc_semaphore_release(ptr: *anyopaque) callconv(.c) i32 {
    const sem: *Semaphore = @ptrCast(@alignCast(ptr));
    const rc = std.c.pthread_mutex_lock(&sem.mutex);
    if (rc != .SUCCESS) return -@as(i32, @intCast(@intFromEnum(rc)));
    if (sem.count < sem.max) sem.count += 1;
    _ = std.c.pthread_cond_signal(&sem.cond);
    _ = std.c.pthread_mutex_unlock(&sem.mutex);
    return 0;
}

/// Return the approximate number of available permits (read under lock).
export fn spc_semaphore_available(ptr: *anyopaque) callconv(.c) usize {
    const sem: *Semaphore = @ptrCast(@alignCast(ptr));
    _ = std.c.pthread_mutex_lock(&sem.mutex);
    const n = sem.count;
    _ = std.c.pthread_mutex_unlock(&sem.mutex);
    return n;
}

/// Destroy the semaphore and free its memory.  Do not use `ptr` after this.
export fn spc_semaphore_destroy(ptr: *anyopaque) callconv(.c) void {
    const sem: *Semaphore = @ptrCast(@alignCast(ptr));
    _ = std.c.pthread_mutex_destroy(&sem.mutex);
    _ = std.c.pthread_cond_destroy(&sem.cond);
    std.heap.c_allocator.destroy(sem);
}

// ---------------------------------------------------------------------------
// Process spawn with scheduling policy
// ---------------------------------------------------------------------------

/// Parameters for a throttled build-harness spawn.
/// All strings are null-terminated; argv/envp follow execve conventions.
pub const SpawnParams = extern struct {
    /// Executable path (null-terminated).
    program: [*:0]const u8,
    /// Null-terminated argv array; argv[0] = program name.
    argv: [*:null]const ?[*:0]const u8,
    /// Null-terminated envp array, or null to inherit the parent environment.
    envp: ?[*:null]const ?[*:0]const u8,
    /// Working directory (null = inherit).
    cwd: ?[*:0]const u8,
    /// nice(2) increment applied via setpriority(PRIO_PROCESS).  0 = skip.
    nice_delta: i32,
    /// Non-zero = request background-efficiency QoS on macOS via
    /// setpriority(PRIO_DARWIN_BG).  Ignored on non-macOS platforms.
    background_qos: u8,
};

// libc declarations not always in std.c across platforms.
extern "c" fn setpriority(which: c_int, who: c_uint, prio: c_int) c_int;
extern "c" fn waitpid(pid: std.c.pid_t, status: ?*c_int, options: c_int) std.c.pid_t;

// posix_spawn family — macOS only (Linux uses fork+exec below).
const posix_spawn_fn = if (is_macos)
    *const fn (
        pid: *std.c.pid_t,
        path: [*:0]const u8,
        file_actions: ?*anyopaque,
        attrp: ?*anyopaque,
        argv: [*:null]const ?[*:0]const u8,
        envp: [*:null]const ?[*:0]const u8,
    ) callconv(.c) c_int
else
    void;

/// Spawn a child process according to `params`.
///
/// Scheduling applied after the child is running:
///   1. `setpriority(PRIO_PROCESS, pid, nice_delta)` when `nice_delta != 0`.
///   2. `setpriority(PRIO_DARWIN_BG, pid, 0)` on macOS when `background_qos != 0`,
///      placing the child in the background-efficiency scheduling tier.
///
/// Returns the child PID (> 0) on success, or a negative errno on failure.
export fn spc_spawn(params: *const SpawnParams) callconv(.c) i32 {
    const pid = if (is_macos)
        spawn_macos(params)
    else
        spawn_posix(params);

    if (pid <= 0) return pid; // error

    // --- Apply scheduling policy to the child ---

    if (params.nice_delta != 0) {
        const PRIO_PROCESS: c_int = 0;
        _ = setpriority(PRIO_PROCESS, @intCast(pid), params.nice_delta);
    }

    if (is_macos and params.background_qos != 0) {
        // PRIO_DARWIN_BG = 0x1000: places the process in the background-
        // efficiency scheduling tier (lower CPU, disk, network priority).
        const PRIO_DARWIN_BG: c_int = 0x1000;
        _ = setpriority(PRIO_DARWIN_BG, @intCast(pid), 0);
    }

    return pid;
}

/// Wait for child `pid` to exit.
/// Returns the process exit status (0–255) on success, negative errno on failure.
export fn spc_waitpid(pid: i32) callconv(.c) i32 {
    var status: c_int = 0;
    const ret = waitpid(@intCast(pid), &status, 0);
    if (ret < 0) {
        // errno is in std.c.getErrno on some versions; use @intFromEnum on E.
        return -1; // simplified: any waitpid failure returns -1
    }
    // WEXITSTATUS: extract upper byte of wait status.
    return (status >> 8) & 0xff;
}

// ---------------------------------------------------------------------------
// macOS spawn path — posix_spawn + file_actions for chdir
// ---------------------------------------------------------------------------

fn spawn_macos(params: *const SpawnParams) i32 {
    if (!is_macos) unreachable;

    // posix_spawn is available on macOS via std.c.
    var pid: std.c.pid_t = 0;

    // Use raw C structs via extern declarations to avoid version skew.
    // We pass null for file_actions and attrp when cwd is not needed.
    const envp: [*:null]const ?[*:0]const u8 = params.envp orelse
        @ptrCast(std.c.environ);

    var rc: c_int = 0;

    if (params.cwd != null) {
        // With a cwd, we need file_actions + addchdir_np.
        // Declare the structs as opaque blobs matching Darwin ABI sizes.
        var fa: [sizeof_posix_spawn_file_actions_t]u8 = undefined;
        var attr: [sizeof_posix_spawnattr_t]u8 = undefined;

        rc = posix_spawn_file_actions_init(@ptrCast(&fa));
        if (rc != 0) return -rc;
        defer _ = posix_spawn_file_actions_destroy(@ptrCast(&fa));

        rc = posix_spawnattr_init(@ptrCast(&attr));
        if (rc != 0) return -rc;
        defer _ = posix_spawnattr_destroy(@ptrCast(&attr));

        rc = posix_spawn_file_actions_addchdir_np(@ptrCast(&fa), params.cwd.?);
        if (rc != 0) return -rc;

        rc = posix_spawn(&pid, params.program, @ptrCast(&fa), @ptrCast(&attr),
            params.argv, envp);
    } else {
        rc = posix_spawn(&pid, params.program, null, null, params.argv, envp);
    }

    if (rc != 0) return -rc;
    return @intCast(pid);
}

// Darwin ABI sizes for posix_spawn structs (opaque to Zig).
const sizeof_posix_spawn_file_actions_t: usize = if (is_macos) 152 else 0;
const sizeof_posix_spawnattr_t: usize = if (is_macos) 376 else 0;

extern "c" fn posix_spawn(
    pid: *std.c.pid_t,
    path: [*:0]const u8,
    file_actions: ?*anyopaque,
    attrp: ?*anyopaque,
    argv: [*:null]const ?[*:0]const u8,
    envp: [*:null]const ?[*:0]const u8,
) c_int;
extern "c" fn posix_spawn_file_actions_init(fa: *anyopaque) c_int;
extern "c" fn posix_spawn_file_actions_destroy(fa: *anyopaque) c_int;
extern "c" fn posix_spawn_file_actions_addchdir_np(fa: *anyopaque, path: [*:0]const u8) c_int;
extern "c" fn posix_spawnattr_init(attr: *anyopaque) c_int;
extern "c" fn posix_spawnattr_destroy(attr: *anyopaque) c_int;

// ---------------------------------------------------------------------------
// POSIX (Linux) spawn path — fork + execve
// ---------------------------------------------------------------------------

fn spawn_posix(params: *const SpawnParams) i32 {
    if (is_macos) unreachable;

    const pid = std.posix.fork() catch return -1;
    if (pid == 0) {
        // Child: apply cwd, then exec.
        if (params.cwd) |cwd| {
            std.posix.chdir(std.mem.sliceTo(cwd, 0)) catch std.posix.exit(127);
        }
        std.posix.execveZ(
            params.program,
            params.argv,
            params.envp orelse @ptrCast(std.c.environ),
        ) catch {};
        std.posix.exit(127);
    }
    return @intCast(pid);
}

// ---------------------------------------------------------------------------
// Tests (run with `zig build test`)
// ---------------------------------------------------------------------------

test "semaphore: acquire and release" {
    const sem = spc_semaphore_new(2).?;
    defer spc_semaphore_destroy(sem);

    try std.testing.expectEqual(@as(usize, 2), spc_semaphore_available(sem));

    try std.testing.expectEqual(@as(i32, 0), spc_semaphore_acquire(sem));
    try std.testing.expectEqual(@as(usize, 1), spc_semaphore_available(sem));

    try std.testing.expectEqual(@as(i32, 0), spc_semaphore_acquire(sem));
    try std.testing.expectEqual(@as(usize, 0), spc_semaphore_available(sem));

    // No permits left — try_acquire must return 1 (not acquired).
    try std.testing.expectEqual(@as(i32, 1), spc_semaphore_try_acquire(sem));

    // Release one — try_acquire should succeed.
    try std.testing.expectEqual(@as(i32, 0), spc_semaphore_release(sem));
    try std.testing.expectEqual(@as(i32, 0), spc_semaphore_try_acquire(sem));
}

test "semaphore: cap respected under sequential load" {
    const CAP: usize = 3;
    const sem = spc_semaphore_new(CAP).?;
    defer spc_semaphore_destroy(sem);

    var i: usize = 0;
    while (i < CAP) : (i += 1) {
        try std.testing.expectEqual(@as(i32, 0), spc_semaphore_acquire(sem));
    }
    try std.testing.expectEqual(@as(usize, 0), spc_semaphore_available(sem));
    try std.testing.expectEqual(@as(i32, 1), spc_semaphore_try_acquire(sem));

    i = 0;
    while (i < CAP) : (i += 1) {
        try std.testing.expectEqual(@as(i32, 0), spc_semaphore_release(sem));
    }
    try std.testing.expectEqual(@as(usize, CAP), spc_semaphore_available(sem));
}

test "spawn and waitpid: /usr/bin/true" {
    const argv = [_:null]?[*:0]const u8{ "/usr/bin/true", null };
    const params = SpawnParams{
        .program = "/usr/bin/true",
        .argv = &argv,
        .envp = null,
        .cwd = null,
        .nice_delta = 0,
        .background_qos = 0,
    };
    const pid = spc_spawn(&params);
    try std.testing.expect(pid > 0);
    const exit_code = spc_waitpid(pid);
    try std.testing.expectEqual(@as(i32, 0), exit_code);
}

test "spawn with nice delta" {
    const argv = [_:null]?[*:0]const u8{ "/usr/bin/true", null };
    const params = SpawnParams{
        .program = "/usr/bin/true",
        .argv = &argv,
        .envp = null,
        .cwd = null,
        .nice_delta = 5,
        .background_qos = 0,
    };
    const pid = spc_spawn(&params);
    try std.testing.expect(pid > 0);
    _ = spc_waitpid(pid);
}

test "spawn with background qos (macos only)" {
    if (!is_macos) return error.SkipZigTest;
    const argv = [_:null]?[*:0]const u8{ "/usr/bin/true", null };
    const params = SpawnParams{
        .program = "/usr/bin/true",
        .argv = &argv,
        .envp = null,
        .cwd = null,
        .nice_delta = 0,
        .background_qos = 1,
    };
    const pid = spc_spawn(&params);
    try std.testing.expect(pid > 0);
    _ = spc_waitpid(pid);
}
