# Drag guard (2026-11-10, Matthew: "We need to figure out how to prevent these drags that end up getting stuck").
# Two slowdowns in two days: 9 Nov WidgetService stuck at ~84% CPU for two days (the laptop ran hot); 10 Nov 107 watchdog shells that never
# ended, each starting PowerShell every 30 s (memory down to 2.7 GB free of 32). Runs every 10 minutes (task "Drag guard").
# What it does on its own (only things that are safe to stop, and that Windows or our jobs start again by themselves):
#   1. watchdogs (hotspot-watchdog*.sh) whose job is no longer running, and duplicates of the same watchdog (the newest one is kept)
#   2. our PowerShell process checks ("Get-CimInstance Win32_Process") still alive after 10 minutes: they should take a second
#   3. a Windows helper on the SAFE list using more than 20% of the whole machine on two checks in a row (WidgetService and the like)
# What it only reports (never stops): anything else using a lot of CPU two checks in a row, more than 80 bash or 30 PowerShell
# processes, and less than 3 GB of memory available. Reports go to ProjectBackup\drag-guard.log, a Windows notification, and
# drag-guard-latest.txt (the overnight check reads it).
$ErrorActionPreference = 'SilentlyContinue'
$dir = Join-Path $env:LOCALAPPDATA 'ProjectBackup'; New-Item -ItemType Directory -Force $dir | Out-Null
$log = Join-Path $dir 'drag-guard.log'; $stateF = Join-Path $dir 'drag-guard-state.json'; $latest = Join-Path $dir 'drag-guard-latest.txt'
$now = Get-Date; $acts = @(); $warn = @()
function L($m) { Add-Content -Path $log -Value ("{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) -Encoding UTF8 }
$all = @(Get-CimInstance Win32_Process)
$bash = @($all | Where-Object { $_.Name -eq 'bash.exe' })

# 1. watchdogs: no job left, or more than one for the same job
$wd = @($bash | Where-Object { $_.CommandLine -match 'hotspot-watchdog' })
foreach ($g in ($wd | Group-Object { ($_.CommandLine -replace '^.*hotspot-watchdog\S*\s*', '').Trim() })) {
  $pat = $g.Name
  $jobAlive = $pat -ne '' -and @($bash | Where-Object { $_.CommandLine -match [regex]::Escape($pat) -and $_.CommandLine -notmatch 'hotspot-watchdog' }).Count -gt 0
  $keep = if ($jobAlive) { $g.Group | Sort-Object CreationDate -Descending | Select-Object -First 1 } else { $null }
  $kill = @($g.Group | Where-Object { -not $keep -or $_.ProcessId -ne $keep.ProcessId } | Where-Object { ($now - $_.CreationDate).TotalMinutes -gt 2 })
  foreach ($p in $kill) { Stop-Process -Id $p.ProcessId -Force }
  if ($kill.Count) { $acts += "stopped $($kill.Count) watchdog(s) for '$pat'" + $(if ($jobAlive) { ' (duplicates; one kept)' } else { ' (its job had ended)' }) }
}

# 2. PowerShell process checks older than 10 minutes
$hung = @($all | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -match 'Get-CimInstance Win32_Process' -and $_.ProcessId -ne $PID -and ($now - $_.CreationDate).TotalMinutes -gt 10 })
foreach ($p in $hung) { Stop-Process -Id $p.ProcessId -Force }
if ($hung.Count) { $acts += "stopped $($hung.Count) stuck PowerShell process check(s)" }

# 3. CPU over about 20 s; a process high on two checks in a row
$cores = [int]((Get-CimInstance Win32_Processor | Measure-Object NumberOfLogicalProcessors -Sum).Sum)
$t1 = @{}; Get-Process | ForEach-Object { if ($_.CPU) { $t1[$_.Id] = $_.CPU } }
Start-Sleep -Seconds 20
$hot = @(Get-Process | Where-Object { $t1.ContainsKey($_.Id) -and $_.CPU } | ForEach-Object {
  [pscustomobject]@{ Name = $_.ProcessName; Id = $_.Id; Pct = [math]::Round(($_.CPU - $t1[$_.Id]) / 20 / $cores * 100, 1) } } | Where-Object { $_.Pct -ge 20 })
$prev = @{}; if (Test-Path $stateF) { try { (Get-Content $stateF -Raw | ConvertFrom-Json).hot | ForEach-Object { $prev[[string]$_] = 1 } } catch {} }
# Windows helpers that are safe to stop: Windows starts them again when they are needed (WidgetService was the 9 Nov one)
$SAFE = @('WidgetService', 'Widgets', 'SearchHost', 'SearchIndexer', 'PhoneExperienceHost', 'StartMenuExperienceHost', 'TextInputHost', 'CompPkgSrv', 'backgroundTaskHost', 'RuntimeBroker')
# busy on purpose: the nightly backup, our pipeline, the editor, browsers and games are reported only after 2 checks, never stopped
foreach ($h in $hot) {
  $key = "$($h.Name)#$($h.Id)"
  if (-not $prev.ContainsKey($key)) { continue }
  if ($SAFE -contains $h.Name) { Stop-Process -Id $h.Id -Force; $acts += "stopped $($h.Name) (was using $($h.Pct)% of the machine for 10+ minutes; Windows restarts it when needed)" }
  elseif ($h.Name -notin @('7z', 'node', 'MsMpEng')) { $warn += "$($h.Name) has used $($h.Pct)% of the machine for 10+ minutes (left running)" }
}
@{ at = $now.ToString('s'); hot = @($hot | ForEach-Object { "$($_.Name)#$($_.Id)" }) } | ConvertTo-Json | Set-Content $stateF -Encoding UTF8

# reports only
$psN = @($all | Where-Object { $_.Name -eq 'powershell.exe' }).Count
if ($bash.Count -gt 80) { $top = ($bash | Group-Object { ($_.CommandLine -replace '\s+', ' ') } | Sort-Object Count -Descending | Select-Object -First 1); $warn += "$($bash.Count) bash processes (most: $($top.Count) x $($top.Name.Substring(0, [math]::Min(90, $top.Name.Length))))" }
if ($psN -gt 30) { $warn += "$psN PowerShell processes" }
$avail = [math]::Round((Get-Counter '\Memory\Available MBytes').CounterSamples[0].CookedValue / 1024, 1)
if ($avail -lt 3) { $top3 = (Get-Process | Group-Object ProcessName | ForEach-Object { [pscustomobject]@{ N = $_.Name; MB = [math]::Round(($_.Group | Measure-Object WS -Sum).Sum / 1MB) } } | Sort-Object MB -Descending | Select-Object -First 3 | ForEach-Object { "$($_.N) $($_.MB) MB" }) -join ', '; $warn += "only $avail GB of memory available (largest: $top3)" }

foreach ($a in $acts) { L "FIXED  $a" }
foreach ($w in $warn) { L "CHECK  $w" }
$line = if ($acts.Count -or $warn.Count) { (($acts | ForEach-Object { "fixed: $_" }) + ($warn | ForEach-Object { "check: $_" })) -join ' | ' } else { "ok (memory available $avail GB)" }
Set-Content $latest -Value ("{0}  {1}" -f $now.ToString('yyyy-MM-dd HH:mm'), $line) -Encoding UTF8

# a Windows notification when something was done or needs a look
if ($acts.Count -or $warn.Count) {
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $x = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $tx = $x.GetElementsByTagName('text'); $tx.Item(0).AppendChild($x.CreateTextNode('Drag guard')) | Out-Null
    $body = (@($acts) + @($warn) | Select-Object -First 2) -join '. '; $tx.Item(1).AppendChild($x.CreateTextNode($body.Substring(0, [math]::Min(200, $body.Length)))) | Out-Null
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($x))
  } catch {}
}
