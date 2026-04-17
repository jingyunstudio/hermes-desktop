# Docker 启动调试脚本
# 用于诊断 Docker Desktop 启动问题

Write-Host "=== Docker 启动诊断工具 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Docker 是否已安装
Write-Host "[1/7] 检查 Docker 安装状态..." -ForegroundColor Yellow
$dockerVersion = docker --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker 已安装: $dockerVersion" -ForegroundColor Green
} else {
    Write-Host "✗ Docker 未安装或未在 PATH 中" -ForegroundColor Red
    exit 1
}

# 2. 检查 Docker Desktop 可执行文件
Write-Host ""
Write-Host "[2/7] 检查 Docker Desktop 可执行文件..." -ForegroundColor Yellow
$dockerExePaths = @(
    "C:\Program Files\Docker\Docker\Docker Desktop.exe",
    "C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe"
)

$dockerExe = $null
foreach ($path in $dockerExePaths) {
    if (Test-Path $path) {
        Write-Host "✓ 找到: $path" -ForegroundColor Green
        $dockerExe = $path
        break
    }
}

if (-not $dockerExe) {
    Write-Host "✗ 未找到 Docker Desktop 可执行文件" -ForegroundColor Red
    exit 1
}

# 3. 检查 Docker Desktop 进程
Write-Host ""
Write-Host "[3/7] 检查 Docker Desktop 进程..." -ForegroundColor Yellow
$dockerProcesses = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerProcesses) {
    Write-Host "✓ Docker Desktop 进程正在运行 (PID: $($dockerProcesses.Id -join ', '))" -ForegroundColor Green
} else {
    Write-Host "✗ Docker Desktop 进程未运行" -ForegroundColor Red
}

# 4. 检查 Docker daemon 状态
Write-Host ""
Write-Host "[4/7] 检查 Docker daemon 状态..." -ForegroundColor Yellow
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Docker daemon 正在运行" -ForegroundColor Green
    Write-Host "  服务器版本: $(docker version --format '{{.Server.Version}}' 2>$null)" -ForegroundColor Gray
} else {
    Write-Host "✗ Docker daemon 未就绪" -ForegroundColor Red
    Write-Host "  错误信息: $($dockerInfo | Select-Object -First 3)" -ForegroundColor Gray
}

# 5. 检查 WSL2 状态
Write-Host ""
Write-Host "[5/7] 检查 WSL2 状态..." -ForegroundColor Yellow
$wslVersion = wsl --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ WSL2 已安装" -ForegroundColor Green
    $wslList = wsl -l -v 2>&1
    Write-Host "  已安装的发行版:" -ForegroundColor Gray
    Write-Host "  $($wslList | Out-String)" -ForegroundColor Gray
} else {
    Write-Host "✗ WSL2 未安装或未启用" -ForegroundColor Red
    Write-Host "  Docker Desktop 需要 WSL2 支持" -ForegroundColor Yellow
}

# 6. 检查 Hyper-V 状态 (可选)
Write-Host ""
Write-Host "[6/7] 检查虚拟化支持..." -ForegroundColor Yellow
$hyperv = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -ErrorAction SilentlyContinue
if ($hyperv -and $hyperv.State -eq "Enabled") {
    Write-Host "✓ Hyper-V 已启用" -ForegroundColor Green
} else {
    Write-Host "⚠ Hyper-V 未启用 (WSL2 模式不需要)" -ForegroundColor Yellow
}

# 7. 尝试启动 Docker Desktop
Write-Host ""
Write-Host "[7/7] 尝试启动 Docker Desktop..." -ForegroundColor Yellow

if (-not $dockerProcesses) {
    Write-Host "正在启动 Docker Desktop..." -ForegroundColor Cyan
    
    # 方法 1: 使用 start 命令
    Write-Host "  方法 1: 使用 start 命令" -ForegroundColor Gray
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "start", '""', '"Docker Desktop"' -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
    
    $dockerProcesses = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
    if ($dockerProcesses) {
        Write-Host "  ✓ 启动成功 (方法 1)" -ForegroundColor Green
    } else {
        # 方法 2: 直接执行可执行文件
        Write-Host "  方法 2: 直接执行可执行文件" -ForegroundColor Gray
        Start-Process -FilePath $dockerExe -WindowStyle Hidden -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 5
        
        $dockerProcesses = Get-Process -Name "Docker Desktop" -ErrorAction SilentlyContinue
        if ($dockerProcesses) {
            Write-Host "  ✓ 启动成功 (方法 2)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ 启动失败" -ForegroundColor Red
        }
    }
    
    # 等待 Docker daemon 就绪
    if ($dockerProcesses) {
        Write-Host ""
        Write-Host "等待 Docker daemon 就绪..." -ForegroundColor Cyan
        $maxWaitSeconds = 120
        $checkInterval = 3
        $elapsed = 0
        
        while ($elapsed -lt $maxWaitSeconds) {
            $dockerInfo = docker info 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Docker daemon 已就绪 (耗时 ${elapsed}s)" -ForegroundColor Green
                break
            }
            
            Write-Host "  等待中... (${elapsed}s / ${maxWaitSeconds}s)" -ForegroundColor Gray
            Start-Sleep -Seconds $checkInterval
            $elapsed += $checkInterval
        }
        
        if ($elapsed -ge $maxWaitSeconds) {
            Write-Host "✗ Docker daemon 启动超时" -ForegroundColor Red
            Write-Host "  建议操作:" -ForegroundColor Yellow
            Write-Host "  1. 检查 Docker Desktop 日志" -ForegroundColor Yellow
            Write-Host "  2. 尝试重启系统" -ForegroundColor Yellow
            Write-Host "  3. 手动启动 Docker Desktop 并查看错误信息" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "Docker Desktop 已在运行，跳过启动" -ForegroundColor Green
}

# 总结
Write-Host ""
Write-Host "=== 诊断完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Docker Desktop 日志位置:" -ForegroundColor Yellow
Write-Host "  %LOCALAPPDATA%\Docker\log.txt" -ForegroundColor Gray
Write-Host "  %APPDATA%\Docker Desktop\log.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "如果问题仍然存在，请:" -ForegroundColor Yellow
Write-Host "  1. 查看上述日志文件" -ForegroundColor Gray
Write-Host "  2. 尝试重启系统" -ForegroundColor Gray
Write-Host "  3. 手动启动 Docker Desktop 查看错误信息" -ForegroundColor Gray
Write-Host "  4. 检查 WSL2 是否正确安装" -ForegroundColor Gray
