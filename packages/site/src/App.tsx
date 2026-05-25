import { useCallback, useEffect, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider, Layout } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import type { Locale } from './content'
import { fetchAuthState, type AuthState, type SiteAuth } from './app/auth'
import { getInitialLocale, stripBasePath, stripLocale } from './app/paths'
import { createAntTheme } from './app/theme'
import type { ThemeMode } from './app/theme'
import { Footer } from './layout/Footer'
import { Header } from './layout/Header'
import { ChangelogPage, ChatPage, DownloadPage, HomePage, PrivacyPage, SharePage } from './pages'

const { Content } = Layout

function Page({ locale, page, auth }: { locale: Locale; page: string; auth: SiteAuth }) {
  switch (page) {
    case '/chat':
      return <ChatPage auth={auth} locale={locale} />
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
  const [authState, setAuthState] = useState<AuthState>({ authenticated: false })
  const [authStatus, setAuthStatus] = useState<SiteAuth['status']>('loading')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem('ai-clash-site-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const locale = getInitialLocale(path)
  const page = stripLocale(path)
  const isAppPage = page === '/chat'

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    window.localStorage.setItem('ai-clash-site-theme', themeMode)
  }, [themeMode])

  const refreshAuth = useCallback(async () => {
    try {
      setAuthState(await fetchAuthState())
    } finally {
      setAuthStatus('ready')
    }
  }, [])

  useEffect(() => {
    if (isAppPage) void refreshAuth()
    else setAuthStatus('ready')
  }, [isAppPage, refreshAuth])

  const antLocale = locale === 'en' ? enUS : zhCN
  const antTheme = createAntTheme(themeMode)
  const auth = useMemo<SiteAuth>(() => ({
    state: authState,
    status: authStatus,
    refresh: refreshAuth,
  }), [authState, authStatus, refreshAuth])
  const pageContent =
    page === '/share' || page.startsWith('/share/')
      ? <SharePage locale={locale} themeMode={themeMode} shareId={page.startsWith('/share/') ? page.slice('/share/'.length) : undefined} />
      : <Page auth={auth} locale={locale} page={page} />

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
            />
          ) : null}
          <Content>{pageContent}</Content>
          {isAppPage ? null : <Footer />}
        </AntApp>
      </Layout>
    </ConfigProvider>
  )
}
