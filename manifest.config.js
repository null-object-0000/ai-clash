import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'
import { PROVIDERS, deriveProviderConfig } from './src/background/providers.js'

// ============================================================================
// 自动生成 manifest 配置 — 新增通道只需在 providers.js 中添加
// ============================================================================

// 生成 content_scripts 配置
// 仅针对有 content script 的 provider（hasContentScript !== false）
const contentScripts = PROVIDERS
  .filter(provider => provider.hasContentScript !== false)
  .flatMap(provider => {
    const derived = deriveProviderConfig(provider);
    return [
      // 先加载 base.js 作为共享模块
      {
        js: ['src/content/shared/base.js'],
        matches: [provider.matchPattern],
        run_at: 'document_start',
      },
      // 再加载 provider 的 index.js
      {
        js: [derived.contentScriptFile],
        matches: [provider.matchPattern],
        run_at: 'document_start',
      },
    ];
  });

// 生成 host_permissions 配置
const hostPermissions = [
  ...PROVIDERS.map(p => p.matchPattern),
  // API 模式通用权限
  'https://api.deepseek.com/*',
  'https://api.longcat.chat/*',
  'https://ark.cn-beijing.volces.com/*',
  'https://coding.dashscope.aliyuncs.com/*',
  'https://ai-clash-service.snewbie.site/*',
];

// 生成 web_accessible_resources 配置
// 仅针对有 content script 的 provider
const webAccessibleResources = PROVIDERS
  .filter(provider => provider.hasContentScript !== false)
  .map(provider => {
    const derived = deriveProviderConfig(provider);
    return ({
      resources: [
        'src/content/shared/base.js',
        derived.contentScriptFile,
      ],
      matches: [provider.matchPattern],
    });
  });

// standalone.js 对所有 AI 网站可访问（仅针对有 content script 的 provider）
const webAccessibleStandalone = {
  resources: ['packages/inject/dist/standalone.js'],
  matches: PROVIDERS
    .filter(provider => provider.hasContentScript !== false)
    .map(p => p.matchPattern),
};

webAccessibleResources.push(webAccessibleStandalone);

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
