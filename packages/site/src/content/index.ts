import { downloadsZh, homePageZh, privacyPageZh } from './source'

export type Locale = 'zh' | 'en'

export const navItems = {
  zh: [
    { label: '首页', href: '/' },
    { label: '安装指南', href: '/download' },
    { label: '更新日志', href: '/changelog' },
    { label: '隐私政策', href: '/privacy' },
  ],
  en: [
    { label: 'Home', href: '/en/' },
    { label: 'Install Guide', href: '/en/download' },
    { label: 'Changelog', href: '/en/changelog' },
    { label: 'Privacy Policy', href: '/en/privacy' },
  ],
} satisfies Record<Locale, Array<{ label: string; href: string }>>

export const homePages = {
  zh: homePageZh,
  en: {
    name: 'AI Clash',
    text: 'Ultimate LLM Arena',
    tagline:
      'Say goodbye to switching tabs! Summon multiple top AI models side-by-side with a single click, and get the ultimate answer with our built-in summary engine.',
    logoAlt: 'AI Clash Logo',
    demoAlt: 'AI Clash Demo Animation',
    actions: [
      {
        kind: 'brand chrome',
        label: 'Chrome Web Store',
        href: 'https://chromewebstore.google.com/detail/ggngmgpjdklmkpoldbfahmeefpnfhhai',
      },
      {
        kind: 'brand edge',
        label: 'Edge Add-ons',
        href: 'https://microsoftedge.microsoft.com/addons/detail/khjmihaeihajagobgbdhlbjeobdpmfkm',
      },
      { kind: 'alt', label: 'Download Offline ZIP', href: '/en/download' },
    ],
    features: [
      {
        title: '⚡️ One Prompt, Multiple Brains',
        details:
          'Say goodbye to switching tabs! Summon multiple top AI models side-by-side with a single click, and get the ultimate answer with our built-in summary engine.',
      },
      {
        title: '⚖️ Built-in AI Judge',
        details:
          'Automatically compares answers from all providers, collapses redundant analysis, points out core differences, and provides the optimal final suggestion.',
      },
      {
        title: '💸 Zero API Cost',
        details:
          'Utilizes pure frontend DOM manipulation to directly tap into the native computing power of the web versions (DeepSeek, Kimi, etc.) you are already logged into.',
      },
    ],
  },
}

export const downloads = {
  zh: downloadsZh,
  en: {
    title: '📥 Download & Installation',
    storeTitle: 'Method 1: Store Installation (Recommended)',
    storeIntro: 'If you can access the stores, it is highly recommended to install through them to get automatic updates.',
    chrome: 'Chrome Web Store',
    edge: 'Edge Add-ons',
    offlineTitle: 'Method 2: Offline ZIP Installation (Developer Mode)',
    offlineIntro: 'If you cannot access the stores, download the offline package directly from this site and install it in 3 steps.',
    stepDownload: '1. Download the Latest ZIP',
    releaseHref: '/downloads/ai-clash-v1.2.2.zip',
    releaseLink: '👉 Directly Download AI Clash v1.2.2 Offline Package',
    releaseNote: '(Downloads ai-clash-v1.2.2.zip; developer-mode installs do not update automatically, so prefer the Chrome/Edge stores when available)',
    stepUnzip: '2. Unzip Files',
    unzip: 'Extract the downloaded ZIP file to a folder on your computer (please do not delete this folder later).',
    stepLoad: '3. Load in Browser',
    steps: [
      "Open your browser's extensions management page: Chrome users type chrome://extensions/; Edge users type edge://extensions/.",
      'Turn on the "Developer mode" switch in the top right corner.',
      'Click "Load unpacked" in the top left, and select the folder you just extracted! 🎉',
    ],
  },
} satisfies Record<Locale, Record<string, string | string[]>>

