$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
[System.Net.ServicePointManager]::SecurityProtocol =
  [System.Net.SecurityProtocolType]::Tls12

$projectRoot = "C:\Users\stigm\Documents\Codex\2026-08-25\referenced-chatgpt-conversation-this-is-an\outputs\Chatnest-7TV"
$workerPath = Join-Path $projectRoot "work\cloudflare-deploy\worker.js"
$statusPath = Join-Path $projectRoot "work\cloudflare-deploy\status.json"
$tokenPath = Join-Path $projectRoot "work\cloudflare-deploy\.deployment-token"
$apiToken = ""
$client = $null
$form = $null

function Save-Status {
  param(
    [bool]$Success,
    [string]$Message,
    [int]$HttpStatus = 0,
    [string[]]$CreatedExports = @()
  )

  [ordered]@{
    success = $Success
    message = $Message
    httpStatus = $HttpStatus
    createdExports = $CreatedExports
  } |
    ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath $statusPath -Encoding UTF8
}

try {
  if (Test-Path -LiteralPath $statusPath) {
    Remove-Item -LiteralPath $statusPath -Force
  }

  if (-not (Test-Path -LiteralPath $tokenPath)) {
    throw "Den midlertidige Cloudflare-nøkkelen mangler."
  }
  $apiToken = ([System.IO.File]::ReadAllText($tokenPath)).Trim()
  if ($apiToken.Length -lt 40) {
    throw "Cloudflare-nøkkelen mangler fra utklippstavlen."
  }

  if (-not (Test-Path -LiteralPath $workerPath)) {
    throw "Worker-pakken mangler."
  }

  $metadata = [ordered]@{
    main_module = "worker.js"
    compatibility_date = "2026-08-25"
    bindings = @(
      [ordered]@{
        type = "durable_object_namespace"
        name = "CHAT_HUB"
        class_name = "ChatHub"
      }
    )
    exports = [ordered]@{
      ChatHub = [ordered]@{
        type = "durable-object"
        storage = "sqlite"
      }
    }
    observability = [ordered]@{
      enabled = $true
    }
  } | ConvertTo-Json -Depth 10 -Compress

  $client = [System.Net.Http.HttpClient]::new()
  $client.Timeout = [TimeSpan]::FromSeconds(60)
  $client.DefaultRequestHeaders.Authorization =
    [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $apiToken)

  $form = [System.Net.Http.MultipartFormDataContent]::new()
  $metadataContent =
    [System.Net.Http.StringContent]::new(
      $metadata,
      [System.Text.Encoding]::UTF8,
      "application/json"
    )
  $form.Add($metadataContent, "metadata")

  $workerContent =
    [System.Net.Http.ByteArrayContent]::new(
      [System.IO.File]::ReadAllBytes($workerPath)
    )
  $workerContent.Headers.ContentType =
    [System.Net.Http.Headers.MediaTypeHeaderValue]::new(
      "application/javascript+module"
    )
  $form.Add($workerContent, "worker.js", "worker.js")

  $uri =
    "https://api.cloudflare.com/client/v4/accounts/bdfd83dd76b59e5c0c93c5bec6d25ab8/workers/scripts/chatnest-kick-relay"
  $response =
    $client.PutAsync($uri, $form).GetAwaiter().GetResult()
  $raw =
    $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  $result =
    $raw | ConvertFrom-Json

  if (-not $response.IsSuccessStatusCode -or -not $result.success) {
    $messages = @(
      $result.errors |
        ForEach-Object { $_.message } |
        Where-Object { $_ }
    )
    $message =
      if ($messages.Count -gt 0) {
        $messages -join " | "
      } else {
        "Cloudflare avviste registreringen."
      }

    Save-Status -Success $false -Message $message -HttpStatus ([int]$response.StatusCode)
    exit 1
  }

  $created = @(
    $result.result.exports_reconciliation.created |
      ForEach-Object { [string]$_ }
  )
  Save-Status -Success $true -Message "Cloudflare-registreringen er ferdig." -HttpStatus ([int]$response.StatusCode) -CreatedExports $created
} catch {
  $errorMessages = @()
  $currentException = $_.Exception
  while ($currentException) {
    if ($currentException.Message) {
      $errorMessages += $currentException.Message
    }
    $currentException = $currentException.InnerException
  }
  $where =
    if ($_.InvocationInfo.ScriptLineNumber) {
      " (linje $($_.InvocationInfo.ScriptLineNumber))"
    } else {
      ""
    }
  Save-Status -Success $false -Message (($errorMessages -join " | ") + $where)
  exit 1
} finally {
  $apiToken = ""
  if (Test-Path -LiteralPath $tokenPath) {
    Remove-Item -LiteralPath $tokenPath -Force
  }
  if ($form) {
    $form.Dispose()
  }
  if ($client) {
    $client.Dispose()
  }
}
