/**
 * AI Clash 自定义 Hook - 整合现有 Background Service Worker 架构
 * 由于项目使用了独特的 Background + Content Scripts 架构，
 * 我们直接使用现有 store 和消息系统，仅借用 @ant-design/x 的 UI 组件
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore, buffers } from '../store';
import { MSG_TYPES } from '../../shared/messages.js';
import { PROVIDER_IDS, type ProviderId } from '../types';

export interface UseAIClashChatOptions {
  providerId: ProviderId;
}

export interface UseAIClashChatReturn {
  /** 消息列表（从 store 读取） */
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    reasoningContent?: string;
    status: 'local' | 'loading' | 'success' | 'error';
  }>;
  /** 是否正在请求 */
  isRequesting: boolean;
  /** 发送请求 */
  onRequest: (query: string) => void;
  /** 取消请求 */
  abort: () => void;
  /** 深度思考内容 */
  thinkingContent: string;
}

/**
 * 使用现有 store 架构管理对话，不依赖 useXChat
 */
export function useAIClashChat(options: UseAIClashChatOptions): UseAIClashChatReturn {
  const { providerId } = options;

  // 从 store 读取状态
  const status = useStore(s => s.statusMap[providerId]);
  const response = useStore(s => s.responses[providerId]);
  const thinkResponse = useStore(s => s.thinkResponses[providerId]);
  const operationStatus = useStore(s => s.operationStatus[providerId]);
  const currentQuestion = useStore(s => s.currentQuestion);
  const conversationTurns = useStore(s => s.conversationTurns);
  const isDeepThinkingEnabled = useStore(s => s.isDeepThinkingEnabled);

  const { setInputStr, submit } = useStore.getState();

  // 构建消息列表
  const messages = useMemo(() => {
    const items: UseAIClashChatReturn['messages'] = [];

    // 历史对话轮次
    conversationTurns.forEach((turn, idx) => {
      items.push({
        id: `user-${idx}`,
        role: 'user' as const,
        content: turn.question,
        status: 'success' as const,
      });
      items.push({
        id: `ai-${turn.providerId}-${idx}`,
        role: 'assistant' as const,
        content: turn.response,
        reasoningContent: turn.thinkResponse,
        status: 'success' as const,
      });
    });

    // 当前用户消息
    if (currentQuestion) {
      items.push({
        id: 'user-current',
        role: 'user' as const,
        content: currentQuestion,
        status: 'success' as const,
      });
    }

    // 当前 AI 回复
    if (status !== 'idle') {
      items.push({
        id: `ai-current-${providerId}`,
        role: 'assistant' as const,
        content: response || '',
        reasoningContent: thinkResponse,
        status: status === 'running' ? 'loading' as const : status === 'error' ? 'error' as const : 'success' as const,
      });
    }

    return items;
  }, [conversationTurns, currentQuestion, response, thinkResponse, status, providerId]);

  // 发送请求
  const handleRequest = useCallback((query: string) => {
    setInputStr(query);
    submit();
  }, [setInputStr, submit]);

  // 取消请求（暂不支持，待实现）
  const handleAbort = useCallback(() => {
    // TODO: 实现取消逻辑
    console.warn('取消功能待实现');
  }, []);

  return {
    messages,
    isRequesting: status === 'running',
    onRequest: handleRequest,
    abort: handleAbort,
    thinkingContent: thinkResponse || '',
  };
}

export default useAIClashChat;
