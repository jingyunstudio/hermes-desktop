import { useEffect, useMemo, useState, useRef } from "react";
import { AppSettings, BootstrapStage, BootstrapState, DeviceBindingState } from "@hermes-desktop/shared-types";
import "./styles.css";

const STAGE_LABELS: Record<BootstrapStage, string> = {
  precheck: "环境检测",
  install_prerequisites: "安装必备环境",
  install_hermes: "安装 Hermes 和 Open WebUI",
  verify_health: "健康检查",
};

const STAGE_ICONS: Record<BootstrapStage, string> = {
  precheck: "🔍",
  install_prerequisites: "🐳",
  install_hermes: "🤖",
  verify_health: "✅",
};

const STAGE_ORDER: BootstrapStage[] = [
  "precheck",
  "install_prerequisites",
  "install_hermes",
  "verify_health",
];

function getBindingStatusLabel(status?: DeviceBindingState["status"]): string {
  switch (status) {
    case "pending":
      return "等待绑定";
    case "bound":
      return "绑定成功";
    case "expired":
      return "已过期";
    case "error":
      return "请求失败";
    default:
      return "未生成";
  }
}

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);
  const [bindingState, setBindingState] = useState<DeviceBindingState | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [bindingBusy, setBindingBusy] = useState<boolean>(false);
  const [bindModalOpen, setBindModalOpen] = useState<boolean>(false);
  const [modelConfigModalOpen, setModelConfigModalOpen] = useState<boolean>(false);
  const [tenantConfigModalOpen, setTenantConfigModalOpen] = useState<boolean>(false);
  const [pairCodeInput, setPairCodeInput] = useState<string>("");
  const [modelConfig, setModelConfig] = useState({
    provider: "custom",
    baseUrl: "https://maidoucoding.online/v1",
    defaultModel: "claude-opus-4-6",
    apiKey: "",
  });
  const [modelConfigBusy, setModelConfigBusy] = useState<boolean>(false);
  const [modelConfigMessage, setModelConfigMessage] = useState<string>("");
  const [tenantConfigBusy, setTenantConfigBusy] = useState<boolean>(false);
  const [tenantConfigMessage, setTenantConfigMessage] = useState<string>("");
  const [workspaceDir, setWorkspaceDir] = useState<string>("");
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      window.desktopApi.getSettings(),
      window.desktopApi.getBootstrapState(),
      window.desktopApi.getBindingState(),
      window.desktopApi.isTenantConfigured(),
    ]).then(([cfg, state, bindState, isConfigured]) => {
      setSettings(cfg);
      setBootstrapState(state);
      setBindingState(bindState);
      
      // 如果未配置租户信息，显示配置向导
      if (!isConfigured) {
        setTenantConfigModalOpen(true);
      }
    });

    const unsubscribe = window.desktopApi.onBootstrapStateChanged((state) => {
      setBootstrapState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 直接使用 logs 数组
  const allLogs = bootstrapState?.logs || [];

  // 自动滚动到最新日志
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [allLogs]);

  const currentStepIndex = useMemo(() => {
    if (!bootstrapState?.currentStage) {
      // 如果没有 currentStage，找第一个非 success 的步骤
      const firstPending = STAGE_ORDER.findIndex(
        (stage) => bootstrapState?.steps[stage].status !== "success"
      );
      return firstPending >= 0 ? firstPending : STAGE_ORDER.length - 1;
    }
    return STAGE_ORDER.indexOf(bootstrapState.currentStage);
  }, [bootstrapState]);

  const completedSteps = useMemo(() => {
    if (!bootstrapState) return 0;
    return STAGE_ORDER.filter(
      (stage) => bootstrapState.steps[stage].status === "success"
    ).length;
  }, [bootstrapState]);

  const progressPercentage = Math.round((completedSteps / STAGE_ORDER.length) * 100);

  const onRepair = async () => {
    setBusy(true);
    try {
      await window.desktopApi.repairBootstrap();
    } finally {
      setBusy(false);
    }
  };

  const onOpenWebui = async () => {
    await window.desktopApi.openWebui();
  };

  const onOpenBindingPage = async () => {
    await window.desktopApi.openBindingPage();
  };

  const onActivateByPairCode = async () => {
    setBindingBusy(true);
    try {
      // 同时更新设备绑定和租户配置
      const result = await window.desktopApi.configureFromPairCode(
        pairCodeInput.trim(),
        workspaceDir.trim() || undefined
      );
      
      if (result.success) {
        // 获取最新的绑定状态
        const state = await window.desktopApi.getBindingState();
        setBindingState(state);
        
        // 显示成功消息
        alert("绑定成功！租户配置已更新，页面将刷新以应用新配置。");
        
        // 刷新页面以应用新配置
        window.location.reload();
      } else {
        alert(`绑定失败：${result.message}`);
      }
    } finally {
      setBindingBusy(false);
    }
  };

  const onCopyBindingCode = async () => {
    if (!pairCodeInput.trim()) {
      return;
    }

    await navigator.clipboard.writeText(pairCodeInput.trim());
  };

  const onSaveModelConfig = async () => {
    setModelConfigBusy(true);
    setModelConfigMessage("");
    try {
      const result = await window.desktopApi.saveModelConfig(modelConfig);
      setModelConfigMessage(result.message);
      if (result.success) {
        setTimeout(() => {
          setModelConfigModalOpen(false);
          setModelConfigMessage("");
        }, 1500);
      }
    } finally {
      setModelConfigBusy(false);
    }
  };

  const onConfigureFromPairCode = async () => {
    setTenantConfigBusy(true);
    setTenantConfigMessage("");
    try {
      const result = await window.desktopApi.configureFromPairCode(
        pairCodeInput.trim(),
        workspaceDir.trim() || undefined
      );
      setTenantConfigMessage(result.message);
      if (result.success) {
        setTimeout(() => {
          setTenantConfigModalOpen(false);
          setTenantConfigMessage("");
          // 刷新页面以应用新配置
          window.location.reload();
        }, 1500);
      }
    } finally {
      setTenantConfigBusy(false);
    }
  };

  if (!settings || !bootstrapState) {
    return (
      <div className="app-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  const currentStage = STAGE_ORDER[currentStepIndex];
  const currentStep = bootstrapState.steps[currentStage];

  return (
    <div className="app-container">
      {/* 背景光晕 */}
      <div className="background-glow"></div>

      {/* 顶部 Logo */}
      <div className="header">
        <div className="logo">
          <span className="logo-icon">🚀</span>
          <h1 className="logo-text">Hermes Desktop</h1>
        </div>
        <div className="subtitle">一键部署 Hermes Agent + Open WebUI</div>
      </div>

      {/* 中央卡片 */}
      <div className="center-card">
        {/* 当前步骤消息 */}
        <p className="stage-message">
          {bootstrapState.phase === "ready" ? "所有服务已成功启动，现在可以开始使用了" : currentStep.message}
        </p>

        {/* 进度条 */}
        <div className="progress-section">
          <div className="progress-label">Installation Progress</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
          <div className="progress-text">{progressPercentage}%</div>
        </div>

        {/* 步骤列表 */}
        <div className="steps-list">
          {STAGE_ORDER.map((stage, index) => {
            const step = bootstrapState.steps[stage];
            const isCompleted = step.status === "success";
            const isActive = index === currentStepIndex && bootstrapState.phase !== "ready";
            const isFailed = step.status === "failed";

            return (
              <div
                key={stage}
                className={`step-item ${isCompleted ? "completed" : ""} ${isActive ? "active" : ""} ${isFailed ? "failed" : ""}`}
              >
                <div className="step-icon">
                  {isCompleted ? "✓" : isFailed ? "✕" : "○"}
                </div>
                <div className="step-label">{STAGE_LABELS[stage]}</div>
              </div>
            );
          })}
        </div>

        {/* 日志 - 去掉标题，增加高度 */}
        <div className="logs-section">
          <div className="logs-content">
            {allLogs.length > 0 ? (
              <>
                {allLogs.map((logLine, idx) => (
                  <div key={idx} className="log-line">
                    {logLine}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </>
            ) : (
              <div className="log-line">等待日志输出...</div>
            )}
          </div>
        </div>

        {/* 错误信息 */}
        {currentStep.status === "failed" && currentStep.errorCode && (
          <div className="error-box">
            <span className="error-icon">⚠️</span>
            <span className="error-code">错误码: {currentStep.errorCode}</span>
          </div>
        )}

        {/* 主操作按钮 */}
        <div className="main-action">
          <button
            className="btn btn-primary btn-large"
            onClick={bootstrapState.phase === "ready" ? onOpenWebui : onRepair}
            disabled={busy}
          >
            {busy ? "⏳ 部署中..." : bootstrapState.phase === "ready" ? "🌐 打开 Open WebUI" : "🔄 重新部署"}
          </button>

          {bootstrapState.phase === "ready" && (
            <button
              className="btn btn-secondary btn-large main-action-secondary"
              onClick={() => setBindModalOpen(true)}
              disabled={bindingBusy}
            >
              {bindingBusy ? "⏳ 处理中..." : "🔗 绑定设备码"}
            </button>
          )}

          {bootstrapState.phase === "ready" && bindingState?.status === "bound" && (
            <div className="binding-inline-success">
              绑定成功：租户 {bindingState.tenantId || "-"}，用户 {bindingState.userId || "-"}
            </div>
          )}
        </div>
      </div>

      {bindModalOpen && (
        <div className="binding-modal-overlay" onClick={() => setBindModalOpen(false)}>
          <div className="binding-modal" onClick={(event) => event.stopPropagation()}>
            <div className="binding-modal-header">
              <h3>设备配对</h3>
              <button className="binding-modal-close" onClick={() => setBindModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="binding-code-label">设备码</div>
            <input
              className="binding-code-input"
              value={pairCodeInput}
              onChange={(event) => setPairCodeInput(event.target.value.toUpperCase())}
              placeholder="请粘贴 User-App 生成的设备码"
            />

            <div className="binding-code-label" style={{ marginTop: "20px" }}>工作目录（可选）</div>
            <input
              className="binding-code-input"
              value={workspaceDir}
              onChange={(event) => setWorkspaceDir(event.target.value)}
              placeholder={`默认: ${process.env.USERPROFILE || 'C:\\Users\\用户名'}\\HermesWorkspace`}
            />
            <p className="binding-tip" style={{ fontSize: "12px", marginTop: "5px" }}>
              Hermes 将在此目录中读写文件。留空使用默认目录。
            </p>

            <p className="binding-tip">请先在 User-App 的 Hermes 页面生成设备码，再回到这里完成绑定。绑定后将自动更新租户配置。</p>

            <div className="binding-status-row">
              当前状态：
              <span className={`binding-status-chip status-${bindingState?.status || "idle"}`}>
                {getBindingStatusLabel(bindingState?.status)}
              </span>
            </div>

            {bindingState?.status === "bound" && (
              <div className="binding-identity">
                <div>租户ID：{bindingState.tenantId || "-"}</div>
                <div>用户ID：{bindingState.userId || "-"}</div>
                <div>实例ID：{bindingState.instanceId || "-"}</div>
              </div>
            )}

            {bindingState?.message && <div className="binding-message">{bindingState.message}</div>}

            <div className="binding-actions">
              <button className="btn btn-secondary" onClick={onCopyBindingCode} disabled={!pairCodeInput.trim()}>
                复制设备码
              </button>
              <button className="btn btn-info" onClick={onOpenBindingPage}>
                打开 User-App 绑定页
              </button>
              <button className="btn btn-primary" onClick={onActivateByPairCode} disabled={bindingBusy || !pairCodeInput.trim()}>
                {bindingBusy ? "绑定中..." : "绑定设备码"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modelConfigModalOpen && (
        <div className="binding-modal-overlay" onClick={() => setModelConfigModalOpen(false)}>
          <div className="binding-modal" onClick={(event) => event.stopPropagation()}>
            <div className="binding-modal-header">
              <h3>模型配置</h3>
              <button className="binding-modal-close" onClick={() => setModelConfigModalOpen(false)}>
                ×
              </button>
            </div>

            <div className="binding-code-label">API 地址</div>
            <input
              className="binding-code-input"
              value={modelConfig.baseUrl}
              onChange={(event) => setModelConfig({ ...modelConfig, baseUrl: event.target.value })}
              placeholder="https://api.example.com/v1"
            />

            <div className="binding-code-label">默认模型</div>
            <input
              className="binding-code-input"
              value={modelConfig.defaultModel}
              onChange={(event) => setModelConfig({ ...modelConfig, defaultModel: event.target.value })}
              placeholder="claude-opus-4-6"
            />

            <div className="binding-code-label">API 密钥</div>
            <input
              type="password"
              className="binding-code-input"
              value={modelConfig.apiKey}
              onChange={(event) => setModelConfig({ ...modelConfig, apiKey: event.target.value })}
              placeholder="sk-..."
            />

            <p className="binding-tip">配置将直接保存到 Hermes 运行时，无需重启容器。</p>

            {modelConfigMessage && (
              <div className={`binding-message ${modelConfigMessage.includes("成功") ? "success" : "error"}`}>
                {modelConfigMessage}
              </div>
            )}

            <div className="binding-actions">
              <button className="btn btn-secondary" onClick={() => setModelConfigModalOpen(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={onSaveModelConfig} disabled={modelConfigBusy || !modelConfig.apiKey.trim()}>
                {modelConfigBusy ? "保存中..." : "保存配置"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tenantConfigModalOpen && (
        <div className="binding-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="binding-modal" onClick={(event) => event.stopPropagation()}>
            <div className="binding-modal-header">
              <h3>首次配置 - 输入设备码</h3>
            </div>

            <p className="binding-tip" style={{ marginBottom: "20px" }}>
              欢迎使用 Hermes Desktop！请输入您的设备码以完成配置。
            </p>

            <div className="binding-code-label">设备码</div>
            <input
              className="binding-code-input"
              value={pairCodeInput}
              onChange={(event) => setPairCodeInput(event.target.value.toUpperCase())}
              placeholder="请输入设备码"
              autoFocus
            />

            <div className="binding-code-label" style={{ marginTop: "20px" }}>工作目录（可选）</div>
            <input
              className="binding-code-input"
              value={workspaceDir}
              onChange={(event) => setWorkspaceDir(event.target.value)}
              placeholder={`默认: ${process.env.USERPROFILE || 'C:\\Users\\用户名'}\\HermesWorkspace`}
            />
            <p className="binding-tip" style={{ fontSize: "12px", marginTop: "5px" }}>
              Hermes 将在此目录中读写文件。留空使用默认目录。
            </p>

            <p className="binding-tip">
              设备码可以从您的管理平台获取。配置完成后，系统将自动连接到对应的租户环境。
            </p>

            {tenantConfigMessage && (
              <div className={`binding-message ${tenantConfigMessage.includes("成功") || tenantConfigMessage.includes("完成") ? "success" : "error"}`}>
                {tenantConfigMessage}
              </div>
            )}

            <div className="binding-actions">
              <button 
                className="btn btn-primary" 
                onClick={onConfigureFromPairCode} 
                disabled={tenantConfigBusy || !pairCodeInput.trim()}
                style={{ width: "100%" }}
              >
                {tenantConfigBusy ? "配置中..." : "开始配置"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 卡片外的圆形图标按钮 */}
      <div className="floating-actions">
        <button
          className="btn-circle"
          onClick={onRepair}
          disabled={busy}
          title="重新部署"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
        <button
          className="btn-circle"
          onClick={() => window.open("http://localhost:9119", "_blank")}
          disabled={busy || bootstrapState.phase !== "ready"}
          title="配置面板"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        {bootstrapState.phase === "ready" && (
          <button
            className="btn-circle"
            onClick={() => setModelConfigModalOpen(true)}
            title="模型配置"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        )}
      </div>

      {/* 页脚 */}
      <div className="footer">
        <span className="footer-version">v0.1.1</span>
      </div>
    </div>
  );
}
