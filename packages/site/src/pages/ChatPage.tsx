import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react'
import {
  BulbOutlined,
  BorderOutlined,
  CarOutlined,
  CheckSquareOutlined,
  CommentOutlined,
  CopyOutlined,
  DeleteOutlined,
  GlobalOutlined,
  HomeOutlined,
  HeartOutlined,
  MenuFoldOutlined,
  LoginOutlined,
  LogoutOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  SwapOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Bubble, Conversations, Sender, Think, Welcome } from '@ant-design/x'
import type { BubbleListProps, ConversationsProps } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { App as AntApp, Avatar, Button, Drawer, Dropdown, Flex, Modal, Switch, Tag } from 'antd'
import type { MenuProps } from 'antd'
import { DeepSeek, Doubao, Qwen, Yuanbao } from '@lobehub/icons'
import type { Locale } from '../content'
import { API_BASE_URL } from '../app/api'
import { logout, type SiteAuth } from '../app/auth'
import { assetPath, withLocale } from '../app/paths'

export type ProviderStats = {
  ttff: number
  totalTime: number
  charCount: number
  charsPerSec: number
}

export type ChatMessage = {
  key: string
  role: 'user' | 'assistant'
  content: string
  providerId?: string
  providerName?: string
  thinkResponse?: string
  analysisResponse?: string
  stats?: ProviderStats
}

