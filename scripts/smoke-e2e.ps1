Write-Host "Running smoke verification for Hermes Desktop"
pnpm install
pnpm --filter desktop-shell run build
Write-Host "Smoke verification done"
