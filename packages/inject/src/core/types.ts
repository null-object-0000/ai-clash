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
 * 也支持自定义字符串作为扩展提供者的 ID。
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
   * @param capability - 能力名称 ('thinking' | 'input' | 'send' | 'newChat')
   * @param method - 方法名称
   * @param args - 方法参数
   * @returns 方法执行结果
   *
   * @example
   * await injector.call('thinking', 'getState')
   * await injector.call('input', 'fill', 'Hello AI')
   * await injector.call('send', 'send')
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
 * - thinking - 思考模式切换
 * - input - 输入框填充
 * - send - 发送消息
 * - newChat - 开始新对话
 */
export interface Capabilities {
  thinking: ThinkingCapability;
  input: InputCapability;
  send: SendCapability;
  newChat: NewChatCapability;
}

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
 * 输入框能力
 *
 * 用于向 AI 输入框填充文本内容。
 *
 * @example
 * await window.__AI_CLASH.input.fill('请解释量子力学')
 */
export interface InputCapability {
  /**
   * 填充输入框
   *
   * 自动定位输入框并填充指定文本。支持：
   * - `<textarea>` 元素
   * - `<input type="text">` 元素
   * - `contenteditable` 可编辑元素
   * - Slate 等富文本编辑器
   *
   * @param text - 要填充的文本内容
   * @returns
   * - `success`: 是否成功
   * - `reason`: 失败原因（可选）
   *   - `'input-not-found'`: 未找到输入框
   */
  fill(text: string): Promise<{ success: boolean; reason?: string }>;
}

/**
 * 发送能力
 *
 * 用于模拟发送消息操作。
 *
 * @example
 * // 填充内容后发送
 * await window.__AI_CLASH.input.fill('你好')
 * await window.__AI_CLASH.send.send()
 */
export interface SendCapability {
  /**
   * 发送消息
   *
   * 自动查找发送按钮并点击，如果找不到按钮则模拟 Enter 键发送。
   *
   * @returns
   * - `success`: 是否成功
   * - `method`: 发送方式
   *   - `'button'`: 点击发送按钮
   *   - `'enter'`: 模拟 Enter 键
   * - `reason`: 失败原因（可选）
   *   - `'no-button-no-input'`: 既找不到按钮也找不到输入框
   */
  send(): Promise<{ success: boolean; method?: 'button' | 'enter'; reason?: string }>;
}

/**
 * 新建对话能力
 *
 * 用于开始新的对话。
 *
 * @example
 * await window.__AI_CLASH.newChat.start()
 */
export interface NewChatCapability {
  /**
   * 开始新对话
   *
   * 自动查找并点击"新对话"按钮。查找优先级：
   * 1. 优先级选择器（priority）
   * 2. 文本标签匹配（textLabels）
   * 3. data-testid 匹配（testIds）
   *
   * @returns
   * - `success`: 是否成功
   * - `reason`: 失败原因（可选）
   *   - `'button-not-found'`: 未找到新对话按钮
   */
  start(): Promise<{ success: boolean; reason?: string }>;
}

// ============================================================================
// Provider 配置
// ============================================================================

/**
 * AI 提供者配置
 *
 * 定义了一个 AI 平台的完整配置信息，包括：
 * - 基础信息（ID、名称、域名）
 * - DOM 选择器配置
 * - 思考模式切换配置（可选）
 */
export interface ProviderConfig {
  /** 提供者唯一标识 */
  id: ProviderId;
  /** 提供者显示名称 */
  name: string;
  /** 网站域名（用于自动检测） */
  domain: string;
  /** DOM 选择器配置 */
  selectors: ProviderSelectors;
  /** 思考模式切换配置（可选，某些平台可能不支持） */
  toggles?: ThinkingToggleConfig;
}

/**
 * Provider DOM 选择器配置
 *
 * 定义了控制 AI 页面所需的所有 CSS 选择器。
 */
