/**
 * AI Clash Inject - 注入库类型定义
 *
 * @packageDocumentation
 *
 * 本文件定义了 AI Clash Inject 库的所有核心类型接口，用于：
 * - 配置注入器选项
 * - 定义能力接口（思考模式、输入框、发送、新建对话）
 * - 描述 Provider 配置结构
 * - 定义事件类型
 */

// ============================================================================
// 核心配置与接口
// ============================================================================

/**
 * AI 提供者 ID
 *
 * 预定义的提供者：
 * - `'deepseek'` - DeepSeek (https://chat.deepseek.com)
 * - `'doubao'` - 豆包 (https://doubao.com)
 * - `'qianwen'` - 通义千问 (https://tongyi.aliyun.com)
 * - `'longcat'` - LongCat/天工 (https://tiangong.cn)
 * - `'yuanbao'` - 腾讯元宝 (https://yuanbao.tencent.com)
 *
 *、 也支持自定义字符串作为扩展提供者的 ID。
 */
export type ProviderId = 'deepseek' | 'doubao' | 'qianwen' | 'longcat' | 'yuanbao' | string;

/**
 * 适配器类型
 *
 * 决定注入器如何与外部环境通信：
 * - `'window'` - 暴露到 window 全局变量（适合 F12/Browser 扩展）
 * - `'extension'` - Chrome Extension Message API（适合扩展集成）
 * - `'ws'` - WebSocket 客户端（适合远程控制）
 * - `'broadcast'` - BroadcastChannel（适合跨标签页通信）
 */
export type AdapterType = 'window' | 'extension' | 'ws' | 'broadcast';

/**
 * 注入器配置选项
 *
 * @example
 * // 基本使用（window 适配器）
 * createInjector({ provider: 'deepseek' })
 *
 * @example
 * // WebSocket 远程控制
 * createInjector({
 *   provider: 'deepseek',
 *   adapter: 'ws',
 *   wsUrl: 'ws://localhost:8080'
 * })
 */
export interface InjectorOptions {
  /**
   * AI 提供者 ID
   * 指定要控制的 AI 平台，如 'deepseek', 'doubao' 等
   */
  provider: ProviderId;

  /**
   * 适配器类型
   * @default 'window'
   */
  adapter?: AdapterType;

  /**
   * WebSocket Server 地址
   * @remarks 仅当 adapter='ws' 时需要配置
   * @example 'ws://localhost:8080'
   */
  wsUrl?: string;

  /**
   * 全局变量名称
   * @default '__AI_CLASH'
   * @remarks 仅当 adapter='window' 时生效
   */
  globalName?: string;

  /**
   * BroadcastChannel 名称
   * @default 'ai-clash-channel'
   * @remarks 仅当 adapter='broadcast' 时生效
   */
  channelName?: string;
}

/**
 * 注入器接口
 *
 * 注入器是控制 AI 页面的核心对象，提供注入、移除和调用能力的方法。
 *
 * @example
 * const injector = createInjector({ provider: 'deepseek' });
 * await injector.inject();
 * await injector.call('thinking', 'sync', true);
 */
export interface Injector {
  /**
   * 注入能力到页面
   *
   * 执行注入逻辑，根据选择的适配器类型将能力暴露到相应环境。
   * 注入完成后可以通过 window.__AI_CLASH（window 适配器）或 call() 方法调用能力。
   */
  inject(): Promise<void>;

  /**
   * 移除注入
   *
   * 清理注入的内容，恢复页面到注入前的状态。
   * 移除后需要重新调用 inject() 才能继续使用能力。
   */
  eject(): void;

  /**
   * 调用能力方法
   *
   * @param capability - 能力名称 ('chat' | 'thinking' | 'search' | 'model')
   * @param method - 方法名称
   * @param args - 方法参数
   * @returns 方法执行结果
   *
   * @example
   * await injector.call('chat', 'newChat')
   * await injector.call('chat', 'fill', 'Hello AI')
   * await injector.call('chat', 'send')
   * await injector.call('thinking', 'getState')
   * await injector.call('thinking', 'sync', true)
   */
  call(capability: string, method: string, ...args: any[]): Promise<any>;
}

// ============================================================================
// 能力接口
// ============================================================================

/**
 * 能力集合接口
 *
 * 定义了注入器提供的所有能力：
 * - chat - 基础对话能力（新对话、输入、发送）
 * - thinking - 思考模式切换
 * - search - 智能搜索切换
 * - model - 模型切换
 */
export interface Capabilities {
  chat: ChatCapability;
  thinking?: ThinkingCapability;
  search?: SearchCapability;
  model?: ModelCapability;
}

/**
 * 发送选项配置
 */
