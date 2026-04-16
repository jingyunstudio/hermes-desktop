# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-16

### Added
- Docker Desktop 自动安装功能
- 支持 GUI 安装界面
- 多镜像源下载支持（官方源、国内镜像源、OSS 备份源）
- 本地缓存检测功能
- Docker 安装状态检测（通过 `docker --version` 命令）
- 自定义安装目录名称（Hermes-Desktop）
- 多分辨率应用图标支持

### Changed
- 优先下载 Docker Desktop 4.33.1 版本（更好的兼容性）
- 使用 Windows `start` 命令启动 Docker Desktop
- 改进安装进度日志输出

### Fixed
- 修复文件删除权限错误（EPERM）
- 修复 Docker Desktop 安装检测逻辑
- 修复图标显示问题

## [0.1.0] - 2026-04-13

### Added
- 初始版本发布
- 一键部署 Hermes Agent + Open WebUI
- 国内镜像源优化
- 离线安装支持
- 实时部署进度反馈
- 健康检查机制
