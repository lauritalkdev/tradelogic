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

$script:WorkerProcess = $null

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

function Ensure-MetaTrader {
    $mt5Processes = @(
        Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
    )

    if ($mt5Processes.Count -gt 0) {
        return $true
    }

    Write-TradeLogicLog "MT5 is not running. Starting MT5."

    try {
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
            return $false
        }

        Write-TradeLogicLog "MT5 confirmed running."
        return $true
    }
    catch {
        Write-TradeLogicLog "ERROR starting MT5: $($_.Exception.Message)"
        return $false
    }
}

function Start-TradeLogicWorker {
    Write-TradeLogicLog "TradeLogic worker is not running. Starting worker."

    try {
        $script:WorkerProcess = Start-Process `
            -FilePath $PythonExe `
            -ArgumentList "`"$WorkerFile`"" `
            -WorkingDirectory $ProjectRoot `
            -RedirectStandardOutput $WorkerStdoutLog `
            -RedirectStandardError $WorkerStderrLog `
            -WindowStyle Hidden `
            -PassThru

        Write-TradeLogicLog "Worker launch requested. PID=$($script:WorkerProcess.Id)."

        Start-Sleep -Seconds 5

        $script:WorkerProcess.Refresh()

        if ($script:WorkerProcess.HasExited) {
            $exitCode = $script:WorkerProcess.ExitCode

            Write-TradeLogicLog "ERROR: Worker exited shortly after launch. ExitCode=$exitCode."
            Write-TradeLogicLog "Inspect runtime-logs\worker-stderr.log and runtime-logs\worker-stdout.log."

            $script:WorkerProcess = $null
            return $false
        }

        Write-TradeLogicLog "Worker process remained alive after initial launch check."
        return $true
    }
    catch {
        Write-TradeLogicLog "ERROR starting worker: $($_.Exception.Message)"
        $script:WorkerProcess = $null
        return $false
    }
}

function Test-TradeLogicWorker {
    if ($null -eq $script:WorkerProcess) {
        return $false
    }

    try {
        $script:WorkerProcess.Refresh()

        if ($script:WorkerProcess.HasExited) {
            $exitCode = $script:WorkerProcess.ExitCode

            Write-TradeLogicLog "Worker exited. PID=$($script:WorkerProcess.Id), ExitCode=$exitCode."
            Write-TradeLogicLog "Inspect runtime-logs\worker-stderr.log and runtime-logs\worker-stdout.log."

            $script:WorkerProcess = $null
            return $false
        }

        return $true
    }
    catch {
        Write-TradeLogicLog "Worker process check failed: $($_.Exception.Message)"
        $script:WorkerProcess = $null
        return $false
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
        $mt5Ready = Ensure-MetaTrader

        if ($mt5Ready) {
            $workerRunning = Test-TradeLogicWorker

            if (-not $workerRunning) {
                Start-TradeLogicWorker | Out-Null
            }
        }
        else {
            Write-TradeLogicLog "Worker launch deferred because MT5 is unavailable."
        }
    }
    catch {
        Write-TradeLogicLog "Watchdog loop error: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 10
}