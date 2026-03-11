import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

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
    default_title: "打开 AI 对撞机"
  },
  content_scripts: [{
    js: ["src/content/deepseek/index.js"],
    matches: ["https://chat.deepseek.com/*"],
    run_at: "document_start"
  }, {
    js: ["src/content/doubao/index.js"],
    matches: ["https://www.doubao.com/*"],
    run_at: "document_start"
  }, {
    js: ["src/content/qianwen/index.js"],
    matches: ["https://tongyi.aliyun.com/*", "https://www.qianwen.com/*"],
    run_at: "document_start"
  }, {
    js: ["src/content/longcat/index.js"],
    matches: ["https://longcat.chat/*"],
    run_at: "document_start"
  }, {
    js: ["src/content/yuanbao/index.js"],
    matches: ["https://yuanbao.tencent.com/*"],
    run_at: "document_start"
  }],
  permissions: [
    "sidePanel",
    "tabs",
    "scripting",
    "storage",
    "alarms"
  ],
  host_permissions: [
    "https://chat.deepseek.com/*",
    "https://www.doubao.com/*",
    "https://www.qianwen.com/*",
    "https://longcat.chat/*",
    "https://yuanbao.tencent.com/*",
    // API模式权限
    "https://api.deepseek.com/*",
    "https://api.longcat.chat/*",
    "https://ark.cn-beijing.volces.com/*",
    "https://coding.dashscope.aliyuncs.com/*"
  ],
  background: {
    service_worker: "src/background/index.js",
    type: "module"
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  web_accessible_resources: [
    {
      resources: [
        "src/content/deepseek/hook.js",
        "src/content/deepseek/index.js"
      ],
      matches: [
        "https://chat.deepseek.com/*"
      ]
    },
    {
      resources: [
        "src/content/doubao/hook.js",
        "src/content/doubao/index.js"
      ],
      matches: [
        "https://www.doubao.com/*"
      ]
    },
    {
      resources: [
        "src/content/qianwen/hook.js",
        "src/content/qianwen/index.js"
      ],
      matches: [
        "https://www.qianwen.com/*"
      ]
    },
    {
      resources: [
        "src/content/longcat/hook.js",
        "src/content/longcat/index.js"
      ],
      matches: [
        "https://longcat.chat/*"
      ]
    },
    {
      resources: [
        "src/content/yuanbao/hook.js",
        "src/content/yuanbao/index.js"
      ],
      matches: [
        "https://yuanbao.tencent.com/*"
      ]
    }
  ],
})

