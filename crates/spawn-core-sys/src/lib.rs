//! FFI declarations for the Zig `spawn_core` static library.
//!
//! # FFI boundary
//!
//! The Zig side exports plain C ABI functions (`export fn` in Zig, no name
//! mangling).  This crate declares them with `extern "C"` and exposes thin
//! safe wrappers.  No bindgen is needed — the boundary is intentionally small
//! (7 functions + 1 `#[repr(C)]` struct).
//!
//! All raw functions return `i32`: 0 = success, negative errno on failure.
//! `spc_semaphore_try_acquire` returns 1 when no slot is available (not an
//! error).  `spc_spawn` returns the child PID (> 0) on success.
//!
//! # Safety invariants
//!
//! * `SemaphoreHandle` is an opaque heap pointer allocated by Zig's
//!   `std.heap.c_allocator`.  It must not be used after `spc_semaphore_destroy`.
//! * `SpawnParams` must have all pointer fields pointing to valid null-terminated
//!   C strings for the duration of the `spc_spawn` call.
//! * `spc_waitpid` is a thin wrapper around `waitpid(2)` — the same threading
//!   rules apply (only call from the thread that forked/spawned the child, or
//!   ensure no other thread is racing on the same PID).

use std::ffi::CStr;
use std::os::raw::{c_char, c_int, c_uchar};
use std::ptr;

// ---------------------------------------------------------------------------
// Raw FFI declarations (unsafe, C ABI)
// ---------------------------------------------------------------------------

/// Opaque semaphore pointer allocated by Zig.  Never construct directly.
#[repr(transparent)]
pub struct SemaphoreHandle(*mut std::ffi::c_void);

// SAFETY: the Zig semaphore is protected by a pthread mutex internally; sharing
// the handle across threads is safe as long as the pointer is valid.
unsafe impl Send for SemaphoreHandle {}
unsafe impl Sync for SemaphoreHandle {}

/// Spawn parameters passed to `spc_spawn`.
///
/// All pointer fields must remain valid for the duration of the call.
/// Layout matches the Zig `extern struct SpawnParams`.
#[repr(C)]
pub struct SpawnParams {
    /// Null-terminated executable path.
    pub program: *const c_char,
    /// Null-terminated argv array (last element = null).
    pub argv: *const *const c_char,
    /// Null-terminated envp array, or null to inherit parent environment.
    pub envp: *const *const c_char,
    /// Working directory (null = inherit).
    pub cwd: *const c_char,
    /// Nice increment via `setpriority(PRIO_PROCESS)`. 0 = skip.
    pub nice_delta: c_int,
    /// Non-zero = apply background QoS on macOS. Ignored on Linux.
    pub background_qos: c_uchar,
}

extern "C" {
    pub fn spc_semaphore_new(max: usize) -> *mut std::ffi::c_void;
    pub fn spc_semaphore_acquire(ptr: *mut std::ffi::c_void) -> c_int;
    pub fn spc_semaphore_try_acquire(ptr: *mut std::ffi::c_void) -> c_int;
    pub fn spc_semaphore_release(ptr: *mut std::ffi::c_void) -> c_int;
    pub fn spc_semaphore_available(ptr: *mut std::ffi::c_void) -> usize;
    pub fn spc_semaphore_destroy(ptr: *mut std::ffi::c_void);
    pub fn spc_spawn(params: *const SpawnParams) -> c_int;
    pub fn spc_waitpid(pid: c_int) -> c_int;
}

// ---------------------------------------------------------------------------
// Safe wrappers
// ---------------------------------------------------------------------------

/// Safe RAII wrapper around the Zig semaphore.
///
/// Allocated from Zig's `std.heap.c_allocator`; freed on drop via
/// `spc_semaphore_destroy`.
pub struct ZigSemaphore {
    ptr: *mut std::ffi::c_void,
}

impl ZigSemaphore {
    /// Create a new semaphore with `max` permits.
    ///
    /// # Panics
    ///
    /// Panics if Zig allocation fails (extremely unlikely — only `c_allocator`
    /// failing to get memory from the OS).
    pub fn new(max: usize) -> Self {
        // SAFETY: spc_semaphore_new allocates + initialises; non-null on success.
        let ptr = unsafe { spc_semaphore_new(max.max(1)) };
        assert!(!ptr.is_null(), "spc_semaphore_new: allocation failed");
        Self { ptr }
    }

    /// Acquire one permit, blocking until a slot is free.
    pub fn acquire(&self) -> Result<(), std::io::Error> {
        // SAFETY: ptr is valid; spc_semaphore_acquire is thread-safe.
        let rc = unsafe { spc_semaphore_acquire(self.ptr) };
        if rc == 0 {
            Ok(())
        } else {
            Err(std::io::Error::from_raw_os_error(-rc))
        }
    }

    /// Try to acquire one permit without blocking.
    ///
    /// Returns `true` if a permit was acquired, `false` if the semaphore is full.
    pub fn try_acquire(&self) -> Result<bool, std::io::Error> {
        // SAFETY: ptr is valid.
        let rc = unsafe { spc_semaphore_try_acquire(self.ptr) };
        match rc {
            0 => Ok(true),
            1 => Ok(false),
            n => Err(std::io::Error::from_raw_os_error(-n)),
        }
    }

