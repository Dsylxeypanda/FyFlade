param(
  [switch]$IncludeDesktopBuild,
  [switch]$AllowNetworkDependencyFetch
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$previousCargoHome = $env:CARGO_HOME
$previousCargoOffline = $env:CARGO_NET_OFFLINE

function Invoke-Checked([scriptblock]$Command, [string]$FailureMessage) {
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

try {
  Push-Location $projectRoot
  if ($AllowNetworkDependencyFetch) {
    Remove-Item Env:CARGO_NET_OFFLINE -ErrorAction SilentlyContinue
  } else {
    $env:CARGO_HOME = Join-Path $projectRoot ".cargo-home"
    $env:CARGO_NET_OFFLINE = "true"
  }

  $config = Get-Content -LiteralPath "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
  $package = Get-Content -LiteralPath "package.json" -Raw | ConvertFrom-Json
  if ($config.productName -cne "FyFlade" -or $package.name -cne "fyflade") {
    throw "Product branding metadata is inconsistent."
  }
  if ($config.version -cne $package.version) {
    throw "The frontend and desktop technical versions differ."
  }

  $youtubeConfigSource = Get-Content -LiteralPath "src\youtubeConfig.ts" -Raw
  $embeddedYouTubeClientId = [regex]::Match(
    $youtubeConfigSource,
    '["''](?<id>[0-9A-Za-z._-]+\.apps\.googleusercontent\.com)["'']'
  )
  if (-not $embeddedYouTubeClientId.Success) {
    throw "The official embedded FyFlade YouTube OAuth Client ID is missing or malformed."
  }

  foreach ($requiredPath in @(
    "PORTABLE.md",
    "SECURITY.md",
    "docs\RELEASE_TEST_CHECKLIST.md",
    "scripts\build-fyflade-release.ps1",
    "scripts\build-fyflade-portable.ps1",
    "scripts\verify-fyflade-release.ps1",
    "scripts\verify-fyflade-portable.ps1"
  )) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      throw "Release requirement is missing: $requiredPath"
    }
  }

  & git ls-files --error-unmatch .env.production.local 2>$null
  if ($LASTEXITCODE -eq 0) {
    throw ".env.production.local is tracked by Git and may expose deployment configuration."
  }

  Invoke-Checked { npm run build } "The TypeScript/Vite production build failed."
  Invoke-Checked { cargo test --manifest-path src-tauri/Cargo.toml } "The Rust test suite failed."
  Invoke-Checked { npm exec --prefix cloudflare/kick-relay -- tsc --noEmit } "The Kick relay type check failed."

  if ($IncludeDesktopBuild) {
    Invoke-Checked { npx tauri build --no-bundle } "The desktop application build failed."
  }

  [pscustomobject]@{
    Product = $config.productName
    DisplayVersion = "1.0"
    TechnicalVersion = $config.version
    FrontendBuild = "Passed"
    RustTests = "Passed"
    RelayTypeCheck = "Passed"
    EmbeddedYouTubeOAuth = "Passed"
    DesktopBuild = if ($IncludeDesktopBuild) { "Passed" } else { "Not requested" }
    DependencyMode = if ($AllowNetworkDependencyFetch) { "Online CI" } else { "Offline release" }
    ManualReleaseChecklist = "Required"
  }
}
finally {
  Pop-Location
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
