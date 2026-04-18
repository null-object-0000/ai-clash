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
 * - `'wenxin'` - 百度文心一言 (https://yiyan.baidu.com)
 * - `'xiaomi'` - 小米 MiMo (https://aistudio.xiaomimimo.com)
 *
 *、也支持自定义字符串作为扩展提供者的 ID。
 */
export type ProviderId = 'deepseek' | 'doubao' | 'qianwen' | 'longcat' | 'yuanbao' | 'wenxin' | 'xiaomi' | string;

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
 */
export interface InjectorOptions {
  /**
   * AI 提供者 ID
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
   */
  wsUrl?: string;

  /**
   * 全局变量名称
   * @default '__AI_CLASH'
   */
  globalName?: string;

  /**
   * BroadcastChannel 名称
   * @default 'ai-clash-channel'
   */
  channelName?: string;
}

/**
 * 注入器接口
 */
export interface Injector {
  inject(): Promise<void>;
  eject(): void;
  call(capability: string, method: string, ...args: any[]): Promise<any>;
}

// ============================================================================
// 能力接口
// ============================================================================

/**
 * 能力集合接口
 */
export interface Capabilities {
  chat: ChatCapability;
  thinking?: ThinkingCapability;
  search?: SearchCapability;
  model?: ModelCapability;
  auth?: AuthCapability;
}

/**
 * 发送选项配置
 */
export interface SendOptions {
  thinking?: boolean;
  search?: boolean;
  newChat?: boolean;
}

/**
 * 基础对话能力集合
 */
export interface ChatCapability {
  newChat(): Promise<{ success: boolean; reason?: string }>;
  fill(text: string): Promise<{ success: boolean; reason?: string }>;
  send(callbacks?: SendCallbacks): Promise<{
    success: boolean;
    method?: 'button' | 'enter';
    reason?: string;
    conversationId?: string;
  }>;
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
  _send(callbacks?: SendCallbacks): Promise<{
    success: boolean;
    method?: 'button' | 'enter';
    reason?: string;
    conversationId?: string;
  }>;
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

/**
 * 思考模式切换能力
 */
export interface ThinkingCapability {
  getState(): Promise<{ found: boolean; enabled: boolean }>;
  enable(): Promise<{ success: boolean; changed: boolean; reason?: string }>;
  disable(): Promise<{ success: boolean; changed: boolean; reason?: string }>;
}

/**
 * 搜索模式切换能力
 */
export interface SearchCapability {
  getState(): Promise<{ found: boolean; enabled: boolean }>;
  enable(): Promise<{ success: boolean; changed: boolean; reason?: string }>;
  disable(): Promise<{ success: boolean; changed: boolean; reason?: string }>;
}

/**
 * 登录信息
 */
export interface AuthInfo {
  loggedIn: boolean;
  username?: string;
  avatarUrl?: string;
}

/**
 * Auth 能力接口 - 获取登录状态和账号信息
 */
export interface AuthCapability {
  getInfo(): Promise<AuthInfo>;
}

/**
 * Provider 配置中的 Auth 动作配置
 */
export interface AuthAction {
  /**
   * 登录状态检测选择器 - 当这些元素存在时表示已登录
   * 通常是用户头像、用户名显示区域等
   */
  loggedInSelectors: string[];
  /**
   * 用户名文本提取选择器
   */
  usernameSelectors?: string[];
  /**
   * 头像图片 URL 提取选择器
   */
  avatarSelectors?: string[];
}

/**
 * 切换模式能力接口（思考模式/搜索模式通用）
 *
 * 用于获取和切换 AI 的各种模式状态（如深度思考模式、联网搜索模式等）。
 */
export interface ToggleAction {
  getState(): Promise<{ found: boolean; enabled: boolean }>;
  enable(): Promise<boolean>;
  disable(): Promise<boolean>;
}

/**
 * 新对话动作配置
 */
export interface NewChatAction {
  button: string[];
}

/**
 * 输入消息动作配置
 */
export interface InputAction {
  box: string[];
}

/**
 * 发送消息动作配置
 */
export interface SendAction {
  button: string[];
  /**
   * 自定义按钮查找函数（用于需要特殊验证的场景，如 MiMo 需要验证 SVG Path）
   * @returns 验证通过的按钮元素，未找到返回 null
   */
  customFind?: () => Element | null;
}

/**
 * 模型切换动作配置
 */
export interface ModelAction {
  dropdownButton: string[];
  modelList: {
    container: string;
    item: string;
    nameSelector: string;
    selectedMarker?: string;
  };
  select: {
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
  urlPattern: string;
  parseLine: (line: string) => { text: string; isThink: boolean | null; done: boolean } | null;
  detectionKeywords: string[];
}

/**
 * AI 提供者配置
 */
export interface ProviderConfig {
  id: ProviderId;
  name: string;
  domain: string;
  actions: ProviderActions;
  conversation?: ConversationConfig;
  sse?: SSEConfig;
}

/**
 * 会话 ID 提取配置
 */
export interface ConversationConfig {
  idFromUrl?: {
    pattern?: string;
    captureGroup?: string | number;
    excludePattern?: string;
  };
  idFromDom?: {
    selector: string;
    attribute?: string;
  };
}

/**
 * Provider 动作配置
 */
export interface ProviderActions {
  chat: ChatActions;
  thinking?: ToggleAction;
  search?: ToggleAction;
  model?: ModelAction;
  auth?: AuthAction;
}

/**
 * 基础对话动作配置
 */
export interface ChatActions {
  newChat: NewChatAction;
  input: InputAction;
  send: SendAction;
}

// ============================================================================
// 流式回调类型（用于 send 方法）
// ============================================================================

/**
 * 发送消息时的回调配置
 */
export interface SendCallbacks {
  onSseChunk?: (
    text: string,
    isThink: boolean,
    stage: 'thinking' | 'responding',
    conversationId?: string
  ) => void;

  onConversationId?: (conversationId: string) => void;

  onComplete?: (fullText: string, conversationId: string | undefined) => void;

  onError?: (error: string, conversationId?: string) => void;
}

/**
 * 会话信息
 */
export interface ConversationInfo {
  id: string;
  url?: string;
}

/**
 * 监听器类型
 */
export type ListenerType = 'dom' | 'fetch';

/**
 * 监听器配置选项
 */
export interface ListenerOptions {
  type?: ListenerType;
}
