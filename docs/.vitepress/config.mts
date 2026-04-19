import { defineConfig } from 'vitepress'

// 从环境变量获取 base 路径，支持 GitHub Pages 二级目录和自有站点根目录访问
// GitHub Pages 部署时通过环境变量 BASE_URL 传入 /ai-clash/
const base = process.env.BASE_URL || process.env.VITE_BASE_URL || '/'

export default defineConfig({
  base: base,

  head: [
    [
      'script',
      {
        defer: '',
        src: 'https://cloud.umami.is/script.js',
        'data-website-id': '3895ace9-ac76-4d79-aa29-40618f3386c9'
      }
    ]
  ],

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: "AI 对撞机",
      description: "聚合顶级大模型同屏对撞的浏览器侧边栏扩展",
      themeConfig: {
        nav: [
          { text: '首页', link: '/' },
          { text: '安装指南', link: '/download' },
          { text: '更新日志', link: '/changelog' },
          { text: '隐私政策', link: '/privacy' }
        ],
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: "AI Clash",
      description: "The Ultimate LLM Arena in your Browser Sidebar",
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Install Guide', link: '/en/download' },
          { text: 'Changelog', link: '/changelog' },
          { text: 'Privacy Policy', link: '/en/privacy' }
        ],
      }
    }
  },

  themeConfig: {
    logo: '/logo.png',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/null-object-0000/ai-clash' }
    ],

    footer: {
      copyright: 'Copyright © 2026-present AI Clash | <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" class="footer-link"> 苏 ICP 备 2024114357 号 -5</a>'
    }
  }
})