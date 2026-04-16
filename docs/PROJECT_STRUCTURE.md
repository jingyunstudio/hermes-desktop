# 项目结构

```
hermes-desktop/
├── apps/                           # 应用程序
│   └── desktop-shell/              # Electron 桌面应用
│       ├── src/
│       │   ├── main/               # Electron 主进程
│       │   ├── preload/            # 预加载脚本
│       │   └── renderer/           # React 渲染进程
│       └── package.json
│
├── packages/                       # 共享包
│   ├── deploy-engine/              # 部署编排引擎
│   │   └── src/
│   │       └── state-machine.ts    # 部署状态机
│   │
│   ├── runtime-adapter/            # Docker 运行时适配器
│   │   └── src/
│   │       ├── docker.ts           # Docker 管理
│   │       ├── docker-installer.ts # Docker 自动安装
│   │       ├── hermes.ts           # Hermes Agent 适配器
│   │       └── openwebui.ts        # Open WebUI 适配器
│   │
│   ├── shared-types/               # 共享类型定义
│   │   └── src/
│   │       └── index.ts
│   │
│   └── ui-kit/                     # UI 组件库
│       └── src/
│
├── build/                          # 构建配置
│   ├── electron-builder.yml        # 在线版打包配置
│   └── electron-builder.offline.yml # 离线版打包配置
│
├── docs/                           # 文档
│   ├── AUTO_INSTALL_DOCKER.md      # Docker 自动安装说明
│   ├── CONFIG_BEST_PRACTICES.md    # 配置最佳实践
│   ├── DEBUG_GUIDE.md              # 调试指南
│   ├── MIRROR_SOURCES.md           # 镜像源配置
│   ├── PRODUCTION_CONFIG.md        # 生产环境配置
│   └── USER_GUIDE.md               # 用户指南
│
├── resources/                      # 资源文件
│   ├── compose/                    # Docker Compose 配置
│   │   ├── hermes-runtime.yml      # Hermes Agent 配置
│   │   └── open-webui.yml          # Open WebUI 配置
│   │
│   ├── installer/                  # 安装器资源
│   │   ├── icon.ico                # 应用图标
│   │   └── installer.nsh           # NSIS 安装脚本
│   │
│   ├── offline-images/             # 离线镜像（.gitignore）
│   │   ├── hermes-agent-latest.tar
│   │   └── open-webui-main.tar
│   │
│   └── HERMES_CONFIG_GUIDE.md      # Hermes 配置指南
│
├── scripts/                        # 构建脚本
│   ├── prepare-offline-images.ps1  # 准备离线镜像
│   ├── release.ps1                 # 发布脚本
│   ├── smoke-e2e.ps1               # 冒烟测试
│   └── verify-installer.ps1        # 验证安装包
│
├── .gitignore                      # Git 忽略配置
├── CHANGELOG.md                    # 变更日志
├── CONTRIBUTING.md                 # 贡献指南
├── LICENSE                         # MIT 许可证
├── README.md                       # 项目说明
├── package.json                    # 根 package.json
├── pnpm-workspace.yaml             # pnpm 工作区配置
└── turbo.json                      # Turbo 构建配置
```

## 核心模块说明

### desktop-shell
Electron 主应用，负责：
- 用户界面展示
- 部署流程协调
- 系统托盘管理
- 窗口管理

### deploy-engine
部署编排引擎，实现：
- 状态机驱动的部署流程
- 阶段管理和错误处理
- 进度追踪和日志记录

### runtime-adapter
Docker 运行时适配器，提供：
- Docker 环境检测和管理
- Docker Desktop 自动安装
- 容器生命周期管理
- 镜像拉取和加载

### shared-types
共享类型定义，包含：
- 部署状态类型
- 配置接口定义
- 事件类型定义

## 构建流程

1. **开发模式**：`pnpm dev`
   - 启动所有包的开发服务器
   - 支持热重载

2. **构建**：`pnpm build`
   - 使用 Turbo 并行构建所有包
   - 生成生产环境代码

3. **打包**：
   - 在线版：`pnpm package:win`
   - 离线版：`pnpm package:win:offline`

## 技术栈

- **框架**：Electron 33 + React 19
- **语言**：TypeScript 5
- **构建**：Vite 5 + Turbo
- **打包**：electron-builder 25
- **包管理**：pnpm 9
- **容器**：Docker + Docker Compose
