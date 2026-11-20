# Hey Jarvis, the laptop wake word: install or update (2026-11-19). Safe to run again; it restarts the listener with the new code.
#   powershell -NoProfile -ExecutionPolicy Bypass -File assistant\jarvis\wakeword\install.ps1           install / update
#   powershell -NoProfile -ExecutionPolicy Bypass -File assistant\jarvis\wakeword\install.ps1 -Remove   stop it, remove the task and the shortcut
# What it sets up, all under %LOCALAPPDATA%\JarvisWake (nothing in the repo's heavy folders):
#   venv\   Python 3.13 (ARM64) with openWakeWord, onnxruntime, numpy (all free, open source, installed from PyPI wheels)
#   app\    hey_jarvis.py and toggle.py, copied from the repo
#   chime.wav, jarvis.ico, the hey_jarvis model (inside the venv), state.json, wake.log, config.json (optional overrides)
#   the scheduled task "Hey Jarvis": at logon, hidden, below-normal priority, runs on battery, restarts if it stops
#   the Desktop shortcut "Hey Jarvis on-off"
param([switch]$Remove)
$ErrorActionPreference = 'Continue'   # pip and the model download write progress to stderr; each step checks its own exit code
$Root = Join-Path $env:LOCALAPPDATA 'JarvisWake'
$App = Join-Path $Root 'app'
$Venv = Join-Path $Root 'venv'
$Py = Join-Path $Venv 'Scripts\python.exe'
$Pyw = Join-Path $Venv 'Scripts\pythonw.exe'
$Task = 'Hey Jarvis'
$Lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Hey Jarvis on-off.lnk'
$Src = Split-Path -Parent $MyInvocation.MyCommand.Path

function Stop-Listener {
    try { Stop-ScheduledTask -TaskName $Task -ErrorAction Stop } catch {}
    Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -like '*JarvisWake\app\hey_jarvis.py*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
}

if ($Remove) {
    Stop-Listener
    try { Unregister-ScheduledTask -TaskName $Task -Confirm:$false -ErrorAction Stop } catch {}
    if (Test-Path $Lnk) { Remove-Item $Lnk -Force }
    Write-Output 'Hey Jarvis removed: the task and the shortcut are gone, nothing is listening. (The files in %LOCALAPPDATA%\JarvisWake are left.)'
    exit 0
}

New-Item -ItemType Directory -Force $App | Out-Null
if (-not (Test-Path $Py)) {
    Write-Output 'Making the Python environment...'
    & py -V:3.13-arm64 -m venv $Venv
    if (-not (Test-Path $Py)) { & python -m venv $Venv }
}
Write-Output 'Installing openWakeWord and onnxruntime (prebuilt ARM64 wheels)...'
& $Py -m pip install --quiet --disable-pip-version-check --only-binary=:all: 'openwakeword==0.6.0' onnxruntime numpy scipy scikit-learn tqdm requests
if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }
& $Py -c "import openwakeword.utils as u; u.download_models(['hey_jarvis'])"
if ($LASTEXITCODE -ne 0) { throw 'the hey_jarvis model did not download' }

Stop-Listener
Copy-Item (Join-Path $Src 'hey_jarvis.py'), (Join-Path $Src 'toggle.py') $App -Force
Copy-Item (Join-Path $Src '..\icon-192.png') (Join-Path $Root 'icon-192.png') -Force
& $Py (Join-Path $App 'hey_jarvis.py') --make-assets

$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$act = New-ScheduledTaskAction -Execute $Pyw -Argument ('"' + (Join-Path $App 'hey_jarvis.py') + '"') -WorkingDirectory $App
$trg = New-ScheduledTaskTrigger -AtLogOn -User $me
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -Priority 7 -Hidden -MultipleInstances IgnoreNew -StartWhenAvailable
$pr = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $Task -Action $act -Trigger $trg -Settings $set -Principal $pr -Force -Description 'J.A.R.V.I.S. wake word: listens on this laptop only for "hey jarvis" (openWakeWord), then brings the J.A.R.V.I.S. window up listening. Off: the Desktop shortcut "Hey Jarvis on-off". Code: assistant\jarvis\wakeword in the repo.' | Out-Null

$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($Lnk)
$s.TargetPath = $Pyw
$s.Arguments = '"' + (Join-Path $App 'toggle.py') + '"'
$s.WorkingDirectory = $App
$s.IconLocation = (Join-Path $Root 'jarvis.ico') + ',0'
$s.Description = 'Turn the Hey Jarvis wake word off or on'
$s.Save()

Start-ScheduledTask -TaskName $Task
Start-Sleep -Seconds 8
$st = Get-Content (Join-Path $Root 'state.json') -ErrorAction SilentlyContinue
Write-Output ('Hey Jarvis installed. Task: ' + (Get-ScheduledTask -TaskName $Task).State + '. Listener: ' + $st)