export interface SendOptions {
  /** 是否开启深度思考模式 */
  thinking?: boolean;
  /** 是否开启联网搜索 */
  search?: boolean;
  /** 是否开始新对话（默认 false）*/
  newChat?: boolean;
}

/**
 * 基础对话能力集合
 *
 * 包含所有 AI 平台都应具备的基础能力：
 * - newChat - 开始新对话
 * - fill - 填充输入框
 * - send - 发送消息
 */
export interface ChatCapability {
  /**
   * 开始新对话
   */
  newChat(): Promise<{ success: boolean; reason?: string }>;

  /**
   * 填充输入框
   */
  fill(text: string): Promise<{ success: boolean; reason?: string }>;

  /**
   * 发送消息
   * @param callbacks - 可选的回调，用于监听当次发送的回复
   * @returns 发送结果，包含会话 ID（如果获取到）
   */
  send(
    callbacks?: SendCallbacks
  ): Promise<{
    success: boolean;
    method?: 'button' | 'enter';
    reason?: string;
    conversationId?: string;
  }>;

  /**
   * 完整发送封装 - 自动处理思考/搜索选项并发送
   * @param message - 要发送的消息内容
   * @param options - 发送选项（思考模式、搜索模式等）
   * @param callbacks - 可选的回调，用于监听当次发送的回复
   * @returns 发送结果，包含会话 ID（如果获取到）
   */
  send(
    message: string,
    options?: SendOptions,
    callbacks?: SendCallbacks
  ): Promise<{
    success: boolean;
    method?: 'button' | 'enter';
    reason?: string;
    conversationId?: string;
  }>;

  /**
   * 基础发送 - 直接发送已填充好的消息，不处理选项
   * @param callbacks - 可选的回调，用于监听当次发送的回复
   * @returns 发送结果，包含会话 ID（如果获取到）
   * @internal 供内部使用，封装方法调用
   */
  _send(
    callbacks?: SendCallbacks
  ): Promise<{
    success: boolean;
    method?: 'button' | 'enter';
    reason?: string;
    conversationId?: string;
  }>;
}

/**
 * 智能搜索能力
 *
 * 用于获取和切换 AI 的联网搜索/智能搜索功能。
 *
 * @example
 * // 获取当前状态
 * const state = await window.__AI_CLASH.search.getState()
 * console.log(state) // { found: true, enabled: false }
 *
 * // 开启搜索
 * await window.__AI_CLASH.search.sync(true)
 *
 * // 关闭搜索
 * await window.__AI_CLASH.search.sync(false)
 */
export interface SearchCapability {
  /**
   * 获取当前搜索模式状态
   *
   * @returns
   * - `found`: 是否找到搜索模式切换按钮
   * - `enabled`: 当前是否已开启搜索模式
   */
  getState(): Promise<{ found: boolean; enabled: boolean }>;

  /**
   * 同步搜索模式到期望状态
   *
   * @param wanted - 期望的状态 (true=开启，false=关闭)
   * @returns
   * - `success`: 操作是否成功
   * - `changed`: 状态是否发生了改变
   * - `reason`: 失败原因（可选）
   *   - `'not-found'`: 未找到切换按钮
   *   - `'disappeared-after-toggle'`: 切换后按钮消失
   */
  sync(wanted: boolean): Promise<{ success: boolean; changed: boolean; reason?: string }>;
}

/**
 * 模型信息
 */
export interface ModelInfo {
  id?: string;
  name: string;
  isSelected: boolean;
}

/**
 * 模型切换能力
 */
export interface ModelCapability {
  getCurrent(): Promise<{ found: boolean; model?: ModelInfo }>;
  getAvailable(): Promise<{ found: boolean; models: ModelInfo[] }>;
  select(modelIdOrName: string): Promise<{ success: boolean; reason?: string }>;
}

// 移除旧的接口定义（InputCapability, SendCapability, NewChatCapability 已合并到 ChatCapability）

/**
 * 思考模式能力
 *
 * 用于获取和切换 AI 的深度思考模式状态。
 *
 * @example
 * // 获取当前状态
 * const state = await window.__AI_CLASH.thinking.getState()
 * console.log(state) // { found: true, enabled: false }
 *
 * // 开启思考模式
 * await window.__AI_CLASH.thinking.sync(true)
 *
 * // 关闭思考模式
 * await window.__AI_CLASH.thinking.sync(false)
 */
export interface ThinkingCapability {
  /**
   * 获取当前思考模式状态
   *
   * @returns
   * - `found`: 是否找到思考模式切换按钮
   * - `enabled`: 当前是否已开启思考模式
   */
  getState(): Promise<{ found: boolean; enabled: boolean }>;