    /// Release one permit, waking a waiter if any.
    pub fn release(&self) -> Result<(), std::io::Error> {
        // SAFETY: ptr is valid.
        let rc = unsafe { spc_semaphore_release(self.ptr) };
        if rc == 0 {
            Ok(())
        } else {
            Err(std::io::Error::from_raw_os_error(-rc))
        }
    }

    /// Return the approximate number of available permits.
    pub fn available(&self) -> usize {
        // SAFETY: ptr is valid.
        unsafe { spc_semaphore_available(self.ptr) }
    }
}

impl Drop for ZigSemaphore {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            // SAFETY: ptr was allocated by spc_semaphore_new; no further use after drop.
            unsafe { spc_semaphore_destroy(self.ptr) };
            self.ptr = ptr::null_mut();
        }
    }
}

// SAFETY: the Zig semaphore is thread-safe internally.
unsafe impl Send for ZigSemaphore {}
unsafe impl Sync for ZigSemaphore {}

/// Spawn a process with optional scheduling policy.
///
/// `program` is the path to the executable.  `args` is the full argument list
/// (including argv[0]).  `envp` is `None` to inherit the parent environment.
/// `cwd` is `None` to inherit the working directory.
///
/// Returns the child PID on success.
pub fn zig_spawn(
    program: &CStr,
    args: &[*const c_char],
    envp: Option<&[*const c_char]>,
    cwd: Option<&CStr>,
    nice_delta: i32,
    background_qos: bool,
) -> Result<i32, std::io::Error> {
    // args and envp must be null-terminated pointer arrays.
    // The caller must ensure the last element is null.
    let params = SpawnParams {
        program: program.as_ptr(),
        argv: args.as_ptr(),
        envp: envp.map(|e| e.as_ptr()).unwrap_or(ptr::null()),
        cwd: cwd.map(|c| c.as_ptr()).unwrap_or(ptr::null()),
        nice_delta,
        background_qos: if background_qos { 1 } else { 0 },
    };

    // SAFETY: params pointers are valid for the duration of this call.
    let pid = unsafe { spc_spawn(&params) };
    if pid > 0 {
        Ok(pid)
    } else {
        Err(std::io::Error::from_raw_os_error(-pid))
    }
}

/// Wait for child `pid` to exit. Returns exit status (0–255).
pub fn zig_waitpid(pid: i32) -> Result<i32, std::io::Error> {
    // SAFETY: spc_waitpid wraps waitpid(2).
    let rc = unsafe { spc_waitpid(pid) };
    if rc >= 0 {
        Ok(rc)
    } else {
        Err(std::io::Error::from_raw_os_error(-rc))
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semaphore_acquire_release() {
        let sem = ZigSemaphore::new(2);
        assert_eq!(sem.available(), 2);

        sem.acquire().unwrap();
        assert_eq!(sem.available(), 1);

        sem.acquire().unwrap();
        assert_eq!(sem.available(), 0);

        // try_acquire must fail when full.
        assert!(!sem.try_acquire().unwrap());

        sem.release().unwrap();
        assert_eq!(sem.available(), 1);

        assert!(sem.try_acquire().unwrap());
        assert_eq!(sem.available(), 0);
    }

    #[test]
    fn semaphore_cap_enforced() {
        let sem = ZigSemaphore::new(3);
        sem.acquire().unwrap();
        sem.acquire().unwrap();
        sem.acquire().unwrap();
        assert!(!sem.try_acquire().unwrap(), "semaphore must block at cap");
        sem.release().unwrap();
        assert!(sem.try_acquire().unwrap());
    }

    #[test]
    fn spawn_true_exits_zero() {
        use std::ffi::CString;
        let prog = CString::new("/usr/bin/true").unwrap();
        let argv0 = CString::new("true").unwrap();
        let args: Vec<*const std::os::raw::c_char> = vec![argv0.as_ptr(), std::ptr::null()];

        let pid = zig_spawn(&prog, &args, None, None, 0, false).expect("spawn failed");
        assert!(pid > 0);
        let status = zig_waitpid(pid).expect("waitpid failed");
        assert_eq!(status, 0);
    }

    #[test]
    fn spawn_with_nice_delta() {
        use std::ffi::CString;
        let prog = CString::new("/usr/bin/true").unwrap();
        let argv0 = CString::new("true").unwrap();
        let args: Vec<*const std::os::raw::c_char> = vec![argv0.as_ptr(), std::ptr::null()];

        let pid = zig_spawn(&prog, &args, None, None, 5, false).expect("spawn failed");
        assert!(pid > 0);
        let _ = zig_waitpid(pid);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn spawn_with_background_qos() {
        use std::ffi::CString;
        let prog = CString::new("/usr/bin/true").unwrap();
        let argv0 = CString::new("true").unwrap();
        let args: Vec<*const std::os::raw::c_char> = vec![argv0.as_ptr(), std::ptr::null()];

        let pid = zig_spawn(&prog, &args, None, None, 0, true).expect("spawn failed");
        assert!(pid > 0);
        let _ = zig_waitpid(pid);
    }
}
