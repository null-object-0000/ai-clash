import { useEffect, useMemo, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import {
  ChromeFilled,
  DownOutlined,
  DownloadOutlined,
  GithubOutlined,
  GlobalOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { App as AntApp, Button, Card, ConfigProvider, Dropdown, Layout, Tooltip, theme } from 'antd'
import type { MenuProps } from 'antd'
import { DeepSeek, Doubao, Qwen, Yuanbao, XiaomiMiMo, Wenxin } from '@lobehub/icons'
import ReactMarkdown from 'react-markdown'
import { downloads, homePages, navItems, privacyPages } from './content'
import type { Locale } from './content'
import changelogEn from './markdown/changelog.en.md?raw'
import changelogZh from './markdown/changelog.zh.md?raw'
import { SharePage } from './SharePage'

const { Header: AntHeader, Footer: AntFooter, Content } = Layout

const localeLabels: Record<Locale, string> = {
  zh: '简体中文',
  en: 'English',
}

const basePath = normalizePath(import.meta.env.BASE_URL).replace(/\/$/, '')

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

function stripBasePath(pathname: string) {
  const normalizedPath = normalizePath(pathname)
  if (!basePath) return normalizedPath
  if (normalizedPath === basePath) return '/'
  if (normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath.slice(basePath.length) || '/'
  }
  return normalizedPath
}

function withBasePath(path: string) {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${basePath}${normalizedPath}` || '/'
}

function assetPath(path: string) {
  return withBasePath(path)
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

type ThemeMode = 'light' | 'dark'

function Header({
  locale,
  path,
  themeMode,
  onToggleTheme,
}: {
  locale: Locale
  path: string
  themeMode: ThemeMode
  onToggleTheme: () => void
}) {
  const pagePath = stripLocale(path)
  const localeMenu: MenuProps['items'] = [
    { key: 'zh', label: <a href={withBasePath(pagePath)}>{localeLabels.zh}</a> },
    { key: 'en', label: <a href={withBasePath(withLocale(pagePath, 'en'))}>{localeLabels.en}</a> },
  ]

  return (
    <AntHeader className="header">
      <div className="nav-bar">
        <a className="brand" href={withBasePath(withLocale('/', locale))} aria-label={homePages[locale].name}>
          <img src={assetPath('/logo.png')} alt="" />
          <span>{homePages[locale].name}</span>
        </a>

        <nav className="nav-links" aria-label="Primary">
          {navItems[locale].map((item) => (
            <a
              key={item.href}
              href={withBasePath(item.href)}
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
          <Button
            aria-label={themeMode === 'dark' ? '切换浅色模式' : '切换深色模式'}
            className="theme-toggle"
            icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            type="text"
            onClick={onToggleTheme}
          />
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
  return <img className="browser-icon edge-browser-icon" src={assetPath('/edge.svg')} alt="" aria-hidden="true" />
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
                href={withBasePath(action.href)}
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
          <img src={assetPath('/logo.png')} alt={content.logoAlt} />
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
        <img src={assetPath('/动画.gif')} alt={content.demoAlt} />
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
  const markdown = locale === 'zh' ? changelogZh : changelogEn

  return (
    <Article title="">
      <ReactMarkdown>{markdown}</ReactMarkdown>
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
        {title && <h1>{title}</h1>}
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
  const path = useMemo(() => stripBasePath(window.location.pathname), [])
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem('ai-clash-site-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    window.localStorage.setItem('ai-clash-site-theme', themeMode)
  }, [themeMode])

  const antTheme = {
    algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#3451b2',
      colorBgBase: themeMode === 'dark' ? '#1b1b1f' : '#ffffff',
      colorBgContainer: themeMode === 'dark' ? '#1b1b1f' : '#ffffff',
      colorBgElevated: themeMode === 'dark' ? '#2f2f35' : '#ffffff',
      colorFillSecondary: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
      colorText: themeMode === 'dark' ? 'rgba(255, 255, 245, 0.92)' : '#213547',
      colorTextSecondary: themeMode === 'dark' ? 'rgba(235, 235, 245, 0.72)' : 'rgba(60, 60, 67, 0.78)',
      colorTextTertiary: themeMode === 'dark' ? 'rgba(235, 235, 245, 0.46)' : 'rgba(60, 60, 67, 0.56)',
      colorBorder: themeMode === 'dark' ? 'rgba(84, 84, 88, 0.65)' : '#e2e2e3',
      colorBorderSecondary: themeMode === 'dark' ? 'rgba(84, 84, 88, 0.48)' : '#e2e2e3',
      borderRadius: 8,
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
  }

  if (path === '/share') {
    return (
      <ConfigProvider theme={antTheme}>
        <Layout className="site-layout">
          <AntApp>
            <Header
              locale="zh"
              path={path}
              themeMode={themeMode}
              onToggleTheme={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            />
            <Content>
              <SharePage themeMode={themeMode} />
            </Content>
            <Footer />
          </AntApp>
        </Layout>
      </ConfigProvider>
    )
  }

  const locale = getLocale(path)
  const page = stripLocale(path)

  return (
    <ConfigProvider
      theme={antTheme}
    >
      <Layout className="site-layout">
        <AntApp>
          <Header
            locale={locale}
            path={path}
            themeMode={themeMode}
            onToggleTheme={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          />
          <Content>
            <Page locale={locale} page={page} />
          </Content>
          <Footer />
        </AntApp>
      </Layout>
    </ConfigProvider>
  )
}
