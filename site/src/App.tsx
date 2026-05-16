import { useEffect, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider, Layout } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import type { Locale } from './content'
import { getInitialLocale, stripBasePath, stripLocale } from './app/paths'
import { createAntTheme } from './app/theme'
import type { ThemeMode } from './app/theme'
import { Footer } from './layout/Footer'
import { Header } from './layout/Header'
import { ChangelogPage, DownloadPage, HomePage, PrivacyPage, SharePage } from './pages'

const { Content } = Layout

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

  const locale = getInitialLocale(path)
  const page = stripLocale(path)
  const antLocale = locale === 'en' ? enUS : zhCN
  const antTheme = createAntTheme(themeMode)
  const pageContent =
    page === '/share' ? <SharePage locale={locale} themeMode={themeMode} /> : <Page locale={locale} page={page} />

  return (
    <ConfigProvider locale={antLocale} theme={antTheme}>
      <Layout className="site-layout">
        <AntApp>
          <Header
            locale={locale}
            path={path}
            themeMode={themeMode}
            onToggleTheme={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          />
          <Content>{pageContent}</Content>
          <Footer />
        </AntApp>
      </Layout>
    </ConfigProvider>
  )
}
