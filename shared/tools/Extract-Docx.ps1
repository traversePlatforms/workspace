<#
.SYNOPSIS
Pulls the plain text out of a .docx so it can be read as source material.

.DESCRIPTION
A .docx is a zip containing word/document.xml. This opens it directly. No Word
install needed, and no COM automation (which hangs in a non-interactive shell).

Paragraphs, line breaks, tabs and table cells survive. Bold, colour, heading
levels, images and comments do not - they are not in the text stream.

NOTE: this file is deliberately ASCII-only. Windows PowerShell 5.1 reads a
BOM-less UTF-8 script as ANSI, which turns any dash or curly quote into
mojibake and produces a cascade of parse errors.

.EXAMPLE
.\tools\Extract-Docx.ps1 -Path .\training-source\objection-handling.docx

.EXAMPLE
.\tools\Extract-Docx.ps1 -Path .\training-source\step.docx -OutFile .\training-source\step.md
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Path,

  [string]$OutFile
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$full = (Resolve-Path -LiteralPath $Path).ProviderPath

$zip = [System.IO.Compression.ZipFile]::OpenRead($full)
try {
  # Word writes forward slashes per the zip spec, but normalize anyway - some
  # producers (including .NET's CreateFromDirectory on Windows) use backslashes.
  $entry = $zip.Entries | Where-Object { $_.FullName.Replace('\', '/') -eq 'word/document.xml' }
  if (-not $entry) {
    throw "No word/document.xml inside that file. Is it really a .docx? (.doc and .rtf are different formats - re-save as .docx.)"
  }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { $xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
}
finally { $zip.Dispose() }

# Structure first, while the tags are still there.
$xml = $xml -replace '<w:tab[^>]*/>', "`t"
$xml = $xml -replace '<w:br[^>]*/>', "`n"
$xml = $xml -replace '</w:p>', "`n"
$xml = $xml -replace '</w:tc>', "`t"     # table cell -> tab
$xml = $xml -replace '</w:tr>', "`n"     # table row  -> newline

# Then drop every remaining tag.
$text = $xml -replace '<[^>]+>', ''

# Entities last, so a literal escaped tag inside the document survives.
$text = $text -replace '&lt;', '<'
$text = $text -replace '&gt;', '>'
$text = $text -replace '&quot;', '"'
$text = $text -replace "&apos;", "'"
$text = $text -replace '&amp;', '&'

# Tidy what Word leaves behind.
$text = $text -replace "[ \t]+(\r?\n)", "`n"
$text = $text -replace "(\r?\n){3,}", "`n`n"
$text = $text.Trim()

if ($OutFile) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $dest = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).ProviderPath $OutFile))
  [System.IO.File]::WriteAllText($dest, $text, $enc)
  $lines = ($text -split "`n").Count
  Write-Output "Wrote $dest ($lines lines)"
}
else {
  Write-Output $text
}
