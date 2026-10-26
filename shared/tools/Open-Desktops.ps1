<#
.SYNOPSIS
    One Windows desktop per company, each with that company's Chrome profile open (set up 2026-10-25, Matthew).

.DESCRIPTION
    Makes sure these desktops exist, in this order, with these names, then opens a Chrome window in each company's profile on
    its own desktop and comes back to the first one:

      1 Build        VS Code and Claude (nothing opened here)
      2 Sixfold 365  sixfoldcolorado.com profile + aeration365.com profile
      3 Surge        surgeftw.com profile
      4 Traverse     traverseplatforms.com profile
      5 Personal     the personal Gmail profile

    Windows keeps the desktops and their names after a restart but not the windows on them, so run this after a restart
    (the "Open my desktops" shortcut on the Desktop does it). Switch desktops with Ctrl+Win+Left/Right; Win+Tab shows them all.
    Needs the VirtualDesktop PowerShell module (Install-Module VirtualDesktop -Scope CurrentUser).

.EXAMPLE
    .\shared\tools\Open-Desktops.ps1              # make the desktops and open the profiles
    .\shared\tools\Open-Desktops.ps1 -NoBrowsers  # only make and name the desktops
#>
param([switch]$NoBrowsers)
$ErrorActionPreference = 'Stop'
Import-Module VirtualDesktop -WarningAction SilentlyContinue

# Chrome profile folders, from Chrome's Local State (2026-10-25)
$layout = @(
    @{ Name = 'Build';       Profiles = @() },
    @{ Name = 'Sixfold 365'; Profiles = @('Profile 1', 'Profile 5') },
    @{ Name = 'Surge';       Profiles = @('Profile 2') },
    @{ Name = 'Traverse';    Profiles = @('Profile 4') },
    @{ Name = 'Personal';    Profiles = @('Default') }
)
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1

while ((Get-DesktopCount) -lt $layout.Count) { New-Desktop | Out-Null }
for ($i = 0; $i -lt $layout.Count; $i++) { Get-Desktop $i | Set-DesktopName -Name $layout[$i].Name }

# each desktop's wallpaper: its name in the company's colours (made 2026-10-25, in Pictures\Desktop wallpapers)
$walls = "$env:USERPROFILE\Pictures\Desktop wallpapers"
$wfile = @('1-build', '2-sixfold365', '3-surge', '4-traverse', '5-personal')
for ($i = 0; $i -lt $layout.Count; $i++) {
    $w = Join-Path $walls ($wfile[$i] + '.png')
    if (Test-Path $w) { Set-DesktopWallpaper -Desktop (Get-Desktop $i) -Path $w }
}

if (-not $NoBrowsers -and $chrome) {
    $start = Get-CurrentDesktop
    for ($i = 0; $i -lt $layout.Count; $i++) {
        if ($layout[$i].Profiles.Count -eq 0) { continue }
        Get-Desktop $i | Switch-Desktop
        Start-Sleep -Milliseconds 1500   # 600 ms was too short: on the first run (25 Oct) the Surge window opened on another desktop
        foreach ($p in $layout[$i].Profiles) {
            Start-Process -FilePath $chrome -ArgumentList "--profile-directory=`"$p`"", '--new-window'
            Start-Sleep -Seconds 3   # the window has to appear before the desktop changes, or it lands on the next one
        }
    }
    $start | Switch-Desktop
}
Get-DesktopList | Format-Table Number, Name -AutoSize
