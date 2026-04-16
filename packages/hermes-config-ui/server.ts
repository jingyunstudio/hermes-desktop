import express from 'express';
import cors from 'cors';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { execSync } from 'child_process';

const app = express();
const PORT = 3005;

app.use(cors());
app.use(express.json());
app.use(express.static('dist/public'));

// 自动同步配置
let lastSyncHash = '';
const AUTO_SYNC_INTERVAL = 60000; // 60秒检查一次
let autoSyncEnabled = true; // 可通过 API 控制

// Hermes 配置文件路径
const HERMES_CONFIG_DIR = process.env.HERMES_CONFIG_DIR || '/root/.hermes';
const CONFIG_FILE = path.join(HERMES_CONFIG_DIR, 'config.yaml');
const ENV_FILE = path.join(HERMES_CONFIG_DIR, '.env');

// 是否在容器内运行
const IN_CONTAINER = fs.existsSync('/.dockerenv');
const HERMES_CONTAINER = process.env.HERMES_CONTAINER || 'hermes-desktop-runtime';

// Open WebUI 数据库路径
const OPENWEBUI_DB = process.env.OPENWEBUI_DB || '/app/backend/data/webui.db';
const USE_DOCKER_EXEC = process.env.USE_DOCKER_EXEC === 'true' || !fs.existsSync(OPENWEBUI_DB);
const WEBUI_CONTAINER = process.env.WEBUI_CONTAINER || 'hermes-desktop-webui';

// 写入配置文件（支持容器和宿主机）
function writeConfigFile(filePath: string, content: string): void {
  if (IN_CONTAINER) {
    // 在容器内直接写入
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    // 在宿主机上，通过 Docker 命令写入到容器
    try {
      const containerPath = filePath;
      const tempFile = path.join(process.cwd(), '.temp-config');
      fs.writeFileSync(tempFile, content, 'utf8');

      execSync(`docker cp "${tempFile}" ${HERMES_CONTAINER}:${containerPath}`);
      fs.unlinkSync(tempFile);

      console.log(`配置已写入容器: ${containerPath}`);
    } catch (error) {
      console.error('写入配置到容器失败:', error);
      throw error;
    }
  }
}

// 读取配置文件（支持容器和宿主机）
function readConfigFile(filePath: string): string {
  if (IN_CONTAINER) {
    // 在容器内直接读取
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return '';
  } else {
    // 在宿主机上，通过 Docker 命令从容器读取
    try {
      const result = execSync(`docker exec ${HERMES_CONTAINER} cat ${filePath}`, { encoding: 'utf8' });
      return result;
    } catch (error) {
      console.log(`配置文件不存在: ${filePath}`);
      return '';
    }
  }
}
if (!fs.existsSync(HERMES_CONFIG_DIR)) {
  fs.mkdirSync(HERMES_CONFIG_DIR, { recursive: true });
}

// 从 Open WebUI 数据库读取连接配置
async function getOpenWebUIConnections(): Promise<any[]> {
  // 如果数据库文件不存在，尝试通过 Docker 访问
  if (USE_DOCKER_EXEC) {
    try {
      console.log('通过 Docker 容器访问 Open WebUI 数据库...');
      const result = execSync(
        `docker exec ${WEBUI_CONTAINER} python3 -c "import sqlite3, json; conn = sqlite3.connect('/app/backend/data/webui.db'); cursor = conn.cursor(); cursor.execute('SELECT data FROM config LIMIT 1'); row = cursor.fetchone(); print(json.dumps(json.loads(row[0]) if row else {}))"`,
        { encoding: 'utf8' }
      );

      const config = JSON.parse(result.trim());
      const connections = parseOpenWebUIConfig(config);
      return connections;
    } catch (error) {
      console.error('通过 Docker 访问数据库失败:', error);
      return [];
    }
  }

  // 直接访问数据库文件
  try {
    const db = new Database(OPENWEBUI_DB, { readonly: true });

    // 查询配置表中的完整配置
    const row = db.prepare('SELECT data FROM config LIMIT 1').get() as { data: string } | undefined;

    if (row && row.data) {
      const config = JSON.parse(row.data);
      const connections = parseOpenWebUIConfig(config);
      db.close();
      return connections;
    } else {
      db.close();
      return [];
    }
  } catch (e) {
    console.error('Error accessing database:', e);
    return [];
  }
}

