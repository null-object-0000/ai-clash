import { useCallback, useEffect, useMemo, useState } from 'react'
import { App as AntApp, Button, ConfigProvider, Layout, Modal } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { Github, Google, Microsoft } from '@lobehub/icons'
import type { Locale } from './content'
import {
  fetchAuthState,
  startGithubLogin,
  startGoogleLogin,
  startMicrosoftLogin,
  type AuthState,
  type SiteAuth,
} from './app/auth'
import { getInitialLocale, stripBasePath, stripLocale, withBasePath, withLocale } from './app/paths'
import { createAntTheme } from './app/theme'
import type { ThemeMode } from './app/theme'
import { Footer } from './layout/Footer'
import { Header } from './layout/Header'
import { AccountPage, ChangelogPage, ChatPage, DownloadPage, HomePage, PrivacyPage, SharePage } from './pages'

const { Content } = Layout

function Page({
  locale,
  page,
  auth,
  onLoginRequired,
}: {
  locale: Locale
  page: string
  auth: SiteAuth
  onLoginRequired: () => void
}) {
  switch (page) {
    case '/chat':
      return <ChatPage auth={auth} locale={locale} onLoginRequired={onLoginRequired} />
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
  const [path, setPath] = useState(() => stripBasePath(window.location.pathname))
  const [authState, setAuthState] = useState<AuthState>({ authenticated: false })
  const [authStatus, setAuthStatus] = useState<SiteAuth['status']>('loading')
  const [loginOpen, setLoginOpen] = useState(false)
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

  const refreshAuth = useCallback(async () => {
    try {
      setAuthState(await fetchAuthState())
    } finally {
      setAuthStatus('ready')
    }
  }, [])

  useEffect(() => {
    void refreshAuth()
  }, [page, refreshAuth])

  useEffect(() => {
    if (page !== '/account' || authStatus !== 'ready' || authState.authenticated) return
    window.history.replaceState(null, '', withBasePath(withLocale('/', locale)))
    setPath(stripBasePath(window.location.pathname))
    setLoginOpen(true)
  }, [authState.authenticated, authStatus, locale, page])

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
      : <Page auth={auth} locale={locale} page={page} onLoginRequired={() => setLoginOpen(true)} />

  return (
    <ConfigProvider locale={antLocale} theme={antTheme}>
      <Layout className="site-layout">
        <AntApp>
          {!isAppPage ? (
            <Header
              locale={locale}
              path={path}
              themeMode={themeMode}
              auth={auth}
              onToggleTheme={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              onLoginRequired={() => setLoginOpen(true)}
            />
          ) : null}
          <Content>{pageContent}</Content>
          {isAppPage ? null : <Footer />}
          <Modal
            centered
            footer={null}
            open={loginOpen}
            title={locale === 'zh' ? '登录 AI 对撞机' : 'Sign in to AI Clash'}
            onCancel={() => setLoginOpen(false)}
          >
            <div className="site-login-modal">
              <p>
                {locale === 'zh'
                  ? '登录后可以使用在线对话、管理公开分享和绑定更多登录方式。'
                  : 'Sign in to chat online, manage public shares, and link more login methods.'}
              </p>
              <div className="site-login-modal__actions">
                <Button block icon={<Github size={16} />} onClick={startGithubLogin}>
                  {locale === 'zh' ? 'GitHub 登录' : 'Continue with GitHub'}
                </Button>
                <Button block icon={<Google.Color size={16} />} onClick={startGoogleLogin}>
                  {locale === 'zh' ? 'Google 登录' : 'Continue with Google'}
                </Button>
                <Button block icon={<Microsoft.Color size={16} />} onClick={startMicrosoftLogin}>
                  {locale === 'zh' ? 'Microsoft 登录' : 'Continue with Microsoft'}
                </Button>
              </div>
            </div>
          </Modal>
        </AntApp>
      </Layout>
    </ConfigProvider>
  )
}
