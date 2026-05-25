import { useEffect, useState } from 'react'
import type { Locale } from '../content'
import { API_BASE_URL } from '../app/api'
import type { SiteAuth } from '../app/auth'
import { ChatPage, type ChatSession, type ProviderStats } from './ChatPage'

type ShareSnapshot = {
  schemaVersion: 1
  title?: string
  question: string
  createdAt: number
  locale: Locale
  providers: Array<{
    providerId: string
    providerName: string
    status: 'completed' | 'error'
    response: string
    thinkResponse?: string
    stats?: ProviderStats | null
  }>
  summary?: {
    response: string
    thinkResponse?: string
    analysisResponse?: string
    stats?: ProviderStats | null
  }
}

type LoadState =
  | { status: 'loading'; session?: ChatSession }
  | { status: 'loaded'; session: ChatSession }
  | { status: 'error'; session?: ChatSession; error: string }

const shareLabels = {
  zh: {
    loadingTitle: '正在打开分享',
    loadingDescription: '正在读取这次 AI 对撞记录。',
    notFoundTitle: '分享不存在或已取消',
    notFoundDescription: '这条分享链接可能已经被取消、过期，或者链接地址不完整。',
    backHome: '返回首页',
    fallbackError: '分享内容加载失败',
    summaryName: '归纳总结',
  },
  en: {
    loadingTitle: 'Opening Share',
    loadingDescription: 'Loading this AI Clash conversation.',
    notFoundTitle: 'Share Not Found',
    notFoundDescription: 'This share may have been removed, expired, or the link is incomplete.',
    backHome: 'Back Home',
    fallbackError: 'Failed to load shared conversation',
    summaryName: 'Summary',
  },
} satisfies Record<Locale, Record<string, string>>

function snapshotToSession(snapshot: ShareSnapshot, locale: Locale): ChatSession {
  const messages: ChatSession['messages'] = [
    {
      key: 'share:user:1',
      role: 'user',
      content: snapshot.question,
    },
  ]

  snapshot.providers.forEach((provider, index) => {
    messages.push({
      key: `share:${provider.providerId}:${index}`,
      role: 'assistant',
      providerId: provider.providerId,
      providerName: provider.providerName,
      content: provider.response,
      thinkResponse: provider.thinkResponse,
      stats: provider.stats ?? undefined,
    })
  })

  if (snapshot.summary) {
    messages.push({
      key: 'share:summary',
      role: 'assistant',
      providerId: 'summary',
      providerName: shareLabels[locale].summaryName,
      content: snapshot.summary.response,
      thinkResponse: snapshot.summary.thinkResponse,
      analysisResponse: snapshot.summary.analysisResponse,
      stats: snapshot.summary.stats ?? undefined,
    })
  }

  return {
    id: `share:${snapshot.createdAt}`,
    title: snapshot.title || snapshot.question.slice(0, 28),
    updatedAt: snapshot.createdAt,
    messages,
  }
}

export function SharePage({ auth, locale, shareId }: { auth: SiteAuth; locale: Locale; themeMode: 'light' | 'dark'; shareId?: string }) {
  const labels = shareLabels[locale]
  const [loadState, setLoadState] = useState<LoadState>(() => (
    shareId ? { status: 'loading' } : { status: 'error', error: 'missing share id' }
  ))

  useEffect(() => {
    if (!shareId) {
      setLoadState({ status: 'error', error: 'missing share id' })
      return
    }

    let ignore = false
    setLoadState((prev) => ({ status: 'loading', session: prev.session }))

    fetch(`${API_BASE_URL}/api/shares/${encodeURIComponent(shareId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null) as { snapshot?: ShareSnapshot; error?: string } | null
        if (!res.ok || !data?.snapshot) {
          throw new Error(data?.error || `HTTP ${res.status}`)
        }
        return data.snapshot
      })
      .then((snapshot) => {
        if (!ignore) setLoadState({ status: 'loaded', session: snapshotToSession(snapshot, locale) })
      })
      .catch((error) => {
        if (!ignore) {
          setLoadState({
            status: 'error',
            error: error instanceof Error ? error.message : labels.fallbackError,
          })
        }
      })

    return () => {
      ignore = true
    }
  }, [labels.fallbackError, locale, shareId])

  return (
    <ChatPage
      auth={auth}
      locale={locale}
      mode="share"
      sharedSession={loadState.session}
      shareNotice={loadState.status === 'loaded' ? undefined : {
        status: loadState.status,
        title: loadState.status === 'loading' ? labels.loadingTitle : labels.notFoundTitle,
        description: loadState.status === 'loading' ? labels.loadingDescription : labels.notFoundDescription,
        actionLabel: labels.backHome,
      }}
    />
  )
}
