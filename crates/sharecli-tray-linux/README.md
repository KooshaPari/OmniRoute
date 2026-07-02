# sharecli-tray-linux

Linux systemtray client for sharecli using freedesktop (ksni) protocol.

## Features

- Systemtray icon with process manager integration
- Health snapshot display (managed processes, memory usage)
- D-Bus integration via zbus + ksni
- Async Tokio-based IPC over Unix socket

## Building

Linux only (macOS/Windows: ignored via `#[cfg(target_os = "linux")]`).

```bash
# On Linux with dbus dev headers
sudo apt install libdbus-1-dev pkg-config  # Ubuntu
sudo dnf install dbus-devel pkgconf-pkg-config  # Fedora

cargo build -p sharecli-tray-linux --release
```

## Running

```bash
# Start sharecli daemon
sharecli-ipc &

# Run the tray
./target/release/sharecli-tray
```

The tray will register with the systemtray service and display a persistent icon.

## Protocol

- **Transport**: Unix domain socket (`~/.local/share/sharecli/ipc.sock`)
- **Format**: NDJSON (newline-delimited JSON)
- **RPC**: JSON-RPC 2.0 method calls (health.status, process.list, etc.)

## Architecture Notes

The Linux tray uses the freedesktop systemtray spec (implemented by GNOME, KDE, Xfce, etc.). The ksni crate handles D-Bus registration and the tray lifecycle.

Unlike the macOS (Swift/AppKit) or Windows (WinUI 3) clients, the Linux tray is lightweight and does not maintain a separate window—it's purely a menu/status provider to the desktop environment.
