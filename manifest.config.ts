import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_title: "打开 Any AI Bridge"
  },
  content_scripts: [{
    js: ["src/content/deepseek/index.ts"],
    matches: ["https://chat.deepseek.com/*"],
    run_at: "document_start"
  }, {
    js: ["src/content/doubao/index.ts"],
    matches: ["https://www.doubao.com/*"],
    run_at: "document_start"
  }],
  permissions: [
    "sidePanel",
    "tabs",
    "scripting",
    "storage"
  ],
  host_permissions: [
    "https://chat.deepseek.com/*",
    "https://www.doubao.com/*"
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  web_accessible_resources: [
    {
      resources: [
        "src/content/deepseek/hook.js"
      ],
      matches: [
        "https://chat.deepseek.com/*"
      ]
    },
    {
      resources: [
        "src/content/doubao/hook.js"
      ],
      matches: [
        "https://www.doubao.com/*"
      ]
    }
  ],
})

