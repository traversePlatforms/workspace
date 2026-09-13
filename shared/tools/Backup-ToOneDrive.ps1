<#
.SYNOPSIS
    Mirrors the whole project into OneDrive as an off-machine backup.

.DESCRIPTION
    Git protects the text in this project, but deliberately ignores ~3.9 GB of
    raw video and photo originals (see .gitignore). Those are irreplaceable and
    need a real backup. This mirrors everything - including .git, so the history
    travels with it - into OneDrive, which then syncs it off the machine.

    A mirror is used rather than putting the project inside OneDrive directly:
    OneDrive live-syncing an active .git directory risks corrupting the repo.
    Here nothing writes to the destination except this script.

    /MIR makes the destination match the source exactly, so files deleted here
    are deleted there. OneDrive's recycle bin holds those for 30 days.

.PARAMETER WhatIf
    List what would be copied and deleted without changing anything.

.EXAMPLE
    .\shared\tools\Backup-ToOneDrive.ps1 -WhatIf
    .\shared\tools\Backup-ToOneDrive.ps1
#>
[CmdletBinding()]
param(
    [string]$Source      = "C:\Users\Surge Inc\Desktop\claude test 2",
    [string]$Destination = "C:\Users\Surge Inc\OneDrive\Backups\claude test 2",
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source)) { throw "Source not found: $Source" }

# Refuse to run if the destination sits inside the source - robocopy would recurse.
$s = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\') + '\'
if ($Destination.TrimEnd('\') -like "$s*") { throw "Destination is inside Source. Pick another destination." }

$logDir = Join-Path $env:TEMP 'project-backup-logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$log = Join-Path $logDir ("backup-{0:yyyy-MM-dd-HHmmss}.log" -f (Get-Date))

$srcStat = Get-ChildItem $Source -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Sum Length
Write-Host ("Source      : {0}" -f $Source)
Write-Host ("              {0} files, {1} GB" -f $srcStat.Count, [math]::Round($srcStat.Sum/1GB,2))
Write-Host ("Destination : {0}" -f $Destination)
Write-Host ("Log         : {0}`n" -f $log)

# /MIR mirror  /DCOPY:DAT keep dir timestamps  /R:1 /W:1 don't hang on locks
# /XJ skip junctions (avoids following OneDrive placeholders/reparse loops)
$args = @($Source, $Destination, '/MIR', '/DCOPY:DAT', '/XJ', '/R:1', '/W:1',
          '/NFL', '/NDL', '/NP', "/LOG:$log", '/TEE')
if ($WhatIf) { $args += '/L'; Write-Host "DRY RUN - nothing will be written.`n" -ForegroundColor Yellow }

& robocopy.exe @args | Out-Null
$code = $LASTEXITCODE

# robocopy exit codes are a bitmask; 0-7 are success, 8+ are real failures
$meaning = switch ($true) {
    ($code -eq 0)               { 'no changes needed - already identical' }
    ($code -band 8)             { 'FAILED - some files or dirs could not be copied' }
    ($code -band 16)            { 'FATAL - no files copied' }
    default                     { 'success - files copied and/or extras removed' }
}
Write-Host ("`nrobocopy exit {0}: {1}" -f $code, $meaning)

if ($code -ge 8) {
    Write-Host "Check the log for the failures: $log" -ForegroundColor Red
    exit $code
}

if (-not $WhatIf) {
    $dstStat = Get-ChildItem $Destination -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Sum Length
    Write-Host ("Destination now: {0} files, {1} GB" -f $dstStat.Count, [math]::Round($dstStat.Sum/1GB,2))
    if ($dstStat.Count -ne $srcStat.Count) {
        Write-Host ("NOTE: file counts differ (source {0} / dest {1}). Check the log." -f $srcStat.Count, $dstStat.Count) -ForegroundColor Yellow
    } else {
        Write-Host "File counts match." -ForegroundColor Green
    }
    Write-Host "`nOneDrive will now upload the changes. Watch its tray icon for 'Up to date'."
}

# robocopy uses non-zero for success; normalise so callers/CI see a clean exit
exit 0
