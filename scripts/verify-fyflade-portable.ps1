param(
  [Parameter(Mandatory = $true)]
  [string]$PackagePath,
  [switch]$AllowUnsignedDevelopmentBuild
)

$ErrorActionPreference = "Stop"
$resolvedPackage = (Resolve-Path -LiteralPath $PackagePath).Path
$temporaryDirectory = $null
$inspectionDirectory = $resolvedPackage

try {
  if ([IO.Path]::GetExtension($resolvedPackage) -ieq ".zip") {
    $temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ("fyflade-portable-verify-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    Expand-Archive -LiteralPath $resolvedPackage -DestinationPath $temporaryDirectory
    $inspectionDirectory = (Get-ChildItem -LiteralPath $temporaryDirectory -Directory | Select-Object -First 1).FullName
  }

  $executablePath = Join-Path $inspectionDirectory "FyFlade.exe"
  $markerPath = Join-Path $inspectionDirectory "FyFlade-portable.marker"
  $readmePath = Join-Path $inspectionDirectory "README.txt"

  foreach ($requiredPath in @($executablePath, $markerPath, $readmePath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      throw "The portable package is incomplete. Missing: $requiredPath"
    }
  }

  $signature = Get-AuthenticodeSignature -LiteralPath $executablePath
  if (-not $AllowUnsignedDevelopmentBuild -and $signature.Status -ne "Valid") {
    throw "The portable executable has no valid Windows Authenticode signature. Status: $($signature.Status)."
  }

  $versionInfo = (Get-Item -LiteralPath $executablePath).VersionInfo
  if ($versionInfo.ProductName -cne "FyFlade") {
    throw "The portable executable ProductName is not FyFlade."
  }

  $hashTarget = if ([IO.Path]::GetExtension($resolvedPackage) -ieq ".zip") { $resolvedPackage } else { $executablePath }
  $hash = Get-FileHash -LiteralPath $hashTarget -Algorithm SHA256
  [pscustomobject]@{
    Product = $versionInfo.ProductName
    Version = $versionInfo.ProductVersion
    Package = $resolvedPackage
    Authenticode = $signature.Status
    Sha256 = $hash.Hash
    PortableMarker = $true
  }
}
finally {
  if ($temporaryDirectory -and (Test-Path -LiteralPath $temporaryDirectory)) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
}
