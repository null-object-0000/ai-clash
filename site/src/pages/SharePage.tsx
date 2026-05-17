import {
  CopyOutlined,
  HomeOutlined,
  MergeCellsOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { Bubble, Think } from '@ant-design/x'
import type { BubbleListProps } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { App as AntApp, Flex } from 'antd'
import { DeepSeek, Doubao, Qwen } from '@lobehub/icons'
import { useEffect, useMemo, useState, type ComponentType } from 'react'
import type { Locale } from '../content'
import { withLocale } from '../app/paths'
import '@ant-design/x-markdown/themes/dark.css'
import '@ant-design/x-markdown/themes/light.css'

type ProviderId = string

type ProviderStats = {
  ttff: number
  totalTime: number
  charCount: number
  charsPerSec: number
}

type ShareMessage = {
  key: string
  providerId?: ProviderId
  providerName?: string
  question?: string
  response?: string
  thinkResponse?: string
  analysisResponse?: string
  stats?: ProviderStats
  role: 'user' | 'assistant'
}

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

type ShareLabels = {
  ariaLabel: string
  loadingTitle: string
  loadingDescription: string
  notFoundTitle: string
  notFoundDescription: string
  backHome: string
  thinkDone: string
  analysisDone: string
  summaryAnalysisDone: string
  copySummary: string
  copySuccess: string
  copyBlocked: string
  stats: (stats: ProviderStats) => string
}

type SummaryAnalysisSection = {
  key: string
  title: string
  content: string
}

const providerIcons: Record<string, ComponentType<any>> = {
  deepseek: DeepSeek.Color,
  doubao: Doubao.Color,
  qianwen: Qwen.Color,
  summary: MergeCellsOutlined,
}

const providerNames: Record<Locale, Record<string, string>> = {
  zh: {
    deepseek: 'DeepSeek',
    doubao: '豆包',
    qianwen: '通义千问',
    summary: '归纳总结',
  },
  en: {
    deepseek: 'DeepSeek',
    doubao: 'Doubao',
    qianwen: 'Qwen',
    summary: 'Summary',
  },
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://ai-clash-service.snewbie.site').replace(/\/+$/, '')

const shareLabels = {
  zh: {
    ariaLabel: 'AI 对撞机会话分享',
    loadingTitle: '正在打开分享',
    loadingDescription: '正在读取这次 AI 对撞记录。',
    notFoundTitle: '分享不存在或已取消',
    notFoundDescription: '这条分享链接可能已经被取消、过期，或者链接地址不完整。',
    backHome: '返回首页',
    thinkDone: '深度思考完成',
    analysisDone: '分析完成',
    summaryAnalysisDone: '归纳总结过程完成',
    copySummary: '复制总结',
    copySuccess: '总结内容已复制到剪贴板',
    copyBlocked: '当前浏览器限制剪贴板访问，请手动选择总结内容复制',
    stats: (stats) =>
      `首字 ${(stats.ttff / 1000).toFixed(1)}s · 总耗时 ${(stats.totalTime / 1000).toFixed(1)}s · ${stats.charCount.toLocaleString('zh-CN')}字 · ${stats.charsPerSec}字/s`,
  },
  en: {
    ariaLabel: 'AI Clash shared conversation',
    loadingTitle: 'Opening Share',
    loadingDescription: 'Loading this AI Clash conversation.',
    notFoundTitle: 'Share Not Found',
    notFoundDescription: 'This share may have been removed, expired, or the link is incomplete.',
    backHome: 'Back Home',
    thinkDone: 'Reasoning complete',
    analysisDone: 'Analysis complete',
    summaryAnalysisDone: 'Summary process complete',
    copySummary: 'Copy summary',
    copySuccess: 'Summary copied to clipboard',
    copyBlocked: 'Clipboard access is restricted in this browser. Please select and copy the summary manually.',
    stats: (stats) =>
      `TTFT ${(stats.ttff / 1000).toFixed(1)}s · Total ${(stats.totalTime / 1000).toFixed(1)}s · ${stats.charCount.toLocaleString('en-US')} chars · ${stats.charsPerSec} chars/s`,
  },
} satisfies Record<Locale, ShareLabels>

function formatStats(stats: ProviderStats | undefined, locale: Locale) {
  if (!stats) return ''
  return shareLabels[locale].stats(stats)
}

function renderMarkdown(content: unknown) {
  if (typeof content !== 'string') return null
  return <XMarkdown className="x-markdown-light" content={content} />
}

function ProviderHeader({
  providerId,
  providerName,
  stats,
  collapsed,
  onToggle,
  locale,
}: {
  providerId: ProviderId
  providerName?: string
  stats?: ProviderStats
  collapsed: boolean
  onToggle: () => void
  locale: Locale
}) {
  const Icon = providerIcons[providerId] ?? MergeCellsOutlined
  const label = providerName || providerNames[locale][providerId] || providerId

  return (
    <button className="share-provider-header" type="button" onClick={onToggle}>
      <span className={`share-provider-header__arrow ${collapsed ? 'is-collapsed' : ''}`}>
        <RightOutlined />
      </span>
      <div className="share-provider-header__content">
        <Icon className="share-provider-header__icon" />
        <span className="share-provider-header__name">{label}</span>
        {stats ? <span className="share-provider-header__status">{formatStats(stats, locale)}</span> : null}
      </div>
    </button>
  )
}

function ThinkAndMarkdown({
  messageKey,
  think,
  analysis,
  response,
  summary,
  markdownClassName,
  expandedMap,
  onExpandedChange,
  labels,
}: {
  messageKey: string
  think?: string
  analysis?: string
  response?: string
  summary?: boolean
  markdownClassName: string
  expandedMap: Record<string, boolean>
  onExpandedChange: (key: string, expanded: boolean) => void
  labels: ShareLabels
}) {
  const thinkKey = `${messageKey}:think`
  const analysisKey = `${messageKey}:analysis`

  return (
    <>
      {think ? (
        <Think
          title={labels.thinkDone}
          loading={false}
          expanded={!!expandedMap[thinkKey]}
          onExpand={(expanded) => onExpandedChange(thinkKey, expanded)}
        >
          <XMarkdown className={markdownClassName} content={think} />
        </Think>
      ) : null}
      {analysis ? (
        <Think
          title={summary ? labels.summaryAnalysisDone : labels.analysisDone}
          loading={false}
          expanded={!!expandedMap[analysisKey]}
          onExpand={(expanded) => onExpandedChange(analysisKey, expanded)}
        >
          <XMarkdown className={markdownClassName} content={analysis} />
        </Think>
      ) : null}
      {response ? <XMarkdown className={markdownClassName} content={response} /> : null}
    </>
  )
}

const SUMMARY_ANALYSIS_SECTION_TITLES = ['核心共识', '观点对撞', '裁判取舍']
const SUMMARY_ANALYSIS_TITLE_ALIASES: Record<string, string> = {
  综合解析: '裁判取舍',
  综合分析: '裁判取舍',
}

function splitSummaryAnalysisSections(markdown: string): SummaryAnalysisSection[] {
  const headingRe = /^#{1,6}\s*(核心共识|观点对撞|裁判取舍|综合解析|综合分析)\s*$/gm
  const matches = Array.from(markdown.matchAll(headingRe))
  if (!matches.length) return []

  return matches
    .map((match, index) => {
      const title = SUMMARY_ANALYSIS_TITLE_ALIASES[match[1]] ?? match[1]
      const start = (match.index ?? 0) + match[0].length
      const end = matches[index + 1]?.index ?? markdown.length
      return {
        key: title,
        title,
        content: markdown.slice(start, end).trim(),
      }
    })
    .filter((section) => SUMMARY_ANALYSIS_SECTION_TITLES.includes(section.title))
}

function SummaryThinkAndMarkdown({
  messageKey,
  think,
  analysis,
  response,
  markdownClassName,
  expandedMap,
  onExpandedChange,
  labels,
}: {
  messageKey: string
  think?: string
  analysis?: string
  response?: string
  markdownClassName: string
  expandedMap: Record<string, boolean>
  onExpandedChange: (key: string, expanded: boolean) => void
  labels: ShareLabels
}) {
  const thinkKey = `${messageKey}:think`
  const analysisSections = splitSummaryAnalysisSections(typeof analysis === 'string' ? analysis : '')

  return (
    <>
      {think ? (
        <Think
          title={labels.thinkDone}
          loading={false}
          expanded={!!expandedMap[thinkKey]}
          onExpand={(expanded) => onExpandedChange(thinkKey, expanded)}
        >
          <XMarkdown className={markdownClassName} content={think} />
        </Think>
      ) : null}
      {analysisSections.length ? (
        analysisSections.map((section) => {
          const sectionKey = `${messageKey}:analysis:${section.key}`
          return (
            <Think
              key={section.key}
              title={section.title}
              loading={false}
              expanded={!!expandedMap[sectionKey]}
              onExpand={(expanded) => onExpandedChange(sectionKey, expanded)}
            >
              <XMarkdown className={markdownClassName} content={section.content} />
            </Think>
          )
        })
      ) : analysis ? (
        <Think
          title={labels.summaryAnalysisDone}
          loading={false}
          expanded={!!expandedMap[`${messageKey}:analysis`]}
          onExpand={(expanded) => onExpandedChange(`${messageKey}:analysis`, expanded)}
        >
          <XMarkdown className={markdownClassName} content={analysis} />
        </Think>
      ) : null}
      {response ? <XMarkdown className={markdownClassName} content={response} /> : null}
    </>
  )
}

const role: BubbleListProps['role'] = {
  assistant: {
    placement: 'start',
    contentRender: renderMarkdown,
  },
  user: { placement: 'end' },
}

function ShareStateView({
  title,
  description,
  actionLabel,
  locale,
  loading,
}: {
  title: string
  description: string
  actionLabel: string
  locale: Locale
  loading?: boolean
}) {
  return (
    <div className="share-state-view">
      <div className={`share-state-view__mark ${loading ? 'is-loading' : ''}`}>
        {loading ? <MergeCellsOutlined /> : <RightOutlined />}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
      {!loading ? (
        <a className="share-state-view__button" href={withLocale('/', locale)}>
          <HomeOutlined />
          {actionLabel}
        </a>
      ) : null}
    </div>
  )
}

async function writeClipboard(text: string) {
  if (!navigator.clipboard?.writeText) return false

  const timeout = new Promise<false>((resolve) => {
    window.setTimeout(() => resolve(false), 500)
  })
  const write = navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  )

  return Promise.race([write, timeout])
}

function snapshotToMessages(snapshot: ShareSnapshot): ShareMessage[] {
  const messages: ShareMessage[] = [
    {
      key: 'user-1',
      role: 'user',
      question: snapshot.question,
    },
  ]

  snapshot.providers.forEach((provider, index) => {
    messages.push({
      key: `${provider.providerId}-${index}`,
      role: 'assistant',
      providerId: provider.providerId,
      providerName: provider.providerName,
      response: provider.response,
      thinkResponse: provider.thinkResponse,
      stats: provider.stats ?? undefined,
    })
  })

  if (snapshot.summary) {
    messages.push({
      key: 'summary-1',
      role: 'assistant',
      providerId: 'summary',
      providerName: '归纳总结',
      response: snapshot.summary.response,
      thinkResponse: snapshot.summary.thinkResponse,
      analysisResponse: snapshot.summary.analysisResponse,
      stats: snapshot.summary.stats ?? undefined,
    })
  }

  return messages
}

type LoadState =
  | { status: 'idle'; messages: ShareMessage[] }
  | { status: 'loading'; messages: ShareMessage[] }
  | { status: 'loaded'; messages: ShareMessage[] }
  | { status: 'error'; messages: ShareMessage[]; error: string }

export function SharePage({ locale, themeMode, shareId }: { locale: Locale; themeMode: 'light' | 'dark'; shareId?: string }) {
  const { message } = AntApp.useApp()
  const [collapseMap, setCollapseMap] = useState<Record<string, boolean>>({})
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [loadState, setLoadState] = useState<LoadState>(() => ({ status: shareId ? 'loading' : 'error', messages: [], error: 'missing share id' }))
  const markdownClassName = themeMode === 'dark' ? 'x-markdown-dark' : 'x-markdown-light'
  const labels = shareLabels[locale]
  const messages = loadState.messages

  useEffect(() => {
    if (!shareId) {
      setLoadState({ status: 'error', messages: [], error: 'missing share id' })
      return
    }

    let ignore = false
    setLoadState((prev) => ({ status: 'loading', messages: prev.messages }))

    fetch(`${API_BASE_URL}/api/shares/${encodeURIComponent(shareId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null) as { snapshot?: ShareSnapshot; error?: string } | null
        if (!res.ok || !data?.snapshot) {
          throw new Error(data?.error || `HTTP ${res.status}`)
        }
        return data.snapshot
      })
      .then((snapshot) => {
        if (ignore) return
        setLoadState({ status: 'loaded', messages: snapshotToMessages(snapshot) })
      })
      .catch((error) => {
        if (ignore) return
        setLoadState({
          status: 'error',
          messages: [],
          error: error instanceof Error ? error.message : '分享内容加载失败',
        })
      })

    return () => {
      ignore = true
    }
  }, [locale, shareId])

  const toggleCollapse = (key: string) => {
    setCollapseMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const setExpanded = (key: string, expanded: boolean) => {
    setExpandedMap((prev) => ({ ...prev, [key]: expanded }))
  }

  const copySummary = async () => {
    const summary = messages.find((item) => item.providerId === 'summary')?.response ?? ''
    const copied = await writeClipboard(summary)
    if (copied) {
      message.success(labels.copySuccess)
    } else {
      message.info(labels.copyBlocked)
    }
  }

  const items: BubbleListProps['items'] = useMemo(() => {
    return messages.map((item) => {
      if (item.role === 'user') {
        return {
          key: item.key,
          role: 'user',
          content: item.question,
        }
      }

      const collapsed = !!collapseMap[item.key]

      return {
        key: item.key,
        role: 'assistant',
        content: item.response ?? '',
        style: { paddingTop: 0, paddingBottom: 0 },
        className: collapsed ? 'share-bubble-content-hidden' : undefined,
        header: item.providerId ? (
          <ProviderHeader
            providerId={item.providerId}
            providerName={item.providerName}
            stats={item.stats}
            collapsed={collapsed}
            onToggle={() => toggleCollapse(item.key)}
            locale={locale}
          />
        ) : null,
        contentRender: collapsed
          ? () => null
          : item.providerId === 'summary'
            ? () => (
                <SummaryThinkAndMarkdown
                  messageKey={item.key}
                  think={item.thinkResponse}
                  analysis={item.analysisResponse}
                  response={item.response}
                  markdownClassName={markdownClassName}
                  expandedMap={expandedMap}
                  onExpandedChange={setExpanded}
                  labels={labels}
                />
              )
            : () => (
              <ThinkAndMarkdown
                messageKey={item.key}
                think={item.thinkResponse}
                analysis={item.analysisResponse}
                response={item.response}
                markdownClassName={markdownClassName}
                expandedMap={expandedMap}
                onExpandedChange={setExpanded}
                labels={labels}
              />
            ),
        footer:
          item.providerId === 'summary' && !collapsed ? (
            <Flex gap={8} align="center">
              <button className="share-floating-btn-text" type="button" onClick={copySummary}>
                <CopyOutlined />
                {labels.copySummary}
              </button>
            </Flex>
          ) : undefined,
      }
    })
  }, [collapseMap, expandedMap, labels, locale, markdownClassName, messages])

  return (
    <main className="share-page">
      <section className="share-panel" aria-label={labels.ariaLabel}>
        {loadState.status === 'loading' ? (
          <ShareStateView
            title={labels.loadingTitle}
            description={labels.loadingDescription}
            actionLabel={labels.backHome}
            locale={locale}
            loading
          />
        ) : null}
        {loadState.status === 'error' ? (
          <ShareStateView
            title={labels.notFoundTitle}
            description={labels.notFoundDescription}
            actionLabel={labels.backHome}
            locale={locale}
          />
        ) : null}
        {loadState.status !== 'error' ? (
          <div className="share-chat-list">
            <Bubble.List items={items} role={role} style={{ paddingInline: 16 }} />
          </div>
        ) : null}
      </section>
    </main>
  )
}
