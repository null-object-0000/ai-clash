import { useState } from 'react'
import {
  DownOutlined,
  GithubOutlined,
  GlobalOutlined,
  MenuOutlined,
  MessageOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Drawer, Dropdown, Layout } from 'antd'
import type { MenuProps } from 'antd'
import { homePages, navItems } from '../content'
import type { Locale } from '../content'
import type { ThemeMode } from '../app/theme'
import type { SiteAuth } from '../app/auth'
import { assetPath, normalizePath, stripLocale, withBasePath, withLocale } from '../app/paths'

const { Header: AntHeader } = Layout

const localeLabels: Record<Locale, string> = {
  zh: '简体中文',
  en: 'English',
}

const startChatLabels: Record<Locale, string> = {
  zh: '开始对话',
  en: 'Start Chat',
}

const accountLabels: Record<Locale, string> = {
  zh: '账号',
  en: 'Account',
}

export function Header({
  locale,
  path,
  themeMode,
  auth,
  onToggleTheme,
  onLoginRequired,
  appMode = false,
}: {
  locale: Locale
  path: string
  themeMode: ThemeMode
  auth?: SiteAuth
  onToggleTheme: () => void
  onLoginRequired?: () => void
  appMode?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pagePath = stripLocale(path)
  const startChatHref = withBasePath(withLocale('/chat', locale))
  const accountHref = withBasePath(withLocale('/account', locale))
  const isSignedIn = auth?.state.authenticated === true
  const localeMenu: MenuProps['items'] = [
    {
      key: 'zh',
      label: (
        <a href={withBasePath(pagePath)} onClick={() => window.localStorage.setItem('ai-clash-site-locale', 'zh')}>
          {localeLabels.zh}
        </a>
      ),
    },
    {
      key: 'en',
      label: (
        <a
          href={withBasePath(withLocale(pagePath, 'en'))}
          onClick={() => window.localStorage.setItem('ai-clash-site-locale', 'en')}
        >
          {localeLabels.en}
        </a>
      ),
    },
  ]

  return (
    <AntHeader className={`header ${appMode ? 'header--app' : ''}`}>
      <div className="nav-bar">
        <a className="brand" href={withBasePath(withLocale('/', locale))} aria-label={homePages[locale].name}>
          <img src={assetPath('/logo.png')} alt="" />
          <span>{homePages[locale].name}</span>
        </a>

        {!appMode ? (
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
        ) : <div className="nav-links nav-links--app" />}

        <div className="nav-actions">
          {!appMode ? (
            <Button
              className="start-chat-button"
              href={startChatHref}
              icon={<MessageOutlined />}
              type="primary"
            >
              {startChatLabels[locale]}
            </Button>
          ) : null}
          {!appMode ? (
            <Dropdown menu={{ items: localeMenu }} placement="bottomRight">
              <Button className="locale-button" type="text">
                <GlobalOutlined />
                {localeLabels[locale]}
                <DownOutlined className="locale-button__arrow" />
              </Button>
            </Dropdown>
          ) : null}
          <Button
            aria-label={themeMode === 'dark' ? '切换浅色模式' : '切换深色模式'}
            className="theme-toggle"
            icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            type="text"
            onClick={onToggleTheme}
          />
          {!appMode ? (
            <Button
              aria-label={accountLabels[locale]}
              className="account-nav-button"
              href={isSignedIn ? accountHref : undefined}
              icon={<UserOutlined />}
              type="text"
              onClick={isSignedIn ? undefined : onLoginRequired}
            />
          ) : null}
          {!appMode ? (
            <a
              className="icon-link"
              href="https://github.com/null-object-0000/ai-clash"
              aria-label="GitHub"
            >
              <GithubOutlined />
            </a>
          ) : null}
          {!appMode ? (
            <Button
              aria-label={locale === 'zh' ? '打开导航菜单' : 'Open navigation menu'}
              className="mobile-menu-button"
              icon={<MenuOutlined />}
              type="text"
              onClick={() => setMenuOpen(true)}
            />
          ) : null}
        </div>
      </div>
      {!appMode ? <Drawer
        className="mobile-nav-drawer"
        closeIcon={null}
        open={menuOpen}
        placement="right"
        width={300}
        onClose={() => setMenuOpen(false)}
      >
        <div className="mobile-menu-header">
          <a className="brand" href={withBasePath(withLocale('/', locale))} aria-label={homePages[locale].name}>
            <img src={assetPath('/logo.png')} alt="" />
            <span>{homePages[locale].name}</span>
          </a>
          <Button
            aria-label={locale === 'zh' ? '关闭导航菜单' : 'Close navigation menu'}
            className="mobile-menu-button"
            icon={<MenuOutlined />}
            type="text"
            onClick={() => setMenuOpen(false)}
          />
        </div>
        <nav className="mobile-nav-links" aria-label="Primary">
          {navItems[locale].map((item) => (
            <a
              key={item.href}
              href={withBasePath(item.href)}
              className={normalizePath(path) === normalizePath(item.href) ? 'active' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mobile-menu-section">
          <span className="mobile-menu-label">{locale === 'zh' ? '语言' : 'Language'}</span>
          <a href={withBasePath(pagePath)} onClick={() => window.localStorage.setItem('ai-clash-site-locale', 'zh')}>
            {localeLabels.zh}
          </a>
          <a
            href={withBasePath(withLocale(pagePath, 'en'))}
            onClick={() => window.localStorage.setItem('ai-clash-site-locale', 'en')}
          >
            {localeLabels.en}
          </a>
        </div>
        <a
          className="mobile-github-link"
          href={accountHref}
          onClick={(event) => {
            setMenuOpen(false)
            if (isSignedIn) return
            event.preventDefault()
            onLoginRequired?.()
          }}
        >
          <UserOutlined />
          {accountLabels[locale]}
        </a>
        <a
          className="mobile-github-link"
          href="https://github.com/null-object-0000/ai-clash"
          onClick={() => setMenuOpen(false)}
        >
          <GithubOutlined />
          GitHub
        </a>
      </Drawer> : null}
    </AntHeader>
  )
}
