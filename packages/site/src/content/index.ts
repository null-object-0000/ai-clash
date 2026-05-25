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
  zh: {
    name: 'AI 对撞机',
    text: '顶级大模型同屏比拼',
    tagline: '告别繁琐切网页！一键召唤多个顶级 AI 同屏赛博斗兽，内置归纳引擎直出终极答案。',
    logoAlt: 'AI Clash Logo',
    demoAlt: 'AI Clash 演示动画',
    actions: [
      {
        kind: 'brand chrome',
        label: 'Chrome 商店下载',
        href: 'https://chromewebstore.google.com/detail/ggngmgpjdklmkpoldbfahmeefpnfhhai',
      },
      {
        kind: 'brand edge',
        label: 'Edge 商店下载',
        href: 'https://microsoftedge.microsoft.com/addons/detail/khjmihaeihajagobgbdhlbjeobdpmfkm',
      },
      { kind: 'alt', label: '下载离线 ZIP 包', href: '/download' },
    ],
    features: [
      {
        title: '⚡️ 一键多路并发',
        details: '告别繁琐切网页！一键召唤多个顶级 AI 同屏赛博斗兽，内置归纳引擎直出终极答案。',
      },
      {
        title: '⚖️ 内置 AI 裁判总结',
        details: '自动对比各家回答，折叠冗长分析过程，一语道破核心分歧，直出最优终极建议。',
      },
      {
        title: '💸 零 API 成本',
        details: '采用纯前端 DOM 劫持技术，直接榨取你已登录网页端（DeepSeek/Kimi 等）的原生算力。',
      },
    ],
  },
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
  zh: {
    title: '📥 插件下载与安装',
    storeTitle: '方式一：应用商店一键安装 (推荐)',
    storeIntro: '如果你可以正常访问外网，强烈推荐通过官方商店安装，这样可以获得自动更新的能力。',
    chrome: 'Chrome Web Store 官方下载',
    edge: 'Edge Add-ons 官方下载',
    offlineTitle: '方式二：离线 ZIP 包开发者模式安装 (国内免翻)',
    offlineIntro: '无法访问商店？没关系，按照以下 3 步即可轻松安装。',
    stepDownload: '1. 下载最新版 ZIP 包',
    releaseLink: '👉 点击下载 AI 对撞机 v1.2.0 离线包',
    releaseNote: '(跳转后下载 ai-clash-v1.2.0.zip)',
    stepUnzip: '2. 解压文件',
    unzip: '将下载的 ZIP 文件解压到电脑上的一个常用文件夹中（请不要删除该文件夹）。',
    stepLoad: '3. 在浏览器中加载',
    steps: [
      '打开浏览器的扩展管理页面：Chrome 用户在地址栏输入 chrome://extensions/；Edge 用户在地址栏输入 edge://extensions/。',
      '打开右上角的「开发者模式」开关。',
      '点击左上角的「加载已解压的扩展程序」，然后选择你刚刚解压好的文件夹即可！🎉',
    ],
  },
  en: {
    title: '📥 Download & Installation',
    storeTitle: 'Method 1: Store Installation (Recommended)',
    storeIntro: 'If you can access the stores, it is highly recommended to install through them to get automatic updates.',
    chrome: 'Chrome Web Store',
    edge: 'Edge Add-ons',
    offlineTitle: 'Method 2: Offline ZIP Installation (Developer Mode)',
    offlineIntro: 'Cannot access the store? No problem, just follow these 3 steps.',
    stepDownload: '1. Download the Latest ZIP',
    releaseLink: '👉 Download AI Clash v1.2.0 Offline Package',
    releaseNote: '(Download ai-clash-v1.2.0.zip after redirect)',
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
  zh: {
    title: 'AI 对撞机隐私政策',
    updated: '最后更新时间：2026年4月16日',
    sections: [
      {
        title: '1. 数据收集',
        body: [
          'AI 对撞机是一款纯正的浏览器端工具。所有 AI 模型交互均直接发生在您的浏览器和相应的 AI 服务提供商（例如 DeepSeek、Kimi 等）之间。我们<strong>不会</strong>收集、存储或向我们自己的服务器传输您的对话、提示词或任何个人数据。',
        ],
      },
      {
        title: '2. 权限说明',
        body: [
          [
            '<strong>标签页/ActiveTab (Tabs)</strong>：用于在提供对话服务的不同 AI 标签页之间进行同步和切换，以提供无缝体验。',
            '<strong>本地存储 (Storage)</strong>：用于在本地保存您的偏好设置，例如已启用的模型和自定义的提示词。',
            '<strong>脚本注入 (Scripting/Content Scripts)</strong>：用于与您已经登录的 AI 平台网页界面进行交互（获取网页原生算力）。',
          ],
        ],
      },
      {
        title: '3. 第三方服务',
        body: ['此扩展程序会与第三方 AI 网站进行交互。您对这些服务的使用受其各自隐私政策的约束。'],
      },
      {
        title: '4. 联系我们',
        body: ['如果您有任何问题，请通过 GitHub Issues 联系我们。'],
      },
    ],
  },
  en: {
    title: 'Privacy Policy for AI Clash',
    updated: 'Last updated: April 16, 2026',
    sections: [
      {
        title: '1. Data Collection',
        body: [
          'AI Clash is a browser-side tool. All AI model interactions happen directly between your browser and the respective AI service providers (e.g., DeepSeek, Kimi, etc.). We do <strong>NOT</strong> collect, store, or transmit your conversations, prompts, or personal data to our own servers.',
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
        body: ['This extension interacts with third-party AI websites. Your use of those services is governed by their respective privacy policies.'],
      },
      {
        title: '4. Contact',
        body: ['If you have questions, please contact us via GitHub Issues.'],
      },
    ],
  },
}
