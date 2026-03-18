import AbstractChatProvider, { type ChatProviderConfig } from '@ant-design/x-sdk';
import type { XModelMessage, XModelParams } from '@ant-design/x-sdk';
import type { AbstractXRequestClass, XRequestOptions } from '@ant-design/x-sdk';
import { MSG_TYPES } from '../../shared/messages.js';
import type { ProviderId } from '../types';

export interface AIClashChatProviderOptions {
  providerId: ProviderId;
  apiKey?: string;
  model?: string;
  isWebMode?: boolean;
  isDeepThinkingEnabled?: boolean;
}

export interface AIClashRequestParams extends Partial<XModelParams> {
  query?: string;
  providerId?: ProviderId;
  isDeepThinkingEnabled?: boolean;
}

export interface AIClashChunkData {
  content: string;
  reasoningContent?: string;
  isThink?: boolean;
  done?: boolean;
}

type RequestType = AbstractXRequestClass<AIClashRequestParams, any, XModelMessage>;

/**
 * AI Clash 自定义 Chat Provider
 * 适配现有的 Background Service Worker + Content Scripts 架构
 */
export class AIClashChatProvider extends AbstractChatProvider<XModelMessage, AIClashRequestParams, any> {
  private providerId: ProviderId;
  private apiKey?: string;
  private model?: string;
  private isWebMode: boolean;
  private isDeepThinkingEnabled: boolean;
  private abortController: AbortController | null = null;
  private onUpdateCallback?: (data: any, responseHeaders: Headers) => any;
  private onSuccessCallback?: (data: any[], responseHeaders: Headers) => any;
  private onErrorCallback?: (error: any, errorInfo?: any) => any;

  constructor(options: AIClashChatProviderOptions) {
    // 创建一个虚拟 request 对象
    const virtualRequest = {
      send: () => Promise.resolve([]),
      abort: () => {},
      setParams: () => {},
    } as unknown as RequestType;

    super({
      request: virtualRequest,
    });

    this.providerId = options.providerId;
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.isWebMode = options.isWebMode ?? true;
    this.isDeepThinkingEnabled = options.isDeepThinkingEnabled ?? false;

    // 注入 request 回调
    this.injectRequest({
      onUpdate: (data: any, headers: Headers) => this.onUpdateCallback?.(data, headers),
      onSuccess: (data: any[], headers: Headers) => this.onSuccessCallback?.(data, headers),
      onError: (error: any, errorInfo?: any) => this.onErrorCallback?.(error, errorInfo),
    });
  }

  /**
   * 转换请求参数
   */
  transformParams(
    requestParams: Partial<AIClashRequestParams>,
    options: XRequestOptions<AIClashRequestParams, any, XModelMessage>
  ): AIClashRequestParams {
    return {
      ...requestParams,
      providerId: this.providerId,
      isDeepThinkingEnabled: this.isDeepThinkingEnabled,
    };
  }

  /**
   * 转换本地消息（用户发送的消息）
   */
  transformLocalMessage(requestParams: Partial<AIClashRequestParams>): XModelMessage | XModelMessage[] {
    const query = requestParams.query || '';
    return {
      role: 'user',
      content: query,
    };
  }

  /**
   * 转换消息（将流式数据转换为可渲染的消息）
   */
  transformMessage(info: any): XModelMessage {
    const { chunks, status } = info;

    // 累积所有内容
    let content = '';
    let reasoningContent = '';

    for (const chunk of chunks) {
      if (chunk?.content) {
        content += chunk.content;
      }
      if (chunk?.reasoningContent) {
        reasoningContent += chunk.reasoningContent;
      }
    }

    return {
      role: 'assistant',
      content,
      ...(reasoningContent ? { reasoningContent } : {}),
    };
  }