  /**
   * 同步思考模式到期望状态
   *
   * @param wanted - 期望的状态 (true=开启，false=关闭)
   * @returns
   * - `success`: 操作是否成功
   * - `changed`: 状态是否发生了改变
   * - `reason`: 失败原因（可选）
   *   - `'not-found'`: 未找到切换按钮
   *   - `'disappeared-after-toggle'`: 切换后按钮消失
   */
  sync(wanted: boolean): Promise<{ success: boolean; changed: boolean; reason?: string }>;
}

/**
 * 基础对话能力集合
 *
 * 包含所有 AI 平台都应具备的基础能力：
 * - newChat - 开始新对话
 * - fill - 填充输入框
 * - send - 发送消息
 *
 * @example
 * // 填充内容后发送
 * await window.__AI_CLASH.chat.fill('你好')
 * await window.__AI_CLASH.chat.send()
 *
 * // 开始新对话
 * await window.__AI_CLASH.chat.newChat()
 */
export interface ChatCapability {
  newChat(): Promise<{ success: boolean; reason?: string }>;
  fill(text: string): Promise<{ success: boolean; reason?: string }>;
  send(): Promise<{ success: boolean; method?: 'button' | 'enter'; reason?: string }>;
}

/**
 * 新对话动作配置
 */
export interface NewChatAction {
  /** 新对话按钮选择器列表（按优先级） */
  button: string[];
}

/**
 * 输入消息动作配置
 */
export interface InputAction {
  /** 输入框选择器列表（按优先级） */
  box: string[];
}

/**
 * 发送消息动作配置
 */
export interface SendAction {
  /** 发送按钮选择器列表（按优先级） */
  button: string[];
}

/**
 * 思考模式动作配置
 */
export interface ThinkingAction {
  /** 思考模式按钮选择器列表（按优先级） */
  button: string[];
  /** 启用状态判断配置 */
  enabledState: string | HasClassConfig | ClassContainsConfig | TextContainsConfig;
  /** 切换操作配置 */
  toggle: ToggleActionConfig;
}

/**
 * 智能搜索动作配置
 */
export interface SearchAction {
  /** 搜索模式按钮选择器列表（按优先级） */
  button: string[];
  /** 启用状态判断配置 */
  enabledState: string | HasClassConfig | ClassContainsConfig | TextContainsConfig;
  /** 切换操作配置 */
  toggle: ToggleActionConfig;
}

/**
 * 模型切换动作配置
 */
export interface ModelAction {
  /** 打开模型选择器的按钮 */
  dropdownButton: string[];
  /** 模型列表配置 */
  modelList: {
    /** 下拉容器选择器 */
    container: string;
    /** 单个模型项选择器 */
    item: string;
    /** 模型名称选择器（在 item 内） */
    nameSelector: string;
    /** 标记已选模型的 class/属性（可选） */
    selectedMarker?: string;
  };
  /** 选择模型配置 */
  select: {
    /** 模型项匹配方式（优先级） */
    matchBy: ('text' | 'data-value' | 'data-model-id')[];
  };
}

// ============================================================================
// Provider 配置
// ============================================================================

/**
 * SSE 流式响应解析配置
 */
export interface SSEConfig {
  /** 匹配需要拦截的 API URL 正则 */
  urlPattern: string;
  /**
   * 解析 SSE 行，返回解析结果
   * @returns { text: string; isThink: boolean | null, done: boolean } 或 null 表示跳过此行
   */
  parseLine: (line: string) => { text: string; isThink: boolean | null; done: boolean } | null;
  /** 初始检测关键词：判断是否是我们要拦截的 SSE 流 */
  detectionKeywords: string[];
}

/**
 * 响应内容提取配置（DOM 轮询模式）
 */
export interface ResponseConfig {
  /** 回复内容选择器列表（按优先级，取最后一个） */
  responseSelectors: string[];
  /** 思考内容选择器列表（按优先级，取最后一个） */
  thinkingSelectors: string[];
}

/**
 * AI 提供者配置
 */
export interface ProviderConfig {
  id: ProviderId;
  name: string;
  domain: string;
  actions: ProviderActions;
  /** 会话 ID 提取配置（可选） */
  conversation?: ConversationConfig;
  /** 响应内容提取配置（DOM 轮询模式） */
  response?: ResponseConfig;
  /** SSE 流式拦截配置 */
  sse?: SSEConfig;
}

/**
 * 会话 ID 提取配置
 */
export interface ConversationConfig {
  /**
   * 从 URL 提取会话 ID
   * 支持正则表达式或 CSS 选择器
   */
  idFromUrl?: {
    /** URL 匹配正则（可选，默认匹配整个 pathname） */
    pattern?: string;
    /** 正则匹配的组名或索引（可选，默认为第一个捕获组） */
    captureGroup?: string | number;
  };
  /**
   * 从 DOM 元素提取会话 ID
   * 用于页面加载后获取当前会话标识
   */
  idFromDom?: {
    /** CSS 选择器 */
    selector: string;
    /** 提取属性（可选，默认为 textContent） */
    attribute?: 'textContent' | 'href' | 'data-id' | string;
  };
}

