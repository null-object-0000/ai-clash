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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')

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

const sharedMessages = {
  zh: [
    {
      key: 'user-1',
      role: 'user',
      question: '我想去洗车，汽车店距离我家 50 米，你说我应该开车去还是走过去？',
    },
    {
      key: 'deepseek-1',
      role: 'assistant',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      thinkResponse:
        '用户问的是一个带有轻微反直觉和幽默感的问题。关键不是交通效率，而是洗车场景本身：如果车需要洗，就应该把车开到店里；如果只是人去咨询，走过去即可。',
      response:
        '建议你**开车去**。\n\n原因很简单：你去的是洗车店，真正需要到店的是车，不是你本人。虽然距离只有 50 米，走过去更省事，但车留在家里就没法洗。\n\n如果你只是先去问价格或排队情况，那可以走过去；如果已经决定洗车，就直接开过去。',
      stats: { ttff: 900, totalTime: 8200, charCount: 168, charsPerSec: 20 },
    },
    {
      key: 'doubao-1',
      role: 'assistant',
      providerId: 'doubao',
      providerName: '豆包',
      response:
        '如果目的是洗车，那就开车去。50 米确实很近，但洗车服务需要车辆到场。\n\n更实际的做法是：先看店里是否排队。如果不排队，开车过去；如果排队很久，你可以先走过去确认时间，再回来开车。',
      stats: { ttff: 1200, totalTime: 6900, charCount: 132, charsPerSec: 19 },
    },
    {
      key: 'qianwen-1',
      role: 'assistant',
      providerId: 'qianwen',
      providerName: '通义千问',
      thinkResponse:
        '需要区分“去洗车”和“去洗车店”这两个动作。回答要短，避免过度展开。',
      response:
        '开车去。\n\n因为你的目标是让汽车被清洗，而不是单纯抵达汽车店。50 米距离很短，但车必须到店才能完成洗车。',
      stats: { ttff: 700, totalTime: 5100, charCount: 78, charsPerSec: 15 },
    },
    {
      key: 'summary-1',
      role: 'assistant',
      providerId: 'summary',
      providerName: '归纳总结',
      thinkResponse: '先提炼共识，再指出条件分支，最后给出一句明确建议。',
      analysisResponse:
        '### 核心共识\n\n三家模型都认为：如果目标是洗车，车必须到店。\n\n### 观点对撞\n\nDeepSeek 更强调问题里的反差；豆包补充了排队确认的现实流程；通义千问给出最短路径判断。\n\n### 裁判取舍\n\n最有用的答案应该同时保留明确结论和一个现实例外。',
      response:
        '## 终极建议\n\n**开车去。**\n\n虽然只有 50 米，但你要洗的是车，车不到店就无法完成服务。只有一种例外：如果你只是想先问价格、确认是否排队，可以先走过去问清楚，再回来开车。',
      stats: { ttff: 1600, totalTime: 10300, charCount: 196, charsPerSec: 19 },
    },
  ],
  en: [
    {
      key: 'user-1',
      role: 'user',
      question: 'I want to get my car washed. The car wash is 50 meters from my home. Should I drive or walk there?',
    },
    {
      key: 'deepseek-1',
      role: 'assistant',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      thinkResponse:
        'The question has a small counterintuitive twist. The key is not travel efficiency, but the car wash scenario: if the car needs washing, the car must go to the shop.',
      response:
        'You should **drive there**.\n\nThe reason is simple: you are going to a car wash, and the thing that needs to arrive is the car, not just you. Although 50 meters is close enough to walk, the car cannot be washed if it stays at home.\n\nIf you only want to ask about prices or wait times, walking over first is fine. If you have already decided to wash the car, drive it there.',
      stats: { ttff: 900, totalTime: 8200, charCount: 372, charsPerSec: 45 },
    },
    {
      key: 'doubao-1',
      role: 'assistant',
      providerId: 'doubao',
      providerName: 'Doubao',
      response:
        'If the goal is to wash the car, drive there. Fifty meters is very close, but the service requires the vehicle to be present.\n\nA practical approach is to check whether there is a queue first. If there is no line, drive over. If the wait is long, you can walk over to confirm the timing and then come back for the car.',
      stats: { ttff: 1200, totalTime: 6900, charCount: 318, charsPerSec: 46 },
    },
    {
      key: 'qianwen-1',
      role: 'assistant',
      providerId: 'qianwen',
      providerName: 'Qwen',
      thinkResponse:
        'The answer should distinguish between "going to the car wash" and "getting the car washed", and stay concise.',
      response:
        'Drive there.\n\nYour goal is to have the car cleaned, not merely to reach the shop yourself. The distance is short, but the car has to be at the shop for the wash to happen.',
      stats: { ttff: 700, totalTime: 5100, charCount: 168, charsPerSec: 33 },
    },
    {
      key: 'summary-1',
      role: 'assistant',
      providerId: 'summary',
      providerName: 'Summary',
      thinkResponse: 'Extract the shared conclusion, note the exception, then give a clear recommendation.',
      analysisResponse:
        "### Shared Conclusion\n\nAll three models agree: if the goal is to get the car washed, the car must be at the shop.\n\n### Different Viewpoints\n\nDeepSeek emphasizes the twist in the question; Doubao adds a practical queue-checking flow; Qwen gives the shortest direct judgment.\n\n### Judge's Choice\n\nThe most useful answer keeps the clear conclusion while preserving the realistic exception.",
      response:
        '## Final Advice\n\n**Drive there.**\n\nEven though it is only 50 meters away, the thing being washed is the car, so the car must arrive at the shop. The only exception is if you merely want to ask about prices or check the queue first; in that case, walking over before driving is reasonable.',
      stats: { ttff: 1600, totalTime: 10300, charCount: 286, charsPerSec: 28 },
    },
  ],
} satisfies Record<Locale, ShareMessage[]>

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
  const [loadState, setLoadState] = useState<LoadState>(() => ({ status: shareId ? 'loading' : 'idle', messages: sharedMessages[locale] }))
  const markdownClassName = themeMode === 'dark' ? 'x-markdown-dark' : 'x-markdown-light'
  const labels = shareLabels[locale]
  const messages = loadState.messages

  useEffect(() => {
    if (!shareId) {
      setLoadState({ status: 'idle', messages: sharedMessages[locale] })
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
