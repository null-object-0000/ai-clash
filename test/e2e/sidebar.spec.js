import { test, expect, chromium } from '@playwright/test'
import path from 'path'

const distPath = path.join(process.cwd(), 'dist')

let context
let extensionId

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    viewport: { width: 800, height: 600 },
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`
    ]
  })

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

  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)

  await expect(page.locator('#app')).toBeVisible({ timeout: 10000 })

  await page.waitForLoadState('networkidle')

  expect(errors).toHaveLength(0, `侧边栏运行时错误: ${errors.join(', ')}`)

  await expect(page.getByPlaceholder('输入你的问题，按 Enter 发送')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('AI 对撞机')).toBeVisible()

  await page.close()
})

test('输入框交互正常', async () => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`)
  await expect(page.locator('#app')).toBeVisible({ timeout: 10000 })

  const input = page.getByPlaceholder('输入你的问题，按 Enter 发送')
  await input.fill('你好')
  await expect(input).toHaveValue('你好')

  await input.press('Enter')
  await expect(input).toHaveValue('', { timeout: 3000 })

  await page.close()
})
