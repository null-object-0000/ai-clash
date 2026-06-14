import { useState } from 'react'
import {
  DownOutlined,
  GithubOutlined,
  GlobalOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { Button, Drawer, Dropdown, Layout } from 'antd'
import type { MenuProps } from 'antd'
import { homePages, navItems } from '../content'
import type { Locale } from '../content'
import type { ThemeMode } from '../app/theme'
import { assetPath, normalizePath, stripLocale, withBasePath, withLocale } from '../app/paths'

const { Header: AntHeader } = Layout

const localeLabels: Record<Locale, string> = {
  zh: '简体中文',
  en: 'English',
}

export function Header({
  locale,
  path,
  themeMode,
  onToggleTheme,
  onLoginRequired,
  appMode = false,
}: {
  locale: Locale
  path: string
  themeMode: ThemeMode
  onToggleTheme: () => void
  onLoginRequired?: () => void
  appMode?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pagePath = stripLocale(path)
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
              aria-label={locale === 'en' ? 'Open navigation menu' : '打开导航菜单'}
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
            aria-label={locale === 'en' ? 'Close navigation menu' : '关闭导航菜单'}
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
          <span className="mobile-menu-label">{locale === 'en' ? 'Language' : '语言'}</span>
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
