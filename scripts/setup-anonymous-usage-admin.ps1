$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

$projectRoot = Split-Path -Parent $PSScriptRoot
$workerRoot = Join-Path $projectRoot "cloudflare\kick-relay"
$secretDirectory = Join-Path $projectRoot "src-tauri\.signing"
$protectedSecretPath = Join-Path $secretDirectory "analytics-admin-secret.dpapi"

if (Test-Path -LiteralPath $protectedSecretPath) {
  Write-Output "The anonymous-usage administrator secret is already configured locally."
  exit 0
}

New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
$secretBytes = New-Object byte[] 32
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $random.GetBytes($secretBytes)
}
finally {
  $random.Dispose()
}
$secret = [Convert]::ToBase64String($secretBytes)
$protectedBytes = [Security.Cryptography.ProtectedData]::Protect(
  [Text.Encoding]::UTF8.GetBytes($secret),
  $null,
  [Security.Cryptography.DataProtectionScope]::CurrentUser
)

$processInfo = New-Object Diagnostics.ProcessStartInfo
$processInfo.FileName = "npx.cmd"
$processInfo.Arguments = "wrangler secret put ANALYTICS_ADMIN_SECRET"
$processInfo.WorkingDirectory = $workerRoot
$processInfo.UseShellExecute = $false
$processInfo.RedirectStandardInput = $true
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.CreateNoWindow = $true

$process = New-Object Diagnostics.Process
$process.StartInfo = $processInfo
if (-not $process.Start()) {
  throw "Could not start Wrangler."
}
$process.StandardInput.WriteLine($secret)
$process.StandardInput.Close()
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()

try {
  if ($process.ExitCode -ne 0) {
    throw "Cloudflare rejected the administrator secret. $stderr"
  }
  [IO.File]::WriteAllBytes($protectedSecretPath, $protectedBytes)
  Write-Output $stdout
  Write-Output "The administrator secret was generated, sent through standard input, and stored locally with Windows DPAPI. It was not printed."
}
finally {
  [Array]::Clear($secretBytes, 0, $secretBytes.Length)
  [Array]::Clear($protectedBytes, 0, $protectedBytes.Length)
  $secret = $null
}
