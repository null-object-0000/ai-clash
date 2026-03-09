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
    js: ["src/content/deepseek.ts"],
    matches: ["https://chat.deepseek.com/*"
    ],
    run_at: "document_start"
  }],
  permissions: [
    "sidePanel",
    "tabs",
    "scripting"
  ],
  host_permissions: [
    "https://chat.deepseek.com/*"
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
        "src/content/hook.js"
      ],
      matches: [
        "https://chat.deepseek.com/*"
      ]
    }
  ],
})

