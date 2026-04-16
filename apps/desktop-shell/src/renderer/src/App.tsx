import { useEffect, useMemo, useState, useRef } from "react";
import { AppSettings, BootstrapStage, BootstrapState } from "@hermes-desktop/shared-types";
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

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      window.desktopApi.getSettings(),
      window.desktopApi.getBootstrapState(),
    ]).then(([cfg, state]) => {
      setSettings(cfg);
      setBootstrapState(state);
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
        </div>
      </div>

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
      </div>

      {/* 页脚 */}
      <div className="footer">
        <span className="footer-version">v0.1.1</span>
      </div>
    </div>
  );
}