export type ChatSession = {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

type ShareNotice = {
  status: 'loading' | 'error'
  title: string
  description: string
  actionLabel: string
}

type AiModel = {
  id: string
  name: string
  ownedBy?: string
  Icon: ElementType
}

type CompletionMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type SummaryAnalysisSection = {
  key: string
  title: string
  content: string
}

const storageKey = 'ai-clash-site-chat-history'

const labels = {
  zh: {
    newChat: '新对话',
    history: '对话历史',
    emptyHistory: '暂无历史',
    welcomeTitle: '👋 欢迎召唤「AI 对撞机」',
    welcomeDescription: '一次提问，多款满血 AI 同屏对撞，直接拿最优解！',
    inputPlaceholder: '输入你的问题，按 Enter 发送',
    deleteTitle: '删除对话',
    deleteContent: '确定要删除这条对话记录吗？删除后无法恢复。',
    deleteOk: '删除',
    cancel: '取消',
    assistantStub: '官网在线对话工作台已就绪。下一步接入服务端对话接口后，这里会展示多通道回答和归纳总结。',
    thinking: '请求中...',
    modelLoadFailed: '模型列表加载失败，请检查后端 new-api 配置。',
    noChannels: '暂无可用模型',
    noChannelsHint: 'new-api /v1/models 暂未返回模型。',
    requestFailed: '请求失败',
    loginRequired: '请先登录后再发起对话。',
    channels: '通道列表',
    enabled: '已启用',
    deselectAll: '全不选',
    selectAll: '全选',
    invert: '反选',
    options: '运行选项',
    account: '个人空间',
    accountSettings: '账号设置',
    login: '登录',
    loginGithub: 'GitHub 登录',
    loginGoogle: 'Google 登录',
    loginMicrosoft: 'Microsoft 登录',
    checkingSession: '读取登录态',
    logout: '退出登录',
    deepThink: '深度思考',
    webSearch: '联网搜索',
    autoSummary: '自动总结',
    proxyModels: 'API 代理通道',
    proxyHint: '通过你的服务端代理统一转发，不再依赖网页侧登录态。',
    apiMode: 'API',
    openHistory: '打开历史对话',
    prompts: '💡 你可以问我：',
    thinkDone: '深度思考完成',
    analysisDone: '分析完成',
    summaryAnalysisDone: '归纳总结过程完成',
    copySummary: '复制总结',
    copySuccess: '总结内容已复制到剪贴板',
    copyBlocked: '当前浏览器限制剪贴板访问，请手动选择总结内容复制',
    sharedConversation: '分享对话',
    sharedReadonly: '这是一条只读分享。',
    backHome: '返回首页',
  },
  en: {
    newChat: 'New Chat',
    history: 'History',
    emptyHistory: 'No history',
    welcomeTitle: '👋 Welcome to AI Clash',
    welcomeDescription: 'Ask once, compare multiple AI answers, and get the best final take.',
    inputPlaceholder: 'Type your question and press Enter',
    deleteTitle: 'Delete Chat',
    deleteContent: 'Delete this conversation? This cannot be undone.',
    deleteOk: 'Delete',
    cancel: 'Cancel',
    assistantStub: 'The web chat workspace is ready. Once the server-side chat API is connected, multi-channel answers and summaries will appear here.',
    thinking: 'Requesting...',
    modelLoadFailed: 'Failed to load models. Check the backend new-api config.',
    noChannels: 'No models available',
    noChannelsHint: 'new-api /v1/models returned no models.',
    requestFailed: 'Request failed',
    loginRequired: 'Please sign in before chatting.',
    channels: 'Channel List',
    enabled: 'enabled',
    deselectAll: 'Deselect',
    selectAll: 'All',
    invert: 'Invert',
    options: 'Run Options',
    account: 'Workspace',
    accountSettings: 'Account Settings',
    login: 'Sign in',
    loginGithub: 'Sign in with GitHub',
    loginGoogle: 'Sign in with Google',
    loginMicrosoft: 'Sign in with Microsoft',
    checkingSession: 'Checking session',
    logout: 'Log Out',
    deepThink: 'Deep Think',
    webSearch: 'Web Search',
    autoSummary: 'Auto Summary',
    proxyModels: 'API Proxy Channels',
    proxyHint: 'All requests are routed through your server-side proxy instead of browser web sessions.',
    apiMode: 'API',
    openHistory: 'Open history',
    prompts: '💡 Try asking:',
    thinkDone: 'Reasoning complete',
    analysisDone: 'Analysis complete',
    summaryAnalysisDone: 'Summary process complete',
    copySummary: 'Copy summary',
    copySuccess: 'Summary copied to clipboard',
    copyBlocked: 'Clipboard access is restricted in this browser. Please select and copy the summary manually.',
    sharedConversation: 'Shared chat',
    sharedReadonly: 'This is a read-only shared conversation.',
    backHome: 'Back Home',
  },
} satisfies Record<Locale, Record<string, string>>

const promptItems = {
  zh: [
    { icon: <TrophyOutlined style={{ color: '#FAAD14' }} />, text: '2026 美加墨世界杯从热度和实力两个角度盘点，TOP 10 是哪些？' },
    { icon: <CarOutlined style={{ color: '#1890FF' }} />, text: '我想去洗车，汽车店距离我家 50 米，你说我应该开车去还是走过去？' },
    { icon: <HeartOutlined style={{ color: '#FF4D4F' }} />, text: '我姓王，我老婆姓牛，给我儿子起个名字，最好是两个字的。' },
  ],
  en: [
    { icon: <TrophyOutlined />, text: 'Compare answers from multiple AI models and point out the tradeoffs' },
    { icon: <BulbOutlined />, text: 'Analyze an AI product idea from technology, market, and cost angles' },
    { icon: <HeartOutlined />, text: 'Turn several model suggestions into one actionable plan' },
  ],
} satisfies Record<Locale, Array<{ icon: ReactNode; text: string }>>

const SUMMARY_SYSTEM_PROMPT = `# Role
你是「AI 对撞机」的中立裁判，不是独立回答问题的普通助手。你的主要任务是对比多个 AI 模型对同一问题的回答，提炼共识、展示分歧、做出基于回答内容的裁判取舍，最后给用户一份直接可执行的最终建议。

# Principles
1. 对撞优先：必须让用户看清各 AI 回答的共同点、分歧点、隐含假设和遗漏。
2. 只基于材料：只基于用户问题和各模型回答做归纳、比较与取舍；不要引入各模型回答之外的新事实、新方案、新风险或新背景知识。
3. 不拼接原文：不要复述每个模型的长段原文，只保留对对比和最终判断有用的信息。
4. 不制造共识：只有多个回答共同支持，或从回答内容中可以稳定推出的内容，才放入“核心共识”。
5. 可裁判但不扩写：可以指出哪些回答路线更可靠、哪些应降权，但不要扩展成自己的独立解答。
6. 面向行动：最终建议必须可执行，并且能追溯到“核心共识 / 观点对撞 / 裁判取舍”中的依据；如果材料不足以支持确定结论，应说明不足以判断。

# Output Contract
严格使用以下输出结构。分析区必须放入 AI Clash 专用标记内，标记外只输出最终建议正文。
不要使用任何模型原生思考标签。
如果你无法输出专用标记，至少必须保留四个 Markdown 标题：### 核心共识、### 观点对撞、### 裁判取舍、### 最终建议，方便系统兜底解析；正常情况下不要输出“最终建议 / 终极建议”标题。

[[AI_CLASH_SUMMARY_ANALYSIS_BEGIN]]
### 核心共识
提炼各 AI 共同支持的关键事实、约束和稳定判断。不要写最终建议。

### 观点对撞
对比各 AI 的关键分歧、不同路线、隐含假设、适用条件、明显遗漏或风险。如果没有关键分歧，写“无关键分歧”。

### 裁判取舍
基于上面的共识和对撞，说明采纳哪类回答路线、降权哪类回答路线，以及原因。不要提出各 AI 回答之外的新方案。
[[AI_CLASH_SUMMARY_ANALYSIS_END]]

直接给出最终建议正文。不要输出“终极建议”标题，不要客套，不要说“综上”，必要时用步骤、优先级或 If-Then 条件表达。`

function readSessions(): ChatSession[] {
  try {
    const value = window.localStorage.getItem(storageKey)
    if (!value) return []
    const parsed = JSON.parse(value) as ChatSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSessions(sessions: ChatSession[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(sessions.slice(0, 50)))
}

function createSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    title: 'New chat',
    updatedAt: Date.now(),
    messages: [],
  }
}

function renderMarkdown(content: unknown) {
  return <XMarkdown className="x-markdown-light" content={typeof content === 'string' ? content : ''} />
}

function getModelIcon(modelId = '') {
  const value = modelId.toLowerCase()
  if (value.includes('deepseek')) return DeepSeek.Color
  if (value.includes('doubao') || value.includes('volc')) return Doubao.Color
  if (value.includes('qwen') || value.includes('qwq') || value.includes('tongyi') || value.includes('qianwen')) return Qwen.Color
  if (value.includes('hunyuan') || value.includes('yuanbao')) return Yuanbao.Color
  return MergeCellsOutlined
}

function formatStats(stats: ProviderStats | undefined, locale: Locale) {
  if (!stats) return ''
  return locale === 'zh'
    ? `首字 ${(stats.ttff / 1000).toFixed(1)}s · 总耗时 ${(stats.totalTime / 1000).toFixed(1)}s · ${stats.charCount.toLocaleString('zh-CN')}字 · ${stats.charsPerSec}字/s`
    : `TTFT ${(stats.ttff / 1000).toFixed(1)}s · Total ${(stats.totalTime / 1000).toFixed(1)}s · ${stats.charCount.toLocaleString('en-US')} chars · ${stats.charsPerSec} chars/s`
}

function ProviderHeader({
  providerId,
  providerName,
  stats,
  collapsed,
  onToggle,
  locale,
}: {
  providerId?: string
  providerName?: string
  stats?: ProviderStats
  collapsed?: boolean
  onToggle?: () => void
  locale: Locale
}) {
  const Icon = getModelIcon(providerId)
  const content = (
    <>
      <span className={`chat-provider-header__arrow ${collapsed ? 'is-collapsed' : ''}`}>
        <RightOutlined />
      </span>
      <div className="chat-provider-header__content">
        <Icon size={14} />
        <span>{providerName || providerId || 'AI'}</span>
        {stats ? <small className="chat-provider-header__status">{formatStats(stats, locale)}</small> : null}
      </div>
    </>
  )

  if (onToggle) {
    return (
      <button className="chat-provider-header chat-provider-header--button" type="button" onClick={onToggle}>
        {content}
      </button>
    )
  }

  return (
    <div className="chat-provider-header">
      {content}
    </div>
  )
}

function ThinkAndMarkdown({
  message,
  markdownClassName,
  expandedMap,
  onExpandedChange,
  locale,
}: {
  message: ChatMessage
  markdownClassName: string
  expandedMap: Record<string, boolean>
  onExpandedChange: (key: string, expanded: boolean) => void
  locale: Locale
}) {
  const copy = labels[locale]
  const thinkKey = `${message.key}:think`
  const analysisKey = `${message.key}:analysis`
  const isSummary = message.providerId === 'summary'

  return (
    <>
      {message.thinkResponse ? (
        <Think
          title={copy.thinkDone}
          loading={false}
          expanded={!!expandedMap[thinkKey]}
          onExpand={(expanded) => onExpandedChange(thinkKey, expanded)}
        >
          <XMarkdown className={markdownClassName} content={message.thinkResponse} />
        </Think>
      ) : null}
      {message.analysisResponse ? (
        <Think
          title={isSummary ? copy.summaryAnalysisDone : copy.analysisDone}
          loading={false}
          expanded={!!expandedMap[analysisKey]}
          onExpand={(expanded) => onExpandedChange(analysisKey, expanded)}
        >
          <XMarkdown className={markdownClassName} content={message.analysisResponse} />
        </Think>
      ) : null}
      <XMarkdown className={markdownClassName} content={message.content} />
    </>
  )
}

const SUMMARY_ANALYSIS_SECTION_TITLES = ['核心共识', '观点对撞', '裁判取舍']
const SUMMARY_ANALYSIS_TITLE_ALIASES: Record<string, string> = {
  综合解析: '裁判取舍',
  综合分析: '裁判取舍',
}
const SUMMARY_FINAL_SECTION_TITLES = ['最终建议', '终极建议', '最终结论', '建议']
const SUMMARY_MARKER_RE = /\[\[AI_CLASH_SUMMARY_ANALYSIS_BEGIN\]\]([\s\S]*?)\[\[AI_CLASH_SUMMARY_ANALYSIS_END\]\]/
const SUMMARY_MARKER_LINE_RE = /^\s*\[\[AI_CLASH_SUMMARY_ANALYSIS_(?:BEGIN|END)\]\]\s*$/gm

function normalizeSummaryHeading(title: string) {
  return SUMMARY_ANALYSIS_TITLE_ALIASES[title.trim()] || title.trim()
}

function splitSummaryAnalysisSections(markdown: string): SummaryAnalysisSection[] {
  const headingRe = /^#{1,6}\s*(核心共识|观点对撞|裁判取舍|综合解析|综合分析)\s*$/gm
  const matches = Array.from(markdown.matchAll(headingRe))
  if (!matches.length) return []

  return matches
    .map((match) => {
      const title = SUMMARY_ANALYSIS_TITLE_ALIASES[match[1]] ?? match[1]
      const start = (match.index ?? 0) + match[0].length
      const next = matches.find((candidate) => (candidate.index ?? 0) > (match.index ?? 0))
      const end = next?.index ?? markdown.length
      return {
        key: title,
        title,
        content: markdown.slice(start, end).trim(),
      }
    })
    .filter((section) => SUMMARY_ANALYSIS_SECTION_TITLES.includes(section.title) && section.content)
}

function splitSummaryOutputFallback(markdown: string): { analysis: string; final: string } | null {
  const cleaned = markdown.replace(SUMMARY_MARKER_LINE_RE, '').trim()
  const headingRe = /^#{1,6}\s*(核心共识|观点对撞|裁判取舍|综合解析|综合分析|最终建议|终极建议|最终结论|建议)\s*$/gm
  const matches = Array.from(cleaned.matchAll(headingRe))
  if (!matches.length) return null

  const sections = matches.map((match, index) => {
    const contentStart = (match.index ?? 0) + match[0].length
    const nextStart = matches[index + 1]?.index ?? cleaned.length
    return {
      title: normalizeSummaryHeading(match[1]),
      content: cleaned.slice(contentStart, nextStart).trim(),
    }
  })
  const analysisSections = sections.filter((section) => SUMMARY_ANALYSIS_SECTION_TITLES.includes(section.title) && section.content)
  const finalSections = sections.filter((section) => SUMMARY_FINAL_SECTION_TITLES.includes(section.title) && section.content)
  if (!analysisSections.length || !finalSections.length) return null

  return {
    analysis: analysisSections.map((section) => `### ${section.title}\n${section.content}`).join('\n\n'),
    final: finalSections.map((section) => section.content).join('\n\n').trim(),
  }
}

function splitSummaryCompletion(markdown: string): { analysis?: string; final: string } {
  const markerMatch = markdown.match(SUMMARY_MARKER_RE)
  if (markerMatch) {
    const analysis = markerMatch[1].trim()
    const final = markdown.replace(SUMMARY_MARKER_RE, '').trim()
    return { analysis: analysis || undefined, final: final || markdown }
  }

  const fallback = splitSummaryOutputFallback(markdown)
  if (fallback) return { analysis: fallback.analysis, final: fallback.final }
  return { final: markdown }
}

function SummaryThinkAndMarkdown({
  message,
  markdownClassName,
  expandedMap,
  onExpandedChange,
  locale,
}: {
  message: ChatMessage
  markdownClassName: string
  expandedMap: Record<string, boolean>
  onExpandedChange: (key: string, expanded: boolean) => void
  locale: Locale
}) {
  const copy = labels[locale]
  const thinkKey = `${message.key}:think`
  const analysisSource = message.analysisResponse || message.content
  const analysisSections = splitSummaryAnalysisSections(analysisSource)
  const shouldRenderRawResponse = !!message.analysisResponse || !analysisSections.length

  return (
    <>
      {message.thinkResponse ? (
        <Think
          title={copy.thinkDone}
          loading={false}
          expanded={!!expandedMap[thinkKey]}
          onExpand={(expanded) => onExpandedChange(thinkKey, expanded)}
        >
          <XMarkdown className={markdownClassName} content={message.thinkResponse} />
        </Think>
      ) : null}
      {analysisSections.length ? (
        analysisSections.map((section) => {
          const sectionKey = `${message.key}:analysis:${section.key}`
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
      ) : message.analysisResponse ? (
        <Think
          title={copy.summaryAnalysisDone}
          loading={false}
          expanded={!!expandedMap[`${message.key}:analysis`]}
          onExpand={(expanded) => onExpandedChange(`${message.key}:analysis`, expanded)}
        >
          <XMarkdown className={markdownClassName} content={message.analysisResponse} />
        </Think>
      ) : null}
      {shouldRenderRawResponse ? <XMarkdown className={markdownClassName} content={message.content} /> : null}
    </>
  )
}

const bubbleRole: BubbleListProps['role'] = {
  assistant: {
    placement: 'start',
    contentRender: renderMarkdown,
  },
  user: { placement: 'end' },
}

function getTimeGroup(timestamp: number, locale: Locale) {
  const now = new Date()
  const date = new Date(timestamp)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const weekStart = todayStart - 6 * 86400000

  if (date.getTime() >= todayStart) return locale === 'zh' ? '今天' : 'Today'
  if (date.getTime() >= yesterdayStart) return locale === 'zh' ? '昨天' : 'Yesterday'
  if (date.getTime() >= weekStart) return locale === 'zh' ? '近 7 天' : 'Last 7 Days'
  return locale === 'zh' ? '更早' : 'Earlier'
}

function getUserName(auth: SiteAuth) {
  if (!auth.state.authenticated) return ''
  return auth.state.user.displayName || auth.state.user.providerLogin || auth.state.user.email || `#${auth.state.user.id}`
}

function normalizeModels(payload: unknown): AiModel[] {
  const data = payload && typeof payload === 'object' && 'data' in payload ? (payload as { data?: unknown }).data : null
  if (!Array.isArray(data)) return []
  const models: AiModel[] = []
  data.forEach((item) => {
    if (!item || typeof item !== 'object') return
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id) return
    models.push({
      id,
      name: id,
      ownedBy: typeof record.owned_by === 'string' ? record.owned_by : undefined,
      Icon: getModelIcon(id),
    })
  })
  return models
}

function readCompletionContent(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return ''
  const first = choices[0]
  if (!first || typeof first !== 'object') return ''
  const message = (first as { message?: unknown }).message
  if (message && typeof message === 'object') {
    const content = (message as { content?: unknown }).content
    if (typeof content === 'string') return content
  }
  const text = (first as { text?: unknown }).text
  return typeof text === 'string' ? text : ''
}

function readDeltaValue(payload: unknown, field: 'content' | 'reasoning_content') {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return ''
  const first = choices[0]
  if (!first || typeof first !== 'object') return ''
  const delta = (first as { delta?: unknown }).delta
  if (delta && typeof delta === 'object') {
    const value = (delta as Record<string, unknown>)[field]
    if (typeof value === 'string') return value
  }
  return ''
}

function readCompletionDelta(payload: unknown) {
  return readDeltaValue(payload, 'content') || readCompletionContent(payload)
}

function readReasoningDelta(payload: unknown) {
  return readDeltaValue(payload, 'reasoning_content')
}

function readErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as { error?: unknown }).error
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (message != null) return String(message)
  }
  if (error != null) return String(error)
  return fallback
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', ...init })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`
    throw new Error(message)
  }
  return data
}

