import type { Locale } from '../content'

export const basePath = normalizePath(import.meta.env.BASE_URL).replace(/\/$/, '')

export function normalizePath(pathname: string) {
  const withoutTrailingSlash = pathname.replace(/\/+$/, '') || '/'
  return withoutTrailingSlash.replace(/\.html$/, '') || '/'
}

export function stripBasePath(pathname: string) {
  const normalizedPath = normalizePath(pathname)
  if (!basePath) return normalizedPath
  if (normalizedPath === basePath) return '/'
  if (normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath.slice(basePath.length) || '/'
  }
  return normalizedPath
}

export function withBasePath(path: string) {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${basePath}${normalizedPath}` || '/'
}

export function assetPath(path: string) {
  return withBasePath(path)
}

export function getLocale(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh'
}

export function getInitialLocale(pathname: string): Locale {
  if (pathname !== '/') return getLocale(pathname)

  const saved = window.localStorage.getItem('ai-clash-site-locale')
  return saved === 'en' || saved === 'zh' ? saved : 'zh'
}

export function stripLocale(pathname: string) {
  if (pathname === '/en') return '/'
  if (pathname.startsWith('/en/')) return pathname.slice(3) || '/'
  return pathname
}

export function withLocale(path: string, locale: Locale) {
  if (locale === 'zh') return path
  return path === '/' ? '/en/' : `/en${path}`
}
