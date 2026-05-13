import {
  BulbOutlined,
  CommentOutlined,
  CopyOutlined,
  GlobalOutlined,
  MergeCellsOutlined,
  MoonOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  SunOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Bubble, Sender, Think } from '@ant-design/x'
import type { BubbleListProps } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { Button, Flex, Tooltip } from 'antd'
import { DeepSeek, Doubao, Qwen } from '@lobehub/icons'
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
}: {
  providerId: ProviderId
  stats?: ProviderStats
}) {
  const Icon = providerIcons[providerId]

  return (
    <div className="share-provider-header">
      <span className="share-provider-header__arrow">
        <RightOutlined />
      </span>
      <div className="share-provider-header__content">
        <Icon className="share-provider-header__icon" />
        <span className="share-provider-header__name">{providerNames[providerId]}</span>
        {stats ? <span className="share-provider-header__status">{formatStats(stats)}</span> : null}
      </div>
    </div>
  )
}

function ThinkAndMarkdown({
  think,
  analysis,
  response,
  summary,
}: {
  think?: string
  analysis?: string
  response?: string
  summary?: boolean
}) {
  return (
    <>
      {think ? (
        <Think title="深度思考完成" loading={false} expanded={false}>
          <XMarkdown className="x-markdown-light" content={think} />
        </Think>
      ) : null}
      {analysis ? (
        <Think title={summary ? '归纳总结过程完成' : '分析完成'} loading={false} expanded={false}>
          <XMarkdown className="x-markdown-light" content={analysis} />
        </Think>
      ) : null}
      {response ? <XMarkdown className="x-markdown-light" content={response} /> : null}
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

function buildItems(): BubbleListProps['items'] {
  return sharedMessages.map((item) => {
    if (item.role === 'user') {
      return {
        key: item.key,
        role: 'user',
        content: item.question,
      }
    }

    return {
      key: item.key,
      role: 'assistant',
      content: item.response ?? '',
      style: { paddingTop: 0, paddingBottom: 0 },
      header: item.providerId ? <ProviderHeader providerId={item.providerId} stats={item.stats} /> : null,
      contentRender: () => (
        <ThinkAndMarkdown
          think={item.thinkResponse}
          analysis={item.analysisResponse}
          response={item.response}
          summary={item.providerId === 'summary'}
        />
      ),
      footer:
        item.providerId === 'summary' ? (
          <Flex gap={8} align="center">
            <button className="share-floating-btn-text">
              <CopyOutlined />
              复制总结
            </button>
          </Flex>
        ) : undefined,
    }
  })
}

export function SharePage({
  themeMode,
  onToggleTheme,
}: {
  themeMode: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const items = buildItems()

  return (
    <main className="share-page">
      <section className="share-panel" aria-label="AI 对撞机会话分享">
        <div className="share-floating-toolbar">
          <button className="share-floating-btn" title="新对话">
            <PlusOutlined />
          </button>
          <button className="share-floating-btn" title="历史记录">
            <CommentOutlined />
          </button>
          <button className="share-floating-btn" title="全局设置">
            <SettingOutlined />
          </button>
          <button
            className="share-floating-btn"
            title={themeMode === 'dark' ? '切换浅色模式' : '切换深色模式'}
            onClick={onToggleTheme}
          >
            {themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          </button>
        </div>

        <div className="share-chat-list">
          <Bubble.List items={items} role={role} style={{ paddingInline: 16 }} />
        </div>

        <Flex vertical className="share-sender">
          <Flex gap="small" className="share-mode-row">
            <Tooltip title="多通道模型输出完成后自动生成归纳总结，帮助你快速抓住重点">
              <Button size="small" type="primary" icon={<MergeCellsOutlined />} className="share-mode-btn">
                自动总结
              </Button>
            </Tooltip>
            <Tooltip title="自动追踪并切换至正在输出的模型">
              <Button size="small" type="default" icon={<VideoCameraOutlined />} className="share-mode-btn">
                导播模式
              </Button>
            </Tooltip>
          </Flex>
          <Sender
            readOnly
            value=""
            placeholder="输入你的问题，按 Enter 发送"
            autoSize
            suffix={false}
            footer={(_, { components }) => {
              const { SendButton } = components
              return (
                <Flex justify="space-between" align="center">
                  <Flex gap="small" align="center">
                    <Sender.Switch icon={<BulbOutlined />} value>
                      深度思考
                    </Sender.Switch>
                    <Sender.Switch icon={<GlobalOutlined />} value>
                      联网搜索
                    </Sender.Switch>
                  </Flex>
                  <SendButton type="primary" disabled />
                </Flex>
              )
            }}
          />
        </Flex>
      </section>
    </main>
  )
}
