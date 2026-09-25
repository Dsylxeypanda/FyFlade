$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseDirectory = Join-Path $projectRoot "release"
$statusPath = Join-Path $releaseDirectory "LAST_RELEASE_BUILD_STATUS.txt"
$installerPath = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis\FyFlade_1.0.0_x64-setup.exe"
$signaturePath = "$installerPath.sig"

New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

try {
  & (Join-Path $PSScriptRoot "build-fyflade-release.ps1")
  if ($LASTEXITCODE -ne 0) {
    throw "The release build returned exit code $LASTEXITCODE."
  }

  foreach ($requiredPath in @($installerPath, $signaturePath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      throw "The release build did not create: $requiredPath"
    }
  }

  $installerHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
  $status = @(
    "Result=SUCCESS"
    "Finished=$([DateTimeOffset]::Now.ToString('o'))"
    "Installer=$installerPath"
    "UpdaterSignature=$signaturePath"
    "Sha256=$installerHash"
    "Authenticode=$((Get-AuthenticodeSignature -LiteralPath $installerPath).Status)"
  )
  Set-Content -LiteralPath $statusPath -Value $status -Encoding UTF8

  Write-Host ""
  Write-Host "FYFLADE RELEASE BUILD COMPLETED" -ForegroundColor Green
  Write-Host "The Tauri updater signature was created." -ForegroundColor Green
  Write-Host "You can return to Codex and type: ferdig" -ForegroundColor Cyan
}
catch {
  $safeMessage = [string]$_.Exception.Message
  Set-Content -LiteralPath $statusPath -Value @(
    "Result=FAILED"
    "Finished=$([DateTimeOffset]::Now.ToString('o'))"
    "Error=$safeMessage"
  ) -Encoding UTF8

  Write-Host ""
  Write-Host "FYFLADE RELEASE BUILD FAILED" -ForegroundColor Red
  Write-Host $safeMessage -ForegroundColor Red
  Write-Host "Leave this window open and return to Codex." -ForegroundColor Yellow
  exit 1
}
