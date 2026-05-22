import { useMemo, useState, type ReactNode } from 'react'
import {
  BulbOutlined,
  BorderOutlined,
  CarOutlined,
  CheckSquareOutlined,
  CommentOutlined,
  DeleteOutlined,
  GlobalOutlined,
  HeartOutlined,
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
import { Bubble, Conversations, Sender, Welcome } from '@ant-design/x'
import type { BubbleListProps, ConversationsProps } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import { Avatar, Button, Dropdown, Flex, Modal, Switch, Tag } from 'antd'
import type { MenuProps } from 'antd'
import { DeepSeek, Doubao, Qwen, Yuanbao } from '@lobehub/icons'
import type { Locale } from '../content'
import { logout, startGithubLogin, type SiteAuth } from '../app/auth'
import { assetPath } from '../app/paths'

type ChatMessage = {
  key: string
  role: 'user' | 'assistant'
  content: string
  providerId?: string
  providerName?: string
}

type ChatSession = {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
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
    channels: '通道列表',
    enabled: '已启用',
    deselectAll: '全不选',
    selectAll: '全选',
    invert: '反选',
    options: '运行选项',
    account: '个人空间',
    accountSettings: '账号设置',
    login: 'GitHub 登录',
    checkingSession: '读取登录态',
    logout: '退出登录',
    deepThink: '深度思考',
    webSearch: '联网搜索',
    autoSummary: '自动总结',
    domesticModels: '🇨🇳 国内原生大模型',
    globalModels: '🌍 海外原生大模型',
    noGlobalModels: '暂无海外 AI 通道，敬请期待',
    noGlobalModelsHint: 'ChatGPT、Gemini 等即将上线',
    webMode: '网页',
    goTo: '前往',
    prompts: '💡 你可以问我：',
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
    channels: 'Channel List',
    enabled: 'enabled',
    deselectAll: 'Deselect',
    selectAll: 'All',
    invert: 'Invert',
    options: 'Run Options',
    account: 'Workspace',
    accountSettings: 'Account Settings',
    login: 'Sign in with GitHub',
    checkingSession: 'Checking session',
    logout: 'Log Out',
    deepThink: 'Deep Think',
    webSearch: 'Web Search',
    autoSummary: 'Auto Summary',
    domesticModels: '🇨🇳 Native China Models',
    globalModels: '🌍 Global Native Models',
    noGlobalModels: 'No global AI channels yet',
    noGlobalModelsHint: 'ChatGPT and Gemini are coming soon',
    webMode: 'Web',
    goTo: 'Go',
    prompts: '💡 Try asking:',
  },
} satisfies Record<Locale, Record<string, string>>

const channelItems = [
  { id: 'deepseek', name: 'DeepSeek', Icon: DeepSeek.Color },
  { id: 'doubao', name: '豆包', Icon: Doubao.Color },
  { id: 'qianwen', name: '通义千问', Icon: Qwen.Color },
  { id: 'yuanbao', name: '腾讯元宝', Icon: Yuanbao.Color },
]

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

