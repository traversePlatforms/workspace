# Schedules the drag guard (shared/tools/drag-guard.ps1) every 10 minutes (and on wake, StartWhenAvailable), as task "Drag guard".
# (11 Nov: the sign-in trigger needs an administrator, which is likely why the first run made no task; dropped, the 10-minute repeat covers it.)
# Run it yourself once: right-click, Run with PowerShell. To remove it later: Unregister-ScheduledTask -TaskName 'Drag guard' -Confirm:$false
$f = Join-Path $PSScriptRoot 'drag-guard.ps1'
$a = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument ('--headless powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $f + '"')
$t1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 10)
$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew -StartWhenAvailable
try {
Register-ScheduledTask -ErrorAction Stop -TaskName 'Drag guard' -Action $a -Trigger $t1 -Settings $s -Description 'Stops stuck watchdogs and PowerShell checks and runaway Windows helpers; reports anything else. shared/tools/drag-guard.ps1 (2026-11-10).' -Force | Out-Null
Write-Host ('Drag guard scheduled. Next run: ' + (Get-ScheduledTask 'Drag guard' | Get-ScheduledTaskInfo).NextRunTime)
} catch { Write-Host ('Could not schedule the drag guard: ' + $_.Exception.Message) -ForegroundColor Red }
Read-Host 'Press Enter to close'
