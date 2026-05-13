import { mkdir, copyFile } from 'node:fs/promises'
import { join } from 'node:path'

const routes = [
  'download',
  'changelog',
  'privacy',
  'en',
  'en/download',
  'en/changelog',
  'en/privacy',
]

await copyFile(join('dist', 'index.html'), join('dist', '404.html'))

for (const route of routes) {
  const dir = join('dist', route)
  await mkdir(dir, { recursive: true })
  await copyFile(join('dist', 'index.html'), join(dir, 'index.html'))
}
