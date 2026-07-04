//! sharecli-fuse — IO-interception tier of the sharecli hypervisor.
//!
//! This crate implements a FUSE filesystem that sits between agent processes and
//! the real backing filesystem.  By intercepting VFS calls at the FUSE layer we
//! can:
//!
//! * Coalesce redundant reads across concurrent agent sessions.
//! * Cache hot paths (Cargo registry, node_modules, build artefacts) in RAM or
//!   on a fast local device, routing cold misses to the backing path.
//! * Meter and throttle per-process IO to prevent one agent's build from starving
//!   another's.
//! * Record provenance — every write carries a (session-id, timestamp) annotation
//!   in the extended-attribute namespace — without modifying the backing FS.
//!
//! The implementation uses [`fuser`] which provides cross-platform FUSE bindings:
//! Linux via libfuse3 and macOS via macFUSE.  The mount entry point is gated
//! behind `#[cfg(any(target_os = "linux", target_os = "macos"))]`; all other
//! targets compile to a stub that returns an unsupported-platform error.
//!
//! Ported/inspired by the harness-fuse Rust prototype; rewritten on top of
//! `fuser` (vs the earlier Linux-only libfuse ELF binary) to keep the codebase
//! portable and maintainable in pure Rust.

#![warn(missing_docs)]

use std::path::Path;

