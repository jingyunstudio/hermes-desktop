<script lang="ts">
  import './app.css';
  import { onMount } from 'svelte';

  interface Config {
    model?: {
      default?: string;
      provider?: string;
      base_url?: string;
    };
  }

  interface EnvVars {
    OPENROUTER_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    GOOGLE_API_KEY?: string;
    GEMINI_API_KEY?: string;
  }

  let config: Config = {};
  let envVars: EnvVars = {};
  let selectedProvider = 'openrouter';
  let apiKey = '';
  let baseUrl = '';
  let selectedModel = '';
  let customModelId = '';
  let models: any[] = [];
  let webuiConnections: any[] = [];
  let availableModels: any[] = [];
  let currentModel = '';
  let loading = false;
  let testing = false;
  let syncing = false;
  let autoSyncEnabled = true;
  let message = '';
  let messageType: 'success' | 'error' | '' = '';

  const providers = [
    { value: 'openrouter', label: 'OpenRouter', keyName: 'OPENROUTER_API_KEY', icon: '🌐', defaultUrl: 'https://openrouter.ai/api/v1' },
    { value: 'anthropic', label: 'Anthropic Claude', keyName: 'ANTHROPIC_API_KEY', icon: '🤖', defaultUrl: 'https://api.anthropic.com/v1' },
    { value: 'openai', label: 'OpenAI', keyName: 'OPENAI_API_KEY', icon: '✨', defaultUrl: 'https://api.openai.com/v1' },
    { value: 'gemini', label: 'Google Gemini', keyName: 'GOOGLE_API_KEY', icon: '🔮', defaultUrl: 'https://generativelanguage.googleapis.com/v1' },
    { value: 'custom', label: '自定义接口', keyName: 'CUSTOM_API_KEY', icon: '🔧', defaultUrl: '' },
  ];

  onMount(async () => {
    await loadConfig();
    await loadWebuiConnections();
    await loadAutoSyncStatus();
  });

  async function loadConfig() {
    try {
      const response = await fetch('http://localhost:3005/api/config');
      const data = await response.json();
      config = data.config || {};
      envVars = data.envVars || {};

      if (config.model?.provider) {
        selectedProvider = config.model.provider;
      }
      if (config.model?.base_url) {
        baseUrl = config.model.base_url;
      }
      if (config.model?.default) {
        selectedModel = config.model.default;
        currentModel = config.model.default;
        // 如果是自定义接口，将模型 ID 填充到 customModelId
        if (selectedProvider === 'custom') {
          customModelId = config.model.default;
        }
      }

      const providerInfo = providers.find(p => p.value === selectedProvider);
      if (providerInfo && envVars[providerInfo.keyName as keyof EnvVars]) {
        apiKey = envVars[providerInfo.keyName as keyof EnvVars] || '';
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  async function loadWebuiConnections() {
    try {
      const response = await fetch('http://localhost:3005/api/webui-connections');
      const data = await response.json();
      if (data.success) {
        webuiConnections = data.connections || [];
      }
    } catch (error) {
      console.error('Failed to load WebUI connections:', error);
    }
  }

  async function loadAutoSyncStatus() {
    try {
      const response = await fetch('http://localhost:3005/api/auto-sync/status');
      const data = await response.json();
      autoSyncEnabled = data.enabled;
    } catch (error) {
      console.error('Failed to load auto-sync status:', error);
    }
  }

  async function toggleAutoSync() {
    try {
      const response = await fetch('http://localhost:3005/api/auto-sync/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !autoSyncEnabled })
      });

      const data = await response.json();
      if (data.success) {
        autoSyncEnabled = data.enabled;
        showMessage(`自动同步已${autoSyncEnabled ? '启用' : '禁用'}`, 'success');
      }
    } catch (error) {
      showMessage('切换自动同步失败', 'error');
    }
  }

  async function loadAvailableModels() {
    try {
      const response = await fetch('http://localhost:3005/api/available-models');
      const data = await response.json();
      if (data.success) {
        availableModels = data.models || [];
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
    }
  }

  async function switchModel(modelId: string) {
    loading = true;
    try {
      const response = await fetch('http://localhost:3005/api/switch-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId })
      });

      const data = await response.json();
      if (data.success) {
        currentModel = modelId;
        showMessage(`已切换到模型: ${modelId}`, 'success');
        await loadConfig();
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      showMessage('切换模型失败', 'error');
    } finally {
      loading = false;
    }
  }

  async function testConnection() {
    testing = true;
    message = '';

    try {
      const response = await fetch('http://localhost:3005/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey,
          baseUrl,
          model: selectedProvider === 'custom' ? customModelId : selectedModel
        })
      });

      const data = await response.json();

      if (data.success) {
        showMessage('连接测试成功！', 'success');
        if (selectedProvider !== 'custom') {
          await fetchModels();
        }
      } else {
        showMessage('连接测试失败：' + data.message, 'error');
      }
    } catch (error) {
      showMessage('连接测试失败', 'error');
    } finally {
      testing = false;
    }
  }

  async function fetchModels() {
    try {
      const response = await fetch(
        `http://localhost:3005/api/models?provider=${selectedProvider}&apiKey=${encodeURIComponent(apiKey)}`
      );
      const data = await response.json();
      models = data.models || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }

  async function saveConfig() {
    loading = true;
    message = '';

    try {
      const providerInfo = providers.find(p => p.value === selectedProvider);
      const updatedEnvVars = { ...envVars };

      if (providerInfo) {
        updatedEnvVars[providerInfo.keyName as keyof EnvVars] = apiKey;
      }

      // 对于自定义接口，使用手动输入的模型 ID
      const modelToSave = selectedProvider === 'custom' ? customModelId : selectedModel;

      const updatedConfig = {
        ...config,
        model: {
          ...config.model,
          default: modelToSave,
          provider: selectedProvider,
          base_url: baseUrl
        }
      };

      const response = await fetch('http://localhost:3005/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: updatedConfig,
          envVars: updatedEnvVars
        })
      });

      if (response.ok) {
        showMessage('配置保存成功！需要重启 Hermes 服务使配置生效。', 'success');
      } else {
        showMessage('配置保存失败', 'error');
      }
    } catch (error) {
      showMessage('配置保存失败', 'error');
    } finally {
      loading = false;
    }
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
    setTimeout(() => {
      message = '';
      messageType = '';
    }, 5000);
  }

  function onProviderChange() {
    const providerInfo = providers.find(p => p.value === selectedProvider);
    if (providerInfo) {
      // 设置默认 URL
      baseUrl = providerInfo.defaultUrl;
      // 尝试加载已保存的 API Key
      if (envVars[providerInfo.keyName as keyof EnvVars]) {
        apiKey = envVars[providerInfo.keyName as keyof EnvVars] || '';
      } else {
        apiKey = '';
      }
    }
    models = [];
    selectedModel = '';
  }

  async function syncFromWebUI() {
    syncing = true;
    message = '';

    try {
      const response = await fetch('http://localhost:3005/api/sync-from-webui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        showMessage(`${data.message} - 已选择模型: ${data.selectedModel}`, 'success');
        await loadConfig();
        await loadWebuiConnections();
        await loadAvailableModels();
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      showMessage('同步失败：无法连接到服务', 'error');
    } finally {
      syncing = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <!-- Header -->
  <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-5xl mx-auto px-6 py-6">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
          <span class="text-2xl">⚙️</span>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Hermes Agent 配置</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">配置 LLM Provider 和模型</p>
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-5xl mx-auto px-6 py-8">
    <!-- Alert Message -->
    {#if message}
      <div class="mb-6 p-4 rounded-xl border {messageType === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}">
        <div class="flex items-start gap-3">
          <span class="text-xl">{messageType === 'success' ? '✓' : '⚠'}</span>
          <p class="flex-1">{message}</p>
        </div>
      </div>
    {/if}

    <!-- Main Card -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div class="p-6 space-y-6">
        <!-- Sync from Open WebUI Button -->
        <div class="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
          <div class="flex items-start gap-3 mb-3">
            <span class="text-2xl">🔄</span>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="font-semibold text-gray-900 dark:text-white">从 Open WebUI 同步配置</h3>
                <button
                  on:click={toggleAutoSync}
                  class="flex items-center gap-2 px-3 py-1 text-sm rounded-lg transition-colors {autoSyncEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}"
                >
                  <span class="text-xs">{autoSyncEnabled ? '🟢 自动同步' : '⚪ 手动同步'}</span>
                </button>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                {#if autoSyncEnabled}
                  自动同步已启用，每60秒检查一次配置变化
                {:else}
                  自动同步已禁用，需要手动点击同步按钮
                {/if}
              </p>
            </div>
          </div>

          <!-- WebUI Connections List -->
          {#if webuiConnections.length > 0}
            <div class="mb-3 space-y-2">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">检测到的连接：</p>
              {#each webuiConnections as conn}
                <div class="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <span class="text-lg">{providers.find(p => p.value === conn.provider)?.icon || '🔌'}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{providers.find(p => p.value === conn.provider)?.label || conn.provider}</span>
                      {#if conn.enabled}
                        <span class="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">已启用</span>
                      {:else}
                        <span class="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">已禁用</span>
                      {/if}
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{conn.url}</p>
                    {#if conn.modelCount > 0}
                      <p class="text-xs text-gray-500 dark:text-gray-400">{conn.modelCount} 个模型</p>
                    {/if}
                  </div>
                  {#if conn.hasApiKey}
                    <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <button
            on:click={syncFromWebUI}
            disabled={syncing}
            class="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-700 dark:disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            {#if syncing}
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              同步中...
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              从 Open WebUI 同步
            {/if}
          </button>
        </div>

        <!-- Current Model Display -->
        {#if currentModel}
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-lg">🤖</span>
                <h3 class="font-semibold text-gray-900 dark:text-white">当前使用的模型</h3>
              </div>
              <button
                on:click={loadAvailableModels}
                class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                切换模型
              </button>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div class="flex-1">
                <p class="font-medium text-gray-900 dark:text-white">{currentModel}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Provider: {providers.find(p => p.value === selectedProvider)?.label || selectedProvider}
                </p>
              </div>
              <span class="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                活跃
              </span>
            </div>
          </div>
        {/if}

        <!-- Available Models List -->
        {#if availableModels.length > 0}
          <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>📋</span>
              <span>可用模型列表</span>
              <span class="text-sm font-normal text-gray-500 dark:text-gray-400">({availableModels.length} 个)</span>
            </h3>
            <div class="space-y-2 max-h-64 overflow-y-auto">
              {#each availableModels as model}
                <button
                  on:click={() => switchModel(model.id)}
                  disabled={loading || currentModel === model.id}
                  class="w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left {currentModel === model.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}"
                >
                  <span class="text-lg">{providers.find(p => p.value === model.provider)?.icon || '🔌'}</span>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-gray-900 dark:text-white truncate">{model.id}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{providers.find(p => p.value === model.provider)?.label || model.provider}</p>
                  </div>
                  {#if currentModel === model.id}
                    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Help Card -->
    <div class="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
      <h3 class="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        获取 API Key
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a href="https://openrouter.ai/keys" target="_blank" class="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline">
          <span>🌐</span>
          <span>OpenRouter</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
        <a href="https://console.anthropic.com/settings/keys" target="_blank" class="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline">
          <span>🤖</span>
          <span>Anthropic</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
        <a href="https://platform.openai.com/api-keys" target="_blank" class="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline">
          <span>✨</span>
          <span>OpenAI</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" class="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:underline">
          <span>🔮</span>
          <span>Google Gemini</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
          </svg>
        </a>
      </div>
    </div>
  </div>
</div>
