import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'

const routes = [
  'download',
  'changelog',
  'privacy',
  'share',
  'en',
  'en/download',
  'en/changelog',
  'en/privacy',
  'en/share',
]

await copyFile(join('dist', 'index.html'), join('dist', '404.html'))

for (const route of routes) {
  const dir = join('dist', route)
  await mkdir(dir, { recursive: true })
  await copyFile(join('dist', 'index.html'), join(dir, 'index.html'))
  await copyFile(join('dist', 'index.html'), join('dist', `${route}.html`))
}
