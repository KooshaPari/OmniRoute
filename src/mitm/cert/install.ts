import fs from "fs";
import crypto from "crypto";
import {
  execFileText,
  execFileWithPassword,
  getErrorMessage,
  quotePowerShell,
  runElevatedPowerShell,
} from "../systemCommands.ts";

const IS_WIN = process.platform === "win32";

// Get SHA1 fingerprint from cert file using Node.js crypto
function getCertFingerprint(certPath: string): string {
  const pem = fs.readFileSync(certPath, "utf-8");
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""), "base64");
  const pairs = crypto.createHash("sha1").update(der).digest("hex").toUpperCase().match(/.{2}/g);
  if (!pairs) {
    throw new Error(`Unable to compute certificate fingerprint for ${certPath}`);
  }
  return pairs.join(":");
}

/**
 * Check if certificate is already installed in system store
 */
export async function checkCertInstalled(certPath: string): Promise<boolean> {
  if (IS_WIN) {
    return checkCertInstalledWindows(certPath);
  }
  return checkCertInstalledMac(certPath);
}

async function checkCertInstalledMac(certPath: string): Promise<boolean> {
  try {
    const fingerprint = getCertFingerprint(certPath);
    const output = await execFileText("security", [
      "find-certificate",
      "-a",
      "-Z",
      "/Library/Keychains/System.keychain",
    ]);
    return output.toUpperCase().includes(fingerprint);
  } catch {
    return false;
  }
}