export const changelogs = {
  zh: [
    {
      version: '[1.2.2] - 2026-06-08',
      groups: [
        {
          title: '✨ 新增特性 (Features)',
          items: [
            '<strong>公开分享页</strong>：侧边栏生成分享链接后，可以在官网打开只读分享页，展示问题、各通道回答和归纳总结。',
            '<strong>语言基础支持</strong>：新增英文扩展文案，并为内置总结提示词提供简中、英文版本。',
          ],
        },
        {
          title: '🛠️ 优化与修复 (Fixes & Improvements)',
          items: [
            '<strong>隐私与设置更新</strong>：补充公开分享和匿名统计说明，并在全局设置中新增「匿名数据统计」开关。',
          ],
        },
      ],
    },
    {
      version: '[1.2.0] - 待发布',
      groups: [
        {
          title: '🎉 重磅更新 (Major)',
          items: [
            '<strong>接入新通道 - Xiaomi MIMO</strong>：小米新一代大模型正式加入对撞阵列！全面适配 Xiaomi MIMO 网页版的原生算力，国内大模型生态再添强劲选手。',
            '<strong>单轮对话中途动态添加新 AI 通道</strong>：在单轮对话过程中，用户可随时添加另一个 AI 通道，无缝切换不同模型的视角，开启多维度的 AI 斗兽体验。',
          ],
        },
        { title: '✨ 新增特性 (Features)', items: [] },
        {
          title: '🛠️ 优化与修复 (Fixes & Improvements)',
          items: [
            '<strong>通道列表体验优化</strong>：支持全选/反选，按国内/海外分组展示，高度自适应侧边栏空间。',
            '<strong>移除元宝智能搜索手动切换</strong>：腾讯元宝官网已升级支持提问时智能联网，移除手动切换代码，简化使用流程。',
          ],
        },
      ],
    },
    {
      version: '[1.1.0] - 2026-04-17',
      groups: [
        {
          title: '🎉 重磅更新 (Major)',
          items: [
            '<strong>接入新通道 - 文心一言</strong>：百度大模型正式加入对撞阵列！全面适配文心一言网页版的原生算力，国内一线大厂模型版图进一步补齐。',
            '<strong>「焦点跟随」导播模式</strong>：突破浏览器对后台非激活标签页的性能降频限制。后台自动探测并唤醒正在输出的 AI 网页，确保满血多路并发，提供无缝沉浸的观感体验。',
          ],
        },
        {
          title: '✨ 新增特性 (Features)',
          items: [
            '<strong>自定义归纳总结</strong>：支持在全局设置中自定义「AI 裁判」的系统提示词（System Prompt），随心所欲定制你的专属裁判风格。',
            '<strong>重构归纳交互</strong>：支持手动按需触发「归纳总结」，并提供「重新生成」功能，将总结的控制权交还给用户。',
            '<strong>官网与分发中心</strong>：上线专属官网，提供完整的历史版本查看与离线 ZIP 包开发者模式安装指引。',
          ],
        },
        {
          title: '🛠️ 优化与修复 (Fixes & Improvements)',
          items: [
            '<strong>追问拦截防护</strong>：新增多通道模式下的「防误触追问拦截弹窗」，防止手滑导致未完成的回答意外清空。',
          ],
        },
      ],
    },
    {
      version: '[1.0.0] - 2026-04-15',
      groups: [
        {
          title: '🎉 创世版正式上线 (MVP Release)',
          items: [
            '<strong>首创同屏并发对撞</strong>：推出独立的侧边栏工作台，一键提问，多网页同时唤醒狂飙，体验极致的 AI 斗兽快感。',
            '<strong>零 API 成本架构</strong>：采用突破性的纯前端网页 DOM Hook 技术，直接劫持并复用网页端原生算力。',
            '<strong>首发四大通道</strong>：原生接入国内顶级大模型阵列，完美适配 DeepSeek、豆包、通义千问、腾讯元宝。',
          ],
        },
        {
          title: '✨ 核心特性 (Features)',
          items: [
            '<strong>内置 AI 裁判引擎</strong>：各通道回答完毕后，自动触发全局「归纳总结」，瞬间提炼核心共识与分歧。',
            '<strong>原生模式完美映射</strong>：无缝同步各平台的进阶开关，全面支持「深度思考模式 (如 DeepSeek R1)」与「联网搜索」的实时状态抓取。',
          ],
        },
      ],
    },
  ],
  en: [
    {
      version: '[1.2.2] - 2026-06-08',
      groups: [
        {
          title: '✨ Features',
          items: [
            '<strong>Public Share Pages</strong>: Shared links now open a read-only site page with the question, model answers, and summary.',
            '<strong>Language Foundation</strong>: Added English extension copy, plus Simplified Chinese and English built-in summary prompts.',
          ],
        },
        {
          title: '🛠️ Fixes & Improvements',
          items: [
            '<strong>Privacy & Settings Update</strong>: Clarified public sharing and anonymous analytics, and added an anonymous analytics toggle in global settings.',
          ],
        },
      ],
    },
    {
      version: '[1.1.0] - 2026-04-17',
      groups: [
        {
          title: '🎉 Major',
          items: [
            "<strong>New Channel — Wenxin Yiyan</strong>: Baidu's flagship LLM officially joins the arena! Fully adapted to the native computing power of the Wenxin Yiyan web interface, completing the lineup of China's top-tier foundation models.",
            '<strong>"Focus Follow" Director Mode</strong>: Breaks through browser performance throttling on inactive background tabs. Background detection automatically awakens updating AI webpages to ensure full-speed concurrency, delivering a seamless and immersive viewing experience.',
          ],
        },
        {
          title: '✨ Features',
          items: [
            '<strong>Customizable AI Judge</strong>: Support for customizing the "AI Judge" System Prompt in global settings, allowing you to tailor the summarization style to your exact needs.',
            '<strong>Revamped Summary Interaction</strong>: Support for triggering the "Generate Summary" on-demand, along with a "Regenerate" feature, returning full control to the user.',
            '<strong>Official Website</strong>: Launched a dedicated official website offering a complete version history and offline ZIP package developer mode installation guide.',
          ],
        },
        {
          title: '🛠️ Fixes & Improvements',
          items: [
            '<strong>Follow-up Question Interception</strong>: New anti-accidental-trigger confirmation modal in multi-channel mode to prevent unintended clearing of in-progress responses.',
          ],
        },
      ],
    },
    {
      version: '[1.0.0] - 2026-04-15',
      groups: [
        {
          title: '🎉 MVP Release',
          items: [
            '<strong>Pioneering Concurrent UI</strong>: Launched an independent sidebar workspace. One prompt awakens multiple AI webpages simultaneously for the ultimate LLM arena experience.',
            '<strong>Zero API Cost Architecture</strong>: Utilizes breakthrough pure frontend DOM Hook injection to directly hijack and reuse the native computing power of logged-in AI web platforms.',
            '<strong>Four Initial Top Models</strong>: Natively integrated with top-tier foundation models, perfectly adapting to DeepSeek, Doubao, Qwen, and Tencent Yuanbao.',
          ],
        },
        {
          title: '✨ Core Features',
          items: [
            '<strong>Built-in AI Judge</strong>: After all AI channels finish answering, automatically triggers a global summary to instantly distill core consensus and differences.',
            '<strong>Native Mode Mapping</strong>: Seamlessly syncs advanced toggles from each platform, fully supporting real-time status capture for "Deep Think (e.g., DeepSeek R1)" and "Web Search".',
          ],
        },
      ],
    },
  ],
}

