<#
.SYNOPSIS
    Off-machine backup to Google Drive (G:\My Drive, account m.sharpe@traverseplatforms.com). Replaces the OneDrive mirror,
    which stopped leaving this computer when OneDrive was cancelled on 2026-10-09.

.DESCRIPTION
    Every run (the "Backup claude test 2 to Google Drive" task, 6 PM daily):

      1. ONE locked archive, core-YYYY-MM-DD.7z (7-Zip, AES-256, file names hidden too), holding what is slow or impossible
         to rebuild:
           - the whole git history as one bundle file (every branch; restore with: git clone repo.bundle "claude test 2")
           - Claude's memory folder for this project
           - C:\Users\Surge Inc\TraverseBackups (the nightly server copies: sign-ins, customers, leads, logs)
           - the door-territory working data that takes hours or days to rebuild (lawn, tree, value, wildfire and owner-history
             caches, walk lists, roof, solar, pest, security, permit, wind and commercial results), minus the big downloaded
             caches that can simply be downloaded again (laser scans, building outlines, roof photo crops, county raw files)
           - surge/clients (client material is kept out of git)
         It is built in a temp folder and moved in whole, so Drive never uploads a half-written file. The newest 7 are kept.

      2. Once a week (or when it has never run): a plain mirror of the photo and video originals and the _archive payload,
         which git ignores and nothing else holds: surge/brand/videos, surge/brand/photos, traverse/videos, _archive.

    The archive password is in C:\Users\Surge Inc\.ssh\backup-archive-pass.txt. Without it the archives cannot be opened, so a
    copy must live somewhere off this computer (a password manager or written down). The script never prints it.

    Not backed up, on purpose: the SSH keys and API keys in ~\.ssh (made again if lost), node_modules, editions/dist and app
    door files (rebuilt by the build scripts; the live servers hold the door files too), and the downloaded caches above.

.NOTES
    RESTORE: install 7-Zip, open core-<date>.7z with the password, then
      git clone repo.bundle "C:\Users\<you>\Desktop\claude test 2"
    and copy the other folders back to the paths they are named after (see the folder names inside the archive).
    Claude memory goes to C:\Users\<you>\.claude\projects\<project path with every non-alphanumeric character as '-'>\memory.

.EXAMPLE
    .\shared\tools\Backup-ToGoogleDrive.ps1            # normal run
    .\shared\tools\Backup-ToGoogleDrive.ps1 -Media     # also force the weekly media mirror now
#>
[CmdletBinding()]
param(
    [string]$Project  = "C:\Users\Surge Inc\Desktop\claude test 2",
    [string]$Drive    = "G:\My Drive",
    [string]$PassFile = "C:\Users\Surge Inc\.ssh\backup-archive-pass.txt",
    [int]$Keep        = 7,
    [switch]$Media
)
$ErrorActionPreference = 'Stop'
$SevenZip = "C:\Program Files\7-Zip\7z.exe"
$Memory   = "C:\Users\Surge Inc\.claude\projects\c--Users-Surge-Inc-Desktop-claude-test-2\memory"
$ServerBk = "C:\Users\Surge Inc\TraverseBackups"
$Dest     = Join-Path $Drive "Backups\claude test 2"
$LogDir   = Join-Path $env:LOCALAPPDATA "ProjectBackup"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir "gdrive.log"
function Say([string]$m) { $line = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m; Add-Content -Path $Log -Value $line; Write-Host $line }

