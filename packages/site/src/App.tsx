import { useEffect, useState } from 'react'
import { App as AntApp, ConfigProvider, Layout } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import type { Locale } from './content'
import { getInitialLocale, stripBasePath, stripLocale } from './app/paths'
import { createAntTheme } from './app/theme'
import type { ThemeMode } from './app/theme'
import { Footer } from './layout/Footer'
import { Header } from './layout/Header'
import { ChangelogPage, DownloadPage, HomePage, PrivacyPage } from './pages'

const { Content } = Layout

function Page({
  locale,
  page
}: {
  locale: Locale
  page: string
  onLoginRequired: () => void
}) {
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
  const [path, setPath] = useState(() => stripBasePath(window.location.pathname))
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem('ai-clash-site-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const locale = getInitialLocale(path)
  const page = stripLocale(path)
  const isSharePage = page === '/share' || page.startsWith('/share/')
  const isAppPage = page === '/chat' || isSharePage

  useEffect(() => {
    const updatePath = () => setPath(stripBasePath(window.location.pathname))
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    window.localStorage.setItem('ai-clash-site-theme', themeMode)
  }, [themeMode])

  const antLocale = locale === 'en' ? enUS : zhCN
  const antTheme = createAntTheme(themeMode)
  const pageContent = <Page locale={locale} page={page} onLoginRequired={() => false} />

  return (
    <ConfigProvider locale={antLocale} theme={antTheme}>
      <Layout className="site-layout">
        <AntApp>
          {!isAppPage ? (
            <Header
              locale={locale}
              path={path}
              themeMode={themeMode}
              onToggleTheme={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              onLoginRequired={() => false}
            />
          ) : null}
          <Content>{pageContent}</Content>
          {isAppPage ? null : <Footer />}
        </AntApp>
      </Layout>
    </ConfigProvider>
  )
}