export interface ProviderSelectors {
  /**
   * 输入框选择器列表（按优先级）
   * 支持多个选择器，按顺序尝试查找
   */
  input: string[];

  /**
   * 发送按钮选择器列表（按优先级）
   * 支持多个选择器，按顺序尝试查找
   */
  sendButton: string[];

  /** 新建对话选择器列表（按优先级） */
  newChat: string[];

  /** 思考模式按钮选择器（可选） */
  thinking?: ThinkingButtonSelectors;
}

/**
 * 思考模式按钮选择器配置
 */
export interface ThinkingButtonSelectors {
  /**
   * 查找选择器
   * 可以是简单的 CSS 选择器字符串，或复杂配置对象
   */
  find: string | {
    selector: string;
    textContains?: string;
    hasChild?: string;
  };

  /** 启用状态判断配置 */
  isEnabled: string | HasClassConfig | ClassContainsConfig | TextContainsConfig;

  /** 切换操作配置 */
  toggle: ToggleActionConfig;
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
 * 启用状态判断配置类型
 *
 * 支持多种判断方式：
 * - 字符串：匹配 class 名称
 * - 配置对象：匹配 class、文本等
 * - 函数：自定义判断逻辑
 */
export type IsEnabledConfig = string | HasClassConfig | ClassContainsConfig | TextContainsConfig | ((el: Element) => boolean);

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
// 内部能力配置
// ============================================================================

/**
 * 思考模式切换配置
 *
 * 定义了如何查找、判断和切换思考模式。
 */
export interface ThinkingToggleConfig {
  /**
   * 查找切换按钮的方法
   * 可以是 CSS 选择器字符串或自定义函数
   */
  findToggle: string | (() => Element | null);

  /** 判断是否已启用的配置 */
  isEnabled: IsEnabledConfig;

  /**
   * 切换方式
   * - `'click'`: 点击切换
   * - `'dropdown'`: 展开下拉菜单选择
   */
  toggle: 'click' | 'dropdown';

  /**
   * 切换后等待时间（毫秒）
   * 等待 UI 状态更新完成
   * @default 300
   */
  waitAfterToggle?: number;
}

// ============================================================================
// 事件类型（用于流式输出和状态通知）
// ============================================================================

/**
 * 内容块事件
 *
 * 用于接收 AI 返回的流式内容片段。
 */
export type ChunkEvent = {
  /** 事件类型标识 */
  type: 'chunk';
  /** 提供者 ID */
  provider: string;
  /** 内容片段文本 */
  text: string;
  /**
   * 输出阶段
   * - `'thinking'`: 思考中
   * - `'responding'`: 回答中
   * - `'connecting'`: 连接中
   */
  stage: 'thinking' | 'responding' | 'connecting';
  /** 是否为思考链内容 */
  isThink?: boolean;
  /** 是否为状态消息 */
  isStatus?: boolean;
};

/**
 * 状态事件
 *
 * 用于接收 AI 当前状态的通知。
 */
export type StatusEvent = {
  /** 事件类型标识 */
  type: 'status';
  /** 提供者 ID */
  provider: string;
  /** 状态描述文本 */
  text: string;
};

/**
 * 错误事件
 *
 * 用于接收错误通知。
 */
export type ErrorEvent = {
  /** 事件类型标识 */
  type: 'error';
  /** 提供者 ID */
  provider: string;
  /** 错误消息 */
  message: string;
};

/**
 * 完成事件
 *
 * 用于接收 AI 回答完成的通知。
 */
export type CompleteEvent = {
  /** 事件类型标识 */
  type: 'complete';
  /** 提供者 ID */
  provider: string;
};

/**
 * 注入事件类型
 *
 * 所有可能的事件类型的联合。
 */
export type InjectEvent = ChunkEvent | StatusEvent | ErrorEvent | CompleteEvent;

/**
 * 事件处理器函数类型
 *
 * @param event - 接收到的事件对象
 */
export type EventHandler = (event: InjectEvent) => void;
