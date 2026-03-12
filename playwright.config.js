import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false, // 持久化 context 不支持并行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 扩展测试串行执行
  reporter: 'html',
  use: {
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium'
    }
  ]
})
