import { useCallback, useEffect, useState } from 'react'
import { Button, Result, Spin } from 'antd'
import { ChromeOutlined, DownloadOutlined, MergeCellsOutlined, RightOutlined } from '@ant-design/icons'
import { Bubble } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { DeepSeek, Doubao, Qwen, Yuanbao, XiaomiMiMo, Wenxin } from '@lobehub/icons'
import type { ComponentType, CSSProperties, ReactNode } from 'react'
import type { Locale } from '../content'
import { downloads } from '../content'
import { shareLabelsZh } from '../content/source'
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

type AiIcon = ComponentType<{ size?: number | string; className?: string; style?: CSSProperties }>

const labels = {
  zh: shareLabelsZh,
  en: {
    loading: 'Opening share',
    missingTitle: 'Share not found',
    missingDesc: 'This share may have been removed, expired, or the link is incomplete.',
    backHome: 'Back home',
    question: 'Question',
    summary: 'Summary',
    providerAnswers: 'Model answers',
    thinking: 'Reasoning',
    thinkingDone: 'Reasoning complete',
    summaryAnalysisDone: 'Summary analysis complete',
    stats: 'Stats',
    growthTitle: 'Create your own multi-model comparison with AI Clash',
    growthDesc: 'Install the browser extension to ask once, compare multiple AI channels, and share the result.',
    chrome: 'Install from Chrome',
    edge: 'Install from Edge',
    offline: 'Offline ZIP',
    upcoming: 'Web multi-model chat is being prepared. For now, install the extension first.',
  },
} satisfies Record<Locale, Record<string, string>>

const chromeStoreUrl = 'https://chromewebstore.google.com/detail/ggngmgpjdklmkpoldbfahmeefpnfhhai'
const edgeStoreUrl = 'https://microsoftedge.microsoft.com/addons/detail/khjmihaeihajagobgbdhlbjeobdpmfkm'
const summarySectionTitleMap: Record<string, string> = {
  核心共识: '核心共识',
  觀點對撞: '观点对撞',
  观点对撞: '观点对撞',
  裁判取舍: '裁判取舍',
  裁判取捨: '裁判取舍',
  'Core Consensus': 'Core Consensus',
  'Clash Points': 'Clash Points',
  "Judge's Take": "Judge's Take",
}

const providerIcons: Record<string, AiIcon> = {
  deepseek: DeepSeek.Color as AiIcon,
  doubao: Doubao.Color as AiIcon,
  qianwen: Qwen.Color as AiIcon,
  qwen: Qwen.Color as AiIcon,
  yuanbao: Yuanbao.Color as AiIcon,
  wenxin: Wenxin.Color as AiIcon,
  xiaomi: XiaomiMiMo as AiIcon,
  summary: MergeCellsOutlined as unknown as AiIcon,
}

function formatStats(stats?: ProviderStats | null) {
  if (!stats) return ''
  return `${Math.round(stats.totalTime)}ms · ${stats.charCount} chars · ${stats.charsPerSec.toFixed(1)} chars/s`
}

function markdown(content = '') {
  return <XMarkdown className="x-markdown-light" content={content} />
}

