# ArgisMonitor Chocolatey install script (Gate 4, file-only).
#
# This file lives at:  chocolatey-packages/argismonitor/tools/chocolateyinstall.ps1
# It is referenced from `argismonitor.nuspec`.

$ErrorActionPreference = 'Stop'

$packageName = $env:ChocolateyPackageName
$toolsDir     = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$url          = 'https://registry.npmjs.org/argismonitor/-/argismonitor-3.8.44.tgz'
$url64bit     = $url

$packageArgs = @{
  packageName    = $packageName
  unzipLocation  = $toolsDir
  url            = $url
  url64bit       = $url64bit
  checksum       = '<computed at release time>'
  checksumType   = 'sha256'
  checksum64     = '<computed at release time>'
  checksumType64 = 'sha256'
}

Install-ChocolateyZipPackage @packageArgs

# npm install globally from the extracted tarball.
$npmTarball = Join-Path $toolsDir 'argismonitor-3.8.44.tgz'
if (Test-Path $npmTarball) {
    npm install -g $npmTarball --no-audit --no-fund
} else {
    Write-Warning "npm tarball not found at $npmTarball — falling back to npm registry"
    npm install -g argismonitor@3.8.44 --no-audit --no-fund
}

# Legacy alias
$argisExe = Join-Path $env:ChocolateyInstall 'bin\argismonitor.cmd'
$omniExe  = Join-Path $env:ChocolateyInstall 'bin\omniroute.cmd'
if ((Test-Path $argisExe) -and -not (Test-Path $omniExe)) {
    Copy-Item $argisExe $omniExe -Force
}