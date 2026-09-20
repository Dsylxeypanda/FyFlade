# FyFlade - add YouTube streamList/gRPC dependencies to src-tauri/Cargo.toml
# Run this from the FyFlade project root:
#   powershell -ExecutionPolicy Bypass -File .\PATCH_CARGO_YOUTUBE_STREAM.ps1

$ErrorActionPreference = "Stop"

$cargoPath = Join-Path $PSScriptRoot "src-tauri\Cargo.toml"
if (-not (Test-Path $cargoPath)) {
    throw "Fant ikke src-tauri\Cargo.toml. Legg scriptet i FyFlade-hovedmappen og kjør det derfra."
}

$backupPath = "$cargoPath.backup-before-youtube-stream"
if (-not (Test-Path $backupPath)) {
    Copy-Item $cargoPath $backupPath
}

$text = Get-Content -Raw -Path $cargoPath

function Add-ToSection {
    param(
        [string]$Text,
        [string]$Section,
        [string]$Key,
        [string]$Line
    )

    if ($Text -match "(?m)^\s*$([regex]::Escape($Key))\s*=") {
        return $Text
    }

    $header = "[$Section]"
    $escapedHeader = [regex]::Escape($header)
    $headerPattern = "(?m)^$escapedHeader\s*$"

    if ($Text -match $headerPattern) {
        return [regex]::Replace(
            $Text,
            $headerPattern,
            "$header`r`n$Line",
            1
        )
    }

    return ($Text.TrimEnd() + "`r`n`r`n$header`r`n$Line`r`n")
}

$text = Add-ToSection $text "dependencies" "tonic" 'tonic = { version = "0.14.6", features = ["transport", "tls-webpki-roots"] }'
$text = Add-ToSection $text "dependencies" "tonic-prost" 'tonic-prost = "0.14.6"'
$text = Add-ToSection $text "dependencies" "prost" 'prost = "0.14"'
$text = Add-ToSection $text "dependencies" "serde_json" 'serde_json = "1"'

$text = Add-ToSection $text "build-dependencies" "tonic-prost-build" 'tonic-prost-build = "0.14.6"'
$text = Add-ToSection $text "build-dependencies" "protoc-bin-vendored" 'protoc-bin-vendored = "3.2"'

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($cargoPath, $text, $utf8NoBom)

Write-Host ""
Write-Host "Ferdig! Cargo.toml er oppdatert for YouTube streamList." -ForegroundColor Green
Write-Host "Backup: $backupPath"
