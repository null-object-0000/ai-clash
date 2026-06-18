import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, '_locales', 'en', 'messages.json');
const targets = ['en_US', 'en_GB', 'en_AU'];

if (!existsSync(source)) {
  throw new Error(`Missing source locale file: ${source}`);
}

for (const locale of targets) {
  const targetDir = join(root, '_locales', locale);
  const targetFile = join(targetDir, 'messages.json');

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, targetFile);
}

console.log(`Synced Chrome English locale variants: ${targets.join(', ')}`);