/**
 * Provider 动作配置
 */
export interface ProviderActions {
  /** 基础对话动作（必填） */
  chat: ChatActions;
  /** 思考模式切换配置（可选） */
  thinking?: ThinkingAction;
  /** 智能搜索切换配置（可选） */
  search?: SearchAction;
  /** 模型切换配置（可选） */
  model?: ModelAction;
}

/**
 * 基础对话动作配置
 */
export interface ChatActions {
  newChat: NewChatAction;
  input: InputAction;
  send: SendAction;
}

/**
 * hasClass 配置
 */
export interface HasClassConfig {
  /** 要匹配的 class 名称 */
  hasClass?: string;
}

/**
 * classContains 配置
 */
export interface ClassContainsConfig {
  /** class 名称中需要包含的关键词 */
  classContains?: string;
}

/**
 * textContains 配置
 */
export interface TextContainsConfig {
  /** 文本内容中需要包含的关键词 */
  textContains?: string;
}

/**
 * 切换操作配置
 *
 * 定义了如何执行切换操作。
 */
export interface ToggleActionConfig {
  /**
   * 切换类型
   * - `'click'`: 直接点击切换
   * - `'dropdown'`: 点击展开菜单后再选择
   */
  type: 'click' | 'dropdown';

  /**
   * 切换后等待时间（毫秒）
   * 等待 UI 动画或状态更新
   */
  wait?: number;

  /**
   * 下拉菜单项选择器（仅 dropdown 类型需要）
   * 点击展开菜单后，从这些选择器中查找目标项
   */
  menuItemSelectors?: string[];

  /**
   * 开启状态的匹配条件（仅 dropdown 类型需要）
   * 用于判断当前是否为开启状态
   */
  enableMatch?: {
    texts: string[];      // 匹配的文本列表
    fallbackTestId?: string; // 文本匹配失败时的 fallback testId
  };

  /**
   * 关闭状态的匹配条件（仅 dropdown 类型需要）
   * 用于判断当前是否为关闭状态
   */
  disableMatch?: {
    texts: string[];
    fallbackTestId?: string;
  };
}

// ============================================================================
// 流式回调类型（用于 send 方法）
// ============================================================================

/**
 * 发送消息时的回调配置
 *
 * 支持多种监听方式的回调：
 * - `onDomChunk` - DOM 轮询模式的流式回调
 * - `onSseChunk` - SSE/ Fetch 拦截模式的流式回调
 * - `onComplete` - 完成回调
 * - `onError` - 错误回调
 *
 * @example
 * await injector.call('chat', 'send', {
 *   onDomChunk: (text, isThink, stage) => console.log('DOM chunk:', text, isThink),
 *   onSseChunk: (data) => console.log('SSE chunk:', data),
 *   onComplete: (fullText) => console.log('complete:', fullText)
 * })
 */
export interface SendCallbacks {
  /**
   * DOM 轮询模式的流式内容块回调
   * @param text - 当前内容片段
   * @param isThink - 是否为思考链内容
   * @param stage - 当前阶段 ('thinking' | 'responding')
   * @param conversationId - 会话 ID
   */
  onDomChunk?: (
    text: string,
    isThink: boolean,
    stage: 'thinking' | 'responding',
    conversationId?: string
  ) => void;

  /**
   * SSE/Fetch 拦截模式的流式内容块回调
   * @param text - 当前内容片段
   * @param isThink - 是否为思考链内容
   * @param stage - 当前阶段 ('thinking' | 'responding')
   * @param conversationId - 会话 ID
   */
  onSseChunk?: (
    text: string,
    isThink: boolean,
    stage: 'thinking' | 'responding',
    conversationId?: string
  ) => void;

  /**
   * 完成回调
   * @param fullText - 完整回复内容（包含思考和回答）
   * @param conversationId - 会话 ID
   */
  onComplete?: (fullText: string, conversationId: string | undefined) => void;

  /**
   * 错误回调
   * @param error - 错误信息
   * @param conversationId - 会话 ID（如果有）
   */
  onError?: (error: string, conversationId?: string) => void;
}

/**
 * 会话信息
 */
export interface ConversationInfo {
  /** 会话 ID */
  id: string;
  /** 会话 URL */
  url?: string;
}

/**
 * 监听器类型
 *
 * - `'dom'` - DOM Observer，通过轮询 DOM 元素变化监听
 * - `'fetch'` - Fetch 拦截，拦截 API 响应解析 SSE
 */
export type ListenerType = 'dom' | 'fetch';

/**
 * 监听器配置选项
 */
export interface ListenerOptions {
  /**
   * 监听器类型
   * @default 'dom'
   */
  type?: ListenerType;
}
