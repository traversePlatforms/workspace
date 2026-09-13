<#
.SYNOPSIS
    Registers (or updates) a Windows scheduled task that runs Backup-ToOneDrive.ps1 daily.

.DESCRIPTION
    Runs as the current user, only while logged on - OneDrive only syncs when
    logged on anyway, and this avoids needing a stored password or admin rights.

    Battery settings are overridden: the Windows defaults refuse to start a task
    on battery and kill it if you unplug, which on a laptop can mean it silently
    never runs.

    StartWhenAvailable means a missed run (machine off at the scheduled time)
    happens at the next opportunity instead of being skipped.

.PARAMETER At
    Time of day to run. Default 6:00 PM.

.PARAMETER Unregister
    Remove the task instead of creating it.

.EXAMPLE
    .\shared\tools\Register-BackupSchedule.ps1
    .\shared\tools\Register-BackupSchedule.ps1 -At 22:30
    .\shared\tools\Register-BackupSchedule.ps1 -Unregister
#>
[CmdletBinding()]
param(
    [datetime]$At = (Get-Date -Hour 18 -Minute 0 -Second 0),
    [string]$TaskName = 'Backup claude test 2 to OneDrive',
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

$script = Join-Path $PSScriptRoot 'Backup-ToOneDrive.ps1'
if (-not $Unregister -and -not (Test-Path -LiteralPath $script)) {
    throw "Backup script not found next to this one: $script"
}

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($Unregister) {
    if ($existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task: $TaskName"
    } else {
        Write-Host "No such task: $TaskName"
    }
    exit 0
}

if ($existing) { Write-Host "Task already exists - replacing it." }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $script)

$trigger = New-ScheduledTaskTrigger -Daily -At $At

# Interactive principal: no stored password, no admin needed, runs when logged on.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings `
    -Description 'Mirrors the claude test 2 project (video, photos and .git included) to OneDrive\Backups. Source: shared/tools/Backup-ToOneDrive.ps1' `
    -Force | Out-Null

$t = Get-ScheduledTask -TaskName $TaskName
$i = Get-ScheduledTaskInfo -TaskName $TaskName
Write-Host ("Registered : {0}" -f $t.TaskName)
Write-Host ("State      : {0}" -f $t.State)
Write-Host ("Runs daily : {0}" -f $At.ToString('h:mm tt'))
Write-Host ("Next run   : {0}" -f $i.NextRunTime)
Write-Host "`nRun it now to test:  Start-ScheduledTask -TaskName '$TaskName'"
exit 0
