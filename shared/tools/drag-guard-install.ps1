# Schedules the drag guard (shared/tools/drag-guard.ps1) every 10 minutes and at sign-in, as task "Drag guard".
# Run it yourself once: right-click, Run with PowerShell. To remove it later: Unregister-ScheduledTask -TaskName 'Drag guard' -Confirm:$false
$f = Join-Path $PSScriptRoot 'drag-guard.ps1'
$a = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument ('--headless powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $f + '"')
$t1 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 10)
$t2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew -StartWhenAvailable
Register-ScheduledTask -TaskName 'Drag guard' -Action $a -Trigger $t1, $t2 -Settings $s -Description 'Stops stuck watchdogs and PowerShell checks and runaway Windows helpers; reports anything else. shared/tools/drag-guard.ps1 (2026-11-10).' -Force | Out-Null
Write-Host ('Drag guard scheduled. Next run: ' + (Get-ScheduledTask 'Drag guard' | Get-ScheduledTaskInfo).NextRunTime)
Read-Host 'Press Enter to close'
