param(
  [switch]$SkipBuild,
  [switch]$AllowUnsignedDevelopmentBuild
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$tauriConfigPath = Join-Path $projectRoot "src-tauri\tauri.conf.json"
$tauriConfig = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
$version = [string]$tauriConfig.version
$portableRoot = Join-Path $projectRoot "release\portable"
$packageName = "FyFlade-$version-windows-x64-portable"
$packageDirectory = Join-Path $portableRoot $packageName
$archivePath = "$packageDirectory.zip"
$executableSource = Join-Path $projectRoot "src-tauri\target\release\fyflade.exe"

if ($tauriConfig.productName -cne "FyFlade") {
  throw "The Tauri product name is not FyFlade."
}

if (-not $SkipBuild) {
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

  if ($youtubeClientId -notmatch '^[0-9A-Za-z._-]+\.apps\.googleusercontent\.com$') {
    throw "The official FyFlade YouTube OAuth Client ID is missing. Set it before creating a portable release."
  }

  $previousCargoHome = $env:CARGO_HOME
  $previousCargoOffline = $env:CARGO_NET_OFFLINE

  try {
    $env:CARGO_HOME = Join-Path $projectRoot ".cargo-home"
    $env:CARGO_NET_OFFLINE = "true"
    Push-Location $projectRoot
    try {
      & npx tauri build --no-bundle
      if ($LASTEXITCODE -ne 0) {
        throw "The FyFlade portable application build failed."
      }
    }
    finally {
      Pop-Location
    }
  }
  finally {
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
  }
}

if (-not (Test-Path -LiteralPath $executableSource)) {
  throw "FyFlade.exe was not found. Build the application before packaging it."
}

$signature = Get-AuthenticodeSignature -LiteralPath $executableSource
if (-not $AllowUnsignedDevelopmentBuild -and $signature.Status -ne "Valid") {
  throw "FyFlade.exe does not have a valid Windows Authenticode signature. Status: $($signature.Status). The public portable package was not created."
}

if (Test-Path -LiteralPath $packageDirectory) {
  throw "The portable output directory already exists and was not overwritten: $packageDirectory"
}
if (Test-Path -LiteralPath $archivePath) {
  throw "The portable ZIP already exists and was not overwritten: $archivePath"
}

New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null
Copy-Item -LiteralPath $executableSource -Destination (Join-Path $packageDirectory "FyFlade.exe")
Copy-Item -LiteralPath (Join-Path $projectRoot "PORTABLE.md") -Destination (Join-Path $packageDirectory "README.txt")
Set-Content -LiteralPath (Join-Path $packageDirectory "FyFlade-portable.marker") -Value "FyFlade portable $version" -Encoding UTF8
Compress-Archive -LiteralPath $packageDirectory -DestinationPath $archivePath -CompressionLevel Optimal

& (Join-Path $PSScriptRoot "verify-fyflade-portable.ps1") -PackagePath $archivePath -AllowUnsignedDevelopmentBuild:$AllowUnsignedDevelopmentBuild
