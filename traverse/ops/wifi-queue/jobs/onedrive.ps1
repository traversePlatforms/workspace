# Wi-Fi queue job: finish moving the OneDrive Desktop to this laptop (Matthew 2026-10-22: "my plan is to download them here so that i can upload
# them to google drive"). Copies only: nothing in OneDrive is deleted. One folder per unit, smallest first, Phone drop (86 GB) last; same rules
# as the 13 Oct move (newer, older and changed files at the destination are left alone). Online-only files download as they are read.
# Exit: 0 every folder done, 3 more left, 1 stopped (disk below 40 GB free, or robocopy failed).
$ErrorActionPreference = 'Stop'
$src = 'C:\Users\Surge Inc\OneDrive'; $dst = 'C:\Users\Surge Inc\Moved from OneDrive'
$state = 'C:\Users\Surge Inc\Desktop\claude test 2\traverse\ops\wifi-queue\state\onedrive'
$log = Join-Path $env:LOCALAPPDATA 'ProjectBackup\onedrive-move.log'
New-Item -ItemType Directory -Force $state | Out-Null
$units = @('Desktop\Documents for sixfold drive', 'Desktop\Marketing web content examples', 'Desktop\Surge Documents', 'Desktop\claude test 2', 'Documents', 'Videos', 'Apps', 'Desktop\Phone drop')
$freeGB = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
if ($freeGB -lt 40) { Write-Output "stopped: only $freeGB GB free on C:, under 40 GB"; exit 1 }
$next = $units | Where-Object { -not (Test-Path (Join-Path $state (($_ -replace '[\\ ]', '_') + '.done'))) } | Select-Object -First 1
if (-not $next) { Write-Output 'every folder done'; exit 0 }
$from = Join-Path $src $next; $to = Join-Path $dst $next
if (-not (Test-Path -LiteralPath $from)) { New-Item -ItemType File (Join-Path $state (($next -replace '[\\ ]', '_') + '.done')) | Out-Null; Write-Output "$next is gone from OneDrive: skipped"; exit 3 }
Write-Output "copying $next ($freeGB GB free on C:)"
& robocopy.exe $from $to *.* /S /E /DCOPY:DAT /COPY:DAT /NP /NDL /XO /XN /XC /XJ /MT:8 /R:2 /W:30 /XF desktop.ini 'ProtonVPN*.exe' 'tor-browser*.exe' /XD Slippi 'Tor Browser' /UNILOG+:$log | Out-Null
$rc = $LASTEXITCODE
if ($rc -ge 8) { Write-Output "robocopy reported failures for $next (code $rc); see $log"; exit 1 }
New-Item -ItemType File -Force (Join-Path $state (($next -replace '[\\ ]', '_') + '.done')) | Out-Null
$left = $units | Where-Object { -not (Test-Path (Join-Path $state (($_ -replace '[\\ ]', '_') + '.done'))) }
Write-Output ("done: $next (robocopy $rc); " + $(if ($left) { "$(@($left).Count) folder(s) left" } else { 'every folder done' }))
if ($left) { exit 3 } else { exit 0 }