try {
    # 2026-10-15: after the 14 Oct restart Google Drive for desktop did not come back, and two nights failed. Start it and wait for it.
    if (-not (Test-Path -LiteralPath $Drive)) {
        $gd = Get-ChildItem "C:\Program Files\Google\Drive File Stream" -Recurse -Filter GoogleDriveFS.exe -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($gd -and -not (Get-Process -Name GoogleDriveFS -ErrorAction SilentlyContinue)) { Say "Google Drive was not running: starting it"; Start-Process -FilePath $gd.FullName }
        for ($w = 0; $w -lt 36 -and -not (Test-Path -LiteralPath $Drive); $w++) { Start-Sleep -Seconds 5 }
    }
    if (-not (Test-Path -LiteralPath $Drive)) { throw "Google Drive is not mounted at $Drive (is Google Drive for desktop running and signed in?)" }
    if (-not (Test-Path -LiteralPath $SevenZip)) { throw "7-Zip not found at $SevenZip" }
    if (-not (Test-Path -LiteralPath $PassFile)) { throw "Archive password file missing: $PassFile" }
    $pass = (Get-Content -LiteralPath $PassFile -TotalCount 1).Trim()
    if ($pass.Length -lt 20) { throw "Archive password looks wrong (too short)" }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null

    $day   = "{0:yyyy-MM-dd}" -f (Get-Date)
    $stage = Join-Path $env:TEMP "gdrive-backup-stage"
    if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null

    # 1a. git history as one file
    $bundle = Join-Path $stage "repo.bundle"
    & git -C $Project bundle create $bundle --all 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $bundle)) { throw "git bundle failed" }
    Say ("git bundle {0:N0} MB" -f ((Get-Item $bundle).Length / 1MB))

    # 1b. the locked archive
    $dt = Join-Path $Project "traverse\data-pipeline\door-territory"
    $items = @($bundle, $Memory, $ServerBk, $dt, (Join-Path $Project "surge\clients")) | Where-Object { Test-Path -LiteralPath $_ }
    $excl = @('-xr!lidar-cache', '-xr!buildings', '-xr!material\cache', '-xr!raw', '-xr!node_modules', '-xr!se-cache',
              '-xr!days', '-xr!days-dfw', '-xr!cache', '-xr!logs-*', '-xr!*.pdf', '-xr!elpaso-imagery', '-xr!pictures')
    $tmp7z = Join-Path $stage "core-$day.7z"
    $args7 = @('a', '-t7z', '-mx=5', '-mhe=on', "-p$pass", '-bso0', '-bsp0', $tmp7z) + $items + $excl
    & $SevenZip @args7
    if ($LASTEXITCODE -gt 1) { throw "7-Zip failed with exit $LASTEXITCODE" }   # 1 = warnings (a file in use), still a usable archive
    & $SevenZip t "-p$pass" -bso0 -bsp0 $tmp7z
    if ($LASTEXITCODE -ne 0) { throw "7-Zip test of the new archive failed (exit $LASTEXITCODE)" }
    $mb = (Get-Item $tmp7z).Length / 1MB
    Move-Item -Force -LiteralPath $tmp7z -Destination (Join-Path $Dest "core-$day.7z")
    Say ("core-$day.7z {0:N0} MB, tested, in Drive" -f $mb)

    # keep the newest $Keep
    $old = Get-ChildItem -LiteralPath $Dest -Filter "core-*.7z" | Sort-Object Name -Descending | Select-Object -Skip $Keep
    foreach ($o in $old) { Remove-Item -LiteralPath $o.FullName -Force; Say ("removed old {0}" -f $o.Name) }

    # 2. weekly media mirror
    $mark = Join-Path $Dest "media-last-run.txt"
    $due = $Media -or -not (Test-Path $mark) -or ((Get-Date) - (Get-Item $mark).LastWriteTime).TotalDays -ge 7
    if ($due) {
        foreach ($rel in @('surge\brand\videos', 'surge\brand\photos', 'traverse\videos', '_archive')) {
            $src = Join-Path $Project $rel
            if (-not (Test-Path -LiteralPath $src)) { continue }
            $dst = Join-Path $Dest ("media\" + $rel)
            & robocopy.exe $src $dst /MIR /XJ /R:1 /W:1 /NFL /NDL /NP /NJH /NJS | Out-Null
            $rc = $LASTEXITCODE
            if ($rc -ge 8) { Say "media mirror FAILED for $rel (robocopy $rc)" } else { Say "media mirror ok: $rel (robocopy $rc)" }
        }
        Set-Content -Path $mark -Value ("{0:yyyy-MM-dd HH:mm}" -f (Get-Date))
    }

    Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
    Say "done"
    exit 0
}
catch {
    Say ("FAILED: " + $_.Exception.Message)
    exit 8
}
