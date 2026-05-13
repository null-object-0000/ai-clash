import { useMemo } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import {
  ChromeFilled,
  DownOutlined,
  DownloadOutlined,
  GithubOutlined,
  GlobalOutlined,
} from '@ant-design/icons'
import { Button, Card, ConfigProvider, Dropdown, Layout, Tooltip, theme } from 'antd'
import type { MenuProps } from 'antd'
import { DeepSeek, Doubao, Qwen, Yuanbao, XiaomiMiMo, Wenxin } from '@lobehub/icons'
import { changelogs, downloads, homePages, navItems, privacyPages } from './content'
import type { Locale } from './content'

const { Header: AntHeader, Footer: AntFooter, Content } = Layout

const localeLabels: Record<Locale, string> = {
  zh: '简体中文',
  en: 'English',
}

type AiIcon = ComponentType<{ size?: number | string; className?: string; style?: CSSProperties }>

const aiProviders = [
  { name: 'DeepSeek', href: 'https://chat.deepseek.com/', Icon: DeepSeek.Color as AiIcon },
  { name: '豆包', href: 'https://www.doubao.com/chat/', Icon: Doubao.Color as AiIcon },
  { name: '通义千问', href: 'https://www.qianwen.com/', Icon: Qwen.Color as AiIcon },
  { name: '腾讯元宝', href: 'https://yuanbao.tencent.com/chat/', Icon: Yuanbao.Color as AiIcon },
  { name: '文心一言', href: 'https://yiyan.baidu.com/chat/', Icon: Wenxin.Color as AiIcon },
  { name: 'Xiaomi MIMO', href: 'https://aistudio.xiaomimimo.com/#/c', Icon: XiaomiMiMo as AiIcon },
] satisfies Array<{ name: string; href: string; Icon: AiIcon }>

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/'
}

function getLocale(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh'
}

function stripLocale(pathname: string) {
  if (pathname === '/en') return '/'
  if (pathname.startsWith('/en/')) return pathname.slice(3) || '/'
  return pathname
}

function withLocale(path: string, locale: Locale) {
  if (locale === 'zh') return path
  return path === '/' ? '/en/' : `/en${path}`
}

