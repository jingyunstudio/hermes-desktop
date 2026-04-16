param(
  [string]$Version = "0.1.0"
)

Write-Host "Preparing Windows release for Hermes Desktop v$Version"
pnpm install
pnpm --filter desktop-shell run build
pnpm --filter desktop-shell exec electron-builder --config ../../build/electron-builder.yml --win
Write-Host "Release build completed"
