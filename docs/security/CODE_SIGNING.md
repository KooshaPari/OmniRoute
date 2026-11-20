---
title: Code Signing for OmniRoute Desktop
description: Guidance for signing and notarizing OmniRoute desktop artifacts.
version: 3.8.49-koosha.0
lastUpdated: 2026-07-18
---

# Code Signing for OmniRoute Desktop

> How to sign and notarize the Electron desktop app for macOS and Windows.

## macOS

### Prerequisites

1. **Apple Developer Account** — $99/year, enrolled in the Apple Developer Program
2. **Apple Developer ID Application certificate** — For distributing outside the App Store
3. **Notarization credentials** — App-specific password or API key for `rcodesign`

### Setup

```bash
# Install rcodesign
brew install rcodesign

# Configure rcodesign credentials in the local keychain or pass its
# documented API issuer/key flags when submitting for notarization.
```

### Build signed app

```bash
cd electron
CSC_LINK=file:///path/to/cert.p12 \
CSC_KEY_PASSWORD=your-password \
npm run build
```

### Notarize

After building, notarize the `.dmg`/`.zip`:

```bash
rcodesign notary-submit \
  --api-issuer <issuer-id> \
  --api-key <key-id> \
  OmniRoute-3.8.43.dmg
```

### CI Integration

Automated signing is not currently configured in the tracked workflows.
Release builds remain unsigned until a dedicated macOS signing job and its
repository secrets are provisioned.

## Windows

### Prerequisites

1. **Code signing certificate** — From DigiCert, Sectigo, or similar CA
2. **Azure Key Vault** — For EV code signing (recommended)

### Setup

```bash
export AZURE_KEY_VAULT_URI=https://omniroute.vault.azure.net
export AZURE_CLIENT_ID=xxx
export AZURE_CLIENT_SECRET=xxx
export AZURE_TENANT_ID=xxx
```

### Build signed app

```powershell
$env:CSC_LINK = "file:///path/to/cert.p12"
$env:CSC_KEY_PASSWORD = "your-password"
cd electron
npm run build
```

## Verification

```bash
# macOS: Verify signature
codesign -dv OmniRoute.app

# macOS: Verify notarization
spctl -a -v OmniRoute.app

# Windows: Verify signature
signtool verify /pa /v OmniRoute.exe
```
