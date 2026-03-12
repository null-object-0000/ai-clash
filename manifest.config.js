import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'
import { PROVIDERS, deriveProviderConfig } from './src/background/providers.js'

// ============================================================================
// 自动生成 manifest 配置 — 新增通道只需在 providers.js 中添加
// ============================================================================

// 生成 content_scripts 配置
const contentScripts = PROVIDERS.map(provider => {
  const derived = deriveProviderConfig(provider);
  return ({
    id: provider.id,
    js: [derived.contentScriptFile],
    matches: [provider.matchPattern],
    run_at: 'document_start',
  });
});

// 生成 host_permissions 配置
const hostPermissions = [
  ...PROVIDERS.map(p => p.matchPattern),
  // API 模式通用权限
  'https://api.deepseek.com/*',
  'https://api.longcat.chat/*',
  'https://ark.cn-beijing.volces.com/*',
  'https://coding.dashscope.aliyuncs.com/*',
];

// 生成 web_accessible_resources 配置
const webAccessibleResources = PROVIDERS.map(provider => {
  const derived = deriveProviderConfig(provider);
  return ({
    resources: [
      derived.hookFile,
      derived.contentScriptFile,
    ],
    matches: [provider.matchPattern],
  });
});

export default defineManifest({
  manifest_version: 3,
  name: 'AI 对撞机',
  version: pkg.version,
  description: pkg.description,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_title: '打开 AI 对撞机',
  },
  content_scripts: contentScripts,
  permissions: [
    'sidePanel',
    'tabs',
    'scripting',
    'storage',
    'alarms',
  ],
  host_permissions: hostPermissions,
  background: {
    service_worker: 'src/background/index.js',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  web_accessible_resources: webAccessibleResources,
});
