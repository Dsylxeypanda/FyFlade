param(
  [switch]$InitializeSigning,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$signingDirectory = Join-Path $projectRoot "src-tauri\.signing"
# Keep the legacy key filename so an existing release key remains usable.
$privateKeyPath = Join-Path $signingDirectory "chatnest-updater-secure.key"
$publicKeyPath = "$privateKeyPath.pub"

function Read-FyFladeSigningPassword([string]$prompt) {
  $securePassword = Read-Host -Prompt $prompt -AsSecureString
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $securePassword.Dispose()
  }
}

if ($InitializeSigning) {
  if (Test-Path -LiteralPath $privateKeyPath) {
    throw "A FyFlade updater key already exists. It was not overwritten."
  }

  New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null
  $signingPassword = Read-FyFladeSigningPassword "Choose a password for the FyFlade updater key"
  $confirmation = Read-FyFladeSigningPassword "Type the same password again"

  if ($signingPassword.Length -lt 12) {
    throw "The updater signing password must contain at least 12 characters."
  }

  if ($signingPassword -cne $confirmation) {
    throw "The two updater signing passwords did not match."
  }

  try {
    & npx tauri signer generate --write-keys $privateKeyPath --password $signingPassword --ci

    if ($LASTEXITCODE -ne 0) {
      throw "Tauri could not generate the updater signing key."
    }
  }
  finally {
    $signingPassword = $null
    $confirmation = $null
  }
}

if (-not (Test-Path -LiteralPath $privateKeyPath) -or -not (Test-Path -LiteralPath $publicKeyPath)) {
  throw "The FyFlade updater signing key is missing. Run this script once with -InitializeSigning."
}

$tauriConfigPath = Join-Path $projectRoot "src-tauri\tauri.conf.json"
$configuredPublicKey = (Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json).plugins.updater.pubkey
$localPublicKey = (Get-Content -LiteralPath $publicKeyPath -Raw).Trim()
if ($localPublicKey -cne $configuredPublicKey.Trim()) {
  throw "The updater public key in tauri.conf.json does not match the private release key. The build was stopped before signing."
}

if ($SkipBuild) {
  Write-Output "FyFlade updater signing is initialized."
  exit 0
}

$youtubeClientId = $env:VITE_YOUTUBE_OAUTH_CLIENT_ID
$productionEnvironmentPath = Join-Path $projectRoot ".env.production.local"

if ([string]::IsNullOrWhiteSpace($youtubeClientId) -and (Test-Path -LiteralPath $productionEnvironmentPath)) {
  $youtubeClientIdLine = Get-Content -LiteralPath $productionEnvironmentPath |
    Where-Object { $_ -match '^\s*VITE_YOUTUBE_OAUTH_CLIENT_ID\s*=' } |
    Select-Object -Last 1

  if ($youtubeClientIdLine) {
    $youtubeClientId = ($youtubeClientIdLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
  }
}

if ([string]::IsNullOrWhiteSpace($youtubeClientId)) {
  $youtubeConfigPath = Join-Path $projectRoot "src\youtubeConfig.ts"
  $youtubeConfigSource = Get-Content -LiteralPath $youtubeConfigPath -Raw
  $embeddedClientId = [regex]::Match(
    $youtubeConfigSource,
    '["''](?<id>[0-9A-Za-z._-]+\.apps\.googleusercontent\.com)["'']'
  )
  if ($embeddedClientId.Success) {
    $youtubeClientId = $embeddedClientId.Groups['id'].Value
  }
}

if ($youtubeClientId -notmatch '^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$') {
  throw "The official FyFlade YouTube OAuth Client ID is missing or malformed. Configure the embedded client ID or a release-only override before creating a public release."
}

$releasePassword = Read-FyFladeSigningPassword "Updater signing password"
$previousCargoHome = $env:CARGO_HOME
$previousCargoOffline = $env:CARGO_NET_OFFLINE

try {
  $env:TAURI_SIGNING_PRIVATE_KEY = $privateKeyPath
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $releasePassword
  $env:CARGO_HOME = Join-Path $projectRoot ".cargo-home"
  $env:CARGO_NET_OFFLINE = "true"
  Push-Location $projectRoot

  try {
    & npx tauri build --bundles nsis
    if ($LASTEXITCODE -ne 0) {
      throw "The FyFlade release build failed."
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue

  if ($null -eq $previousCargoHome) {
    Remove-Item Env:CARGO_HOME -ErrorAction SilentlyContinue
  } else {
    $env:CARGO_HOME = $previousCargoHome
  }

  if ($null -eq $previousCargoOffline) {
    Remove-Item Env:CARGO_NET_OFFLINE -ErrorAction SilentlyContinue
  } else {
    $env:CARGO_NET_OFFLINE = $previousCargoOffline
  }

  $releasePassword = $null
}

Get-ChildItem -LiteralPath (Join-Path $projectRoot "src-tauri\target\release\bundle\nsis") -File |
  Select-Object Name, Length, LastWriteTime
