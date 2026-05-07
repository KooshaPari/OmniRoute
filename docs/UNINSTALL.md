# OmniRoute — Uninstall Guide

🌐 **Languages:** 🇺🇸 [English](UNINSTALL.md) | 🇧🇷 [Português (Brasil)](i18n/pt-BR/UNINSTALL.md) | 🇪🇸 [Español](i18n/es/UNINSTALL.md) | 🇫🇷 [Français](i18n/fr/UNINSTALL.md) | 🇮🇹 [Italiano](i18n/it/UNINSTALL.md) | 🇷🇺 [Русский](i18n/ru/UNINSTALL.md) | 🇨🇳 [中文 (简体)](i18n/zh-CN/UNINSTALL.md) | 🇩🇪 [Deutsch](i18n/de/UNINSTALL.md) | 🇮🇳 [हिन्दी](i18n/in/UNINSTALL.md) | 🇹🇭 [ไทย](i18n/th/UNINSTALL.md) | 🇺🇦 [Українська](i18n/uk-UA/UNINSTALL.md) | 🇸🇦 [العربية](i18n/ar/UNINSTALL.md) | 🇯🇵 [日本語](i18n/ja/UNINSTALL.md) | 🇻🇳 [Tiếng Việt](i18n/vi/UNINSTALL.md) | 🇧🇬 [Български](i18n/bg/UNINSTALL.md) | 🇩🇰 [Dansk](i18n/da/UNINSTALL.md) | 🇫🇮 [Suomi](i18n/fi/UNINSTALL.md) | 🇮🇱 [עברית](i18n/he/UNINSTALL.md) | 🇭🇺 [Magyar](i18n/hu/UNINSTALL.md) | 🇮🇩 [Bahasa Indonesia](i18n/id/UNINSTALL.md) | 🇰🇷 [한국어](i18n/ko/UNINSTALL.md) | 🇲🇾 [Bahasa Melayu](i18n/ms/UNINSTALL.md) | 🇳🇱 [Nederlands](i18n/nl/UNINSTALL.md) | 🇳🇴 [Norsk](i18n/no/UNINSTALL.md) | 🇵🇹 [Português (Portugal)](i18n/pt/UNINSTALL.md) | 🇷🇴 [Română](i18n/ro/UNINSTALL.md) | 🇵🇱 [Polski](i18n/pl/UNINSTALL.md) | 🇸🇰 [Slovenčina](i18n/sk/UNINSTALL.md) | 🇸🇪 [Svenska](i18n/sv/UNINSTALL.md) | 🇵🇭 [Filipino](i18n/phi/UNINSTALL.md) | 🇨🇿 [Čeština](i18n/cs/UNINSTALL.md)

This guide covers how to cleanly remove OmniRoute from your system.

---

## Quick Uninstall (v3.6.2+)

OmniRoute provides two built-in scripts for clean removal:

### Keep Your Data

```bash
npm run uninstall
```

This removes the OmniRoute application but **preserves** your database, configurations, API keys, and provider settings in `~/.omniroute/`. Use this if you plan to reinstall later and want to keep your setup.

### Full Removal

```bash
npm run uninstall:full
```

This removes the application **and permanently erases** all data:

- Database (`storage.sqlite`)
- Provider configurations and API keys
- Backup files
- Log files
- All files in the `~/.omniroute/` directory

> ⚠️ **Warning:** `npm run uninstall:full` is irreversible. All your provider connections, combos, API keys, and usage history will be permanently deleted.

---

## Manual Uninstall

### NPM Global Install

```bash
# Remove the global package
npm uninstall -g omniroute

# (Optional) Remove data directory
rm -rf ~/.omniroute
```

### pnpm Global Install

```bash
pnpm uninstall -g omniroute
rm -rf ~/.omniroute
```

### Docker

```bash
# Stop and remove the container
docker stop omniroute
docker rm omniroute

# Remove the volume (deletes all data)
docker volume rm omniroute-data

# (Optional) Remove the image
docker rmi diegosouzapw/omniroute:latest
```

### Docker Compose

```bash
# Stop and remove containers
docker compose down

# Also remove volumes (deletes all data)
docker compose down -v
```

### Electron Desktop App

**Windows:**

- Open `Settings → Apps → OmniRoute → Uninstall`
- Or run the NSIS uninstaller from the install directory

**macOS:**

- Drag `OmniRoute.app` from `/Applications` to Trash
- Remove data: `rm -rf ~/Library/Application Support/omniroute`

**Linux:**

- Remove the AppImage file
- Remove data: `rm -rf ~/.omniroute`

### Source Install (git clone)

```bash
# Remove the cloned directory
rm -rf /path/to/omniroute

# (Optional) Remove data directory
rm -rf ~/.omniroute
```

---

## Data Directories

OmniRoute stores data in the following locations by default:

| Platform      | Default Path                  | Override                  |
| ------------- | ----------------------------- | ------------------------- |
| Linux         | `~/.omniroute/`               | `DATA_DIR` env var        |
| macOS         | `~/.omniroute/`               | `DATA_DIR` env var        |
| Windows       | `%APPDATA%/omniroute/`        | `DATA_DIR` env var        |
| Docker        | `/app/data/` (mounted volume) | `DATA_DIR` env var        |
| XDG-compliant | `$XDG_CONFIG_HOME/omniroute/` | `XDG_CONFIG_HOME` env var |

### Files in the data directory

| File/Directory       | Description                                       |
| -------------------- | ------------------------------------------------- |
| `storage.sqlite`     | Main database (providers, combos, settings, keys) |
| `storage.sqlite-wal` | SQLite write-ahead log (temporary)                |
| `storage.sqlite-shm` | SQLite shared memory (temporary)                  |
| `call_logs/`         | Request payload archives                          |
| `backups/`           | Automatic database backups                        |
| `log.txt`            | Legacy request log (optional)                     |

---

## Verify Complete Removal

After uninstalling, verify there are no remaining files:

```bash
# Check for global npm package
npm list -g omniroute 2>/dev/null

# Check for data directory
ls -la ~/.omniroute/ 2>/dev/null

# Check for running processes
pgrep -f omniroute
```

If any process is still running, stop it:

```bash
pkill -f omniroute
```
