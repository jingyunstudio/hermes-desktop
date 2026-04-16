Write-Host "Verifying installer artifact existence"
$artifactDir = "dist/installer"
if (!(Test-Path $artifactDir)) {
  throw "Installer output directory not found: $artifactDir"
}
Get-ChildItem $artifactDir | Format-Table Name, Length, LastWriteTime
