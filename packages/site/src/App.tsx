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
import { AccountPage, ChangelogPage, ChatPage, DownloadPage, HomePage, PrivacyPage, SharePage } from './pages'

const { Content } = Layout

function Page({ locale, page, auth }: { locale: Locale; page: string; auth: SiteAuth }) {
  switch (page) {
    case '/chat':
      return <ChatPage auth={auth} locale={locale} />
    case '/account':
      return <AccountPage auth={auth} locale={locale} />
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
  const isSharePage = page === '/share' || page.startsWith('/share/')
  const isAppPage = page === '/chat' || isSharePage

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
    if (page === '/chat' || page === '/account') void refreshAuth()
    else setAuthStatus('ready')
  }, [page, refreshAuth])

  const antLocale = locale === 'en' ? enUS : zhCN
  const antTheme = createAntTheme(themeMode)
  const auth = useMemo<SiteAuth>(() => ({
    state: authState,
    status: authStatus,
    refresh: refreshAuth,
  }), [authState, authStatus, refreshAuth])
  const pageContent =
    isSharePage
      ? <SharePage auth={auth} locale={locale} themeMode={themeMode} shareId={page.startsWith('/share/') ? page.slice('/share/'.length) : undefined} />
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
