$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ProjectRoot ".env.local"
$PythonExe = Join-Path $ProjectRoot "trading-engine\.venv\Scripts\python.exe"
$WorkerFile = Join-Path $ProjectRoot "trading-engine\worker.py"
$Mt5Exe = "C:\Program Files\MetaTrader 5 EXNESS\terminal64.exe"

$LogDir = Join-Path $ProjectRoot "runtime-logs"
$WatchdogLog = Join-Path $LogDir "startup-watchdog.log"
$WorkerStdoutLog = Join-Path $LogDir "worker-stdout.log"
$WorkerStderrLog = Join-Path $LogDir "worker-stderr.log"

$WorkerId = "1941e76e-37c2-403e-8a9b-570f13d970cf"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-TradeLogicLog {
    param([string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $WatchdogLog -Value "[$timestamp] $Message"
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
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -like "*trading-engine*worker.py*"
        }
    )
}

function Ensure-MetaTrader {
    $mt5Processes = @(
        Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
    )

    if ($mt5Processes.Count -gt 0) {
        return
    }

    Write-TradeLogicLog "MT5 is not running. Starting MT5."

    $mt5 = Start-Process `
        -FilePath $Mt5Exe `
        -WorkingDirectory (Split-Path $Mt5Exe) `
        -PassThru

    Write-TradeLogicLog "MT5 launch requested. PID=$($mt5.Id)."

    Start-Sleep -Seconds 15

    $mt5Check = @(
        Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
    )

    if ($mt5Check.Count -eq 0) {
        Write-TradeLogicLog "ERROR: MT5 did not remain running after launch."
    }
    else {
        Write-TradeLogicLog "MT5 confirmed running."
    }
}

function Start-TradeLogicWorker {
    Write-TradeLogicLog "TradeLogic worker is not running. Starting worker."

    try {
        $worker = Start-Process `
            -FilePath $PythonExe `
            -ArgumentList "`"$WorkerFile`"" `
            -WorkingDirectory $ProjectRoot `
            -RedirectStandardOutput $WorkerStdoutLog `
            -RedirectStandardError $WorkerStderrLog `
            -WindowStyle Hidden `
            -PassThru

        Write-TradeLogicLog "Worker launch requested. PID=$($worker.Id)."

        Start-Sleep -Seconds 5

        $worker.Refresh()

        if ($worker.HasExited) {
            Write-TradeLogicLog "ERROR: Worker exited shortly after launch. ExitCode=$($worker.ExitCode)."
            Write-TradeLogicLog "Inspect runtime-logs\worker-stderr.log and runtime-logs\worker-stdout.log."
        }
        else {
            Write-TradeLogicLog "Worker process remained alive after initial launch check."
        }
    }
    catch {
        Write-TradeLogicLog "ERROR starting worker: $($_.Exception.Message)"
    }
}

Set-Location $ProjectRoot

Write-TradeLogicLog "============================================================"
Write-TradeLogicLog "TradeLogic startup watchdog initializing."

try {
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

    Write-TradeLogicLog "Environment loaded successfully."
    Write-TradeLogicLog "TradeLogic startup watchdog started."
}
catch {
    Write-TradeLogicLog "FATAL startup error: $($_.Exception.Message)"
    exit 1
}

while ($true) {
    try {
        Ensure-MetaTrader

        $workerProcesses = Get-TradeLogicWorkerProcesses

        if ($workerProcesses.Count -eq 0) {
            Start-TradeLogicWorker
        }
        elseif ($workerProcesses.Count -gt 2) {
            Write-TradeLogicLog "WARNING: more than one normal worker process chain appears to exist. ProcessCount=$($workerProcesses.Count)."
        }
    }
    catch {
        Write-TradeLogicLog "Watchdog loop error: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 10
}