function stripSummaryFinalTitle(content = '') {
  return content.replace(/^\s{0,3}#{1,6}\s*(终极建议|最终建议|最终结论|建议|終極建議|最終建議|最終結論|建議)\s*\n+/, '').trimStart()
}

function splitSummaryAnalysis(content = '') {
  const sections = content
    .split(/(?=^#{1,6}\s+)/m)
    .map((part) => {
      const match = part.match(/^#{1,6}\s+(.+?)\s*\n([\s\S]*)$/)
      if (!match) return null
      const title = summarySectionTitleMap[match[1].trim()]
      if (!title) return null
      return { title, content: match[2].trim() }
    })
    .filter((section): section is { title: string; content: string } => Boolean(section?.content))

  return sections
}

function ProviderHeader({
  providerId,
  label,
  stats,
  status,
  collapsed,
  onClick,
}: {
  providerId: string
  label: string
  stats?: ProviderStats | null
  status?: string
  collapsed?: boolean
  onClick?: () => void
}) {
  const Icon = providerIcons[providerId] || providerIcons.summary
  return (
    <button
      type="button"
      className={`share-bubble-header${collapsed ? ' is-collapsed' : ''}`}
      onClick={onClick}
      aria-expanded={!collapsed}
    >
      <span className="share-bubble-header__chevron" aria-hidden="true">
        <RightOutlined />
      </span>
      <div className="share-bubble-header__content">
        {Icon ? <Icon size={16} /> : null}
        <span className="share-bubble-header__name">{label}</span>
        {stats ? <span className="share-bubble-header__meta">{formatStats(stats)}</span> : null}
        {!stats && status ? <span className="share-bubble-header__meta">{status}</span> : null}
      </div>
    </button>
  )
}

function CollapsibleContent({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <details className="share-think">
      <summary>{title}</summary>
      <div className="share-think__content">{children}</div>
    </details>
  )
}

function AnswerContent({
  response,
  thinkResponse,
  thinkingTitle,
}: {
  response: string
  thinkResponse?: string
  thinkingTitle: string
}) {
  return (
    <>
      {thinkResponse ? (
        <CollapsibleContent title={thinkingTitle}>
          {markdown(thinkResponse)}
        </CollapsibleContent>
      ) : null}
      {markdown(response)}
    </>
  )
}

function SummaryContent({
  summary,
  thinkingTitle,
  analysisTitle,
}: {
  summary: NonNullable<ShareSnapshot['summary']>
  thinkingTitle: string
  analysisTitle: string
}) {
  const analysisSections = splitSummaryAnalysis(summary.analysisResponse)
  return (
    <>
      {summary.thinkResponse ? (
        <CollapsibleContent title={thinkingTitle}>
          {markdown(summary.thinkResponse)}
        </CollapsibleContent>
      ) : null}
      {analysisSections.length ? (
        analysisSections.map((section) => (
          <CollapsibleContent key={section.title} title={section.title}>
            {markdown(section.content)}
          </CollapsibleContent>
        ))
      ) : summary.analysisResponse ? (
        <CollapsibleContent title={analysisTitle}>
          {markdown(summary.analysisResponse)}
        </CollapsibleContent>
      ) : null}
      {markdown(stripSummaryFinalTitle(summary.response))}
    </>
  )
}

export function SharePage({ locale, shareId }: { locale: Locale; shareId?: string }) {
  const text = labels[locale]
  const [state, setState] = useState<LoadState>(() => (
    shareId ? { status: 'loading' } : { status: 'error', error: 'missing share id' }
  ))
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({})

  const toggleCollapsed = useCallback((key: string) => {
    setCollapsedMap((current) => ({ ...current, [key]: !current[key] }))
  }, [])

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
        if (!ignore) {
          trackSiteEvent('share_loaded', {
            provider_count: snapshot.providers.length,
            has_summary: Boolean(snapshot.summary),
          }, `/share/${shareId}`)
          setCollapsedMap({
            ...Object.fromEntries(snapshot.providers.map((provider) => [`provider-${provider.providerId}`, true])),
            ...(snapshot.summary ? { summary: false } : {}),
          })
          setState({ status: 'loaded', snapshot })
        }
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
  const conversationItems = [
    {
      key: 'question',
      role: 'user',
      className: 'share-bubble-user',
      placement: 'end' as const,
      variant: 'filled' as const,
      content: snapshot.question,
    },
    ...snapshot.providers.map((provider) => {
      const key = `provider-${provider.providerId}`
      const collapsed = collapsedMap[key] ?? true
      return {
        key,
        role: 'assistant',
        className: `share-bubble-assistant${collapsed ? ' share-bubble-assistant--collapsed' : ''}`,
        placement: 'start' as const,
        variant: 'filled' as const,
        content: provider.response,
        header: (
          <ProviderHeader
            providerId={provider.providerId}
            label={provider.providerName}
            stats={provider.stats}
            status={provider.status}
            collapsed={collapsed}
            onClick={() => toggleCollapsed(key)}
          />
        ),
        contentRender: () => collapsed ? null : (
          <AnswerContent
            response={provider.response}
            thinkResponse={provider.thinkResponse}
            thinkingTitle={text.thinkingDone}
          />
        ),
      }
    }),
    ...(snapshot.summary ? (() => {
      const collapsed = collapsedMap.summary ?? false
      return [{
        key: 'summary',
        role: 'assistant',
        className: `share-bubble-assistant${collapsed ? ' share-bubble-assistant--collapsed' : ''}`,
        placement: 'start' as const,
        variant: 'filled' as const,
        content: snapshot.summary.response,
        header: (
          <ProviderHeader
            providerId="summary"
            label={text.summary}
            stats={snapshot.summary.stats}
            status="completed"
            collapsed={collapsed}
            onClick={() => toggleCollapsed('summary')}
          />
        ),
        contentRender: () => collapsed ? null : (
          <SummaryContent
            summary={snapshot.summary!}
            thinkingTitle={text.thinkingDone}
            analysisTitle={text.summaryAnalysisDone}
          />
        ),
      }]
    })() : []),
  ]

  return (
    <main className="share-page">
      <section className="share-conversation" aria-label={text.providerAnswers}>
        <Bubble.List
          className="share-bubble-list"
          items={conversationItems}
          role={{
            user: {
              placement: 'end',
              variant: 'filled',
            },
            assistant: {
              placement: 'start',
              variant: 'filled',
            },
          }}
        />
      </section>

      <section className="share-growth">
        <h2>{text.growthTitle}</h2>
        <p>{text.growthDesc}</p>
        <p className="share-upcoming">{text.upcoming}</p>
        <div className="share-actions">
          <Button
            type="primary"
            icon={<ChromeOutlined />}
            href={chromeStoreUrl}
            onClick={() => trackSiteEvent('install_cta_clicked', { source: 'share_bottom', channel: 'chrome' })}
          >
            {text.chrome}
          </Button>
          <Button
            href={edgeStoreUrl}
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
