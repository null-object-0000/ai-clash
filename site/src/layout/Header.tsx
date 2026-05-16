import {
  DownOutlined,
  GithubOutlined,
  GlobalOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Layout } from 'antd'
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
}: {
  locale: Locale
  path: string
  themeMode: ThemeMode
  onToggleTheme: () => void
}) {
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