export const privacyPages = {
  zh: privacyPageZh,
  en: {
    title: 'Privacy Policy for AI Clash',
    updated: 'Last updated: June 8, 2026',
    sections: [
      {
        title: '1. Data Collection',
        body: [
          'AI Clash is a browser-side tool. All AI model interactions happen directly between your browser and the respective AI service providers (e.g., DeepSeek, Kimi, etc.). We do <strong>NOT</strong> collect, store, or transmit your conversations, prompts, or personal data to our own servers.',
          'When you explicitly create a public share link, the question, model answers, summary, and basic timing stats for that session are uploaded to the AI Clash backend so the public share page can be generated. You can revoke the share with its delete token.',
          'Anonymous product analytics are enabled by default to understand install sources, product funnels, and failure types. Analytics events do not include your prompts, answers, API keys, account identifiers, or full URL query strings. You can disable anonymous analytics in the extension settings.',
        ],
      },
      {
        title: '2. Permissions Use',
        body: [
          [
            '<strong>Tabs/ActiveTab</strong>: Used to synchronize and switch between different AI provider tabs for a seamless experience.',
            '<strong>Storage</strong>: Used locally to save your preferences, such as enabled models and custom prompts.',
            '<strong>Scripting/Content Scripts</strong>: Used to interact with the web interface of AI providers you have already logged into.',
          ],
        ],
      },
      {
        title: '3. Third-Party Services',
        body: ['This extension interacts with third-party AI websites. Your use of those services is governed by their respective privacy policies. Website and extension analytics reuse Umami Analytics.'],
      },
      {
        title: '4. Contact',
        body: ['If you have questions, please contact us via GitHub Issues.'],
      },
    ],
  },
}
