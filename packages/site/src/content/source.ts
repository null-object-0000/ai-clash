export const homePageZh = {
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
}

export const downloadsZh = {
  title: '📥 插件下载与安装',
  storeTitle: '方式一：应用商店一键安装 (推荐)',
  storeIntro: '如果你可以正常访问外网，强烈推荐通过官方商店安装，这样可以获得自动更新的能力。',
  chrome: 'Chrome Web Store 官方下载',
  edge: 'Edge Add-ons 官方下载',
  offlineTitle: '方式二：离线 ZIP 包开发者模式安装 (国内可直连)',
  offlineIntro: '无法访问应用商店时，可以直接从官网下载离线包，再按以下 3 步安装。',
  stepDownload: '1. 下载最新版 ZIP 包',
  releaseHref: '/downloads/ai-clash-v1.2.2.zip',
  releaseLink: '👉 直接下载 AI 对撞机 v1.2.2 离线包',
  releaseNote: '(下载 ai-clash-v1.2.2.zip；开发者模式安装不会自动更新，推荐优先使用 Chrome/Edge 应用商店)',
  stepUnzip: '2. 解压文件',
  unzip: '将下载的 ZIP 文件解压到电脑上的一个常用文件夹中（请不要删除该文件夹）。',
  stepLoad: '3. 在浏览器中加载',
  steps: [
    '打开浏览器的扩展管理页面：Chrome 用户在地址栏输入 chrome://extensions/；Edge 用户在地址栏输入 edge://extensions/。',
    '打开右上角的「开发者模式」开关。',
    '点击左上角的「加载已解压的扩展程序」，然后选择你刚刚解压好的文件夹即可！🎉',
  ],
}

export const privacyPageZh = {
  title: 'AI 对撞机隐私政策',
  updated: '最后更新时间：2026年6月8日',
  sections: [
    {
      title: '1. 数据收集',
      body: [
        'AI 对撞机是一款纯正的浏览器端工具。所有 AI 模型交互均直接发生在您的浏览器和相应的 AI 服务提供商（例如 DeepSeek、Kimi 等）之间。我们<strong>不会</strong>收集、存储或向我们自己的服务器传输您的对话、提示词或任何个人数据。',
        '当您主动生成公开分享链接时，本次问题、各通道回答、归纳总结和基础耗时统计会上传到 AI 对撞机后端，用于生成公开可访问的分享页面。您可以使用删除令牌取消该分享。',
        '我们会默认启用匿名产品统计，用于了解安装来源、功能使用漏斗和故障类型。统计事件不会包含您的问题、回答正文、API Key、账号标识或完整 URL 参数，您可以在扩展设置中关闭匿名数据统计。',
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
      body: ['此扩展程序会与第三方 AI 网站进行交互。您对这些服务的使用受其各自隐私政策的约束。官网和扩展的匿名使用统计复用 Umami Analytics。'],
    },
    {
      title: '4. 联系我们',
      body: ['如果您有任何问题，请通过 GitHub Issues 联系我们。'],
    },
  ],
}

export const shareLabelsZh = {
  loading: '正在打开分享',
  missingTitle: '分享不存在或已取消',
  missingDesc: '这条分享链接可能已经取消、过期，或者链接地址不完整。',
  backHome: '返回首页',
  question: '问题',
  summary: '归纳总结',
  providerAnswers: '多模型回答',
  thinking: '思考过程',
  thinkingDone: '深度思考完成',
  summaryAnalysisDone: '归纳总结过程完成',
  stats: '统计',
  growthTitle: '用 AI 对撞机生成你自己的多模型对比',
  growthDesc: '安装浏览器插件后，一次提问即可同时唤起多个 AI 通道，并生成可分享的对比结果。',
  chrome: 'Chrome 商店安装',
  edge: 'Edge 商店安装',
  offline: '离线 ZIP 安装',
  upcoming: '官网在线多模型对话正在准备中，当前推荐先安装插件使用。',
}
