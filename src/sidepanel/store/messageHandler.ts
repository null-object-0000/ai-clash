import { message } from 'antd';
import { MSG_TYPES } from '../../shared/messages.js';
import { PROVIDER_IDS, type ProviderId, type ProviderStatus, PROVIDER_NAME_MAP } from '../types';
import { buffers, createDefaultRecord } from './helpers';
import type { AppStore } from './types';

type StoreGet = () => AppStore;
type StoreSet = (partial: Partial<AppStore> | ((prev: AppStore) => Partial<AppStore>)) => void;

const STAGE_INDEX: Record<string, number> = {
  waiting: -1, opening: 0, loading: 1, connecting: 2, sending: 3, thinking: 4, responding: 5,
};

const SUMMARY_ANALYSIS_TITLE_ALIASES: Record<string, string> = {
  综合解析: '裁判取舍',
  综合分析: '裁判取舍',
};

const SUMMARY_HEADING_RE = /^#{1,6}\s*(核心共识|观点对撞|裁判取舍|综合解析|综合分析|最终建议|终极建议|最终结论|建议)\s*$/gm;
const SUMMARY_ANALYSIS_TITLES = new Set(['核心共识', '观点对撞', '裁判取舍']);
const SUMMARY_FINAL_TITLES = new Set(['最终建议', '终极建议', '最终结论', '建议']);
const SUMMARY_MARKER_RE = /^\s*\[\[AI_CLASH_SUMMARY_ANALYSIS_(?:BEGIN|END)\]\]\s*$/gm;

function normalizeSummaryHeading(title: string) {
  const trimmed = title.trim();
  return SUMMARY_ANALYSIS_TITLE_ALIASES[trimmed] || trimmed;
}

function splitSummaryOutputFallback(markdown: string): { analysis: string; final: string } | null {
  const cleaned = markdown.replace(SUMMARY_MARKER_RE, '').trim();
  const matches = Array.from(cleaned.matchAll(SUMMARY_HEADING_RE));
  if (!matches.length) return null;

  const sections = matches.map((match, index) => {
    const headingStart = match.index ?? 0;
    const contentStart = headingStart + match[0].length;
    const nextStart = matches[index + 1]?.index ?? cleaned.length;
    const title = normalizeSummaryHeading(match[1]);
    return {
      title,
      content: cleaned.slice(contentStart, nextStart).trim(),
    };
  });

  const analysisSections = sections.filter(section => SUMMARY_ANALYSIS_TITLES.has(section.title) && section.content);
  const finalSections = sections.filter(section => SUMMARY_FINAL_TITLES.has(section.title) && section.content);
  if (!analysisSections.length || !finalSections.length) return null;

  return {
    analysis: analysisSections
      .map(section => `### ${section.title}\n${section.content}`)
      .join('\n\n'),
    final: finalSections.map(section => section.content).join('\n\n').trim(),
  };
}

function salvageSummaryBuffers(set: StoreSet) {
  if (buffers.summaryAnalysis.trim()) return;

  const fallback = splitSummaryOutputFallback(buffers.summaryFull || '');
  if (!fallback) return;

  buffers.summaryAnalysis = fallback.analysis;
  buffers.summaryFull = fallback.final;
  buffers.summaryAnalysisDisplayedLen = fallback.analysis.length;
  buffers.summaryDisplayedLen = fallback.final.length;
  set({
    summaryAnalysisResponse: fallback.analysis,
    summaryResponse: fallback.final,
  });
}

function trackStageTransition(prov: ProviderId, newStage: string, get: StoreGet) {
  const prevStage = get().stageMap[prov];
  const prevIdx = STAGE_INDEX[prevStage] ?? -1;
  const newIdx = STAGE_INDEX[newStage] ?? -1;
  if (prevIdx >= 0 && newIdx > prevIdx) {
    buffers.visitedStages[prov].add(prevStage);
  }
  buffers.visitedStages[prov].add(newStage);
}

