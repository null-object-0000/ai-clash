/**
 * 通义千问 (Qianwen) Provider Configuration
 */

import type { ProviderConfig, ToggleAction } from '../core/types.js';
import { simulateRealClick } from '../core/dom-utils.js';
import { IncrementalHelper } from '../core/incremental-utils.js';

// 思考模式实现（深度思考）
const thinkingAction: ToggleAction = {
  async getState() {
    // 查找关闭按钮，找到就说明已开启深度思考
    const closeBtn = document.querySelector('[aria-label="深度思考"][aria-pressed="true"]');
    const container = document.querySelector('[aria-label="深度思考"]');
    if (!container) return { found: false, enabled: false };
    return { found: true, enabled: !!closeBtn };
  },

  async enable() {
    // 先检查是否已开启（有关闭按钮说明已开启）
    const closeBtn = document.querySelector('[aria-label="深度思考"][aria-pressed="true"]');
    if (closeBtn) return true; // 已开启，无需操作

    // 未开启时点击容器开启深度思考
    const container = document.querySelector('[aria-label="深度思考"]');
    if (!container) return false;
    simulateRealClick(container);
    return true;
  },

  async disable() {
    // 点击关闭按钮来关闭深度思考
    const closeBtn = document.querySelector('[aria-label="深度思考"][aria-pressed="true"]');
    if (!closeBtn) return false; // 未开启，无需关闭
    simulateRealClick(closeBtn);
    return true;
  },
};

export const qianwenProvider: ProviderConfig = {
  id: 'qianwen',
  name: '通义千问',
  domain: 'qianwen.com',  // 支持 www.qianwen.com / chat2.qianwen.com
  auth: {
    failureMessage: '通义千问当前未登录，请先完成登录后再重试',
    getLoginState() {
      const user = (window as any)._USER_;
      if (!user) {
        return { status: 'unknown', message: '无法确认通义千问登录状态' };
      }
      if (user.userId || user.aliyunUid) {
        return { status: 'logged_in' };
      }
      return { status: 'logged_out', message: '通义千问当前未登录，请先完成登录后再重试' };
    },
  },
  actions: {
    // 基础对话能力
    chat: {
      // 开启新对话
      newChat: {
        button: [
          '[data-icon-type="qwpcicon-newDialogueMedium"]',
          '[data-icon-type="qwpcicon-newDialogue"]',
        ],
      },
      // 输入消息
      input: {
        box: [
          '#chat-input',
          'textarea[placeholder*="输入"]',
          '[contenteditable="true"]',
          '[data-slate-editor]',
        ],
      },
      // 发送消息
      send: {
        button: [
          '[data-icon-type="qwpcicon-sendChat"]'
        ],
      },
    },
    // 思考模式（深度思考）- 使用抽象接口
    thinking: thinkingAction,
  },
  // 会话 ID 提取配置
  // 通义千问 URL 格式：https://www.qianwen.com/chat/{conversationId}
  conversation: {
    idFromUrl: {
      pattern: '/chat/(.+)',
      captureGroup: 1,
    },
  },
  // SSE 流式拦截配置
  sse: (() => {
    let helper = new IncrementalHelper();

    return {
      urlPattern: '/api/v2/chat',
      detectionKeywords: ['"messages":', '"error_code":'],
      parseLine: (line: string) => {
        line = line.trim();
        if (!line) return null;

        const json = line.substring(5).trim();
        if (!json || line === 'event:complete') {
          // 重置状态
          helper.reset();
          return { text: '', isThink: null, done: true };
        }

        try {
          const d = JSON.parse(json);

          // 检查错误码
          if (d.error_code !== 0) {
            return null;
          }

          // 屏蔽千问最后还会输出一次全量信息的情况
          if (d.error_msg === 'request process success!') {
            return null;
          }

          // 获取消息数组
          let msgArr: any[] | null = null;
          if (d.data && Array.isArray(d.data.messages)) {
            msgArr = d.data.messages;
          }

          if (!msgArr || msgArr.length === 0) {
            return null;
          }

          // 找到 mime_type = "multi_load/iframe" 的消息
          let targetMsg: any = null;
          for (let i = msgArr.length - 1; i >= 0; i--) {
            const msg = msgArr[i];
            if (msg && msg.mime_type === 'multi_load/iframe') {
              targetMsg = msg;
              break;
            }
          }

          if (!targetMsg) {
            return null;
          }

          // 看是否是首包
          if (targetMsg.meta_data && targetMsg.meta_data.first_packet) {
            helper = new IncrementalHelper(); // 首包重置状态
          }

          // 检查是否有思考块 (type = deep_think)
          let thinkContent: string | null = null;
          let thinkingCompleted = false;

          if (targetMsg.meta_data && Array.isArray(targetMsg.meta_data.multi_load)) {
            for (const item of targetMsg.meta_data.multi_load) {
              if (item && item.type === 'deep_think' && item.content) {
                thinkContent = item.content.think_content.trimStart();
                // 检查思考是否完成
                if (thinkContent && item.content.status === 'complete') {
                  thinkingCompleted = true;
                  // 剔除思考内容结尾的换行符
                  thinkContent = thinkContent.trimEnd();
                }
                break;
              }
            }
          }

          // 使用公共方法处理思考内容增量
          let thinkResult: ReturnType<IncrementalHelper['process']> | null = null;
          if (thinkContent !== null) {
            thinkResult = helper.process('thinking', thinkContent, thinkingCompleted, true);
          }

          // 优先返回思考增量
          if (thinkResult && thinkResult.delta) {
            return {
              text: thinkResult.delta,
              isThink: true,
              done: thinkResult.done,
            };
          }

          // 使用公共方法处理正式内容增量
          let contentResult: ReturnType<IncrementalHelper['process']> | null = null;
          if (targetMsg.content && typeof targetMsg.content === 'string') {
            // 跳过 [(deep_think)] 占位标记
            const contentStr = targetMsg.content.replace('[(deep_think)]\n\n\n', '').replace('[(deep_think)]\n\n', '').replace('[(deep_think)]\n', '').replace('[(deep_think)]', '');
            const contentDone = targetMsg.status === 'complete';
            contentResult = helper.process('content', contentStr, contentDone, false);
          }

          // 返回正式内容增量
          if (contentResult && contentResult.delta) {
            return {
              text: contentResult.delta,
              isThink: false,
              done: contentResult.done,
            };
          }

          // 全部完成
          if (contentResult?.done) {
            helper.reset();
            return { text: '', isThink: null, done: true };
          }

          return null;
        } catch (e) {
          return null;
        }
      },
    };
  })(),
};

export default qianwenProvider;
