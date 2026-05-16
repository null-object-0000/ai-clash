import { privacyPages } from '../content'
import type { Locale } from '../content'
import { Article } from './Article'

export function PrivacyPage({ locale }: { locale: Locale }) {
  const content = privacyPages[locale]

  return (
    <Article title={content.title}>
      <p>{content.updated}</p>
      {content.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.body.map((paragraph) =>
            Array.isArray(paragraph) ? (
              <ul key={section.title + '-list'}>
                {paragraph.map((item) => (
                  <li key={item} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
            ) : (
              <p key={paragraph} dangerouslySetInnerHTML={{ __html: paragraph }} />
            ),
          )}
        </section>
      ))}
    </Article>
  )
}