export function createMessageListener(
  get: StoreGet,
  set: StoreSet,
  syncProviderRawUrls: (ids: ProviderId[]) => Promise<void>,
) {
  return (request: any, sender: any, sendResponse: any) => {
    const { provider } = request.payload || {};
    const store = get();

    if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
      const p = request.payload;
      if (provider === '_summary') {
        if (p.isStatus) { set({ summaryOperationStatus: p.text }); return; }
        if (p.stage) set({ summaryStage: p.stage });
        if (p.summaryPart === 'final' && p.text && !buffers.summaryTiming.firstContentTime) buffers.summaryTiming.firstContentTime = Date.now();
        if (p.summaryPart === 'analysis') buffers.summaryAnalysis += p.text;
        else if (p.isThink) buffers.summaryThink += p.text;
        else buffers.summaryFull += p.text;
        if (buffers.animationId == null) buffers.animationId = requestAnimationFrame(get().tickStreamDisplay);
        return;
      }
      const prov = provider as ProviderId;
      if (!prov) return;
      if (p.isStatus) {
        // clearError: true 表示清除之前的错误状态（重试成功场景）
        if (p.clearError) {
          set(prev => ({
            errorTypeMap: { ...prev.errorTypeMap, [prov]: 'none' },
            stageMap: { ...prev.stageMap, [prov]: 'connecting' },
            responses: { ...prev.responses, [prov]: '' },
            thinkResponses: { ...prev.thinkResponses, [prov]: '' },
            operationStatus: { ...prev.operationStatus, [prov]: '' },
          }));
          // 清除 buffers 中的文本，下次 tickStreamDisplay 会清空 UI 显示
          buffers.fullText[prov] = '';
          buffers.displayedLen[prov] = 0;
          buffers.thinkText[prov] = '';
          buffers.thinkDisplayedLen[prov] = 0;
        } else {
          set((prev: AppStore) => ({ operationStatus: { ...prev.operationStatus, [prov]: p.text } }));
        }
        if (p.stage) buffers.visitedStages[prov].add(p.stage);
        get().schedulePersist();
        return;
      }
      if (!p.isThink && p.text && !buffers.timing[prov].firstContentTime) buffers.timing[prov].firstContentTime = Date.now();
      if (p.stage) {
        trackStageTransition(prov, p.stage, get);
        set((prev: AppStore) => ({ stageMap: { ...prev.stageMap, [prov]: p.stage } }));
      } else if (p.text?.length > 0) {
        trackStageTransition(prov, 'responding', get);
        set((prev: AppStore) => ({ stageMap: { ...prev.stageMap, [prov]: 'responding' } }));
      }
      if (p.isThink) {
        // 即使没有开启深度思考模式，也要保存思考内容（底层模型可能仍然输出了思考）
        // if (!get().isDeepThinkingEnabled) return;
        buffers.thinkText[prov] = (buffers.thinkText[prov] || '') + p.text;
      } else {
        buffers.fullText[prov] = (buffers.fullText[prov] || '') + p.text;
      }
      if (buffers.animationId == null) buffers.animationId = requestAnimationFrame(get().tickStreamDisplay);
      get().schedulePersist();

    } else if (request.type === MSG_TYPES.TASK_STATUS_UPDATE) {
      if (provider === '_summary') { set({ summaryStatus: 'running', summaryOperationStatus: request.payload.text || '' }); return; }
      const prov = provider as ProviderId;
      if (!prov) return;
      if (get().statusMap[prov] === 'error') return;
      const stage = request.payload.stage;
      if (stage) trackStageTransition(prov, stage, get);
      set((prev: AppStore) => ({
        statusMap: { ...prev.statusMap, [prov]: 'running' },
        operationStatus: { ...prev.operationStatus, [prov]: request.payload.text || '' },
        ...(stage ? { stageMap: { ...prev.stageMap, [prov]: stage } } : {}),
      }));
      get().schedulePersist();

    } else if (request.type === MSG_TYPES.TASK_COMPLETED) {
      if (provider === '_summary') {
        salvageSummaryBuffers(set);
        const s = get();

        // 新生成的版本
        const newVersion = {
          response: buffers.summaryFull || '',
          thinkResponse: buffers.summaryThink || '',
          analysisResponse: buffers.summaryAnalysis || '',
          stats: null,
          createdAt: Date.now(),
        };

        // 添加到版本数组
        const updatedVersions = [...s.summaryVersions, newVersion];
        const newVersionIndex = updatedVersions.length - 1;

        set({
          summaryStatus: 'completed',
          summaryOperationStatus: '',
          summaryVersions: updatedVersions,
          summaryCurrentVersion: newVersionIndex,
        });

        if (buffers.summaryTiming.startTime > 0 && buffers.summaryTiming.firstContentTime > 0) {
          const now = Date.now();
          const charCount = buffers.summaryFull?.length || 0;
          const ttff = buffers.summaryTiming.firstContentTime - buffers.summaryTiming.startTime;
          const totalTime = now - buffers.summaryTiming.startTime;
          const outputSecs = (now - buffers.summaryTiming.firstContentTime) / 1000;
          const stats = { ttff, totalTime, charCount, charsPerSec: outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0 };

          set(prev => ({
            summaryStats: stats,
            summaryVersions: prev.summaryVersions.map((v, i) =>
              i === newVersionIndex ? { ...v, stats } : v
            ),
          }));
        }

        get().schedulePersist();
        return;
      }
      const prov = provider as ProviderId;
      if (!prov) return;
      if (get().statusMap[prov] === 'completed') return;

      set((prev: AppStore) => ({ statusMap: { ...prev.statusMap, [prov]: 'completed' }, operationStatus: { ...prev.operationStatus, [prov]: '' } }));
      const timing = buffers.timing[prov];
      if (timing.startTime > 0 && timing.firstContentTime > 0) {
        const now = Date.now();
        const charCount = buffers.fullText[prov]?.length || 0;
        const ttff = timing.firstContentTime - timing.startTime;
        const totalTime = now - timing.startTime;
        const outputSecs = (now - timing.firstContentTime) / 1000;
        set((prev: AppStore) => ({ statsMap: { ...prev.statsMap, [prov]: { ttff, totalTime, charCount, charsPerSec: outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0 } } }));
      }
      syncProviderRawUrls([prov]);
      get().schedulePersist();

      // 多通道模式下，通道输出完成后自动折叠该通道和深度思考
      setTimeout(() => {
        const s = get();
        const enabledCount = PROVIDER_IDS.filter(id => s.enabledMap[id]).length;
        const stillRunning = PROVIDER_IDS.some(id => s.statusMap[id] === 'running');
        if (enabledCount >= 2) {
          // 多通道模式：当前通道完成后立即折叠通道和深度思考
          set((prev: AppStore) => ({
            collapseMap: { ...prev.collapseMap, [prov]: true },
            thinkExpandedMap: { ...prev.thinkExpandedMap, [prov]: false },
          }));
        }
        if (!stillRunning) {
          if (s.isSummaryEnabled && s.hasAsked && !s.isCurrentSessionFromHistory) get().triggerSummary();
        } else if (s.isFocusFollowEnabled) {
          chrome.runtime?.sendMessage({
            type: MSG_TYPES.TRY_FOCUS_FOLLOW,
            payload: { completedProvider: prov }
          });
        }
      }, 50);

    } else if (request.type === MSG_TYPES.ERROR) {
      if (provider === '_summary') {
        const errMsg = request.payload.message || request.payload.error || '未知错误';
        buffers.summaryFull = `[归纳总结出错] ${errMsg}`;
        buffers.summaryDisplayedLen = buffers.summaryFull.length;
        set({ summaryStatus: 'error', summaryOperationStatus: '', summaryResponse: buffers.summaryFull });
        return;
      }
      const prov = provider as ProviderId;
      if (!prov) return;
      if (get().statusMap[prov] === 'error') return; // Deduplication

      const errorType = request.payload.errorType || 'system_error';
      const errMsg = request.payload.message || request.payload.error || '未知错误';

      // 统一按普通错误处理，避免前置登录判断误导主流程
      const errText = `[系统报错] ${errMsg}`;
      buffers.fullText[prov] = errText;
      buffers.displayedLen[prov] = errText.length;
      set((prev: AppStore) => ({
        statusMap: { ...prev.statusMap, [prov]: 'error' },
        operationStatus: { ...prev.operationStatus, [prov]: '' },
        responses: { ...prev.responses, [prov]: errText },
        errorTypeMap: { ...prev.errorTypeMap, [prov]: errorType },
      }));

      syncProviderRawUrls([prov]);
      get().schedulePersist();

      setTimeout(() => {
        const s = get();
        const stillRunning = PROVIDER_IDS.some(id => s.statusMap[id] === 'running');
        if (!stillRunning && s.isSummaryEnabled && s.hasAsked && !s.isCurrentSessionFromHistory) {
          get().triggerSummary();
        } else if (stillRunning && s.isFocusFollowEnabled) {
          chrome.runtime?.sendMessage({
            type: MSG_TYPES.TRY_FOCUS_FOLLOW,
            payload: { completedProvider: prov }
          });
        }
      }, 50);
    } else if (request.type === MSG_TYPES.GET_RUNNING_PROVIDERS) {
      if (sendResponse) {
        const s = get();
        const runningIds = PROVIDER_IDS.filter(id => s.statusMap[id] === 'running');
        sendResponse({ runningIds });
      }
      return false; // synchronous response
    } else if (request.type === MSG_TYPES.SHOW_TOAST) {
      const msg = request.payload?.message;
      if (msg) message.success(msg);
    }
    return false;
  };
}
