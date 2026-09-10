$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ProjectRoot ".env.local"
$PythonExe = Join-Path $ProjectRoot "trading-engine\.venv\Scripts\python.exe"
$WorkerFile = Join-Path $ProjectRoot "trading-engine\worker.py"
$Mt5Exe = "C:\Program Files\MetaTrader 5 EXNESS\terminal64.exe"
$LogDir = Join-Path $ProjectRoot "runtime-logs"
$LogFile = Join-Path $LogDir "startup-watchdog.log"

$WorkerId = "1941e76e-37c2-403e-8a9b-570f13d970cf"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-TradeLogicLog {
    param([string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$timestamp] $Message"
}

function Import-DotEnv {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Environment file not found: $Path"
    }

    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()

        if (
            [string]::IsNullOrWhiteSpace($trimmed) -or
            $trimmed.StartsWith("#") -or
            $trimmed -notmatch "^[A-Za-z_][A-Za-z0-9_]*="
        ) {
            continue
        }

        $parts = $trimmed -split "=", 2
        $name = $parts[0].Trim()
        $value = $parts[1].Trim()

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        [Environment]::SetEnvironmentVariable(
            $name,
            $value,
            [EnvironmentVariableTarget]::Process
        )
    }
}

function Get-TradeLogicWorkerProcesses {
    return @(
        Get-CimInstance Win32_Process |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -like "*trading-engine*worker.py*"
        }
    )
}

Set-Location $ProjectRoot

Import-DotEnv -Path $EnvFile

if ([string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_URL)) {
    throw "NEXT_PUBLIC_SUPABASE_URL is missing."
}

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)) {
    throw "SUPABASE_SERVICE_ROLE_KEY is missing."
}

if ([string]::IsNullOrWhiteSpace($env:BROKER_CREDENTIAL_ENCRYPTION_KEY)) {
    throw "BROKER_CREDENTIAL_ENCRYPTION_KEY is missing."
}

if (-not (Test-Path $PythonExe)) {
    throw "Python virtual environment executable not found: $PythonExe"
}

if (-not (Test-Path $WorkerFile)) {
    throw "Worker file not found: $WorkerFile"
}

if (-not (Test-Path $Mt5Exe)) {
    throw "MT5 executable not found: $Mt5Exe"
}

$env:SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$env:TRADING_WORKER_ID = $WorkerId
$env:MT5_TERMINAL_PATH = $Mt5Exe
$env:TRADING_WORKER_POLL_SECONDS = "2"
$env:TRADING_WORKER_HEARTBEAT_SECONDS = "30"

Write-TradeLogicLog "TradeLogic startup watchdog started."

while ($true) {
    try {
        $mt5Process = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue

        if (-not $mt5Process) {
            Write-TradeLogicLog "MT5 is not running. Starting MT5."

            Start-Process `
                -FilePath $Mt5Exe `
                -WorkingDirectory (Split-Path $Mt5Exe)

            Start-Sleep -Seconds 15
        }

        $workerProcesses = Get-TradeLogicWorkerProcesses

        if ($workerProcesses.Count -eq 0) {
            Write-TradeLogicLog "TradeLogic worker is not running. Starting worker."

            Start-Process `
                -FilePath $PythonExe `
                -ArgumentList "`"$WorkerFile`"" `
                -WorkingDirectory $ProjectRoot `
                -WindowStyle Hidden

            Start-Sleep -Seconds 5
        }
        elseif ($workerProcesses.Count -gt 2) {
            Write-TradeLogicLog "Warning: more than one normal worker process chain appears to exist."
        }
    }
    catch {
        Write-TradeLogicLog "Watchdog error: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 10
}