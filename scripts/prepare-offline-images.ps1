$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$repoRoot = Split-Path -Parent $PSScriptRoot
$offlineDir = Join-Path $repoRoot "resources/offline-images"
New-Item -ItemType Directory -Force -Path $offlineDir | Out-Null

function Test-ImageExists {
  param([Parameter(Mandatory = $true)][string]$Image)

  $id = (docker images -q $Image 2>$null | Select-Object -First 1)
  return -not [string]::IsNullOrWhiteSpace($id)
}

function Ensure-ImageFromCandidates {
  param(
    [Parameter(Mandatory = $true)][string]$TargetImage,
    [Parameter(Mandatory = $true)][string[]]$Candidates
  )

  if (Test-ImageExists -Image $TargetImage) {
    Write-Host "Using existing local image: $TargetImage"
    return
  }

  foreach ($candidate in $Candidates) {
    if (Test-ImageExists -Image $candidate) {
      Write-Host "Tagging existing local image '$candidate' as '$TargetImage'"
      docker tag $candidate $TargetImage
      return
    }

    Write-Host "Pulling image: $candidate"
    docker pull $candidate
    if ($LASTEXITCODE -eq 0) {
      docker tag $candidate $TargetImage
      return
    }
  }

  throw "Failed to prepare image '$TargetImage' from candidates: $($Candidates -join ', ')"
}

$hermesTarget = "ghcr.io/nousresearch/hermes-agent:latest"
$hermesCandidates = @(
  # 国内镜像源（优先）
  "registry.cn-hangzhou.aliyuncs.com/nousresearch/hermes-agent:latest",
  "ccr.ccs.tencentyun.com/nousresearch/hermes-agent:latest",
  "docker.m.daocloud.io/nousresearch/hermes-agent:latest",
  "docker.m.daocloud.io/ghcr.io/nousresearch/hermes-agent:latest",
  "docker.mirrors.ustc.edu.cn/nousresearch/hermes-agent:latest",
  "hub-mirror.c.163.com/nousresearch/hermes-agent:latest",
  # 官方源（备用）
  "ghcr.io/nousresearch/hermes-agent:latest",
  "nousresearch/hermes-agent:latest"
)

$openWebuiTarget = "ghcr.io/open-webui/open-webui:main"
$openWebuiCandidates = @(
  # 国内镜像源（优先）
  "registry.cn-hangzhou.aliyuncs.com/open-webui/open-webui:main",
  "ccr.ccs.tencentyun.com/open-webui/open-webui:main",
  "docker.m.daocloud.io/ghcr.io/open-webui/open-webui:main",
  "docker.m.daocloud.io/openwebui/open-webui:main",
  "docker.mirrors.ustc.edu.cn/open-webui/open-webui:main",
  "hub-mirror.c.163.com/open-webui/open-webui:main",
  # 官方源（备用）
  "ghcr.io/open-webui/open-webui:main",
  "openwebui/open-webui:main"
)

Ensure-ImageFromCandidates -TargetImage $hermesTarget -Candidates $hermesCandidates
Ensure-ImageFromCandidates -TargetImage $openWebuiTarget -Candidates $openWebuiCandidates

$hermesTar = Join-Path $offlineDir "hermes-agent-latest.tar"
$openWebuiTar = Join-Path $offlineDir "open-webui-main.tar"

Write-Host "Saving Hermes image to $hermesTar"
docker save -o $hermesTar $hermesTarget
if ($LASTEXITCODE -ne 0) {
  throw "Failed to save Hermes image"
}

Write-Host "Saving Open WebUI image to $openWebuiTar"
docker save -o $openWebuiTar $openWebuiTarget
if ($LASTEXITCODE -ne 0) {
  throw "Failed to save Open WebUI image"
}

Write-Host "Offline images prepared successfully:"
Get-ChildItem $offlineDir | Format-Table Name, Length, LastWriteTime