async function checkCertInstalledWindows(_certPath: string): Promise<boolean> {
  try {
    await execFileText("certutil", ["-store", "Root", "daily-cloudcode-pa.googleapis.com"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install SSL certificate to system trust store
 */
export async function installCert(sudoPassword: string, certPath: string): Promise<void> {
  if (!fs.existsSync(certPath)) {
    throw new Error(`Certificate file not found: ${certPath}`);
  }

  const isInstalled = await checkCertInstalled(certPath);
  if (isInstalled) {
    console.log("✅ Certificate already installed");
    return;
  }

  if (IS_WIN) {
    await installCertWindows(certPath);
  } else {
    await installCertMac(sudoPassword, certPath);
  }
}

// ── Graceful fallback for containers / headless environments (#4546) ──────────
//
// In a container the system trust store can't be written (no sudo / read-only
// store / no interactive auth), so installCert() throws and used to abort the
// whole Agent Bridge start. The helpers below let callers treat that as a
// recoverable "skip" with a manual-install guide, instead of a hard failure.

const CERT_DOWNLOAD_URL = "/api/tools/agent-bridge/cert/download";

/** Why an automatic cert install did not complete. */
export type CertInstallReason = "canceled" | "environment";

/** Platform-specific steps the operator can run to trust the MITM root CA by hand. */
export interface CertManualGuide {
  platform: NodeJS.Platform;
  certPath: string;
  downloadUrl: string;
  steps: string[];
}

/** Structured outcome of an attempted cert install (never throws for env failures). */
export interface CertInstallResult {
  installed: boolean;
  skipped: boolean;
  reason?: CertInstallReason;
  /** Safe, already-sanitized message (no stack trace). */
  message?: string;
  manualGuide?: CertManualGuide;
}

/**
 * Classify a cert-install failure message. Only an explicit user cancellation
 * counts as "canceled"; every other failure (missing trust store, no sudo,
 * read-only FS, container) is treated as an "environment" failure that the
 * operator can resolve with a manual install.
 */
export function classifyCertInstallError(message: string): CertInstallReason {
  return /cancel+ed/i.test(message) ? "canceled" : "environment";
}

/**
 * Build the manual-install instructions for trusting the MITM root CA on the
 * given platform. Pure + platform-overridable so it is fully unit-testable.
 */
export function buildCertManualGuide(
  certPath: string,
  platform: NodeJS.Platform = process.platform
): CertManualGuide {
  let steps: string[];
  if (platform === "win32") {
    steps = [
      `certutil -addstore -f Root "${certPath}"`,
      "Or import it via certmgr.msc → Trusted Root Certification Authorities → Certificates → Import.",
    ];
  } else if (platform === "darwin") {
    steps = [
      `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${certPath}"`,
    ];
  } else {
    // Linux — match the detected distro's anchor dir + refresh command.
    const config = getLinuxCertConfig();
    steps = [
      `sudo cp "${certPath}" ${config.dir}/${LINUX_CERT_NAME}`,
      `sudo ${config.cmd}`,
      `Container-friendly per-tool trust (no root needed): set NODE_EXTRA_CA_CERTS="${certPath}" (Node) or REQUESTS_CA_BUNDLE="${certPath}" (Python), or import "${certPath}" into your client's trust store.`,
    ];
  }
  return { platform, certPath, downloadUrl: CERT_DOWNLOAD_URL, steps };
}

/**
 * Attempt to install the cert, returning a structured result instead of
 * throwing on environment failures. A user-canceled authorization is reported
 * with reason "canceled" (not skipped); any other failure is reported as a
 * skippable "environment" failure carrying a manual-install guide so the bridge
 * can still start and the operator can trust the CA by hand.
 */
export async function installCertResult(
  sudoPassword: string,
  certPath: string
): Promise<CertInstallResult> {
  try {
    await installCert(sudoPassword, certPath);
    return { installed: true, skipped: false };
  } catch (error) {
    const message = getErrorMessage(error);
    const reason = classifyCertInstallError(message);
    if (reason === "canceled") {
      return { installed: false, skipped: false, reason, message };
    }
    return {
      installed: false,
      skipped: true,
      reason,
      message,
      manualGuide: buildCertManualGuide(certPath),
    };
  }
}

async function installCertMac(sudoPassword: string, certPath: string): Promise<void> {
  try {
    await execFileWithPassword(
      "sudo",
      [
        "-S",
        "security",
        "add-trusted-cert",
        "-d",
        "-r",
        "trustRoot",
        "-k",
        "/Library/Keychains/System.keychain",
        certPath,
      ],
      sudoPassword
    );
    console.log(`✅ Installed certificate to system keychain: ${certPath}`);
  } catch (error) {
    const message = getErrorMessage(error);
    const msg = message.includes("canceled")
      ? "User canceled authorization"
      : "Certificate install failed";
    throw new Error(msg);
  }
}

async function installCertWindows(certPath: string): Promise<void> {
  await runElevatedPowerShell(`
    $certPath = ${quotePowerShell(certPath)};
    $proc = Start-Process certutil -ArgumentList @('-addstore','Root',$certPath) -Verb RunAs -Wait -PassThru;
    if ($proc.ExitCode -ne 0) { throw "certutil exited with code $($proc.ExitCode)" }
  `);
  console.log(`✅ Installed certificate to Windows Root store`);
}

/**
 * Uninstall SSL certificate from system store
 */
export async function uninstallCert(sudoPassword: string, certPath: string): Promise<void> {
  const isInstalled = await checkCertInstalled(certPath);
  if (!isInstalled) {
    console.log("Certificate not found in system store");
    return;
  }

  if (IS_WIN) {
    await uninstallCertWindows();
  } else {
    await uninstallCertMac(sudoPassword, certPath);
  }
}

async function uninstallCertMac(sudoPassword: string, certPath: string): Promise<void> {
  const fingerprint = getCertFingerprint(certPath).replace(/:/g, "");
  try {
    await execFileWithPassword(
      "sudo",
      [
        "-S",
        "security",
        "delete-certificate",
        "-Z",
        fingerprint,
        "/Library/Keychains/System.keychain",
      ],
      sudoPassword
    );
    console.log("✅ Uninstalled certificate from system keychain");
  } catch (err) {
    throw new Error("Failed to uninstall certificate");
  }
}

async function uninstallCertWindows(): Promise<void> {
  await runElevatedPowerShell(`
    $proc = Start-Process certutil -ArgumentList @('-delstore','Root','daily-cloudcode-pa.googleapis.com') -Verb RunAs -Wait -PassThru;
    if ($proc.ExitCode -ne 0) { throw "certutil exited with code $($proc.ExitCode)" }
  `);
  console.log("✅ Uninstalled certificate from Windows Root store");
}
