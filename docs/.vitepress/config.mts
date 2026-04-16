import { defineConfig } from 'vitepress'

export default defineConfig({
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
          { text: 'Changelog', link: '/en/changelog' },
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
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present AI Clash'
    }
  }
})