// 解析 Open WebUI 配置
function parseOpenWebUIConfig(config: any): any[] {
  const connections: any[] = [];

  try {
    const openaiConfig = config.openai || {};
    const baseUrls = openaiConfig.api_base_urls || [];
    const apiKeys = openaiConfig.api_keys || [];
    const apiConfigs = openaiConfig.api_configs || {};

    // 组合 URL、Key 和详细配置
    baseUrls.forEach((url: string, index: number) => {
      // 跳过 Hermes 自己的连接
      if (url && url !== 'http://hermes-runtime:8642/v1') {
        const detailedConfig = apiConfigs[index.toString()] || {};
        const provider = detectProvider(url);

        connections.push({
          index,
          url,
          apiKey: apiKeys[index] || '',
          provider,
          enabled: detailedConfig.enable !== false,
          modelIds: detailedConfig.model_ids || [],
          connectionType: detailedConfig.connection_type || 'external',
          authType: detailedConfig.auth_type || 'bearer'
        });
      }
    });
  } catch (e) {
    console.error('Error parsing OpenWebUI config:', e);
  }

  return connections;
}

// 检测 Provider 类型
function detectProvider(url: string): string {
  if (url.includes('openrouter')) return 'openrouter';
  if (url.includes('anthropic')) return 'anthropic';
  if (url.includes('openai.com')) return 'openai';
  if (url.includes('generativelanguage.googleapis.com')) return 'gemini';
  // 对于其他 URL，尝试从模型 ID 推断
  return 'openrouter'; // 默认使用 openrouter，因为它支持多种模型
}

// 智能选择默认模型
function selectBestModel(connections: any[]): { connection: any; model: string } | null {
  const enabledConnections = connections.filter(c => c.enabled && c.modelIds.length > 0);

  if (enabledConnections.length === 0) {
    return null;
  }

  // 模型优先级评分
  const scoreModel = (modelId: string): number => {
    const id = modelId.toLowerCase();

    // Claude 系列 - 最高优先级
    if (id.includes('claude-opus')) return 1000;
    if (id.includes('claude-sonnet')) return 900;
    if (id.includes('claude')) return 800;

    // GPT-4 系列
    if (id.includes('gpt-4o')) return 700;
    if (id.includes('gpt-4-turbo')) return 650;
    if (id.includes('gpt-4')) return 600;

    // Gemini 系列
    if (id.includes('gemini-2.0')) return 500;
    if (id.includes('gemini-1.5-pro')) return 450;
    if (id.includes('gemini')) return 400;

    // GPT-3.5 系列
    if (id.includes('gpt-3.5')) return 300;

    // 其他模型
    return 100;
  };

  // 找出所有模型及其评分
  const allModels: Array<{ connection: any; model: string; score: number }> = [];

  for (const conn of enabledConnections) {
    for (const modelId of conn.modelIds) {
      allModels.push({
        connection: conn,
        model: modelId,
        score: scoreModel(modelId)
      });
    }
  }

  // 按评分排序，选择最高分的
  allModels.sort((a, b) => b.score - a.score);

  if (allModels.length > 0) {
    const best = allModels[0];
    return {
      connection: best.connection,
      model: best.model
    };
  }

  return null;
}
function getConfigHash(connections: any[]): string {
  const configStr = JSON.stringify(connections.map(c => ({
    url: c.url,
    provider: c.provider,
    enabled: c.enabled,
    modelIds: c.modelIds
  })));
  return crypto.createHash('md5').update(configStr).digest('hex');
}