function Header({ locale, path }: { locale: Locale; path: string }) {
  const pagePath = stripLocale(path)
  const localeMenu: MenuProps['items'] = [
    { key: 'zh', label: <a href={pagePath}>{localeLabels.zh}</a> },
    { key: 'en', label: <a href={withLocale(pagePath, 'en')}>{localeLabels.en}</a> },
  ]

  return (
    <AntHeader className="header">
      <div className="nav-bar">
        <a className="brand" href={withLocale('/', locale)} aria-label={homePages[locale].name}>
          <img src="/logo.png" alt="" />
          <span>{homePages[locale].name}</span>
        </a>

        <nav className="nav-links" aria-label="Primary">
          {navItems[locale].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={normalizePath(path) === normalizePath(item.href) ? 'active' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="nav-actions">
          <Dropdown menu={{ items: localeMenu }} placement="bottomRight">
            <Button className="locale-button" type="text">
              <GlobalOutlined />
              {localeLabels[locale]}
              <DownOutlined className="locale-button__arrow" />
            </Button>
          </Dropdown>
          <a
            className="icon-link"
            href="https://github.com/null-object-0000/ai-clash"
            aria-label="GitHub"
          >
            <GithubOutlined />
          </a>
        </div>
      </div>
    </AntHeader>
  )
}

function EdgeIcon() {
  return (
    <svg className="browser-icon" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="edge-a" x1="3.31" x2="20.56" y1="15.15" y2="7.05" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0C59A4" />
          <stop offset="0.54" stopColor="#11AEEF" />
          <stop offset="1" stopColor="#35C889" />
        </linearGradient>
      </defs>
      <path
        fill="url(#edge-a)"
        d="M21.5 13.03c0-4.73-3.42-8.83-8.06-9.68C8.1 2.37 3 6.46 3 11.9c0 .89.13 1.75.38 2.56 1.05-3.62 4.36-5.65 7.45-5.65 2.98 0 5.42 1.73 5.42 4.34 0 1.88-1.39 3.1-3.36 3.1H8.34c.77 2.05 2.73 3.38 5.23 3.38 3.95 0 7.93-2.72 7.93-6.6Z"
      />
      <path
        fill="#0AA6A6"
        d="M16.24 13.15c0-2.61-2.44-4.34-5.42-4.34-3.09 0-6.4 2.03-7.45 5.65.96 3.09 3.83 5.34 7.24 5.34 2.43 0 4.62-1.15 5.99-2.94-.89.37-1.92.56-3.03.56-2.5 0-4.46-1.33-5.23-3.38h4.55c1.97 0 3.35-1.21 3.35-2.89Z"
      />
    </svg>
  )
}

function getActionIcon(kind: string) {
  if (kind.includes('chrome')) return <ChromeFilled className="browser-icon chrome-icon" />
  if (kind.includes('edge')) return <EdgeIcon />
  return <DownloadOutlined />
}

function HomePage({ locale }: { locale: Locale }) {
  const content = homePages[locale]

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1>{content.name}</h1>
          <p className="hero-text">{content.text}</p>
          <p className="tagline">{content.tagline}</p>
          <div className="actions">
            {content.actions.map((action) => (
              <Button
                key={action.href}
                className={`button ${action.kind}`}
                href={action.href}
                icon={getActionIcon(action.kind)}
                size="large"
                type={action.kind.includes('brand') ? 'primary' : 'default'}
              >
                {action.label}
              </Button>
            ))}
          </div>

          <div className="supported-ai-strip" aria-label={locale === 'zh' ? '已支持的 AI' : 'Supported AI'}>
            {aiProviders.map(({ name, href, Icon }) => (
              <Tooltip key={name} title={name}>
                <a
                  className="supported-ai-strip__item"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={name}
                  aria-label={name}
                >
                  <Icon size={30} />
                </a>
              </Tooltip>
            ))}
          </div>
        </div>
        <div className="hero-logo">
          <img src="/logo.png" alt={content.logoAlt} />
        </div>
      </section>

      <section className="features" aria-label={locale === 'zh' ? '功能亮点' : 'Features'}>
        {content.features.map((feature) => (
          <Card className="feature" key={feature.title} variant="borderless">
            <h2>{feature.title}</h2>
            <p>{feature.details}</p>
          </Card>
        ))}
      </section>

      <div className="demo">
        <img src="/动画.gif" alt={content.demoAlt} />
      </div>
    </main>
  )
}

function DownloadPage({ locale }: { locale: Locale }) {
  const content = downloads[locale]

  return (
    <Article title={content.title}>
      <h2>{content.storeTitle}</h2>
      <p>{content.storeIntro}</p>
      <ul>
        <li>
          <a href="https://chromewebstore.google.com/detail/ggngmgpjdklmkpoldbfahmeefpnfhhai">
            {content.chrome}
          </a>
        </li>
        <li>
          <a href="https://microsoftedge.microsoft.com/addons/detail/khjmihaeihajagobgbdhlbjeobdpmfkm">
            {content.edge}
          </a>
        </li>
      </ul>
      <h2>{content.offlineTitle}</h2>
      <p>{content.offlineIntro}</p>
      <h3>{content.stepDownload}</h3>
      <p>
        <a href="https://github.com/null-object-0000/ai-clash/releases/latest">
          {content.releaseLink}
        </a>{' '}
        {content.releaseNote}
      </p>
      <h3>{content.stepUnzip}</h3>
      <p>{content.unzip}</p>
      <h3>{content.stepLoad}</h3>
      <ol>
        {content.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </Article>
  )
}

function ChangelogPage({ locale }: { locale: Locale }) {
  return (
    <Article title={locale === 'zh' ? '更新日志' : 'Changelog'}>
      {changelogs[locale].map((release) => (
        <section className="release" key={release.version}>
          <h2>{release.version}</h2>
          {release.groups.map((group) => (
            <div key={group.title}>
              <h3>{group.title}</h3>
              {group.items.length > 0 && (
                <ul>
                  {group.items.map((item) => (
                    <li key={item} dangerouslySetInnerHTML={{ __html: item }} />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
    </Article>
  )
}

function PrivacyPage({ locale }: { locale: Locale }) {
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

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="doc-shell">
      <article className="doc">
        <h1>{title}</h1>
        {children}
      </article>
    </main>
  )
}

function Footer() {
  return (
    <footer className="footer">
      Copyright © 2026-present AI Clash |{' '}
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
        苏 ICP 备 2024114357 号 -5
      </a>
    </footer>
  )
}

function Page({ locale, page }: { locale: Locale; page: string }) {
  switch (page) {
    case '/download':
      return <DownloadPage locale={locale} />
    case '/changelog':
      return <ChangelogPage locale={locale} />
    case '/privacy':
      return <PrivacyPage locale={locale} />
    default:
      return <HomePage locale={locale} />
  }
}

export function App() {
  const path = useMemo(() => normalizePath(window.location.pathname), [])
  const locale = getLocale(path)
  const page = stripLocale(path)

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#3451b2',
          borderRadius: 8,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <Layout className="site-layout">
        <Header locale={locale} path={path} />
        <Content>
          <Page locale={locale} page={page} />
        </Content>
        <Footer />
      </Layout>
    </ConfigProvider>
  )
}
