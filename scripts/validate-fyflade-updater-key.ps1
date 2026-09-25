$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$privateKeyPath = Join-Path $projectRoot "src-tauri\.signing\chatnest-updater-secure.key"
$publicKeyPath = "$privateKeyPath.pub"
$tauriConfigPath = Join-Path $projectRoot "src-tauri\tauri.conf.json"
$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("fyflade-key-check-" + [guid]::NewGuid().ToString("N"))
$password = $null

function Read-FyFladeSigningPassword([string]$Prompt) {
  $securePassword = Read-Host -Prompt $Prompt -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $securePassword.Dispose()
  }
}

try {
  foreach ($requiredPath in @($privateKeyPath, $publicKeyPath, $tauriConfigPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      throw "Required updater-signing file is missing: $requiredPath"
    }
  }

  $configuredPublicKey = (
    Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
  ).plugins.updater.pubkey.Trim()
  $localPublicKey = (Get-Content -LiteralPath $publicKeyPath -Raw).Trim()

  if ($configuredPublicKey -cne $localPublicKey) {
    throw "The private updater key does not belong to the public key compiled into FyFlade."
  }

  New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
  $testFile = Join-Path $temporaryDirectory "fyflade-updater-key-check.txt"
  Set-Content -LiteralPath $testFile -Value "FyFlade updater signing key validation" -Encoding UTF8

  $password = Read-FyFladeSigningPassword "FyFlade updater signing password"
  if ([string]::IsNullOrWhiteSpace($password)) {
    throw "No password was entered."
  }

  Push-Location $projectRoot
  try {
    & npx tauri signer sign --private-key-path $privateKeyPath --password $password $testFile
    if ($LASTEXITCODE -ne 0) {
      throw "The updater key could not be unlocked. Check the password and try again."
    }
  }
  finally {
    Pop-Location
  }

  if (-not (Test-Path -LiteralPath "$testFile.sig")) {
    throw "The key command finished without creating a test signature."
  }

  Write-Host ""
  Write-Host "Updater key validated successfully." -ForegroundColor Green
  Write-Host "The password was not saved." -ForegroundColor Green
}
finally {
  $password = $null
  if (Test-Path -LiteralPath $temporaryDirectory) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
}
