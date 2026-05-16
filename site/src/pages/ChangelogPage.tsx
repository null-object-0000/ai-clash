import ReactMarkdown from 'react-markdown'
import type { Locale } from '../content'
import changelogEn from '../content/markdown/changelog.en.md?raw'
import changelogZh from '../content/markdown/changelog.zh.md?raw'
import { Article } from './Article'

export function ChangelogPage({ locale }: { locale: Locale }) {
  const markdown = locale === 'zh' ? changelogZh : changelogEn

  return (
    <Article title="">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </Article>
  )
}
