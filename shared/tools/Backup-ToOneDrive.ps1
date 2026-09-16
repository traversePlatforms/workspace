<#
.SYNOPSIS
    Mirrors the project AND Claude's memory for it into OneDrive as an
    off-machine backup.

.DESCRIPTION
    Two trees are mirrored, each to its own folder under OneDrive\Backups:

      1. The project itself.
         Git protects the text, but deliberately ignores ~3.9 GB of raw video
         and photo originals (see .gitignore). Those are irreplaceable. This
         mirrors everything - including .git, so the history travels with it.

      2. Claude's project folder for this repo (added 2026-09-15).
         C:\Users\<you>\.claude\projects\c--Users-Surge-Inc-Desktop-claude-test-2\
         holds the persistent memory (memory\*.md - everything Claude knows
         about this project across sessions), the session transcripts
         (*.jsonl), and cached tool results. None of it is inside the project
         folder, so without this it would die with the machine while the repo
         survived, and every future session would start from nothing.

    A mirror is used rather than putting the project inside OneDrive directly:
    OneDrive live-syncing an active .git directory risks corrupting the repo.
    Here nothing writes to the destinations except this script.

    /MIR makes each destination match its source exactly, so files deleted here
    are deleted there. OneDrive's recycle bin holds those for 30 days.

.NOTES
    RESTORING ON ANOTHER MACHINE
    ----------------------------
    1. Sign into OneDrive. Copy Backups\claude test 2 to wherever you want the
       project. Git history, photos and video are all in it.
    2. Copy Backups\claude test 2 (claude memory) to
          C:\Users\<you>\.claude\projects\<ENCODED PATH>\
       where <ENCODED PATH> is the project's new full path with every
       non-alphanumeric character replaced by '-', e.g.
          C:\Users\Surge Inc\Desktop\claude test 2
       becomes
          c--Users-Surge-Inc-Desktop-claude-test-2
       Claude Code derives that folder name from the path. If the project lands
       somewhere else, rename the restored folder to match or the memory is
       simply not found - no error, it just starts blank.

.PARAMETER WhatIf
    List what would be copied and deleted without changing anything.

.EXAMPLE
    .\shared\tools\Backup-ToOneDrive.ps1 -WhatIf
    .\shared\tools\Backup-ToOneDrive.ps1
#>
[CmdletBinding()]
param(
    [string]$Source            = "C:\Users\Surge Inc\Desktop\claude test 2",
    [string]$Destination       = "C:\Users\Surge Inc\OneDrive\Backups\claude test 2",
    [string]$MemorySource      = "C:\Users\Surge Inc\.claude\projects\c--Users-Surge-Inc-Desktop-claude-test-2",
    [string]$MemoryDestination = "C:\Users\Surge Inc\OneDrive\Backups\claude test 2 (claude memory)",
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$logDir = Join-Path $env:TEMP 'project-backup-logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$stamp = "{0:yyyy-MM-dd-HHmmss}" -f (Get-Date)

if ($WhatIf) { Write-Host "DRY RUN - nothing will be written.`n" -ForegroundColor Yellow }

# Mirrors one tree. Returns $true on success. Prints its own report.
function Mirror-Tree {
    param([string]$Label, [string]$Src, [string]$Dst, [string]$Log)

    if (-not (Test-Path -LiteralPath $Src)) { throw "$Label source not found: $Src" }

    # Refuse to run if the destination sits inside the source - robocopy would recurse.
    $s = (Resolve-Path -LiteralPath $Src).Path.TrimEnd('\') + '\'
    if ($Dst.TrimEnd('\') -like "$s*") { throw "$Label destination is inside its source. Pick another destination." }

    $srcStat = Get-ChildItem $Src -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Sum Length
    Write-Host ("== {0} ==" -f $Label) -ForegroundColor Cyan
    Write-Host ("Source      : {0}" -f $Src)
    Write-Host ("              {0} files, {1} MB" -f $srcStat.Count, [math]::Round($srcStat.Sum/1MB,1))
    Write-Host ("Destination : {0}" -f $Dst)
    Write-Host ("Log         : {0}" -f $Log)

    # /MIR mirror  /DCOPY:DAT keep dir timestamps  /R:1 /W:1 don't hang on locks
    # /XJ skip junctions (avoids following OneDrive placeholders/reparse loops)
    $args = @($Src, $Dst, '/MIR', '/DCOPY:DAT', '/XJ', '/R:1', '/W:1',
              '/NFL', '/NDL', '/NP', "/LOG:$Log", '/TEE')
    if ($WhatIf) { $args += '/L' }

    & robocopy.exe @args | Out-Null
    $code = $LASTEXITCODE

    # robocopy exit codes are a bitmask; 0-7 are success, 8+ are real failures
    $meaning = switch ($true) {
        ($code -eq 0)    { 'no changes needed - already identical' }
        ($code -band 8)  { 'FAILED - some files or dirs could not be copied' }
        ($code -band 16) { 'FATAL - no files copied' }
        default          { 'success - files copied and/or extras removed' }
    }
    Write-Host ("robocopy exit {0}: {1}" -f $code, $meaning)

    if ($code -ge 8) {
        Write-Host "Check the log for the failures: $Log`n" -ForegroundColor Red
        return $false
    }

    if (-not $WhatIf) {
        $dstStat = Get-ChildItem $Dst -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Sum Length
        Write-Host ("Destination now: {0} files, {1} MB" -f $dstStat.Count, [math]::Round($dstStat.Sum/1MB,1))
        if ($dstStat.Count -ne $srcStat.Count) {
            Write-Host ("NOTE: file counts differ (source {0} / dest {1}). Check the log." -f $srcStat.Count, $dstStat.Count) -ForegroundColor Yellow
        } else {
            Write-Host "File counts match." -ForegroundColor Green
        }
    }
    Write-Host ""
    return $true
}

$ok1 = Mirror-Tree -Label 'Project'       -Src $Source       -Dst $Destination       -Log (Join-Path $logDir "backup-$stamp.log")
$ok2 = Mirror-Tree -Label 'Claude memory' -Src $MemorySource -Dst $MemoryDestination -Log (Join-Path $logDir "backup-memory-$stamp.log")

if (-not ($ok1 -and $ok2)) { exit 8 }

if (-not $WhatIf) {
    Write-Host "OneDrive will now upload the changes. Watch its tray icon for 'Up to date'."
}

# robocopy uses non-zero for success; normalise so callers/CI see a clean exit
exit 0