function ProviderHeader({ providerId, providerName }: { providerId?: string; providerName?: string }) {
  const item = channelItems.find((channel) => channel.id === providerId)
  const Icon = item?.Icon ?? MergeCellsOutlined
  return (
    <div className="chat-provider-header">
      <span className="chat-provider-header__arrow">
        <RightOutlined />
      </span>
      <div className="chat-provider-header__content">
        <Icon size={14} />
        <span>{providerName || item?.name || providerId || 'AI'}</span>
      </div>
    </div>
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

export function ChatPage({ auth, locale }: { auth: SiteAuth; locale: Locale }) {
  const copy = labels[locale]
  const [sessions, setSessions] = useState<ChatSession[]>(readSessions)
  const [activeId, setActiveId] = useState(() => sessions[0]?.id ?? '')
  const [inputValue, setInputValue] = useState('')
  const [deepThink, setDeepThink] = useState(true)
  const [webSearch, setWebSearch] = useState(true)
  const [autoSummary, setAutoSummary] = useState(true)
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(() => new Set(channelItems.map((item) => item.id)))

  const activeSession = sessions.find((session) => session.id === activeId)

  const persist = (nextSessions: ChatSession[], nextActiveId = activeId) => {
    setSessions(nextSessions)
    setActiveId(nextActiveId)
    writeSessions(nextSessions)
  }

  const startNewChat = () => {
    const session = createSession()
    persist([session, ...sessions], session.id)
  }

  const submit = (value: string) => {
    const question = value.trim()
    if (!question) return

    const baseSession = activeSession ?? createSession()
    const userMessage: ChatMessage = {
      key: `${baseSession.id}:user:${Date.now()}`,
      role: 'user',
      content: question,
    }
    const selectedChannels = channelItems.filter((item) => enabledChannels.has(item.id))
    const assistantMessages: ChatMessage[] = selectedChannels.map((channel) => ({
      key: `${baseSession.id}:${channel.id}:${Date.now()}`,
      role: 'assistant',
      providerId: channel.id,
      providerName: channel.name,
      content: `**${channel.name}**\n\n${copy.assistantStub}`,
    }))
    if (selectedChannels.length >= 2 && autoSummary) {
      assistantMessages.push({
        key: `${baseSession.id}:summary:${Date.now()}`,
        role: 'assistant',
        providerId: 'summary',
        providerName: locale === 'zh' ? '归纳总结' : 'Summary',
        content: copy.assistantStub,
      })
    }
    const nextSession: ChatSession = {
      ...baseSession,
      title: baseSession.messages.length ? baseSession.title : question.slice(0, 28),
      updatedAt: Date.now(),
      messages: [...baseSession.messages, userMessage, ...assistantMessages],
    }
    const rest = sessions.filter((session) => session.id !== nextSession.id)
    persist([nextSession, ...rest], nextSession.id)
    setInputValue('')
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

  const bubbleItems: BubbleListProps['items'] = (activeSession?.messages ?? []).map((message) => ({
    key: message.key,
    role: message.role,
    content: message.content,
    header: message.providerId ? <ProviderHeader providerId={message.providerId} providerName={message.providerName} /> : undefined,
    style: message.providerId ? { paddingTop: 0, paddingBottom: 0 } : undefined,
  }))

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
  const allEnabled = enabledChannels.size === channelItems.length
  const toggleAllChannels = () => {
    setEnabledChannels(allEnabled ? new Set() : new Set(channelItems.map((item) => item.id)))
  }
  const handleLogout = async () => {
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
  const userName = getUserName(auth)

  return (
    <main className="chat-page">
      <aside className="chat-sidebar">
        <a className="chat-brand" href="/">
          <img src={assetPath('/logo.png')} alt="" />
          <span>AI 对撞机</span>
        </a>
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
            onActiveChange={(key) => setActiveId(key as string)}
          />
        ) : (
          <div className="chat-history-empty">
            <CommentOutlined />
            <span>{copy.emptyHistory}</span>
          </div>
        )}
        {auth.status === 'loading' ? (
          <button className="chat-user-entry" disabled type="button">
            <Avatar className="chat-user-avatar" icon={<UserOutlined />} size={32} />
            <span className="chat-user-meta">
              <strong>{copy.checkingSession}</strong>
              <small>AI Clash</small>
            </span>
          </button>
        ) : auth.state.authenticated ? (
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
          <button className="chat-user-entry" type="button" onClick={startGithubLogin}>
            <span className="chat-user-avatar">
              <LoginOutlined />
            </span>
            <span className="chat-user-meta">
              <strong>{copy.login}</strong>
              <small>AI Clash</small>
            </span>
          </button>
        )}
      </aside>

      <section className="chat-copilot">
        <div className="chat-dialog-panel">
          <div className="chat-list">
          {bubbleItems.length ? (
            <Bubble.List className="chat-bubble-list" items={bubbleItems} role={bubbleRole} />
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
                    <div className="chat-channel-section">{copy.domesticModels}</div>
                    {channelItems.map(({ id, name, Icon }) => {
                      const enabled = enabledChannels.has(id)
                      return (
                        <div className="chat-channel-row" key={id}>
                          <div className="chat-channel-icon">
                            <Icon size={20} />
                          </div>
                          <div className="chat-channel-name">
                            <span>{name}</span>
                            <Tag className="chat-channel-mode">{copy.webMode}</Tag>
                          </div>
                          <Button className="chat-channel-action" size="small" type="link">
                            {copy.goTo}
                          </Button>
                          <Button className="chat-channel-action" size="small" type="text" icon={<SettingOutlined />} />
                          <Switch size="small" checked={enabled} onChange={() => toggleChannel(id)} />
                        </div>
                      )
                    })}
                    <div className="chat-channel-section">{copy.globalModels}</div>
                    <div className="chat-channel-empty">
                      {copy.noGlobalModels}
                      <div>{copy.noGlobalModelsHint}</div>
                    </div>
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
                    <LoadingButton type="default" style={{ display: 'none' }} />
                    <SendButton type="primary" disabled={false} />
                  </Flex>
                </Flex>
              )
            }}
          />
          </div>
        </div>
      </section>
    </main>
  )
}