// 执行同步操作（核心逻辑）
async function performSync(options?: { preserveModel?: boolean }): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const connections = await getOpenWebUIConnections();

    if (connections.length === 0) {
      return {
        success: false,
        message: '未找到 Open WebUI 连接配置'
      };
    }

    // 过滤出启用的连接
    const enabledConnections = connections.filter(c => c.enabled);

    if (enabledConnections.length === 0) {
      return {
        success: false,
        message: '所有连接都已禁用'
      };
    }

    // 读取现有配置
    let config: any = {};
    let existingModel = '';
    const configContent = readConfigFile(CONFIG_FILE);
    if (configContent) {
      config = yaml.load(configContent) || {};
      existingModel = config.model?.default || '';
    }

    // 智能选择模型
    const bestChoice = selectBestModel(connections);

    if (!bestChoice) {
      return {
        success: false,
        message: '未找到可用的模型'
      };
    }

    const primaryConnection = bestChoice.connection;
    let defaultModel = bestChoice.model;

    // 如果设置了保留现有模型，且现有模型在新连接的模型列表中，则保留
    if (options?.preserveModel && existingModel) {
      const allAvailableModels = enabledConnections.flatMap(c => c.modelIds);
      if (allAvailableModels.includes(existingModel)) {
        defaultModel = existingModel;
        console.log(`保留现有模型: ${existingModel}`);
      } else {
        console.log(`现有模型 ${existingModel} 不可用，切换到: ${defaultModel}`);
      }
    }

    // 更新 Hermes 配置
    config.model = {
      ...config.model,
      provider: primaryConnection.provider,
      base_url: primaryConnection.url,
      default: defaultModel
    };

    // 保存配置
    const yamlContent = yaml.dump(config);
    writeConfigFile(CONFIG_FILE, yamlContent);

    // 更新环境变量
    let envVars: any = {};
    const existingEnvContent = readConfigFile(ENV_FILE);
    if (existingEnvContent) {
      existingEnvContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          envVars[match[1]] = match[2];
        }
      });
    }

    // 根据 provider 设置对应的 API Key
    const keyMap: Record<string, string> = {
      'openrouter': 'OPENROUTER_API_KEY',
      'anthropic': 'ANTHROPIC_API_KEY',
      'openai': 'OPENAI_API_KEY',
      'gemini': 'GOOGLE_API_KEY'
    };

    const envKey = keyMap[primaryConnection.provider] || 'OPENROUTER_API_KEY';
    if (primaryConnection.apiKey) {
      envVars[envKey] = primaryConnection.apiKey;
    }

    // 添加 Hermes 必需的环境变量
    envVars['GATEWAY_ALLOW_ALL_USERS'] = 'true';
    envVars['HERMES_INFERENCE_PROVIDER'] = primaryConnection.provider;
    envVars['HERMES_INFERENCE_MODEL'] = defaultModel;

    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    writeConfigFile(ENV_FILE, envContent);

    // 收集所有可用模型
    const allModels = enabledConnections.flatMap(c =>
      c.modelIds.map((m: string) => ({
        id: m,
        provider: c.provider
      }))
    );

    // 在容器内运行时，自动重启 Hermes 容器
    if (IN_CONTAINER) {
      try {
        console.log('重启 Hermes 容器以应用新配置...');
        execSync(`docker restart ${HERMES_CONTAINER}`);
        console.log('Hermes 容器已重启');
      } catch (error) {
        console.error('重启 Hermes 容器失败:', error);
      }
    }

    return {
      success: true,
      message: `已同步 ${enabledConnections.length} 个连接配置到 Hermes${IN_CONTAINER ? '，Hermes 服务已自动重启' : '，请重启 Hermes 服务使配置生效'}`,
      data: {
        selectedModel: defaultModel,
        primaryConnection: {
          provider: primaryConnection.provider,
          url: primaryConnection.url
        },
        allConnections: enabledConnections.map(c => ({
          provider: c.provider,
          url: c.url,
          models: c.modelIds.length
        })),
        availableModels: allModels
      }
    };
  } catch (error) {
    console.error('Error syncing config:', error);
    return {
      success: false,
      message: `同步配置失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// 自动同步检查
async function autoSyncCheck() {
  if (!autoSyncEnabled) return;

  try {
    const connections = await getOpenWebUIConnections();
    const currentHash = getConfigHash(connections);

    if (currentHash !== lastSyncHash && lastSyncHash !== '') {
      console.log('检测到 Open WebUI 配置变化，自动同步中...');
      // 自动同步时保留现有模型选择
      const result = await performSync({ preserveModel: true });
      if (result.success) {
        console.log('自动同步成功:', result.message);
      } else {
        console.log('自动同步失败:', result.message);
      }
    }

    lastSyncHash = currentHash;
  } catch (error) {
    console.error('自动同步检查失败:', error);
  }
}

// 启动自动同步定时器
setInterval(autoSyncCheck, AUTO_SYNC_INTERVAL);

// 获取 Open WebUI 连接列表
app.get('/api/webui-connections', async (_req, res) => {
  try {
    const connections = await getOpenWebUIConnections();
    res.json({
      success: true,
      connections: connections.map(c => ({
        provider: c.provider,
        url: c.url,
        enabled: c.enabled,
        modelCount: c.modelIds.length,
        models: c.modelIds,
        hasApiKey: !!c.apiKey
      }))
    });
  } catch (error) {
    console.error('Error fetching WebUI connections:', error);
    res.status(500).json({
      success: false,
      message: '获取连接列表失败'
    });
  }
});

// 同步 Open WebUI 配置到 Hermes（手动触发）
app.post('/api/sync-from-webui', async (_req, res) => {
  // 手动同步时不保留现有模型，使用智能选择
  const result = await performSync({ preserveModel: false });

  if (result.success) {
    // 更新哈希值，避免自动同步重复执行
    const connections = await getOpenWebUIConnections();
    lastSyncHash = getConfigHash(connections);

    res.json({
      success: true,
      message: result.message,
      ...result.data
    });
  } else {
    res.status(500).json({
      success: false,
      message: result.message
    });
  }
});

// 获取所有可用模型
app.get('/api/available-models', async (_req, res) => {
  try {
    const connections = await getOpenWebUIConnections();
    const enabledConnections = connections.filter(c => c.enabled);

    const models = enabledConnections.flatMap(c =>
      c.modelIds.map((modelId: string) => ({
        id: modelId,
        provider: c.provider,
        providerUrl: c.url
      }))
    );

    res.json({
      success: true,
      models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取模型列表失败'
    });
  }
});

// 切换 Hermes 使用的模型
app.post('/api/switch-model', async (req, res) => {
  try {
    const { modelId } = req.body;

    if (!modelId) {
      return res.status(400).json({
        success: false,
        message: '缺少 modelId 参数'
      });
    }

    // 查找该模型所属的连接
    const connections = await getOpenWebUIConnections();
    const enabledConnections = connections.filter(c => c.enabled);

    let targetConnection = null;
    for (const conn of enabledConnections) {
      if (conn.modelIds.includes(modelId)) {
        targetConnection = conn;
        break;
      }
    }

    if (!targetConnection) {
      return res.status(404).json({
        success: false,
        message: '未找到该模型对应的连接'
      });
    }

    // 更新配置
    let config: any = {};
    const configContent = readConfigFile(CONFIG_FILE);
    if (configContent) {
      config = yaml.load(configContent) || {};
    }

    config.model = {
      ...config.model,
      provider: targetConnection.provider,
      base_url: targetConnection.url,
      default: modelId
    };

    const yamlContent = yaml.dump(config);
    writeConfigFile(CONFIG_FILE, yamlContent);

    // 更新环境变量
    let envVars: any = {};
    if (fs.existsSync(ENV_FILE)) {
      const envContent = fs.readFileSync(ENV_FILE, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          envVars[match[1]] = match[2];
        }
      });
    }

    const keyMap: Record<string, string> = {
      'openrouter': 'OPENROUTER_API_KEY',
      'anthropic': 'ANTHROPIC_API_KEY',
      'openai': 'OPENAI_API_KEY',
      'gemini': 'GOOGLE_API_KEY',
      'custom': 'CUSTOM_API_KEY'
    };

    const envKey = keyMap[targetConnection.provider];
    if (envKey && targetConnection.apiKey) {
      envVars[envKey] = targetConnection.apiKey;
    }

    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    writeConfigFile(ENV_FILE, envContent);

    res.json({
      success: true,
      message: `已切换到模型: ${modelId}`,
      model: {
        id: modelId,
        provider: targetConnection.provider,
        url: targetConnection.url
      }
    });
  } catch (error) {
    console.error('Error switching model:', error);
    res.status(500).json({
      success: false,
      message: '切换模型失败'
    });
  }
});

// 获取配置
app.get('/api/config', (req, res) => {
  try {
    let config = {};
    const configContent = readConfigFile(CONFIG_FILE);
    if (configContent) {
      config = yaml.load(configContent) || {};
    }

    let envVars = {};
    const envFileContent = readConfigFile(ENV_FILE);
    if (envFileContent) {
      envFileContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          envVars[match[1]] = match[2];
        }
      });
    }

    res.json({ config, envVars });
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ error: 'Failed to read configuration' });
  }
});

// 保存配置
app.post('/api/config', (req, res) => {
  try {
    const { config, envVars } = req.body;

    if (config) {
      const yamlContent = yaml.dump(config);
      writeConfigFile(CONFIG_FILE, yamlContent);
    }

    if (envVars) {
      const envContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      writeConfigFile(ENV_FILE, envContent);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// 测试连接（简化版，不实际调用 API）
app.post('/api/test-connection', async (req, res) => {
  try {
    const { provider, apiKey, baseUrl } = req.body;

    if (!apiKey) {
      return res.json({
        success: false,
        message: '请输入 API Key'
      });
    }

    if (!baseUrl) {
      return res.json({
        success: false,
        message: '请输入 API Base URL'
      });
    }

    // 简单验证，实际项目中应该调用 API 测试
    res.json({
      success: true,
      message: '配置验证通过'
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({
      success: false,
      message: '测试连接失败'
    });
  }
});

// 获取模型列表（简化版）
app.get('/api/models', async (req, res) => {
  try {
    const { provider } = req.query;

    // 返回一些常见模型作为示例
    const modelsByProvider: Record<string, any[]> = {
      'openrouter': [
        { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4' },
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
      ],
      'anthropic': [
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' }
      ],
      'openai': [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
      ],
      'gemini': [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
      ]
    };

    const models = modelsByProvider[provider as string] || [];

    res.json({
      success: true,
      models
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      success: false,
      message: '获取模型列表失败'
    });
  }
});

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// 获取自动同步状态
app.get('/api/auto-sync/status', (_req, res) => {
  res.json({
    enabled: autoSyncEnabled,
    interval: AUTO_SYNC_INTERVAL,
    lastSyncHash: lastSyncHash ? 'configured' : 'not-synced'
  });
});

// 控制自动同步开关
app.post('/api/auto-sync/toggle', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled === 'boolean') {
    autoSyncEnabled = enabled;
    console.log(`自动同步已${enabled ? '启用' : '禁用'}`);
    res.json({
      success: true,
      enabled: autoSyncEnabled
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Invalid parameter'
    });
  }
});

app.listen(PORT, async () => {
  console.log(`Hermes Config UI running on port ${PORT}`);
  console.log(`自动同步: ${autoSyncEnabled ? '已启用' : '已禁用'} (间隔: ${AUTO_SYNC_INTERVAL / 1000}秒)`);

  // 启动时执行一次同步
  console.log('执行启动时同步...');
  const result = await performSync();
  if (result.success) {
    console.log('启动同步成功:', result.message);
    const connections = await getOpenWebUIConnections();
    lastSyncHash = getConfigHash(connections);
  } else {
    console.log('启动同步失败:', result.message);
  }
});