// ---------------------------------------------------------------------------
// Platform-gated implementation
// ---------------------------------------------------------------------------

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod platform {
    use std::{
        ffi::OsStr,
        os::unix::fs::MetadataExt,
        path::{Path, PathBuf},
        time::{Duration, SystemTime},
    };

    use fuser::{
        Config, Errno, FileAttr, FileHandle, FileType, Filesystem, Generation, INodeNo,
        MountOption, OpenFlags, RenameFlags, ReplyAttr, ReplyData, ReplyDirectory, ReplyEmpty,
        ReplyEntry, ReplyWrite, Request, WriteFlags,
    };
    use tracing::{debug, trace};

    const TTL: Duration = Duration::from_secs(1);
    /// Inode number for the FUSE root (always 1 in libfuse convention).
    const ROOT_INO: u64 = 1;

    /// Passthrough FUSE filesystem that forwards VFS calls to a real backing path.
    ///
    /// This is the attach point for the sharecli hypervisor hooks.  Each method
    /// carries a `// TODO(hypervisor):` marker indicating where caching,
    /// coalescing, or metering logic will be inserted in follow-up work.
    pub struct InterceptFs {
        /// Root of the real filesystem subtree being mirrored.
        backing: PathBuf,
    }

    impl InterceptFs {
        /// Create a new [`InterceptFs`] rooted at `backing`.
        pub fn new(backing: &Path) -> Self {
            Self { backing: backing.to_path_buf() }
        }
    }

    impl Filesystem for InterceptFs {
        /// Resolve `name` inside directory `parent`.
        ///
        /// TODO(hypervisor): insert read-through cache here — check the in-process
        ///   dentry cache before hitting the backing FS.
        fn lookup(&self, _req: &Request, parent: INodeNo, name: &OsStr, reply: ReplyEntry) {
            trace!(?parent, ?name, "lookup");
            if parent.0 != ROOT_INO {
                // TODO(hypervisor): resolve non-root parents via inode map.
                reply.error(Errno::ENOSYS);
                return;
            }
            let path = self.backing.join(name);
            match std::fs::metadata(&path) {
                Ok(meta) => {
                    let attr = metadata_to_attr(2, &meta);
                    reply.entry(&TTL, &attr, Generation(0));
                }
                Err(_) => reply.error(Errno::ENOENT),
            }
        }

        /// Return attributes for an inode.
        ///
        /// TODO(hypervisor): hook per-inode metering counters here so the
        ///   thermal governor can observe per-file-class read pressure.
        fn getattr(&self, _req: &Request, ino: INodeNo, _fh: Option<FileHandle>, reply: ReplyAttr) {
            trace!(?ino, "getattr");
            if ino.0 == ROOT_INO {
                match std::fs::metadata(&self.backing) {
                    Ok(meta) => reply.attr(&TTL, &metadata_to_attr(ROOT_INO, &meta)),
                    Err(_) => reply.error(Errno::ENOENT),
                }
            } else {
                // TODO(hypervisor): resolve ino via inode map; return ENOENT for
                //   unknown inodes until the full walk is wired.
                reply.error(Errno::ENOSYS);
            }
        }

        /// Read `size` bytes at `offset` from the file at `ino`.
        ///
        /// TODO(hypervisor): speculative read-ahead cache — on first miss populate
        ///   a page-aligned buffer in the session cache; serve subsequent reads from
        ///   RAM without touching the backing FS.
        fn read(
            &self,
            _req: &Request,
            ino: INodeNo,
            _fh: FileHandle,
            offset: u64,
            size: u32,
            _flags: OpenFlags,
            _lock: Option<fuser::LockOwner>,
            reply: ReplyData,
        ) {
            debug!(?ino, offset, size, "read");
            // TODO(hypervisor): real passthrough — map ino→path, open backing
            //   file, pread(fd, buf, size, offset).
            reply.error(Errno::ENOSYS);
        }

        /// Write `data` at `offset` into the file at `ino`.
        ///
        /// TODO(hypervisor): write-coalescing — buffer writes per session-id,
        ///   flush in background; attribute each write with (session-id, ts) xattr.
        fn write(
            &self,
            _req: &Request,
            ino: INodeNo,
            _fh: FileHandle,
            offset: u64,
            data: &[u8],
            _write_flags: WriteFlags,
            _flags: OpenFlags,
            _lock: Option<fuser::LockOwner>,
            reply: ReplyWrite,
        ) {
            debug!(?ino, offset, len = data.len(), "write");
            // TODO(hypervisor): passthrough write + provenance xattr injection.
            reply.error(Errno::ENOSYS);
        }

        /// Read directory entries.
        ///
        /// TODO(hypervisor): cache opendir results per session to avoid repeated
        ///   getdents syscalls when multiple agents stat the same tree.
        fn readdir(
            &self,
            _req: &Request,
            ino: INodeNo,
            _fh: FileHandle,
            _offset: u64,
            reply: ReplyDirectory,
        ) {
            debug!(?ino, "readdir");
            // TODO(hypervisor): iterate backing dir, fill reply with real entries.
            reply.error(Errno::ENOSYS);
        }

        fn mkdir(
            &self,
            _req: &Request,
            _parent: INodeNo,
            _name: &OsStr,
            _mode: u32,
            _umask: u32,
            reply: ReplyEntry,
        ) {
            // TODO(hypervisor): passthrough mkdir.
            reply.error(Errno::ENOSYS);
        }

        fn unlink(&self, _req: &Request, _parent: INodeNo, _name: &OsStr, reply: ReplyEmpty) {
            // TODO(hypervisor): passthrough unlink + invalidate cache entry.
            reply.error(Errno::ENOSYS);
        }

        fn rmdir(&self, _req: &Request, _parent: INodeNo, _name: &OsStr, reply: ReplyEmpty) {
            // TODO(hypervisor): passthrough rmdir.
            reply.error(Errno::ENOSYS);
        }

        fn rename(
            &self,
            _req: &Request,
            _parent: INodeNo,
            _name: &OsStr,
            _newparent: INodeNo,
            _newname: &OsStr,
            _flags: RenameFlags,
            reply: ReplyEmpty,
        ) {
            // TODO(hypervisor): passthrough rename + update inode map.
            reply.error(Errno::ENOSYS);
        }
    }

    // -----------------------------------------------------------------------
    // Mount entry point
    // -----------------------------------------------------------------------

    /// Mount the [`InterceptFs`] at `mountpoint`, mirroring `backing`.
    ///
    /// Blocks until the filesystem is unmounted.  Callers should run this on a
    /// dedicated thread or inside a `tokio::task::spawn_blocking` block.
    pub fn mount(mountpoint: &Path, backing: &Path) -> anyhow::Result<()> {
        let fs = InterceptFs::new(backing);
        let mut config = Config::default();
        config.mount_options = vec![
            MountOption::RO,
            MountOption::FSName("sharecli-fuse".to_string()),
            MountOption::AutoUnmount,
        ];
        fuser::mount2(fs, mountpoint, &config)?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn metadata_to_attr(ino: u64, meta: &std::fs::Metadata) -> FileAttr {
        let kind = if meta.is_dir() {
            FileType::Directory
        } else if meta.is_symlink() {
            FileType::Symlink
        } else {
            FileType::RegularFile
        };
        let now = SystemTime::now();
        FileAttr {
            ino: INodeNo(ino),
            size: meta.len(),
            blocks: meta.blocks(),
            atime: meta.accessed().unwrap_or(now),
            mtime: meta.modified().unwrap_or(now),
            ctime: now,
            crtime: now,
            kind,
            perm: meta.mode() as u16,
            nlink: meta.nlink() as u32,
            uid: meta.uid(),
            gid: meta.gid(),
            rdev: meta.rdev() as u32,
            blksize: 512,
            flags: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Public surface — re-export or stub depending on platform
// ---------------------------------------------------------------------------

/// Passthrough FUSE filesystem; attach point for sharecli hypervisor hooks.
///
/// See the crate-level documentation for the full IO-interception design.
#[cfg(any(target_os = "linux", target_os = "macos"))]
pub use platform::InterceptFs;

/// Mount the sharecli FUSE layer at `mountpoint` over `backing`.
///
/// On Linux and macOS this calls `fuser::mount2`; on other platforms it returns
/// an [`anyhow::Error`] indicating the platform is not supported.
pub fn mount(mountpoint: &Path, backing: &Path) -> anyhow::Result<()> {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        platform::mount(mountpoint, backing)
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = (mountpoint, backing);
        anyhow::bail!("sharecli-fuse is only supported on Linux and macOS")
    }
}