async function fetchChatCompletionStream({
  model,
  messages,
  deepThink,
  onDelta,
}: {
  model: string
  messages: CompletionMessage[]
  deepThink: boolean
  onDelta: (message: Pick<ChatMessage, 'content' | 'thinkResponse'>) => void
}) {
  const res = await fetch(`${API_BASE_URL}/api/ai/chat/completions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      extra_body: {
        thinking: { type: deepThink ? 'enabled' : 'disabled' },
      },
    }),
  })

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    try {
      throw new Error(readErrorMessage(JSON.parse(text), `HTTP ${res.status}`))
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text || `HTTP ${res.status}`)
      throw error
    }
  }

  if (!res.body || !contentType.includes('text/event-stream')) {
    const data = await res.json().catch(() => null)
    const content = readCompletionContent(data)
    if (content) onDelta({ content })
    return { content, thinkResponse: '' }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let thinkResponse = ''
  let done = false

  const consumeEvent = (event: string) => {
    const data = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim()

    if (!data) return
    if (data === '[DONE]') {
      done = true
      return
    }

    try {
      const payload = JSON.parse(data)
      const contentDelta = readCompletionDelta(payload)
      const reasoningDelta = readReasoningDelta(payload)
      if (contentDelta || reasoningDelta) {
        content += contentDelta
        thinkResponse += reasoningDelta
        onDelta({ content, thinkResponse })
      }
    } catch {
      // Ignore malformed SSE keep-alive payloads from upstream proxies.
    }
  }

  while (!done) {
    const chunk = await reader.read()
    if (chunk.done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    events.forEach(consumeEvent)
  }

  buffer += decoder.decode()
  if (buffer.trim()) consumeEvent(buffer)
  return { content, thinkResponse }
}

function buildChannelHistoryMessages(messages: ChatMessage[], channelId: string): CompletionMessage[] {
  const historyMessages: CompletionMessage[] = []

  messages.forEach((message) => {
    if (!message.content.trim()) return
    if (message.role === 'user') {
      historyMessages.push({ role: 'user', content: message.content })
      return
    }
    if (message.providerId === channelId || message.providerId === 'summary') {
      historyMessages.push({ role: 'assistant', content: message.content })
    }
  })

  return historyMessages
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

function ChatNotice({ notice, locale }: { notice: ShareNotice; locale: Locale }) {
  return (
    <div className="share-state-view">
      <div className={`share-state-view__mark ${notice.status === 'loading' ? 'is-loading' : ''}`}>
        {notice.status === 'loading' ? <MergeCellsOutlined /> : <RightOutlined />}
      </div>
      <h1>{notice.title}</h1>
      <p>{notice.description}</p>
      {notice.status === 'error' ? (
        <a className="share-state-view__button" href={withLocale('/', locale)}>
          <HomeOutlined />
          {notice.actionLabel}
        </a>
      ) : null}
    </div>
  )
}

export function ChatPage({
  auth,
  locale,
  mode = 'chat',
  sharedSession,
  shareNotice,
  onLoginRequired,
}: {
  auth?: SiteAuth
  locale: Locale
  mode?: 'chat' | 'share'
  sharedSession?: ChatSession
  shareNotice?: ShareNotice
  onLoginRequired?: () => void
}) {
  const { message } = AntApp.useApp()
  const copy = labels[locale]
  const isShareMode = mode === 'share'
  const [sessions, setSessions] = useState<ChatSession[]>(readSessions)
  const [activeId, setActiveId] = useState(() => sessions[0]?.id ?? '')
  const [inputValue, setInputValue] = useState('')
  const [deepThink, setDeepThink] = useState(true)
  const [webSearch, setWebSearch] = useState(true)
  const [autoSummary, setAutoSummary] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState('')
  const [apiModels, setApiModels] = useState<AiModel[]>([])
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(() => new Set())
  const [collapseMap, setCollapseMap] = useState<Record<string, boolean>>({})
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})

  const channelItems = apiModels

  const activeSession = isShareMode ? sharedSession : sessions.find((session) => session.id === activeId)

  useEffect(() => {
    if (isShareMode) return
    let cancelled = false
    setModelsLoading(true)
    setModelsError('')
    fetchJson(`${API_BASE_URL}/api/ai/models`)
      .then((data) => {
        if (cancelled) return
        const models = normalizeModels(data)
        setApiModels(models)
        setEnabledChannels((prev) => {
          const valid = new Set(models.map((item) => item.id))
          const kept = [...prev].filter((id) => valid.has(id))
          return new Set(kept.length ? kept : models.map((item) => item.id))
        })
      })
      .catch((error) => {
        if (cancelled) return
        setModelsError(error instanceof Error ? error.message : copy.modelLoadFailed)
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [copy.modelLoadFailed, isShareMode])

  const persist = (nextSessions: ChatSession[], nextActiveId = activeId) => {
    setSessions(nextSessions)
    setActiveId(nextActiveId)
    writeSessions(nextSessions)
  }

  const replaceSession = (nextSession: ChatSession) => {
    setSessions((prev) => {
      const nextSessions = [nextSession, ...prev.filter((session) => session.id !== nextSession.id)]
      writeSessions(nextSessions)
      return nextSessions
    })
    setActiveId(nextSession.id)
  }

  const startNewChat = () => {
    const session = createSession()
    persist([session, ...sessions], session.id)
    setMobileSidebarOpen(false)
  }

  const updateSessionMessage = (sessionId: string, messageKey: string, patch: Partial<Pick<ChatMessage, 'content' | 'thinkResponse'>>) => {
    setSessions((prev) => {
      const nextSessions = prev.map((session) => (
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) => (
                message.key === messageKey ? { ...message, ...patch } : message
              )),
            }
          : session
      ))
      writeSessions(nextSessions)
      return nextSessions
    })
  }

  const submit = async (value: string) => {
    const question = value.trim()
    if (!question || isSending) return
    if (!auth) return
    if (!auth.state.authenticated) {
      onLoginRequired?.()
      return
    }

    const baseSession = activeSession ?? createSession()
    const userMessage: ChatMessage = {
      key: `${baseSession.id}:user:${Date.now()}`,
      role: 'user',
      content: question,
    }
    const selectedChannels = channelItems.filter((item) => enabledChannels.has(item.id))
    if (!selectedChannels.length) return

    const pendingMessages: ChatMessage[] = selectedChannels.map((channel) => ({
      key: `${baseSession.id}:${channel.id}:${Date.now()}`,
      role: 'assistant',
      providerId: channel.id,
      providerName: channel.name,
      content: copy.thinking,
    }))
    const nextSession: ChatSession = {
      ...baseSession,
      title: baseSession.messages.length ? baseSession.title : question.slice(0, 28),
      updatedAt: Date.now(),
      messages: [...baseSession.messages, userMessage, ...pendingMessages],
    }
    const rest = sessions.filter((session) => session.id !== nextSession.id)
    persist([nextSession, ...rest], nextSession.id)
    setInputValue('')
    setIsSending(true)

    const results = await Promise.all(selectedChannels.map(async (channel) => {
      const pendingMessage = pendingMessages.find((message) => message.providerId === channel.id)
      const pendingKey = pendingMessage?.key ?? `${baseSession.id}:${channel.id}:fallback`
      try {
        const historyMessages = buildChannelHistoryMessages(baseSession.messages, channel.id)
        const result = await fetchChatCompletionStream({
          model: channel.id,
          messages: [...historyMessages, { role: 'user', content: question }],
          deepThink,
          onDelta: (message) => updateSessionMessage(nextSession.id, pendingKey, {
            content: message.content || copy.thinking,
            thinkResponse: message.thinkResponse,
          }),
        })
        return {
          channel,
          content: result.content || copy.requestFailed,
          thinkResponse: result.thinkResponse,
        }
      } catch (error) {
        const content = `**${copy.requestFailed}**\n\n${error instanceof Error ? error.message : copy.requestFailed}`
        updateSessionMessage(nextSession.id, pendingKey, { content })
        return {
          channel,
          content,
          thinkResponse: '',
        }
      }
    }))

    const completedMessages: ChatMessage[] = results.map(({ channel, content, thinkResponse }) => ({
      key: `${baseSession.id}:${channel.id}:${Date.now()}`,
      role: 'assistant',
      providerId: channel.id,
      providerName: channel.name,
      content,
      thinkResponse: thinkResponse || undefined,
    }))
    const successfulResults = results.filter((result) => !result.content.startsWith(`**${copy.requestFailed}**`))
    if (autoSummary && successfulResults.length >= 2) {
      try {
        const responseParts = successfulResults
          .map((result) => `【${result.channel.name} 的回答】\n${result.content}`)
          .join('\n\n')
        const userContent = `【用户原始问题】\n${question}\n\n${responseParts}`
        const summary = await fetchJson(`${API_BASE_URL}/api/ai/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: selectedChannels[0].id,
            messages: [
              { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            temperature: 0.3,
            extra_body: {
              thinking: { type: 'enabled' },
            },
          }),
        })
        const summaryContent = readCompletionContent(summary) || copy.requestFailed
        const parsedSummary = splitSummaryCompletion(summaryContent)
        completedMessages.push({
          key: `${baseSession.id}:summary:${Date.now()}`,
          role: 'assistant',
          providerId: 'summary',
          providerName: locale === 'zh' ? '归纳总结' : 'Summary',
          content: parsedSummary.final,
          analysisResponse: parsedSummary.analysis,
        })
      } catch (error) {
        completedMessages.push({
          key: `${baseSession.id}:summary:${Date.now()}`,
          role: 'assistant',
          providerId: 'summary',
          providerName: locale === 'zh' ? '归纳总结' : 'Summary',
          content: `**${copy.requestFailed}**\n\n${error instanceof Error ? error.message : copy.requestFailed}`,
        })
      }
    }
    replaceSession({
      ...nextSession,
      updatedAt: Date.now(),
      messages: [...baseSession.messages, userMessage, ...completedMessages],
    })
    setIsSending(false)
  }

  const deleteSession = (id: string) => {
    const nextSessions = sessions.filter((session) => session.id !== id)
    persist(nextSessions, activeId === id ? (nextSessions[0]?.id ?? '') : activeId)
  }

  const conversationItems = useMemo(() => {
    return sessions.map((session) => ({
      key: session.id,
      label: session.title || copy.newChat,
      group: getTimeGroup(session.updatedAt, locale),
    }))
  }, [copy.newChat, locale, sessions])

  const conversationMenu: ConversationsProps['menu'] = (conversation) => ({
    items: [
      { label: copy.deleteOk, key: 'delete', icon: <DeleteOutlined />, danger: true },
    ],
    onClick: (info) => {
      info.domEvent.stopPropagation()
      Modal.confirm({
        title: copy.deleteTitle,
        content: copy.deleteContent,
        okText: copy.deleteOk,
        okButtonProps: { danger: true },
        cancelText: copy.cancel,
        centered: true,
        onOk: () => deleteSession(conversation.key as string),
      })
    },
  })

  const toggleChannel = (id: string) => {
    setEnabledChannels((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const invertChannels = () => {
    setEnabledChannels((prev) => new Set(channelItems.filter((item) => !prev.has(item.id)).map((item) => item.id)))
  }
  const allEnabled = channelItems.length > 0 && enabledChannels.size === channelItems.length
  const toggleAllChannels = () => {
    setEnabledChannels(allEnabled ? new Set() : new Set(channelItems.map((item) => item.id)))
  }
  const handleLogout = async () => {
    if (!auth) return
    await logout()
    await auth.refresh()
  }

  const userMenu: MenuProps['items'] = [
    { key: 'settings', icon: <SettingOutlined />, label: copy.accountSettings },
    { key: 'options', icon: <MergeCellsOutlined />, label: copy.options },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: copy.logout },
  ]
  const userMenuClick: MenuProps['onClick'] = (info) => {
    if (info.key === 'logout') void handleLogout()
  }
  const userName = auth ? getUserName(auth) : ''
  const toggleCollapse = (key: string) => {
    setCollapseMap((prev) => ({ ...prev, [key]: !prev[key] }))
  }
  const setExpanded = (key: string, expanded: boolean) => {
    setExpandedMap((prev) => ({ ...prev, [key]: expanded }))
  }
  const copySummary = async () => {
    const summary = activeSession?.messages.find((item) => item.providerId === 'summary')?.content ?? ''
    const copied = await writeClipboard(summary)
    if (copied) message.success(copy.copySuccess)
    else message.info(copy.copyBlocked)
  }
  const bubbleItems: BubbleListProps['items'] = (activeSession?.messages ?? []).map((item) => {
    if (item.role === 'user') {
      return {
        key: item.key,
        role: item.role,
        content: item.content,
      }
    }

    const collapsed = !!collapseMap[item.key]
    const hasRichContent = !!(item.thinkResponse || item.analysisResponse)

    return {
      key: item.key,
      role: item.role,
      content: item.content,
      header: item.providerId ? (
        <ProviderHeader
          providerId={item.providerId}
          providerName={item.providerName}
          stats={item.stats}
          collapsed={collapsed}
          onToggle={isShareMode ? () => toggleCollapse(item.key) : undefined}
          locale={locale}
        />
      ) : undefined,
      style: item.providerId ? { paddingTop: 0, paddingBottom: 0 } : undefined,
      className: collapsed ? 'share-bubble-content-hidden' : undefined,
      contentRender: collapsed
        ? () => null
        : item.providerId === 'summary'
          ? () => (
              <SummaryThinkAndMarkdown
                message={item}
                markdownClassName="x-markdown-light"
                expandedMap={expandedMap}
                onExpandedChange={setExpanded}
                locale={locale}
              />
            )
        : hasRichContent
          ? () => (
              <ThinkAndMarkdown
                message={item}
                markdownClassName="x-markdown-light"
                expandedMap={expandedMap}
                onExpandedChange={setExpanded}
                locale={locale}
              />
            )
          : undefined,
      footer:
        isShareMode && item.providerId === 'summary' && !collapsed ? (
          <Flex gap={8} align="center">
            <button className="share-floating-btn-text" type="button" onClick={copySummary}>
              <CopyOutlined />
              {copy.copySummary}
            </button>
          </Flex>
        ) : undefined,
    }
  })

  const renderSidebarContent = () => (
    <>
      <a className="chat-brand" href="/">
        <img src={assetPath('/logo.png')} alt="" />
        <span>AI 对撞机</span>
      </a>
      {isShareMode ? (
        <>
          <div className="chat-sidebar-intro">
            <h1>{sharedSession?.title || copy.sharedConversation}</h1>
            <p>{copy.sharedReadonly}</p>
          </div>
          <div className="chat-history-empty">
            <CommentOutlined />
            <span>{copy.sharedConversation}</span>
          </div>
          <a className="chat-user-entry" href={withLocale('/', locale)}>
            <span className="chat-user-avatar">
              <HomeOutlined />
            </span>
            <span className="chat-user-meta">
              <strong>{copy.backHome}</strong>
              <small>AI Clash</small>
            </span>
          </a>
        </>
      ) : (
      <>
      <div className="chat-sidebar-intro">
        <div className="chat-sidebar-actions">
          <Button block icon={<PlusOutlined />} type="primary" onClick={startNewChat}>
            {copy.newChat}
          </Button>
        </div>
      </div>
      {sessions.length ? (
        <Conversations
          activeKey={activeId}
          className="chat-conversations"
          groupable
          items={conversationItems}
          menu={conversationMenu}
          onActiveChange={(key) => {
            setActiveId(key as string)
            setMobileSidebarOpen(false)
          }}
        />
      ) : (
        <div className="chat-history-empty">
          <CommentOutlined />
          <span>{copy.emptyHistory}</span>
        </div>
      )}
      {auth?.status === 'loading' ? (
        <button className="chat-user-entry" disabled type="button">
          <Avatar className="chat-user-avatar" icon={<UserOutlined />} size={32} />
          <span className="chat-user-meta">
            <strong>{copy.checkingSession}</strong>
            <small>AI Clash</small>
          </span>
        </button>
      ) : auth?.state.authenticated ? (
        <Dropdown menu={{ items: userMenu, onClick: userMenuClick }} placement="topRight" trigger={['click']}>
          <button className="chat-user-entry" type="button">
            <Avatar className="chat-user-avatar" icon={<UserOutlined />} size={32} src={auth.state.user.avatarUrl} />
            <span className="chat-user-meta">
              <strong>{userName}</strong>
              <small>{auth.state.user.email || auth.state.user.providerLogin || copy.account}</small>
            </span>
            <SettingOutlined className="chat-user-caret" />
          </button>
        </Dropdown>
      ) : (
        <button className="chat-user-entry" type="button" onClick={onLoginRequired}>
          <span className="chat-user-avatar">
            <LoginOutlined />
          </span>
          <span className="chat-user-meta">
            <strong>{copy.login}</strong>
            <small>GitHub / Google / Microsoft</small>
          </span>
        </button>
      )}
      </>
      )}
    </>
  )

  return (
    <main className="chat-page">
      <aside className="chat-sidebar">
        {renderSidebarContent()}
      </aside>
      <Button
        className="chat-history-trigger"
        icon={<MenuFoldOutlined />}
        type="text"
        aria-label={copy.openHistory}
        onClick={() => setMobileSidebarOpen(true)}
      />
      <Drawer
        className="chat-mobile-drawer"
        placement="left"
        width={300}
        closable={false}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      >
        <div className="chat-sidebar chat-sidebar--drawer">{renderSidebarContent()}</div>
      </Drawer>

      <section className="chat-copilot">
        <div className="chat-dialog-panel">
          <div className="chat-list">
          {bubbleItems.length ? (
            <Bubble.List className="chat-bubble-list" items={bubbleItems} role={bubbleRole} />
          ) : shareNotice ? (
            <ChatNotice notice={shareNotice} locale={locale} />
          ) : (
            <div className="chat-empty-state">
              <Welcome
                variant="borderless"
                title={copy.welcomeTitle}
                description={copy.welcomeDescription}
              />
              <div className="chat-channel-list">
                <div className="chat-channel-card">
                  <div className="chat-channel-card__header">
                    <div className="chat-channel-card__title">
                      <span>{copy.channels}</span>
                      <Tag bordered={false} color="blue">{enabledChannels.size} {copy.enabled}</Tag>
                    </div>
                    <div className="chat-channel-card__actions">
                      <Button
                        size="small"
                        type="text"
                        icon={allEnabled ? <BorderOutlined /> : <CheckSquareOutlined />}
                        onClick={toggleAllChannels}
                      >
                        {allEnabled ? copy.deselectAll : copy.selectAll}
                      </Button>
                      <Button size="small" type="text" icon={<SwapOutlined />} onClick={invertChannels}>
                        {copy.invert}
                      </Button>
                    </div>
                  </div>
                  <div className="chat-channel-card__body">
                    <div className="chat-channel-section">
                      <span>{copy.proxyModels}</span>
                      <small>{copy.proxyHint}</small>
                    </div>
                    {modelsLoading ? (
                      <div className="chat-channel-empty">{copy.thinking}</div>
                    ) : modelsError ? (
                      <div className="chat-channel-empty">
                        {copy.modelLoadFailed}
                        <div>{modelsError}</div>
                      </div>
                    ) : channelItems.length ? channelItems.map(({ id, name, ownedBy, Icon }) => {
                      const enabled = enabledChannels.has(id)
                      return (
                        <div className="chat-channel-row" key={id}>
                          <div className="chat-channel-icon">
                            <Icon size={20} />
                          </div>
                          <div className="chat-channel-name">
                            <span>{name}</span>
                            {ownedBy ? <small>{ownedBy}</small> : null}
                            <Tag className="chat-channel-mode">{copy.apiMode}</Tag>
                          </div>
                          <Button className="chat-channel-action" size="small" type="text" icon={<SettingOutlined />} />
                          <Switch size="small" checked={enabled} onChange={() => toggleChannel(id)} />
                        </div>
                      )
                    }) : (
                      <div className="chat-channel-empty">
                        {copy.noChannels}
                        <div>{copy.noChannelsHint}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {inputValue.trim() ? null : (
                <div className="chat-prompt-panel">
                  <div className="chat-panel-title">{copy.prompts}</div>
                  {promptItems[locale].map((prompt) => (
                    <button
                      className="chat-prompt-row"
                      key={prompt.text}
                      type="button"
                      onClick={() => setInputValue(prompt.text)}
                    >
                      <span className="chat-prompt-icon">{prompt.icon}</span>
                      <span>{prompt.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>

          {isShareMode ? null : (
          <div className="chat-sender">
          <Flex gap="small" className="chat-option-row">
            <Button size="small" type={autoSummary ? 'primary' : 'default'} icon={<MergeCellsOutlined />} onClick={() => setAutoSummary(!autoSummary)}>
              {copy.autoSummary}
            </Button>
          </Flex>
          <Sender
            autoSize
            value={inputValue}
            placeholder={copy.inputPlaceholder}
            onChange={setInputValue}
            onSubmit={() => submit(inputValue)}
            suffix={false}
            footer={(_, { components }) => {
              const { SendButton, LoadingButton } = components
              return (
                <Flex justify="space-between" align="center">
                  <Flex gap="small" align="center">
                    <Sender.Switch icon={<BulbOutlined />} value={deepThink} onChange={setDeepThink}>
                      {copy.deepThink}
                    </Sender.Switch>
                    <Sender.Switch icon={<GlobalOutlined />} value={webSearch} onChange={setWebSearch}>
                      {copy.webSearch}
                    </Sender.Switch>
                  </Flex>
                  <Flex align="center">
                    <LoadingButton type="default" style={{ display: isSending ? undefined : 'none' }} />
                    <SendButton type="primary" disabled={isSending || !enabledChannels.size} />
                  </Flex>
                </Flex>
              )
            }}
          />
          </div>
          )}
        </div>
      </section>
    </main>
  )
}
