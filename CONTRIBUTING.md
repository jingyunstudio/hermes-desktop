# Contributing to Hermes Desktop

感谢你对 Hermes Desktop 的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告 Bug

如果你发现了 bug，请在 [GitHub Issues](https://github.com/your-org/hermes-desktop/issues) 中创建一个新的 issue，并包含以下信息：

- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 系统环境（操作系统、版本等）
- 相关日志或截图

### 提交功能建议

如果你有新功能的想法，欢迎在 Issues 中提出。请详细描述：

- 功能的使用场景
- 预期的实现方式
- 可能的替代方案

### 提交代码

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建一个 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循项目现有的代码风格
- 添加必要的注释
- 确保代码通过 lint 检查
- 为新功能添加测试

### 提交信息规范

提交信息应该清晰地描述改动内容：

- `feat: 添加新功能`
- `fix: 修复 bug`
- `docs: 更新文档`
- `style: 代码格式调整`
- `refactor: 重构代码`
- `test: 添加测试`
- `chore: 构建或辅助工具的变动`

## 开发环境设置

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 打包
pnpm package:win
```

## 项目结构

```
hermes-desktop/
├── apps/
│   └── desktop-shell/          # Electron 主应用
├── packages/
│   ├── deploy-engine/          # 部署编排引擎
│   ├── runtime-adapter/        # Docker 运行时适配器
│   ├── shared-types/           # 共享类型定义
│   └── ui-kit/                 # UI 组件库
├── build/                      # electron-builder 配置
├── docs/                       # 文档
├── resources/                  # 资源文件
└── scripts/                    # 构建脚本
```

## 行为准则

- 尊重所有贡献者
- 保持友好和专业的交流
- 接受建设性的批评
- 关注对项目最有利的事情

## 许可证

通过贡献代码，你同意你的贡献将在 MIT 许可证下发布。
