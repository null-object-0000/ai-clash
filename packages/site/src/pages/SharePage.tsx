import { useEffect, useMemo, useState } from 'react'
import { Button, Result, Spin, Tag } from 'antd'
import { ChromeOutlined, DownloadOutlined, ShareAltOutlined } from '@ant-design/icons'
import XMarkdown from '@ant-design/x-markdown'
import type { Locale } from '../content'
import { downloads } from '../content'
import { API_BASE_URL } from '../app/api'
import { trackSiteEvent } from '../app/analytics'
import { withBasePath, withLocale } from '../app/paths'

type ProviderStats = {
  ttff: number
  totalTime: number
  charCount: number
  charsPerSec: number
}

type ShareSnapshot = {
  schemaVersion: 1
  title?: string
  question: string
  createdAt: number
  locale: 'zh' | 'en'
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
  | { status: 'loading'; snapshot?: ShareSnapshot }
  | { status: 'loaded'; snapshot: ShareSnapshot }
  | { status: 'error'; error: string }

const labels = {
  zh: {
    loading: '正在打开分享',
    missingTitle: '分享不存在或已取消',
    missingDesc: '这条分享链接可能已经取消、过期，或者链接地址不完整。',
    backHome: '返回首页',
    question: '问题',
    summary: '归纳总结',
    providerAnswers: '多模型回答',
    thinking: '思考过程',
    stats: '统计',
    growthTitle: '用 AI 对撞机生成你自己的多模型对比',
    growthDesc: '安装浏览器插件后，一次提问即可同时唤起多个 AI 通道，并生成可分享的对比结果。',
    chrome: 'Chrome 商店安装',
    edge: 'Edge 商店安装',
    offline: '离线 ZIP 安装',
    upcoming: '官网在线多模型对话正在准备中，当前推荐先安装插件使用。',
  },
  en: {
    loading: 'Opening share',
    missingTitle: 'Share not found',
    missingDesc: 'This share may have been removed, expired, or the link is incomplete.',
    backHome: 'Back home',
    question: 'Question',
    summary: 'Summary',
    providerAnswers: 'Model answers',
    thinking: 'Reasoning',
    stats: 'Stats',
    growthTitle: 'Create your own multi-model comparison with AI Clash',
    growthDesc: 'Install the browser extension to ask once, compare multiple AI channels, and share the result.',
    chrome: 'Install from Chrome',
    edge: 'Install from Edge',
    offline: 'Offline ZIP',
    upcoming: 'Web multi-model chat is being prepared. For now, install the extension first.',
  },
} satisfies Record<Locale, Record<string, string>>

function formatStats(stats?: ProviderStats | null) {
  if (!stats) return ''
  return `${Math.round(stats.totalTime)}ms · ${stats.charCount} chars · ${stats.charsPerSec.toFixed(1)} chars/s`
}

function markdown(content = '') {
  return <XMarkdown className="x-markdown-light" content={content} />
}

export function SharePage({ locale, shareId }: { locale: Locale; shareId?: string }) {
  const text = labels[locale]
  const [state, setState] = useState<LoadState>(() => (
    shareId ? { status: 'loading' } : { status: 'error', error: 'missing share id' }
  ))

  useEffect(() => {
    trackSiteEvent('share_page_viewed', { has_id: Boolean(shareId) }, shareId ? `/share/${shareId}` : '/share')
  }, [shareId])

  useEffect(() => {
    if (!shareId) {
      setState({ status: 'error', error: 'missing share id' })
      return
    }

    let ignore = false
    setState({ status: 'loading' })

    fetch(`${API_BASE_URL}/api/shares/${encodeURIComponent(shareId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null) as { snapshot?: ShareSnapshot; error?: string } | null
        if (!res.ok || !data?.snapshot) throw new Error(data?.error || `HTTP ${res.status}`)
        return data.snapshot
      })
      .then((snapshot) => {
        if (!ignore) setState({ status: 'loaded', snapshot })
      })
      .catch((error) => {
        if (!ignore) {
          trackSiteEvent('share_load_failed', { reason: error instanceof Error ? error.message.slice(0, 80) : 'unknown' }, `/share/${shareId}`)
          setState({ status: 'error', error: error instanceof Error ? error.message : 'failed' })
        }
      })

    return () => {
      ignore = true
    }
  }, [shareId])

  const installHref = useMemo(() => withLocale('/download', locale), [locale])
  const download = downloads[locale]

  if (state.status === 'loading') {
    return (
      <main className="share-page share-page--center">
        <Spin size="large" />
        <p>{text.loading}</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="share-page share-page--center">
        <Result
          status="404"
          title={text.missingTitle}
          subTitle={text.missingDesc}
          extra={<Button href={withBasePath(withLocale('/', locale))}>{text.backHome}</Button>}
        />
      </main>
    )
  }

  const snapshot = state.snapshot

  return (
    <main className="share-page">
      <section className="share-hero">
        <div>
          <Tag icon={<ShareAltOutlined />} color="blue">AI Clash Share</Tag>
          <h1>{snapshot.title || snapshot.question.slice(0, 56)}</h1>
          <p>{new Date(snapshot.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN')}</p>
        </div>
        <Button type="primary" href={withBasePath(installHref)} onClick={() => trackSiteEvent('install_cta_clicked', { source: 'share_hero' })}>
          {text.chrome}
        </Button>
      </section>

      <section className="share-section">
        <h2>{text.question}</h2>
        <div className="share-question">{snapshot.question}</div>
      </section>

      {snapshot.summary ? (
        <section className="share-section share-summary">
          <h2>{text.summary}</h2>
          {snapshot.summary.analysisResponse ? (
            <details>
              <summary>{text.thinking}</summary>
              {markdown(snapshot.summary.analysisResponse)}
            </details>
          ) : null}
          {markdown(snapshot.summary.response)}
          {formatStats(snapshot.summary.stats) ? <p className="share-stats">{formatStats(snapshot.summary.stats)}</p> : null}
        </section>
      ) : null}

      <section className="share-section">
        <h2>{text.providerAnswers}</h2>
        <div className="share-provider-list">
          {snapshot.providers.map((provider) => (
            <article className="share-provider" key={provider.providerId}>
              <header>
                <strong>{provider.providerName}</strong>
                <Tag color={provider.status === 'error' ? 'red' : 'green'}>{provider.status}</Tag>
              </header>
              {provider.thinkResponse ? (
                <details>
                  <summary>{text.thinking}</summary>
                  {markdown(provider.thinkResponse)}
                </details>
              ) : null}
              {markdown(provider.response)}
              {formatStats(provider.stats) ? <p className="share-stats">{formatStats(provider.stats)}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="share-growth">
        <h2>{text.growthTitle}</h2>
        <p>{text.growthDesc}</p>
        <p className="share-upcoming">{text.upcoming}</p>
        <div className="share-actions">
          <Button
            type="primary"
            icon={<ChromeOutlined />}
            href="https://chromewebstore.google.com/detail/ggngmgpjdklmkpoldbfahmeefpnfhhai"
            onClick={() => trackSiteEvent('install_cta_clicked', { source: 'share_bottom', channel: 'chrome' })}
          >
            {text.chrome}
          </Button>
          <Button
            href="https://microsoftedge.microsoft.com/addons/detail/khjmihaeihajagobgbdhlbjeobdpmfkm"
            onClick={() => trackSiteEvent('install_cta_clicked', { source: 'share_bottom', channel: 'edge' })}
          >
            {text.edge}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            href={withBasePath(download.releaseHref)}
            onClick={() => trackSiteEvent('install_cta_clicked', { source: 'share_bottom', channel: 'offline' })}
          >
            {text.offline}
          </Button>
        </div>
      </section>
    </main>
  )
}
