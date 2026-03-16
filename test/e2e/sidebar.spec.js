import { test, expect, chromium } from '@playwright/test'
import path from 'path'

const distPath = path.join(process.cwd(), 'dist')

let context
let extensionId

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 400, height: 600 },
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`
    ]
  })

  // MV3 标准方式：通过 Service Worker URL 解析扩展 ID
  let [sw] = context.serviceWorkers()
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 10000 })
  }
  extensionId = new URL(sw.url()).hostname
  if (!extensionId) throw new Error('未找到扩展 Service Worker，请确认 dist 目录已构建')
})

test.afterAll(async () => {
  await context.close()
})

test('侧边栏打开无报错且正常渲染', async () => {
  const page = await context.newPage()

  // 收集所有控制台错误（需在 goto 之前注册）
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)

  // 验证页面正常加载
  await expect(page.locator('#app')).toBeVisible({ timeout: 10000 })

  // 等待页面完全稳定
  await page.waitForLoadState('networkidle')

  // 验证没有任何运行时错误
  expect(errors).toHaveLength(0, `侧边栏运行时错误: ${errors.join(', ')}`)

  // 验证核心UI元素存在
  await expect(page.getByPlaceholder('输入问题，按 Enter 发送...')).toBeVisible()
  await expect(page.locator('button[type="button"]').filter({ has: page.locator('svg') }).last()).toBeVisible()

  await page.close()
})

test('发送消息功能正常', async () => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)
  await expect(page.locator('#app')).toBeVisible({ timeout: 10000 })

  // 开启 LongCat 通道（无需登录即可对话）
  const longcatRow = page.locator('div.px-4.py-2\\.5').filter({ hasText: 'LongCat' })
  const longcatToggle = longcatRow.locator('button.rounded-full.h-6.w-10')
  await longcatToggle.click()
  await expect(longcatToggle).toHaveClass(/bg-indigo-500/, { timeout: 3000 })

  await page.getByPlaceholder('输入问题，按 Enter 发送...').fill('你好')
  await page.getByPlaceholder('输入问题，按 Enter 发送...').press('Enter')

  // 验证问题出现在聊天区域
  await expect(page.getByText('你好')).toBeVisible({ timeout: 5000 })

  await page.close()
})
