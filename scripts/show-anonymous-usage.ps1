$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

$projectRoot = Split-Path -Parent $PSScriptRoot
$protectedSecretPath = Join-Path $projectRoot "src-tauri\.signing\analytics-admin-secret.dpapi"
if (-not (Test-Path -LiteralPath $protectedSecretPath)) {
  throw "Run scripts\setup-anonymous-usage-admin.ps1 first."
}

$protectedBytes = [IO.File]::ReadAllBytes($protectedSecretPath)
$secretBytes = [Security.Cryptography.ProtectedData]::Unprotect(
  $protectedBytes,
  $null,
  [Security.Cryptography.DataProtectionScope]::CurrentUser
)
$secret = [Text.Encoding]::UTF8.GetString($secretBytes)

try {
  $result = Invoke-RestMethod `
    -Uri "https://chatnest-kick-relay.sabryna91.workers.dev/usage/summary" `
    -Headers @{ Authorization = "Bearer $secret" } `
    -Method Get
  $result.days | Select-Object day, count | Format-Table -AutoSize
}
finally {
  [Array]::Clear($protectedBytes, 0, $protectedBytes.Length)
  [Array]::Clear($secretBytes, 0, $secretBytes.Length)
  $secret = $null
}
