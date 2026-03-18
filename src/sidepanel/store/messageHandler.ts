import { MSG_TYPES } from '../../shared/messages.js';
import { PROVIDER_IDS, type ProviderId, type ProviderStatus } from '../types';
import { buffers, createDefaultRecord } from './helpers';
import type { AppStore } from './types';

type StoreGet = () => AppStore;
type StoreSet = (partial: Partial<AppStore> | ((prev: AppStore) => Partial<AppStore>)) => void;

export function createMessageListener(
  get: StoreGet,
  set: StoreSet,
  syncProviderRawUrls: (ids: ProviderId[]) => Promise<void>,
) {
  return (request: any) => {
    const { provider } = request.payload || {};
    const store = get();

    if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
      const p = request.payload;
      if (provider === '_summary') {
        if (p.isStatus) { set({ summaryOperationStatus: p.text }); return; }
        if (p.stage) set({ summaryStage: p.stage });
        if (!p.isThink && p.text && !buffers.summaryTiming.firstContentTime) buffers.summaryTiming.firstContentTime = Date.now();
        setTimeout(() => {
          if (p.isThink) buffers.summaryThink += p.text;
          else buffers.summaryFull += p.text;
          if (buffers.animationId == null) buffers.animationId = requestAnimationFrame(get().tickStreamDisplay);
        }, 0);
        return;
      }
      const prov = provider as ProviderId;
      if (!prov) return;
      if (p.isStatus) { set((prev: AppStore) => ({ operationStatus: { ...prev.operationStatus, [prov]: p.text } })); get().schedulePersist(); return; }
      if (!p.isThink && p.text && !buffers.timing[prov].firstContentTime) buffers.timing[prov].firstContentTime = Date.now();
      if (p.stage) set((prev: AppStore) => ({ stageMap: { ...prev.stageMap, [prov]: p.stage } }));
      else if (p.text?.length > 0) set((prev: AppStore) => ({ stageMap: { ...prev.stageMap, [prov]: 'responding' } }));
      setTimeout(() => {
        if (p.isThink) {
          if (!get().isDeepThinkingEnabled) return;
          buffers.thinkText[prov] = (buffers.thinkText[prov] || '') + p.text;
        } else {
          buffers.fullText[prov] = (buffers.fullText[prov] || '') + p.text;
        }
        if (buffers.animationId == null) buffers.animationId = requestAnimationFrame(get().tickStreamDisplay);
        get().schedulePersist();
      }, 0);

    } else if (request.type === MSG_TYPES.TASK_STATUS_UPDATE) {
      if (provider === '_summary') { set({ summaryStatus: 'running', summaryOperationStatus: request.payload.text || '' }); return; }
      const prov = provider as ProviderId;
      if (!prov) return;
      set((prev: AppStore) => ({ statusMap: { ...prev.statusMap, [prov]: 'running' }, operationStatus: { ...prev.operationStatus, [prov]: request.payload.text || '' } }));
      get().schedulePersist();

    } else if (request.type === MSG_TYPES.TASK_COMPLETED) {
      if (provider === '_summary') {
        set({ summaryStatus: 'completed', summaryOperationStatus: '' });
        if (buffers.summaryTiming.startTime > 0 && buffers.summaryTiming.firstContentTime > 0) {
          const now = Date.now();
          const charCount = buffers.summaryFull?.length || 0;
          const ttff = buffers.summaryTiming.firstContentTime - buffers.summaryTiming.startTime;
          const totalTime = now - buffers.summaryTiming.startTime;
          const outputSecs = (now - buffers.summaryTiming.firstContentTime) / 1000;
          set({ summaryStats: { ttff, totalTime, charCount, charsPerSec: outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0 } });
        }
        get().schedulePersist();
        return;
      }
      const prov = provider as ProviderId;
      if (!prov) return;
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

      setTimeout(() => {
        const s = get();
        const stillRunning = PROVIDER_IDS.some(id => s.statusMap[id] === 'running');
        if (!stillRunning) {
          setTimeout(() => set({ openMap: createDefaultRecord(false) }), 1500);
          if (s.isSummaryEnabled && s.hasAsked && !s.isCurrentSessionFromHistory) get().triggerSummary();
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
      const errText = `[系统报错] ${request.payload.message || request.payload.error || '未知错误'}`;
      buffers.fullText[prov] = errText;
      buffers.displayedLen[prov] = errText.length;
      set((prev: AppStore) => ({
        statusMap: { ...prev.statusMap, [prov]: 'error' },
        operationStatus: { ...prev.operationStatus, [prov]: '' },
        responses: { ...prev.responses, [prov]: errText },
      }));
      syncProviderRawUrls([prov]);
      get().schedulePersist();

      setTimeout(() => {
        const s = get();
        const stillRunning = PROVIDER_IDS.some(id => s.statusMap[id] === 'running');
        if (!stillRunning && s.isSummaryEnabled && s.hasAsked && !s.isCurrentSessionFromHistory) get().triggerSummary();
      }, 50);
    }
  };
}