  /**
   * 发送请求 - 根据模式选择网页或 API 方式
   */
  async request(
    params: AIClashRequestParams,
    callbacks: {
      onUpdate?: (data: any, headers: Headers) => void;
      onSuccess?: (data: any[], headers: Headers) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    const { onUpdate, onSuccess, onError } = callbacks;

    // 保存回调
    this.onUpdateCallback = onUpdate;
    this.onSuccessCallback = onSuccess;
    this.onErrorCallback = onError;

    // 创建 AbortController 用于取消请求
    this.abortController = new AbortController();

    try {
      if (this.isWebMode) {
        // 网页模式：通过 Chrome Runtime 消息通知 Background
        await this.sendWebModeRequest(params.query || '');
      } else {
        // API 模式：直接调用 API
        await this.sendApiModeRequest(params);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // 用户取消请求
        return;
      }
      onError?.(error as Error);
    }
  }

  /**
   * 网页模式请求 - 通知 Background Service Worker
   */
  private async sendWebModeRequest(query: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 发送 Dispatch 消息到 Background
      chrome.runtime.sendMessage(
        {
          type: MSG_TYPES.DISPATCH_TASK,
          payload: {
            providerId: this.providerId,
            prompt: query,
            isDeepThinkingEnabled: this.isDeepThinkingEnabled,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          // 监听流式响应
          const messageListener = (message: any) => {
            if (
              message.type === MSG_TYPES.CHUNK_RECEIVED &&
              message.providerId === this.providerId
            ) {
              // 处理流式数据块
              const chunkData = message.data as AIClashChunkData;

              // 转换为 Provider 格式
              const chunk = {
                content: chunkData.isThink ? undefined : chunkData.content,
                reasoningContent: chunkData.isThink ? chunkData.content : undefined,
              };

              this.onUpdateCallback?.(chunk, new Headers());
            } else if (
              message.type === MSG_TYPES.TASK_COMPLETED &&
              message.providerId === this.providerId
            ) {
              // 任务完成
              this.onSuccessCallback?.([], new Headers());
              resolve();
              chrome.runtime.onMessage.removeListener(messageListener);
            } else if (
              message.type === MSG_TYPES.ERROR &&
              message.providerId === this.providerId
            ) {
              // 发生错误
              const error = new Error(message.error || '请求失败');
              this.onErrorCallback?.(error, { error });
              reject(error);
              chrome.runtime.onMessage.removeListener(messageListener);
            }
          };

          // 添加消息监听器
          chrome.runtime.onMessage.addListener(messageListener);
        }
      );
    });
  }

  /**
   * API 模式请求 - 直接调用 API
   */
  private async sendApiModeRequest(params: AIClashRequestParams): Promise<void> {
    // 构建 API 请求体
    const requestBody: any = {
      model: this.model,
      messages: params.messages || [],
      stream: true,
    };

    // 如果开启深度思考，添加 extra_body 参数
    if (this.isDeepThinkingEnabled) {
      requestBody.extra_body = {
        thinking: { type: 'enabled' },
      };
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 处理 SSE 流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const chunks: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.slice(6));
              const delta = data.choices?.[0]?.delta;
              if (delta) {
                const chunk = {
                  content: delta.content || '',
                  reasoningContent: delta.reasoning_content || '',
                };
                chunks.push(chunk);
                this.onUpdateCallback?.(chunk, response.headers);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      this.onSuccessCallback?.(chunks, response.headers);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      throw error;
    }
  }

  /**
   * 取消请求
   */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * 更新配置
   */
  updateOptions(options: Partial<AIClashChatProviderOptions>): void {
    if (options.providerId !== undefined) this.providerId = options.providerId;
    if (options.apiKey !== undefined) this.apiKey = options.apiKey;
    if (options.model !== undefined) this.model = options.model;
    if (options.isWebMode !== undefined) this.isWebMode = options.isWebMode;
    if (options.isDeepThinkingEnabled !== undefined) {
      this.isDeepThinkingEnabled = options.isDeepThinkingEnabled;
    }
  }
}

export default AIClashChatProvider;
