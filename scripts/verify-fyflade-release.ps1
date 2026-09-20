param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath
)

$ErrorActionPreference = "Stop"
$resolvedInstaller = (Resolve-Path -LiteralPath $InstallerPath).Path
$projectRoot = Split-Path -Parent $PSScriptRoot
$tauriConfig = Get-Content -LiteralPath (Join-Path $projectRoot "src-tauri\tauri.conf.json") -Raw | ConvertFrom-Json

if ($tauriConfig.productName -cne "FyFlade") {
  throw "The Tauri product name is not FyFlade."
}

if ($tauriConfig.version -cne "1.0.0") {
  throw "The technical release version must be 1.0.0 for FyFlade 1.0."
}

$updaterSignaturePath = "$resolvedInstaller.sig"
if (-not (Test-Path -LiteralPath $updaterSignaturePath)) {
  throw "The mandatory Tauri updater signature is missing: $updaterSignaturePath"
}

if ((Get-Item -LiteralPath $updaterSignaturePath).Length -lt 32) {
  throw "The Tauri updater signature file is unexpectedly small."
}

$authenticode = Get-AuthenticodeSignature -LiteralPath $resolvedInstaller
if ($authenticode.Status -ne "Valid") {
  throw "The installer does not have a valid Windows Authenticode signature. Status: $($authenticode.Status). Do not publish it yet."
}

$hash = Get-FileHash -LiteralPath $resolvedInstaller -Algorithm SHA256
[pscustomobject]@{
  Product = "FyFlade"
  DisplayVersion = "1.0"
  TechnicalVersion = $tauriConfig.version
  Installer = $resolvedInstaller
  Authenticode = $authenticode.Status
  Sha256 = $hash.Hash
  UpdaterSignature = $updaterSignaturePath
}
