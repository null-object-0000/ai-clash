import {
  CopyOutlined,
  MergeCellsOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { Bubble, Think } from '@ant-design/x'
import type { BubbleListProps } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { App as AntApp, Flex } from 'antd'
import { DeepSeek, Doubao, Qwen } from '@lobehub/icons'
import { useMemo, useState } from 'react'
import '@ant-design/x-markdown/themes/dark.css'
import '@ant-design/x-markdown/themes/light.css'

type ProviderId = 'deepseek' | 'doubao' | 'qianwen' | 'summary'

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

const providerIcons = {
  deepseek: DeepSeek.Color,
  doubao: Doubao.Color,
  qianwen: Qwen.Color,
  summary: MergeCellsOutlined,
}

const providerNames = {
  deepseek: 'DeepSeek',
  doubao: '豆包',
  qianwen: '通义千问',
  summary: '归纳总结',
}

const sharedMessages: ShareMessage[] = [
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
]

function formatStats(stats?: ProviderStats) {
  if (!stats) return ''
  return `首字 ${(stats.ttff / 1000).toFixed(1)}s · 总耗时 ${(stats.totalTime / 1000).toFixed(1)}s · ${stats.charCount.toLocaleString('zh-CN')}字 · ${stats.charsPerSec}字/s`
}

function renderMarkdown(content: unknown) {
  if (typeof content !== 'string') return null
  return <XMarkdown className="x-markdown-light" content={content} />
}

function ProviderHeader({
  providerId,
  stats,
  collapsed,
  onToggle,
}: {
  providerId: ProviderId
  stats?: ProviderStats
  collapsed: boolean
  onToggle: () => void
}) {
  const Icon = providerIcons[providerId]

  return (
    <button className="share-provider-header" type="button" onClick={onToggle}>
      <span className={`share-provider-header__arrow ${collapsed ? 'is-collapsed' : ''}`}>
        <RightOutlined />
      </span>
      <div className="share-provider-header__content">
        <Icon className="share-provider-header__icon" />
        <span className="share-provider-header__name">{providerNames[providerId]}</span>
        {stats ? <span className="share-provider-header__status">{formatStats(stats)}</span> : null}
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
}: {
  messageKey: string
  think?: string
  analysis?: string
  response?: string
  summary?: boolean
  markdownClassName: string
  expandedMap: Record<string, boolean>
  onExpandedChange: (key: string, expanded: boolean) => void
}) {
  const thinkKey = `${messageKey}:think`
  const analysisKey = `${messageKey}:analysis`

  return (
    <>
      {think ? (
        <Think
          title="深度思考完成"
          loading={false}
          expanded={!!expandedMap[thinkKey]}
          onExpand={(expanded) => onExpandedChange(thinkKey, expanded)}
        >
          <XMarkdown className={markdownClassName} content={think} />
        </Think>
      ) : null}
      {analysis ? (
        <Think
          title={summary ? '归纳总结过程完成' : '分析完成'}
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

const role: BubbleListProps['role'] = {
  assistant: {
    placement: 'start',
    contentRender: renderMarkdown,
  },
  user: { placement: 'end' },
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

export function SharePage({ themeMode }: { themeMode: 'light' | 'dark' }) {
  const { message } = AntApp.useApp()
  const [collapseMap, setCollapseMap] = useState<Record<string, boolean>>({})
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const markdownClassName = themeMode === 'dark' ? 'x-markdown-dark' : 'x-markdown-light'

  const toggleCollapse = (key: string) => {
    setCollapseMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const setExpanded = (key: string, expanded: boolean) => {
    setExpandedMap((prev) => ({ ...prev, [key]: expanded }))
  }

  const copySummary = async () => {
    const summary = sharedMessages.find((item) => item.providerId === 'summary')?.response ?? ''
    const copied = await writeClipboard(summary)
    if (copied) {
      message.success('总结内容已复制到剪贴板')
    } else {
      message.info('当前浏览器限制剪贴板访问，请手动选择总结内容复制')
    }
  }

  const items: BubbleListProps['items'] = useMemo(() => {
    return sharedMessages.map((item) => {
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
            stats={item.stats}
            collapsed={collapsed}
            onToggle={() => toggleCollapse(item.key)}
          />
        ) : null,
        contentRender: collapsed
          ? () => null
          : () => (
              <ThinkAndMarkdown
                messageKey={item.key}
                think={item.thinkResponse}
                analysis={item.analysisResponse}
                response={item.response}
                summary={item.providerId === 'summary'}
                markdownClassName={markdownClassName}
                expandedMap={expandedMap}
                onExpandedChange={setExpanded}
              />
            ),
        footer:
          item.providerId === 'summary' && !collapsed ? (
            <Flex gap={8} align="center">
              <button className="share-floating-btn-text" type="button" onClick={copySummary}>
                <CopyOutlined />
                复制总结
              </button>
            </Flex>
          ) : undefined,
      }
    })
  }, [collapseMap, expandedMap, markdownClassName, message])

  return (
    <main className="share-page">
      <section className="share-panel" aria-label="AI 对撞机会话分享">
        <div className="share-chat-list">
          <Bubble.List items={items} role={role} style={{ paddingInline: 16 }} />
        </div>

      </section>
    </main>
  )
}
