<template>
  <div
    class="app-shell flex flex-col h-screen bg-slate-50 text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">

    <header
      class="flex items-center justify-between px-4 py-3 bg-white/75 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 px-2 text-slate-500 shadow-sm hover:text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          @click="createNewChat"
          :disabled="!hasAsked || isRunning"
          aria-label="新建对话">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm hover:text-slate-700 hover:border-slate-300 transition-colors"
          @click="isHistoryPanelOpen = !isHistoryPanelOpen"
          aria-label="历史对话">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.05 11A9 9 0 1112 21v-3" />
          </svg>
          <span class="text-[11px]">{{ historyList.length }}</span>
        </button>
      </div>
      <div class="relative flex items-center gap-2">
        <!-- 单通道/多轮对话时显示绿色标签，多通道显示 MoE 模式 -->
        <div
          v-if="isMultiTurnSession && hasAsked"
          class="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 transition-colors">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          多轮对话
        </div>
        <div
          v-else-if="singleChannelProviderId"
          class="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 transition-colors">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          单通道
        </div>
        <div
          v-else
          class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          MoE 模式
        </div>
      </div>

      <HistoryPanel
        v-if="isHistoryPanelOpen"
        :history-list="historyList"
        :active-session-id="activeSessionId"
        :has-asked="hasAsked"
        :is-running="isRunning"
        @create-new-chat="createNewChat"
        @restore-session="restoreHistorySession"
        @delete-item="deleteHistoryItem"
        @clear-all="clearAllHistory"
        @close="isHistoryPanelOpen = false"
      />
    </header>

    <main class="flex-1 overflow-y-auto px-4 py-5 space-y-6 scroll-smooth" ref="chatContainer">

      <div v-if="!hasAsked" class="min-h-full flex items-start justify-center pt-2">
        <div class="w-full max-w-[360px] mx-auto space-y-3">
          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-[18px] leading-7 font-semibold tracking-[-0.02em] text-slate-900">开始新对话</h2>
                <p class="mt-1 text-[12px] leading-6 text-slate-500">
                  先选择要参与的通道。单个通道的详细参数，点对应的“设置”再调。
                </p>
              </div>
              <div class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                {{ getEnabledProviderIds().length }}/{{ PROVIDER_META.length }}
              </div>
            </div>
            <!-- 单通道 / 多通道模式动态提示 -->
            <div class="mt-2.5 pt-2.5 border-t border-slate-100">
              <div v-if="getEnabledProviderIds().length === 1" class="flex items-center gap-1.5 text-[11px] text-emerald-600">
                <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
                </svg>
                单通道模式 · 支持多轮对话，可连续追问
              </div>
              <div v-else-if="getEnabledProviderIds().length >= 2" class="flex items-center gap-1.5 text-[11px] text-indigo-500">
                <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                MoE 对比模式 · {{ getEnabledProviderIds().length }} 个通道并行回答
              </div>
              <div v-else class="text-[11px] text-slate-400">请至少选择一个通道</div>
            </div>
          </div>

          <ChannelList
            :provider-meta="PROVIDER_META"
            :is-enabled="(id: string) => isProviderEnabled(id as ProviderId)"
            :get-mode-text="(id: string) => getProviderModeText(id as ProviderId)"
            :get-mode-value="(id: string) => getModeValue(id as ProviderId)"
            @view-history="isHistoryPanelOpen = true"
            @open-settings="(id) => openProviderSettings(id as ProviderId)"
            @toggle="(id) => handleToggleProvider(id as ProviderId)"
            @go="(id) => handleGoToProvider(id as ProviderId)"
          />
        </div>
      </div>

      <template v-else>
        <!-- 多轮对话：历史轮次（仅单通道模式下出现） -->
        <template v-if="conversationTurns.length > 0">
          <template v-for="(turn, idx) in conversationTurns" :key="idx">
            <div class="flex justify-end">
              <div
                class="bg-slate-700 text-white text-[13px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-sm leading-7 break-words tracking-[0.01em] opacity-80">
                {{ turn.question }}
              </div>
            </div>
            <ChatMessage
              :provider-id="turn.providerId"
              :provider-name="getProviderLabel(turn.providerId)"
              :theme-color="getProviderThemeColor(turn.providerId)"
              status="completed"
              stage="responding"
              :response="turn.response"
              :think-response="turn.thinkResponse"
              :raw-url="turn.rawUrl"
              :is-from-history="true"
              :is-deep-thinking-enabled="isDeepThinkingEnabled"
              :stats="turn.stats"
            />
          </template>
          <div class="flex items-center gap-2 my-1 opacity-40">
            <div class="flex-1 border-t border-dashed border-slate-300"></div>
            <span class="text-[10px] text-slate-400 whitespace-nowrap">继续对话</span>
            <div class="flex-1 border-t border-dashed border-slate-300"></div>
          </div>
        </template>

        <div class="flex justify-end">
          <div
            class="bg-slate-900 text-white text-[13px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-md leading-7 break-words tracking-[0.01em]">
            {{ currentQuestion }}
          </div>
        </div>

        <!-- 单通道：对话气泡样式 -->
        <template v-if="singleChannelProviderId">
          <ChatMessage
            :provider-id="singleChannelProviderId"
            :provider-name="getProviderLabel(singleChannelProviderId)"
            :theme-color="getProviderThemeColor(singleChannelProviderId as ProviderId)"
            :status="statusMap[singleChannelProviderId as ProviderId]"
            :stage="stageMap[singleChannelProviderId as ProviderId]"
            :response="responses[singleChannelProviderId as ProviderId]"
            :think-response="thinkResponses[singleChannelProviderId as ProviderId]"
            :operation-status="operationStatus[singleChannelProviderId as ProviderId]"
            :raw-url="rawUrlMap[singleChannelProviderId as ProviderId]"
            :is-from-history="isCurrentSessionFromHistory"
            :is-deep-thinking-enabled="isDeepThinkingEnabled"
            :stats="statsMap[singleChannelProviderId as ProviderId]"
          />
        </template>

        <!-- 多通道：折叠面板 -->
        <template v-else>
          <!-- DeepSeek 折叠面板 -->
          <ProviderCollapse
            v-if="isDeepSeekEnabled"
            provider-id="deepseek"
            provider-name="DeepSeek"
            theme-color="blue"
            :status="statusMap.deepseek"
            :stage="stageMap.deepseek"
            :response="responses.deepseek"
            :think-response="thinkResponses.deepseek"
            :operation-status="operationStatus.deepseek"
            :raw-url="rawUrlMap.deepseek"
            :is-from-history="isCurrentSessionFromHistory"
            :is-deep-thinking-enabled="isDeepThinkingEnabled"
            :default-open="isDeepSeekOpen"
            :stats="statsMap.deepseek"
          />

          <!-- 豆包 折叠面板 -->
          <ProviderCollapse
            v-if="isDoubaoEnabled"
            provider-id="doubao"
            provider-name="豆包"
            theme-color="amber"
            :status="statusMap.doubao"
            :stage="stageMap.doubao"
            :response="responses.doubao"
            :think-response="thinkResponses.doubao"
            :operation-status="operationStatus.doubao"
            :raw-url="rawUrlMap.doubao"
            :is-from-history="isCurrentSessionFromHistory"
            :is-deep-thinking-enabled="isDeepThinkingEnabled"
            :default-open="isDoubaoOpen"
            :stats="statsMap.doubao"
          />

          <!-- 千问 折叠面板 -->
          <ProviderCollapse
            v-if="isQianwenEnabled"
            provider-id="qianwen"
            provider-name="千问"
            theme-color="emerald"
            :status="statusMap.qianwen"
            :stage="stageMap.qianwen"
            :response="responses.qianwen"
            :think-response="thinkResponses.qianwen"
            :operation-status="operationStatus.qianwen"
            :raw-url="rawUrlMap.qianwen"
            :is-from-history="isCurrentSessionFromHistory"
            :is-deep-thinking-enabled="isDeepThinkingEnabled"
            :default-open="isQianwenOpen"
            :stats="statsMap.qianwen"
          />

          <!-- LongCat 折叠面板 -->
          <ProviderCollapse
            v-if="isLongcatEnabled"
            provider-id="longcat"
            provider-name="LongCat"
            theme-color="violet"
            :status="statusMap.longcat"
            :stage="stageMap.longcat"
            :response="responses.longcat"
            :think-response="thinkResponses.longcat"
            :operation-status="operationStatus.longcat"
            :raw-url="rawUrlMap.longcat"
            :is-from-history="isCurrentSessionFromHistory"
            :is-deep-thinking-enabled="isDeepThinkingEnabled"
            :default-open="isLongcatOpen"
            :stats="statsMap.longcat"
          />

          <!-- 元宝 折叠面板 -->
          <ProviderCollapse
            v-if="isYuanbaoEnabled"
            provider-id="yuanbao"
            provider-name="元宝"
            theme-color="teal"
            :status="statusMap.yuanbao"
            :stage="stageMap.yuanbao"
            :response="responses.yuanbao"
            :think-response="thinkResponses.yuanbao"
            :operation-status="operationStatus.yuanbao"
            :raw-url="rawUrlMap.yuanbao"
            :is-from-history="isCurrentSessionFromHistory"
            :is-deep-thinking-enabled="isDeepThinkingEnabled"
            :default-open="isYuanbaoOpen"
            :stats="statsMap.yuanbao"
          />
        </template>

        <!-- 归纳总结面板：开启时或历史有汇总内容时显示 -->
        <SummaryPanel
          v-if="hasAsked && isSummaryEnabled && !summaryBlockReason()"
          :status="summaryStatus"
          :stage="summaryStage"
          :response="summaryResponse"
          :think-response="summaryThinkResponse"
          :operation-status="summaryOperationStatus"
          :stats="summaryStats"
        />
      </template>

    </main>

    <ChannelSettingsModal
      v-if="activeProviderSettings"
      :active-provider-id="activeProviderSettings"
      :provider-label="getProviderLabel(activeProviderSettings as ProviderId)"
      :mode="getModeValue(activeProviderSettings as ProviderId)"
      :supports-api="supportsApi(activeProviderSettings as ProviderId)"
      :api-key="getApiKeyValue(activeProviderSettings as ProviderId)"
      :model="getModelValue(activeProviderSettings as ProviderId)"
      :model-options="getModelOptions(activeProviderSettings as ProviderId)"
      :show-api-key="showApiKey[activeProviderSettings] ?? false"
      :testing="testingApiKey[activeProviderSettings] ?? false"
      :api-key-test-result="apiKeyTestResult[activeProviderSettings] ?? null"
      :api-key-link="getProviderMeta(activeProviderSettings as ProviderId)?.apiKeyLink"
      :api-note="getProviderMeta(activeProviderSettings as ProviderId)?.apiNote"
      @close="closeProviderSettings"
      @update:mode="(m) => setProviderMode(activeProviderSettings as ProviderId, m)"
      @update:api-key="(v) => setProviderApiKey(activeProviderSettings as ProviderId, v)"
      @update:model="(v) => setProviderModel(activeProviderSettings as ProviderId, v)"
      @toggle-show-api-key="showApiKey[activeProviderSettings] = !showApiKey[activeProviderSettings]"
      @test-api-key="testApiKey(activeProviderSettings as ProviderId, getApiKeyValue(activeProviderSettings as ProviderId))"
    />

    <!-- 未选通道提示（内嵌样式，替代原生 alert） -->
    <div
      v-if="showNoChannelTip"
      class="fixed inset-0 z-30 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]"
        aria-label="关闭提示"
        @click="showNoChannelTip = false">
      </button>
      <div
        class="relative z-10 w-full max-w-[320px] rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.25)]">
        <p class="text-[14px] leading-6 text-slate-700">请在通道列表中至少开启一个通道后再发送。</p>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            @click="showNoChannelTip = false"
            class="inline-flex h-9 items-center justify-center rounded-full bg-indigo-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-indigo-700">
            确定
          </button>
        </div>
      </div>
    </div>

    <FooterArea
      :input-value="inputStr"
      :is-running="isRunning"
      :is-deep-thinking-enabled="isDeepThinkingEnabled"
      :is-summary-enabled="isSummaryEnabled"
      :is-summary-settings-open="isSummarySettingsOpen"
      :is-debug-enabled="isDebugEnabled"
      :summary-provider-id="summaryProviderId"
      :summary-model="summaryModel"
      :summary-block-reason="summaryBlockReason()"
      :get-summary-provider-options="getSummaryProviderOptions"
      :get-summary-model-options="getSummaryModelOptions"
      :is-multi-turn-session="isMultiTurnSession"
      :has-asked="hasAsked"
      @update:input-value="inputStr = $event"
      @submit="submit"
      @toggle-deep-thinking="isDeepThinkingEnabled = !isDeepThinkingEnabled"
      @toggle-summary-enabled="toggleSummaryEnabled"
      @toggle-summary-settings="isSummarySettingsOpen = !isSummarySettingsOpen"
      @update:summary-provider-id="summaryProviderId = $event"
      @update:summary-model="summaryModel = $event"
      @toggle-debug-enabled="isDebugEnabled = !isDebugEnabled"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue';
import { MSG_TYPES } from '../shared/messages.js';
import logger, { setDebugEnabled } from '../shared/logger.js';
import ProviderCollapse from './components/ProviderCollapse.vue';
import ChatMessage from './components/ChatMessage.vue';
import ChannelList from './components/ChannelList.vue';
import ChannelSettingsModal from './components/ChannelSettingsModal.vue';
import SummaryPanel from './components/SummaryPanel.vue';
import HistoryPanel from './components/HistoryPanel.vue';
import FooterArea from './components/FooterArea.vue';

const PROVIDER_IDS = ['deepseek', 'doubao', 'qianwen', 'longcat', 'yuanbao'] as const;
type ProviderId = typeof PROVIDER_IDS[number];
type ProviderMode = 'web' | 'api';
type ProviderStatus = 'idle' | 'running' | 'completed' | 'error';
type StageType = 'connecting' | 'thinking' | 'responding';
const PROVIDER_META = [
  {
    id: 'deepseek', name: 'DeepSeek', supportsApi: true,
    apiKeyLink: 'https://platform.deepseek.com/api_keys',
    apiNote: undefined,
  },
  {
    id: 'doubao', name: '豆包', supportsApi: true,
    apiKeyLink: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    apiNote: '暂仅支持火山方舟 Coding Plan 模式',
  },
  {
    id: 'qianwen', name: '千问', supportsApi: true,
    apiKeyLink: 'https://bailian.console.aliyun.com/cn-beijing/?tab=coding-plan#/efm/detail',
    apiNote: '暂仅支持阿里云百炼 Coding Plan 模式',
  },
  {
    id: 'longcat', name: 'LongCat', supportsApi: true,
    apiKeyLink: 'https://longcat.chat/platform/api_keys',
    apiNote: undefined,
  },
  {
    id: 'yuanbao', name: '元宝', supportsApi: false,
    apiKeyLink: undefined,
    apiNote: undefined,
  },
] as const;

type SidepanelSettings = {
  isDeepThinkingEnabled?: boolean;
  isSummaryEnabled?: boolean;
  isDebugEnabled?: boolean;
};

type SummaryConfig = {
  providerId?: string;
  model?: string;
};

type ApiConfig = {
  mode?: ProviderMode;
  apiKey?: string;
  model?: string;
  enabled?: boolean;
};

type ProviderHistoryEntry = {
  enabled: boolean;
  mode: ProviderMode;
  status: ProviderStatus;
  stage: StageType;
  response: string;
  thinkResponse: string;
  operationStatus: string;
  rawUrl: string;
  stats: ProviderStats | null;
};

type ProviderStats = {
  ttff: number;
  totalTime: number;
  charCount: number;
  charsPerSec: number;
};

type SummaryHistoryEntry = {
  status: 'idle' | 'running' | 'completed' | 'error';
  response: string;
  thinkResponse: string;
  stats: ProviderStats | null;
};

type HistoryType = 'multi' | 'single';

// 多通道历史：一次提问+多个AI回答
type MultiChannelHistoryItem = {
  id: string;
  type: 'multi';
  question: string;
  createdAt: number;
  providers: Record<ProviderId, ProviderHistoryEntry>;
  summary: SummaryHistoryEntry | null;
  conversationTurns?: CompletedTurn[];
};

// 单通道历史：单个AI多轮对话
type SingleChannelHistoryItem = {
  id: string;
  type: 'single';
  providerId: ProviderId;
  providerName: string;
  createdAt: number;
  updatedAt: number;
  turns: Array<{
    question: string;
    response: string;
    thinkResponse: string;
    createdAt: number;
    stats?: ProviderStats;
    rawUrl?: string;
  }>;
  summary?: SummaryHistoryEntry;
};

// 统一历史条目类型
export type ChatHistoryItem = MultiChannelHistoryItem | SingleChannelHistoryItem;

// 多轮对话：已完成的历史轮次
export interface CompletedTurn {
  question: string;
  providerId: ProviderId;
  response: string;
  thinkResponse: string;
  rawUrl: string;
  stats: ProviderStats | null;
}

// UI 状态控制
const inputStr = ref('');
const currentQuestion = ref('');
const hasAsked = ref(false);
const isDeepThinkingEnabled = ref(true);
const isDebugEnabled = ref(false);
const isDeepSeekEnabled = ref(false);
const isDoubaoEnabled = ref(false);
const isQianwenEnabled = ref(false);
const isLongcatEnabled = ref(false);
const isYuanbaoEnabled = ref(false);
const isDeepSeekOpen = ref(true);
const isDoubaoOpen = ref(true);
const isQianwenOpen = ref(true);
const isLongcatOpen = ref(true);
const isYuanbaoOpen = ref(true);
const deepseekMode = ref<ProviderMode>('web');
const doubaoMode = ref<ProviderMode>('web');
const qianwenMode = ref<ProviderMode>('web');
const longcatMode = ref<ProviderMode>('web');
const deepseekApiKey = ref('');
const doubaoApiKey = ref('');
const qianwenApiKey = ref('');
const longcatApiKey = ref('');
const deepseekModel = ref('');
const doubaoModel = ref('');
const qianwenModel = ref('');
const longcatModel = ref('');
const yuanbaoMode = ref<ProviderMode>('web');
const yuanbaoApiKey = ref('');
const yuanbaoModel = ref('');
const testingApiKey = ref<Record<string, boolean>>({});
const apiKeyTestResult = ref<Record<string, { success: boolean; message: string }>>({});
const showApiKey = ref<Record<string, boolean>>({});
const historyList = ref<ChatHistoryItem[]>([]);
const isHistoryPanelOpen = ref(false);
const activeSessionId = ref('');
const activeProviderSettings = ref<ProviderId | ''>('');
const showNoChannelTip = ref(false);
/** 当前展示的会话是否来自历史恢复（历史会话点原文打开新标签，新会话点原文激活已有 tab） */
const isCurrentSessionFromHistory = ref(false);
/** 多轮对话：已完成的历史轮次（仅单通道模式下生效） */
const conversationTurns = ref<CompletedTurn[]>([]);
/** 当前会话是否以单通道模式启动（用于判断是否继续多轮对话） */
const isMultiTurnSession = ref(false);

const statusMap: Record<ProviderId, ProviderStatus> = reactive({ deepseek: 'idle', doubao: 'idle', qianwen: 'idle', longcat: 'idle', yuanbao: 'idle' });
const responses: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '', yuanbao: '' });
const stageMap: Record<ProviderId, StageType> = reactive({ deepseek: 'connecting', doubao: 'connecting', qianwen: 'connecting', longcat: 'connecting', yuanbao: 'connecting' });
const fullTextBuffer: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '', yuanbao: '' });
const thinkTextBuffer: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '', yuanbao: '' });
const displayedLength: Record<ProviderId, number> = reactive({ deepseek: 0, doubao: 0, qianwen: 0, longcat: 0, yuanbao: 0 });
const thinkDisplayedLength: Record<ProviderId, number> = reactive({ deepseek: 0, doubao: 0, qianwen: 0, longcat: 0, yuanbao: 0 });
const thinkResponses: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '', yuanbao: '' });
const operationStatus: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '', yuanbao: '' });
const rawUrlMap: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '', yuanbao: '' });
const statsMap: Record<ProviderId, ProviderStats | null> = reactive({ deepseek: null, doubao: null, qianwen: null, longcat: null, yuanbao: null });

// 内部计时数据（非响应式，仅用于计算）
const timingData: Record<ProviderId, { startTime: number; firstContentTime: number }> = {
  deepseek: { startTime: 0, firstContentTime: 0 },
  doubao: { startTime: 0, firstContentTime: 0 },
  qianwen: { startTime: 0, firstContentTime: 0 },
  longcat: { startTime: 0, firstContentTime: 0 },
  yuanbao: { startTime: 0, firstContentTime: 0 },
};

// 归纳总结状态
const isSummaryEnabled = ref(false);
const summaryProviderId = ref('');
const summaryModel = ref('');
const isSummarySettingsOpen = ref(false);
const summaryStatus = ref<'idle' | 'running' | 'completed' | 'error'>('idle');
const summaryStage = ref<'thinking' | 'responding'>('responding');
const summaryResponse = ref('');
const summaryThinkResponse = ref('');
const summaryFullBuffer = ref('');
const summaryThinkBuffer = ref('');
const summaryDisplayedLength = ref(0);
const summaryThinkDisplayedLength = ref(0);
const summaryOperationStatus = ref('');
const summaryStats = ref<ProviderStats | null>(null);
let summaryTriggered = false;
let summaryTimingData = { startTime: 0, firstContentTime: 0 };

const chatContainer = ref<HTMLElement | null>(null);
const userHasScrolled = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const SETTINGS_KEY = 'aiclash.sidepanel.settings';
const API_CONFIG_KEY = 'aiclash.api.config';
const SUMMARY_CONFIG_KEY = 'aiclash.summary.config';
const HISTORY_STORAGE_KEY = 'aiclash.chat.history';
const HISTORY_STORAGE_KEY_SINGLE = 'aiclash.chat.history.single';
const MAX_HISTORY_COUNT = 30;
const CHARS_PER_FRAME = 8;

let streamAnimationId: number | null = null;
let historyPersistTimer: number | null = null;
let pendingRawUrlOverrides: Partial<Record<ProviderId, string>> = {};

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatHistoryTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getProviderMeta(providerId: ProviderId) {
  return PROVIDER_META.find(p => p.id === providerId);
}

function supportsApi(providerId: ProviderId) {
  return getProviderMeta(providerId)?.supportsApi ?? false;
}

function isSummaryConfigValid() {
  const pid = summaryProviderId.value as ProviderId;
  if (!pid || !PROVIDER_IDS.includes(pid)) return false;
  return supportsApi(pid) && !!getApiKeyValue(pid).trim();
}

function getSummaryProviderOptions() {
  return PROVIDER_META
    .filter(p => p.supportsApi && getApiKeyValue(p.id as ProviderId).trim())
    .map(p => ({ value: p.id, label: p.name }));
}

function getSummaryModelOptions() {
  if (!summaryProviderId.value) return [];
  return getModelOptions(summaryProviderId.value as ProviderId);
}

function summaryBlockReason(): string | null {
  if (!isSummaryConfigValid()) return '请先配置归纳总结通道';
  if (getEnabledProviderIds().length < 2) return '请选择 2 个或以上通道';
  return null;
}

function toggleSummaryEnabled() {
  if (!isSummaryConfigValid()) {
    isSummarySettingsOpen.value = true;
    return;
  }
  if (getEnabledProviderIds().length < 2) return;
  isSummaryEnabled.value = !isSummaryEnabled.value;
}

function loadSummaryConfig() {
  chrome.storage?.local.get([SUMMARY_CONFIG_KEY], (result) => {
    const saved = (result?.[SUMMARY_CONFIG_KEY] || {}) as SummaryConfig;
    summaryProviderId.value = saved.providerId || '';
    summaryModel.value = saved.model || '';
  });
}

function saveSummaryConfig() {
  chrome.storage?.local.set({
    [SUMMARY_CONFIG_KEY]: {
      providerId: summaryProviderId.value,
      model: summaryModel.value,
    }
  });
}

function resetSummaryState() {
  summaryStatus.value = 'idle';
  summaryStage.value = 'responding';
  summaryResponse.value = '';
  summaryThinkResponse.value = '';
  summaryFullBuffer.value = '';
  summaryThinkBuffer.value = '';
  summaryDisplayedLength.value = 0;
  summaryThinkDisplayedLength.value = 0;
  summaryOperationStatus.value = '';
  summaryStats.value = null;
  summaryTriggered = false;
  summaryTimingData = { startTime: 0, firstContentTime: 0 };
}

async function triggerSummary() {
  if (summaryTriggered) return;
  if (!isSummaryEnabled.value || !isSummaryConfigValid()) return;

  const providerNames: Record<ProviderId, string> = {
    deepseek: 'DeepSeek', doubao: '豆包', qianwen: '千问', longcat: 'LongCat', yuanbao: '元宝'
  };

  const responses = getEnabledProviderIds()
    .filter(id => (statusMap[id] === 'completed' || statusMap[id] === 'error') && fullTextBuffer[id]?.trim())
    .map(id => ({ providerId: id, name: providerNames[id], text: fullTextBuffer[id] }));

  if (responses.length < 2) return;

  summaryTriggered = true;
  summaryStatus.value = 'running';
  summaryOperationStatus.value = '';
  summaryTimingData.startTime = Date.now();

  chrome.runtime?.sendMessage({
    type: MSG_TYPES.DISPATCH_SUMMARY,
    payload: {
      question: currentQuestion.value,
      responses,
      summaryConfig: {
        providerId: summaryProviderId.value,
        model: summaryModel.value,
      },
    }
  });
}

function getProviderLabel(providerId: string) {
  return providerId === 'deepseek' ? 'DeepSeek'
    : providerId === 'doubao' ? '豆包'
    : providerId === 'qianwen' ? '千问'
    : providerId === 'longcat' ? 'LongCat'
    : providerId === 'yuanbao' ? '元宝'
    : providerId;
}

function getProviderThemeColor(providerId: ProviderId): 'blue' | 'amber' | 'emerald' | 'violet' | 'teal' {
  return providerId === 'deepseek' ? 'blue'
    : providerId === 'doubao' ? 'amber'
    : providerId === 'qianwen' ? 'emerald'
    : providerId === 'yuanbao' ? 'teal'
    : 'violet';
}

function getProviderModeText(providerId: ProviderId) {
  const mode = getProviderMode(providerId);
  return mode === 'api' ? 'API' : '网页';
}

function getProviderMode(providerId: ProviderId): ProviderMode {
  return providerId === 'deepseek' ? deepseekMode.value
    : providerId === 'doubao' ? doubaoMode.value
    : providerId === 'qianwen' ? qianwenMode.value
    : providerId === 'yuanbao' ? yuanbaoMode.value
    : longcatMode.value;
}

function getModeValue(providerId: ProviderId) {
  return getProviderMode(providerId);
}

function setProviderMode(providerId: ProviderId, mode: ProviderMode) {
  if (mode === 'api' && !getApiKeyValue(providerId).trim()) return;
  if (providerId === 'deepseek') deepseekMode.value = mode;
  else if (providerId === 'doubao') doubaoMode.value = mode;
  else if (providerId === 'qianwen') qianwenMode.value = mode;
  else if (providerId === 'yuanbao') yuanbaoMode.value = mode;
  else longcatMode.value = mode;
}

function getApiKeyValue(providerId: ProviderId) {
  return providerId === 'deepseek' ? deepseekApiKey.value
    : providerId === 'doubao' ? doubaoApiKey.value
    : providerId === 'qianwen' ? qianwenApiKey.value
    : providerId === 'yuanbao' ? yuanbaoApiKey.value
    : longcatApiKey.value;
}

function setProviderApiKey(providerId: ProviderId, value: string) {
  if (providerId === 'deepseek') deepseekApiKey.value = value;
  else if (providerId === 'doubao') doubaoApiKey.value = value;
  else if (providerId === 'qianwen') qianwenApiKey.value = value;
  else if (providerId === 'yuanbao') yuanbaoApiKey.value = value;
  else longcatApiKey.value = value;
}

function getModelValue(providerId: ProviderId) {
  return providerId === 'deepseek' ? deepseekModel.value
    : providerId === 'doubao' ? doubaoModel.value
    : providerId === 'qianwen' ? qianwenModel.value
    : providerId === 'yuanbao' ? yuanbaoModel.value
    : longcatModel.value;
}

function setProviderModel(providerId: ProviderId, value: string) {
  if (providerId === 'deepseek') deepseekModel.value = value;
  else if (providerId === 'doubao') doubaoModel.value = value;
  else if (providerId === 'qianwen') qianwenModel.value = value;
  else if (providerId === 'yuanbao') yuanbaoModel.value = value;
  else longcatModel.value = value;
}

function getModelOptions(providerId: ProviderId) {
  if (providerId === 'deepseek') {
    return [
      { value: '', label: '默认模型 (deepseek-chat)' },
      { value: 'deepseek-chat', label: 'deepseek-chat（DeepSeek-V3.2，输出最大 8K）' },
      { value: 'deepseek-reasoner', label: 'deepseek-reasoner（DeepSeek-V3.2 思考，输出最大 64K）' }
    ];
  }

  if (providerId === 'longcat') {
    return [
      { value: '', label: '默认模型 (LongCat-Flash-Lite)' },
      { value: 'LongCat-Flash-Lite', label: 'LongCat-Flash-Lite（高效轻量 MoE）' },
      { value: 'LongCat-Flash-Chat', label: 'LongCat-Flash-Chat（通用对话）' },
      { value: 'LongCat-Flash-Thinking', label: 'LongCat-Flash-Thinking（深度思考）' },
      { value: 'LongCat-Flash-Thinking-2601', label: 'LongCat-Flash-Thinking-2601（升级版深度思考）' },
    ];
  }

  if (providerId === 'doubao') {
    return [
      { value: '', label: '默认模型 (ark-code-latest)' },
      { value: 'ark-code-latest', label: 'ark-code-latest（Coding Plan）' },
    ];
  }

  if (providerId === 'qianwen') {
    return [
      { value: '', label: '默认模型 (qwen3.5-plus)' },
      { value: 'qwen3.5-plus',         label: 'qwen3.5-plus（推荐 · 深度思考 · 图片理解）' },
      { value: 'kimi-k2.5',            label: 'kimi-k2.5（推荐 · 深度思考 · 图片理解）' },
      { value: 'glm-5',                label: 'glm-5（推荐 · 深度思考）' },
      { value: 'MiniMax-M2.5',         label: 'MiniMax-M2.5（推荐 · 深度思考）' },
      { value: 'deepseek-v3.2',        label: 'deepseek-v3.2（推荐）' },
      { value: 'qwen3-max-2026-01-23', label: 'qwen3-max-2026-01-23（旗舰 · 深度思考）' },
      { value: 'qwen3-coder-next',     label: 'qwen3-coder-next（编程专用）' },
      { value: 'qwen3-coder-plus',     label: 'qwen3-coder-plus（编程专用·轻量）' },
      { value: 'glm-4.7',              label: 'glm-4.7（深度思考）' },
    ];
  }

  if (providerId === 'yuanbao') {
    return [{ value: '', label: '默认模型（仅支持网页模式）' }];
  }

  return [{ value: '', label: '默认模型' }];
}

function isProviderEnabled(providerId: ProviderId) {
  return providerId === 'deepseek' ? isDeepSeekEnabled.value
    : providerId === 'doubao' ? isDoubaoEnabled.value
    : providerId === 'qianwen' ? isQianwenEnabled.value
    : providerId === 'yuanbao' ? isYuanbaoEnabled.value
    : isLongcatEnabled.value;
}

function openProviderSettings(providerId: ProviderId) {
  activeProviderSettings.value = providerId;
  isHistoryPanelOpen.value = false;
}

function closeProviderSettings() {
  activeProviderSettings.value = '';
}

function handleApiKeyInput(providerId: ProviderId, event: Event) {
  const target = event.target as HTMLInputElement;
  setProviderApiKey(providerId, target.value);
}

function handleModelChange(providerId: ProviderId, event: Event) {
  const target = event.target as HTMLSelectElement;
  setProviderModel(providerId, target.value);
}

function setProviderEnabled(providerId: ProviderId, enabled: boolean) {
  if (providerId === 'deepseek') isDeepSeekEnabled.value = enabled;
  else if (providerId === 'doubao') isDoubaoEnabled.value = enabled;
  else if (providerId === 'qianwen') isQianwenEnabled.value = enabled;
  else if (providerId === 'yuanbao') isYuanbaoEnabled.value = enabled;
  else isLongcatEnabled.value = enabled;
}

function setProviderOpen(providerId: ProviderId, open: boolean) {
  if (providerId === 'deepseek') isDeepSeekOpen.value = open;
  else if (providerId === 'doubao') isDoubaoOpen.value = open;
  else if (providerId === 'qianwen') isQianwenOpen.value = open;
  else if (providerId === 'yuanbao') isYuanbaoOpen.value = open;
  else isLongcatOpen.value = open;
}

function getEnabledProviderIds() {
  return PROVIDER_IDS.filter((providerId) => isProviderEnabled(providerId));
}

function getHistoryEnabledCount(item: ChatHistoryItem) {
  if (item.type === 'single') {
    return 1;
  }
  return PROVIDER_IDS.filter((providerId) => item.providers[providerId]?.enabled).length;
}

function createDefaultHistoryEntry(providerId: ProviderId): ProviderHistoryEntry {
  return {
    enabled: false,
    mode: getProviderMode(providerId),
    status: 'idle',
    stage: 'connecting',
    response: '',
    thinkResponse: '',
    operationStatus: '',
    rawUrl: '',
    stats: null,
  };
}

function saveSettings() {
  chrome.storage?.local.set({
    [SETTINGS_KEY]: {
      isDeepThinkingEnabled: isDeepThinkingEnabled.value,
      isSummaryEnabled: isSummaryEnabled.value,
      isDebugEnabled: isDebugEnabled.value,
    }
  });
}

// 保存多通道历史
function saveMultiChannelHistory(items: MultiChannelHistoryItem[]) {
  chrome.storage?.local.set({
    [HISTORY_STORAGE_KEY]: items.slice(0, MAX_HISTORY_COUNT)
  });
}

// 保存单通道历史
function saveSingleChannelHistory(items: SingleChannelHistoryItem[]) {
  chrome.storage?.local.set({
    [HISTORY_STORAGE_KEY_SINGLE]: items.slice(0, MAX_HISTORY_COUNT)
  });
}

// 保存所有历史（自动拆分类型）
function saveHistory() {
  const multiItems = historyList.value.filter(item => item.type === 'multi') as MultiChannelHistoryItem[];
  const singleItems = historyList.value.filter(item => item.type === 'single') as SingleChannelHistoryItem[];

  saveMultiChannelHistory(multiItems);
  saveSingleChannelHistory(singleItems);
}

// 新增：保存单通道多轮会话
function upsertSingleChannelSession(providerId: ProviderId, question: string, response: string, thinkResponse: string, stats?: ProviderStats, rawUrl?: string) {
  const isMultiTurn = isMultiTurnSession.value && conversationTurns.value.length > 0;
  let session = historyList.value.find(item => item.id === activeSessionId.value && item.type === 'single') as SingleChannelHistoryItem | undefined;

  const now = Date.now();
  const providerNames: Record<ProviderId, string> = {
    deepseek: 'DeepSeek',
    doubao: '豆包',
    qianwen: '千问',
    longcat: 'LongCat',
    yuanbao: '元宝',
  };

  if (session && isMultiTurn) {
    // 检查最后一个轮次是否是同一个问题，如果是则更新，否则追加
    const lastTurn = session.turns[session.turns.length - 1];
    if (lastTurn && lastTurn.question === question) {
      // 同一个问题：更新当前轮次的响应内容
      lastTurn.response = response;
      lastTurn.thinkResponse = thinkResponse;
      lastTurn.stats = stats ?? undefined;
      lastTurn.rawUrl = rawUrl || lastTurn.rawUrl;
    } else {
      // 新问题：追加新的轮次
      session.turns.push({
        question,
        response,
        thinkResponse,
        createdAt: now,
        stats: stats ?? undefined,
        rawUrl,
      });
    }
    session.updatedAt = now;
    session.summary = buildSummaryHistoryEntry() ?? undefined;
  } else if (session) {
    // 已有会话但不是多轮模式：更新第一个轮次
    const firstTurn = session.turns[0];
    if (firstTurn) {
      firstTurn.response = response;
      firstTurn.thinkResponse = thinkResponse;
      firstTurn.stats = stats ?? undefined;
      firstTurn.rawUrl = rawUrl || firstTurn.rawUrl;
    }
    session.updatedAt = now;
    session.summary = buildSummaryHistoryEntry() ?? undefined;
  } else {
    // 新建会话
    const newSession: SingleChannelHistoryItem = {
      id: activeSessionId.value,
      type: 'single',
      providerId,
      providerName: providerNames[providerId] || providerId,
      createdAt: now,
      updatedAt: now,
      turns: [{
        question,
        response,
        thinkResponse,
        createdAt: now,
        stats: stats ?? undefined,
        rawUrl,
      }],
      summary: buildSummaryHistoryEntry() ?? undefined,
    };
    session = newSession;
  }

  // 更新历史列表
  const nextList = historyList.value.filter((historyItem) => historyItem.id !== session.id);
  nextList.unshift(session);
  historyList.value = nextList.slice(0, MAX_HISTORY_COUNT * 2);
  saveHistory();
}

function upsertHistoryItem(item: ChatHistoryItem) {
  const nextList = historyList.value.filter((historyItem) => historyItem.id !== item.id);
  nextList.unshift(item);
  historyList.value = nextList.slice(0, MAX_HISTORY_COUNT * 2);
  saveHistory();
}

function deleteHistoryItem(id: string) {
  historyList.value = historyList.value.filter((item) => item.id !== id);
  saveHistory();
}

function clearAllHistory() {
  historyList.value = [];
  saveHistory();
  isHistoryPanelOpen.value = false;
}

function buildHistoryProviders(rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) {
  return PROVIDER_IDS.reduce((acc, providerId) => {
    acc[providerId] = {
      enabled: isProviderEnabled(providerId),
      mode: getProviderMode(providerId),
      status: statusMap[providerId],
      stage: stageMap[providerId],
      response: responses[providerId],
      thinkResponse: thinkResponses[providerId],
      operationStatus: operationStatus[providerId],
      rawUrl: rawUrlOverrides[providerId] ?? rawUrlMap[providerId] ?? '',
      stats: statsMap[providerId] ?? null,
    };
    return acc;
  }, {} as Record<ProviderId, ProviderHistoryEntry>);
}

function buildSummaryHistoryEntry(): SummaryHistoryEntry | null {
  if (summaryStatus.value === 'idle') return null;
  return {
    status: summaryStatus.value,
    response: summaryFullBuffer.value || '',
    thinkResponse: summaryThinkBuffer.value || '',
    stats: summaryStats.value,
  };
}

async function persistCurrentSession(rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) {
  if (!activeSessionId.value || !hasAsked.value || !currentQuestion.value.trim()) return;

  const existing = historyList.value.find((item) => item.id === activeSessionId.value);
  const mergedRawUrlOverrides = { ...pendingRawUrlOverrides, ...rawUrlOverrides };
  pendingRawUrlOverrides = {};

  const enabledProviders = PROVIDER_IDS.filter(id => isProviderEnabled(id));

  // 判断是否是单通道模式
  if (enabledProviders.length === 1) {
    const providerId = enabledProviders[0];
    const providerState = buildHistoryProviders(mergedRawUrlOverrides)[providerId];

    // 单通道模式：保存为单通道多轮历史
    upsertSingleChannelSession(
      providerId,
      currentQuestion.value,
      providerState.response,
      providerState.thinkResponse,
      providerState.stats ?? undefined,
      providerState.rawUrl
    );
  } else {
    // 多通道模式：保存为原有结构
    upsertHistoryItem({
      id: activeSessionId.value,
      type: 'multi',
      question: currentQuestion.value,
      createdAt: existing?.createdAt ?? Date.now(),
      providers: buildHistoryProviders(mergedRawUrlOverrides),
      summary: buildSummaryHistoryEntry(),
      conversationTurns: conversationTurns.value.length > 0 ? [...conversationTurns.value] : undefined,
    });
  }
}

function schedulePersistCurrentSession(delay = 120, rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) {
  pendingRawUrlOverrides = { ...pendingRawUrlOverrides, ...rawUrlOverrides };
  if (historyPersistTimer != null) window.clearTimeout(historyPersistTimer);
  historyPersistTimer = window.setTimeout(() => {
    historyPersistTimer = null;
    void persistCurrentSession();
  }, delay);
}

async function fetchProviderRawUrls(providerIds: ProviderId[]) {
  if (!providerIds.length) return {} as Partial<Record<ProviderId, string>>;
  try {
    const result = await chrome.runtime?.sendMessage({
      type: MSG_TYPES.GET_PROVIDER_RAW_URLS,
      payload: { providerIds }
    });
    return (result?.urlMap || {}) as Partial<Record<ProviderId, string>>;
  } catch {
    return {} as Partial<Record<ProviderId, string>>;
  }
}

async function syncProviderRawUrls(providerIds: ProviderId[]) {
  if (!providerIds.length) return;

  const apiOverrides = providerIds.reduce((acc, providerId) => {
    if (getProviderMode(providerId) === 'api') acc[providerId] = 'api';
    return acc;
  }, {} as Partial<Record<ProviderId, string>>);

  const webProviderIds = providerIds.filter((providerId) => getProviderMode(providerId) === 'web');
  const webUrls = await fetchProviderRawUrls(webProviderIds);
  const mergedUrls = { ...apiOverrides, ...webUrls };

  for (const providerId of providerIds) {
    rawUrlMap[providerId] = mergedUrls[providerId] ?? apiOverrides[providerId] ?? rawUrlMap[providerId] ?? '';
  }

  schedulePersistCurrentSession(0, mergedUrls);
}

function resetRawUrlMap() {
  for (const providerId of PROVIDER_IDS) {
    rawUrlMap[providerId] = '';
  }
}

function clearThinkBuffers() {
  for (const providerId of PROVIDER_IDS) {
    thinkResponses[providerId] = '';
    thinkTextBuffer[providerId] = '';
    thinkDisplayedLength[providerId] = 0;
  }
}

function resetTaskState() {
  for (const providerId of PROVIDER_IDS) {
    statusMap[providerId] = 'idle';
    stageMap[providerId] = 'connecting';
    responses[providerId] = '';
    thinkResponses[providerId] = '';
    fullTextBuffer[providerId] = '';
    thinkTextBuffer[providerId] = '';
    displayedLength[providerId] = 0;
    thinkDisplayedLength[providerId] = 0;
    operationStatus[providerId] = '';
    rawUrlMap[providerId] = '';
    statsMap[providerId] = null;
    timingData[providerId] = { startTime: 0, firstContentTime: 0 };
  }

  resetSummaryState();

  if (streamAnimationId != null) {
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
  }
}

function applyHistorySession(item: ChatHistoryItem) {
  activeSessionId.value = item.id;
  hasAsked.value = true;
  isHistoryPanelOpen.value = false;
  isCurrentSessionFromHistory.value = true;

  // 先重置所有状态
  resetTaskState();

  if (streamAnimationId != null) {
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
  }

  if (item.type === 'single') {
    // 单通道历史加载
    const { providerId, turns, summary } = item;
    const lastTurn = turns[turns.length - 1];

    // 只启用该通道
    PROVIDER_IDS.forEach(id => setProviderEnabled(id, id === providerId));
    setProviderOpen(providerId, true);

    // 恢复会话状态
    currentQuestion.value = lastTurn?.question || '';
    conversationTurns.value = turns.slice(0, -1).map(turn => ({
      question: turn.question,
      providerId,
      response: turn.response,
      thinkResponse: turn.thinkResponse,
      rawUrl: turn.rawUrl || '',
      stats: turn.stats || null,
    }));
    isMultiTurnSession.value = turns.length > 0;

    // 恢复最后一轮的响应
    if (lastTurn) {
      statusMap[providerId] = 'completed';
      stageMap[providerId] = 'responding';
      responses[providerId] = lastTurn.response;
      thinkResponses[providerId] = lastTurn.thinkResponse;
      fullTextBuffer[providerId] = lastTurn.response;
      thinkTextBuffer[providerId] = lastTurn.thinkResponse;
      displayedLength[providerId] = lastTurn.response.length;
      thinkDisplayedLength[providerId] = lastTurn.thinkResponse.length;
      operationStatus[providerId] = '';
      rawUrlMap[providerId] = lastTurn.rawUrl || '';
      statsMap[providerId] = lastTurn.stats || null;
    }
  } else {
    // 多通道历史加载
    currentQuestion.value = item.question;
    conversationTurns.value = item.conversationTurns ? [...item.conversationTurns] : [];
    isMultiTurnSession.value = false;

    for (const providerId of PROVIDER_IDS) {
      const providerState = item.providers[providerId] || createDefaultHistoryEntry(providerId);
      setProviderEnabled(providerId, providerState.enabled);
      setProviderOpen(providerId, false); // 历史会话默认折叠所有面板
      statusMap[providerId] = providerState.status;
      stageMap[providerId] = providerState.stage;
      responses[providerId] = providerState.response;
      thinkResponses[providerId] = providerState.thinkResponse;
      fullTextBuffer[providerId] = providerState.response;
      thinkTextBuffer[providerId] = providerState.thinkResponse;
      displayedLength[providerId] = providerState.response.length;
      thinkDisplayedLength[providerId] = providerState.thinkResponse.length;
      operationStatus[providerId] = providerState.operationStatus;
      rawUrlMap[providerId] = providerState.rawUrl;
      statsMap[providerId] = providerState.stats ?? null;
    }
  }

  // 恢复归纳总结状态
  const summaryEntry = item.summary;
  if (summaryEntry) {
    summaryStatus.value = summaryEntry.status;
    summaryStage.value = 'responding';
    summaryResponse.value = summaryEntry.response;
    summaryThinkResponse.value = summaryEntry.thinkResponse;
    summaryFullBuffer.value = summaryEntry.response;
    summaryThinkBuffer.value = summaryEntry.thinkResponse;
    summaryDisplayedLength.value = summaryEntry.response.length;
    summaryThinkDisplayedLength.value = summaryEntry.thinkResponse.length;
    summaryOperationStatus.value = '';
    summaryStats.value = summaryEntry.stats ?? null;
    summaryTriggered = true; // 防止重复触发
  } else {
    resetSummaryState();
  }

  void scrollToBottom();
}

function restoreHistorySession(item: ChatHistoryItem) {
  applyHistorySession(item);
}

function loadHistory() {
  chrome.storage?.local.get([HISTORY_STORAGE_KEY, HISTORY_STORAGE_KEY_SINGLE], (result) => {
    // 加载并格式化多通道历史
    const multiHistory = Array.isArray(result?.[HISTORY_STORAGE_KEY]) ? result[HISTORY_STORAGE_KEY] : [];
    const normalizedMultiHistory = multiHistory
      .map((item: Partial<MultiChannelHistoryItem>) => {
        const providers = PROVIDER_IDS.reduce((acc, providerId) => {
          acc[providerId] = {
            ...createDefaultHistoryEntry(providerId),
            ...(item.providers?.[providerId] || {})
          };
          return acc;
        }, {} as Record<ProviderId, ProviderHistoryEntry>);

        return {
          id: item.id || createSessionId(),
          type: 'multi' as const,
          question: item.question || '',
          createdAt: item.createdAt || Date.now(),
          providers,
          summary: (item.summary as SummaryHistoryEntry) ?? null,
          conversationTurns: Array.isArray(item.conversationTurns) ? item.conversationTurns : undefined,
        };
      })
      .filter((item: MultiChannelHistoryItem) => item.question.trim());

    // 加载并格式化单通道历史
    const singleHistory = Array.isArray(result?.[HISTORY_STORAGE_KEY_SINGLE]) ? result[HISTORY_STORAGE_KEY_SINGLE] : [];
    const normalizedSingleHistory = singleHistory
      .map((item: Partial<SingleChannelHistoryItem>) => {
        // 兼容对象格式的turns（旧版本可能存储为对象）
        let turns: SingleChannelHistoryItem['turns'] = [];
        if (Array.isArray(item.turns)) {
          turns = item.turns;
        } else if (item.turns && typeof item.turns === 'object') {
          // 将对象格式的turns转换为数组，按key排序
          turns = Object.values(item.turns as Record<string, SingleChannelHistoryItem['turns'][0]>).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        }

        return {
          id: item.id || createSessionId(),
          type: 'single' as const,
          providerId: item.providerId || 'deepseek',
          providerName: item.providerName || 'DeepSeek',
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
          turns,
          summary: (item.summary as SummaryHistoryEntry) ?? null,
        };
      })
      .filter((item: SingleChannelHistoryItem) => item.turns.length > 0);

    // 合并并按时间倒序排序
    historyList.value = [...normalizedMultiHistory, ...normalizedSingleHistory]
      .sort((a, b) => {
        const timeA = a.type === 'single' ? a.updatedAt : a.createdAt;
        const timeB = b.type === 'single' ? b.updatedAt : b.createdAt;
        return timeB - timeA;
      })
      .slice(0, MAX_HISTORY_COUNT * 2); // 总共最多60条历史
  });
}

async function checkProviderTabValid(providerId: string) {
  try {
    const result = await chrome.runtime?.sendMessage({
      type: MSG_TYPES.CHECK_PROVIDER_TAB_VALID,
      payload: { providerId }
    });
    return result?.valid ?? false;
  } catch {
    return false;
  }
}

function loadSettings() {
  chrome.storage?.local.get([SETTINGS_KEY, API_CONFIG_KEY], async (result) => {
    const saved = (result?.[SETTINGS_KEY] || {}) as SidepanelSettings;
    isDeepThinkingEnabled.value = saved.isDeepThinkingEnabled ?? true;
    isSummaryEnabled.value = saved.isSummaryEnabled ?? false;
    isDebugEnabled.value = saved.isDebugEnabled ?? false;
    isDeepSeekEnabled.value = false;
    isDoubaoEnabled.value = false;
    isQianwenEnabled.value = false;
    isLongcatEnabled.value = false;
    isYuanbaoEnabled.value = false;

    const [deepseekValid, doubaoValid, qianwenValid, longcatValid, yuanbaoValid] = await Promise.all([
      checkProviderTabValid('deepseek'),
      checkProviderTabValid('doubao'),
      checkProviderTabValid('qianwen'),
      checkProviderTabValid('longcat'),
      checkProviderTabValid('yuanbao'),
    ]);

    isDeepSeekEnabled.value = deepseekValid;
    isDoubaoEnabled.value = doubaoValid;
    isQianwenEnabled.value = qianwenValid;
    isLongcatEnabled.value = longcatValid;
    isYuanbaoEnabled.value = yuanbaoValid;

    const apiConfig = (result?.[API_CONFIG_KEY] || {}) as Record<string, ApiConfig>;
    deepseekMode.value = apiConfig.deepseek?.mode || 'web';
    doubaoMode.value = apiConfig.doubao?.mode || 'web';
    qianwenMode.value = apiConfig.qianwen?.mode || 'web';
    longcatMode.value = apiConfig.longcat?.mode || 'web';
    yuanbaoMode.value = 'web'; // 元宝暂不支持 API 模式
    deepseekApiKey.value = apiConfig.deepseek?.apiKey || '';
    doubaoApiKey.value = apiConfig.doubao?.apiKey || '';
    qianwenApiKey.value = apiConfig.qianwen?.apiKey || '';
    longcatApiKey.value = apiConfig.longcat?.apiKey || '';
    yuanbaoApiKey.value = '';
    deepseekModel.value = apiConfig.deepseek?.model || '';
    doubaoModel.value = apiConfig.doubao?.model || '';
    qianwenModel.value = apiConfig.qianwen?.model || '';
    longcatModel.value = apiConfig.longcat?.model || '';
    yuanbaoModel.value = '';
  });
}

function saveApiConfig(providerId: string, config: ApiConfig) {
  chrome.storage?.local.get([API_CONFIG_KEY], (result) => {
    const existingConfig = (result?.[API_CONFIG_KEY] || {}) as Record<string, ApiConfig>;
    const newConfig = {
      ...existingConfig,
      [providerId]: {
        ...existingConfig[providerId],
        ...config
      }
    };
    chrome.storage?.local.set({ [API_CONFIG_KEY]: newConfig });
  });
}

async function testApiKey(providerId: string, apiKey: string) {
  testingApiKey.value[providerId] = true;
  try {
    const result = await chrome.runtime?.sendMessage({
      type: MSG_TYPES.TEST_API_KEY,
      payload: { providerId, apiKey }
    });
    apiKeyTestResult.value[providerId] = {
      success: !!result?.success,
      message: result?.message || result?.error || '请求失败'
    };
  } catch {
    apiKeyTestResult.value[providerId] = { success: false, message: '请求失败' };
  } finally {
    testingApiKey.value[providerId] = false;
  }
}

async function handleGoToProvider(providerId: string, activate: boolean = true) {
  try {
    const result = await chrome.runtime?.sendMessage({
      type: MSG_TYPES.OPEN_PROVIDER_TAB,
      payload: { providerId, activate }
    });
    return result;
  } catch (err) {
    logger.error('打开provider tab失败:', err);
    return { success: false, error: String(err) };
  }
}

async function handleToggleProvider(providerId: string) {
  const currentState = providerId === 'deepseek' ? isDeepSeekEnabled.value
    : providerId === 'doubao' ? isDoubaoEnabled.value
    : providerId === 'qianwen' ? isQianwenEnabled.value
    : providerId === 'longcat' ? isLongcatEnabled.value
    : providerId === 'yuanbao' ? isYuanbaoEnabled.value
    : false;

  if (currentState) {
    if (providerId === 'deepseek') isDeepSeekEnabled.value = false;
    else if (providerId === 'doubao') isDoubaoEnabled.value = false;
    else if (providerId === 'qianwen') isQianwenEnabled.value = false;
    else if (providerId === 'longcat') isLongcatEnabled.value = false;
    else if (providerId === 'yuanbao') isYuanbaoEnabled.value = false;
    return;
  }

  const mode = providerId === 'deepseek' ? deepseekMode.value
    : providerId === 'doubao' ? doubaoMode.value
    : providerId === 'qianwen' ? qianwenMode.value
    : providerId === 'longcat' ? longcatMode.value
    : 'web';

  if (mode === 'api') {
    if (providerId === 'deepseek') isDeepSeekEnabled.value = true;
    else if (providerId === 'doubao') isDoubaoEnabled.value = true;
    else if (providerId === 'qianwen') isQianwenEnabled.value = true;
    else if (providerId === 'longcat') isLongcatEnabled.value = true;
    return;
  }

  try {
    const result = await handleGoToProvider(providerId, false);
    if (result?.success) {
      if (providerId === 'deepseek') isDeepSeekEnabled.value = true;
      else if (providerId === 'doubao') isDoubaoEnabled.value = true;
      else if (providerId === 'qianwen') isQianwenEnabled.value = true;
      else if (providerId === 'longcat') isLongcatEnabled.value = true;
      else if (providerId === 'yuanbao') isYuanbaoEnabled.value = true;
    } else {
      window.alert(`开启${providerId}失败：${result?.error || '无法创建页面'}`);
    }
  } catch (err) {
    window.alert(`开启${providerId}失败：${String(err)}`);
  }
}

function tickStreamDisplay() {
  let anyPending = false;

  for (const providerId of PROVIDER_IDS) {
    const thinkFull = thinkTextBuffer[providerId] || '';
    let thinkLength = thinkDisplayedLength[providerId] || 0;
    if (thinkLength < thinkFull.length) {
      thinkLength = Math.min(thinkLength + CHARS_PER_FRAME, thinkFull.length);
      thinkDisplayedLength[providerId] = thinkLength;
      thinkResponses[providerId] = thinkFull.slice(0, thinkLength);
      anyPending = true;
    }

    const full = fullTextBuffer[providerId] || '';
    let responseLength = displayedLength[providerId] || 0;
    if (responseLength < full.length) {
      responseLength = Math.min(responseLength + CHARS_PER_FRAME, full.length);
      displayedLength[providerId] = responseLength;
      responses[providerId] = full.slice(0, responseLength);
      anyPending = true;
    }
  }

  // 归纳总结动画
  const sThinkFull = summaryThinkBuffer.value;
  let sThinkLen = summaryThinkDisplayedLength.value;
  if (sThinkLen < sThinkFull.length) {
    sThinkLen = Math.min(sThinkLen + CHARS_PER_FRAME, sThinkFull.length);
    summaryThinkDisplayedLength.value = sThinkLen;
    summaryThinkResponse.value = sThinkFull.slice(0, sThinkLen);
    anyPending = true;
  }
  const sFull = summaryFullBuffer.value;
  let sLen = summaryDisplayedLength.value;
  if (sLen < sFull.length) {
    sLen = Math.min(sLen + CHARS_PER_FRAME, sFull.length);
    summaryDisplayedLength.value = sLen;
    summaryResponse.value = sFull.slice(0, sLen);
    anyPending = true;
  }

  void scrollToBottom();
  if (anyPending) {
    streamAnimationId = requestAnimationFrame(tickStreamDisplay);
  } else {
    streamAnimationId = null;
  }
}

const isRunning = computed(() => Object.values(statusMap).includes('running'));

/** 单通道模式下当前激活的提供者 ID（hasAsked 且仅有一个通道启用时非 null） */
const singleChannelProviderId = computed<ProviderId | null>(() => {
  if (!hasAsked.value) return null;
  const enabled = PROVIDER_IDS.filter(id => isProviderEnabled(id));
  return enabled.length === 1 ? enabled[0] : null;
});

const scrollToBottom = async () => {
  if (userHasScrolled.value) return;
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

onMounted(() => {
  loadSettings();
  loadHistory();
  loadSummaryConfig();

  // 检测用户主动向上滚动，暂停自动滚动
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.addEventListener('scroll', () => {
        if (!isRunning.value) return;
        const el = chatContainer.value!;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom > 80) {
          userHasScrolled.value = true;
        }
      }, { passive: true });
    }
  });

  chrome.runtime?.onMessage.addListener((request) => {
    const { provider } = request.payload || {};

    if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
      const payload = request.payload;

      // 归纳总结通道
      if (provider === '_summary') {
        if (payload.isStatus) {
          summaryOperationStatus.value = payload.text;
          return;
        }
        if (payload.stage) summaryStage.value = payload.stage;
        if (!payload.isThink && payload.text && !summaryTimingData.firstContentTime) {
          summaryTimingData.firstContentTime = Date.now();
        }
        setTimeout(() => {
          if (payload.isThink) {
            summaryThinkBuffer.value += payload.text;
          } else {
            summaryFullBuffer.value += payload.text;
          }
          if (streamAnimationId == null) streamAnimationId = requestAnimationFrame(tickStreamDisplay);
        }, 0);
        return;
      }

      const prov = provider as ProviderId;
      if (!prov) return;

      if (payload.isStatus) {
        operationStatus[prov] = payload.text;
        schedulePersistCurrentSession();
        return;
      }

      // 记录首次正文 chunk 到达时间（用于 TTFF 计算）
      if (!payload.isThink && payload.text && !timingData[prov].firstContentTime) {
        timingData[prov].firstContentTime = Date.now();
      }

      if (payload.stage && (payload.stage !== 'thinking' || isDeepThinkingEnabled.value)) {
        stageMap[prov] = payload.stage;
      } else if (payload.text && payload.text.length > 0) {
        stageMap[prov] = 'responding';
      }

      setTimeout(() => {
        if (payload.isThink) {
          if (!isDeepThinkingEnabled.value) return;
          thinkTextBuffer[prov] = (thinkTextBuffer[prov] || '') + payload.text;
        } else {
          fullTextBuffer[prov] = (fullTextBuffer[prov] || '') + payload.text;
        }
        if (streamAnimationId == null) streamAnimationId = requestAnimationFrame(tickStreamDisplay);
        schedulePersistCurrentSession();
      }, 0);

    } else if (request.type === MSG_TYPES.TASK_STATUS_UPDATE) {
      const payload = request.payload;

      // 归纳总结通道
      if (provider === '_summary') {
        summaryStatus.value = 'running';
        summaryOperationStatus.value = payload.text || '';
        return;
      }

      const prov = provider as ProviderId;
      if (!prov) return;
      statusMap[prov] = 'running';
      operationStatus[prov] = payload.text || '';
      schedulePersistCurrentSession();

    } else if (request.type === MSG_TYPES.TASK_COMPLETED) {
      // 归纳总结通道
      if (provider === '_summary') {
        summaryStatus.value = 'completed';
        summaryOperationStatus.value = '';
        if (summaryTimingData.startTime > 0 && summaryTimingData.firstContentTime > 0) {
          const completedAt = Date.now();
          const charCount = summaryFullBuffer.value?.length || 0;
          const ttff = summaryTimingData.firstContentTime - summaryTimingData.startTime;
          const totalTime = completedAt - summaryTimingData.startTime;
          const outputSecs = (completedAt - summaryTimingData.firstContentTime) / 1000;
          const charsPerSec = outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0;
          summaryStats.value = { ttff, totalTime, charCount, charsPerSec };
        }
        schedulePersistCurrentSession();
        return;
      }

      const prov = provider as ProviderId;
      if (!prov) return;
      statusMap[prov] = 'completed';
      operationStatus[prov] = '';

      // 计算本次性能统计
      const timing = timingData[prov];
      if (timing.startTime > 0 && timing.firstContentTime > 0) {
        const completedAt = Date.now();
        const charCount = fullTextBuffer[prov]?.length || 0;
        const ttff = timing.firstContentTime - timing.startTime;
        const totalTime = completedAt - timing.startTime;
        const outputSecs = (completedAt - timing.firstContentTime) / 1000;
        const charsPerSec = outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0;
        statsMap[prov] = { ttff, totalTime, charCount, charsPerSec };
      }

      if (prov === 'deepseek' && !(responses.deepseek || '').trim()) {
        responses.deepseek = '（网页端已结束，但未抓取到流式内容，可能接口格式已变更）';
      }
      void syncProviderRawUrls([prov]);
      schedulePersistCurrentSession();
      if (!isRunning.value) {
        setTimeout(() => {
          isDeepSeekOpen.value = false;
          isDoubaoOpen.value = false;
          isQianwenOpen.value = false;
          isLongcatOpen.value = false;
          isYuanbaoOpen.value = false;
        }, 1500);
        // 所有通道完成后触发归纳总结
        if (isSummaryEnabled.value && hasAsked.value && !isCurrentSessionFromHistory.value) {
          void triggerSummary();
        }
      }

    } else if (request.type === MSG_TYPES.ERROR) {
      // 归纳总结通道
      if (provider === '_summary') {
        summaryStatus.value = 'error';
        summaryOperationStatus.value = '';
        const errMsg = request.payload.message || request.payload.error || '未知错误';
        summaryFullBuffer.value = `[归纳总结出错] ${errMsg}`;
        summaryDisplayedLength.value = summaryFullBuffer.value.length;
        summaryResponse.value = summaryFullBuffer.value;
        return;
      }

      const prov = provider as ProviderId;
      if (!prov) return;
      statusMap[prov] = 'error';
      operationStatus[prov] = '';
      const message = request.payload.message || request.payload.error || '未知错误';
      responses[prov] = `[系统报错] ${message}`;
      fullTextBuffer[prov] = responses[prov];
      displayedLength[prov] = responses[prov].length;
      void syncProviderRawUrls([prov]);
      schedulePersistCurrentSession();
      // 出错的通道也可能是最后一个完成的，检查是否触发总结
      if (!isRunning.value && isSummaryEnabled.value && hasAsked.value && !isCurrentSessionFromHistory.value) {
        void triggerSummary();
      }
    }
  });
});

const createNewChat = () => {
  if (isRunning.value) return;

  currentQuestion.value = '';
  hasAsked.value = false;
  activeSessionId.value = '';
  isCurrentSessionFromHistory.value = false;
  isHistoryPanelOpen.value = false;
  activeProviderSettings.value = '';
  conversationTurns.value = [];
  isMultiTurnSession.value = false;
  isDeepSeekOpen.value = isDeepSeekEnabled.value;
  isDoubaoOpen.value = isDoubaoEnabled.value;
  isQianwenOpen.value = isQianwenEnabled.value;
  isLongcatOpen.value = isLongcatEnabled.value;
  isYuanbaoOpen.value = isYuanbaoEnabled.value;
  resetTaskState();
  inputStr.value = '';
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
};

const submit = () => {
  const prompt = inputStr.value.trim();
  if (!prompt || isRunning.value) return;

  userHasScrolled.value = false;

  const enabledIds = getEnabledProviderIds();
  if (!enabledIds.length) {
    showNoChannelTip.value = true;
    return;
  }

  const isSingleChannel = enabledIds.length === 1;
  // 多轮对话续接条件：当前会话以单通道启动、已有回答、非历史恢复
  const isMultiTurnContinuation = isMultiTurnSession.value && isSingleChannel && hasAsked.value && !isCurrentSessionFromHistory.value;

  if (isMultiTurnContinuation) {
    // 保存当前已完成的轮次
    const singleProviderId = enabledIds[0];
    conversationTurns.value.push({
      question: currentQuestion.value,
      providerId: singleProviderId,
      response: fullTextBuffer[singleProviderId] || responses[singleProviderId] || '',
      thinkResponse: thinkTextBuffer[singleProviderId] || '',
      rawUrl: rawUrlMap[singleProviderId] || '',
      stats: statsMap[singleProviderId] ?? null,
    });
  } else {
    // 全新会话：清空历史轮次，生成新会话 ID
    conversationTurns.value = [];
    activeSessionId.value = createSessionId();
    isMultiTurnSession.value = isSingleChannel;
  }

  currentQuestion.value = prompt;
  hasAsked.value = true;

  if (isMultiTurnContinuation) {
    // 续接轮次：在 resetTaskState() 清空状态之前同步持久化，确保 conversationTurns 不丢失
    void persistCurrentSession();
  }
  schedulePersistCurrentSession(0);

  isCurrentSessionFromHistory.value = false;
  isHistoryPanelOpen.value = false;
  activeProviderSettings.value = '';
  isDeepSeekOpen.value = isDeepSeekEnabled.value;
  isDoubaoOpen.value = isDoubaoEnabled.value;
  isQianwenOpen.value = isQianwenEnabled.value;
  isLongcatOpen.value = isLongcatEnabled.value;
  isYuanbaoOpen.value = isYuanbaoEnabled.value;
  resetTaskState();

  for (const providerId of enabledIds) {
    rawUrlMap[providerId] = getProviderMode(providerId) === 'api' ? 'api' : '';
  }

  void syncProviderRawUrls(enabledIds);

  // API 模式下的多轮对话历史（仅单通道时有效）
  const conversationHistory = (isSingleChannel && conversationTurns.value.length > 0)
    ? conversationTurns.value.map(t => ({ question: t.question, response: t.response }))
    : [];

  // 单通道续接时网页端不重新新建对话，直接在当前对话窗口追问
  const isNewConversation = !isMultiTurnContinuation;

  if (isDeepSeekEnabled.value) {
    statusMap.deepseek = 'running';
    timingData.deepseek.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'deepseek',
        prompt,
        mode: deepseekMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
          isNewConversation,
        }
      }
    });
  }

  if (isDoubaoEnabled.value) {
    statusMap.doubao = 'running';
    timingData.doubao.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'doubao',
        prompt,
        mode: doubaoMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
          isNewConversation,
        }
      }
    });
  }

  if (isQianwenEnabled.value) {
    statusMap.qianwen = 'running';
    timingData.qianwen.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'qianwen',
        prompt,
        mode: qianwenMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
          isNewConversation,
        }
      }
    });
  }

  if (isLongcatEnabled.value) {
    statusMap.longcat = 'running';
    timingData.longcat.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'longcat',
        prompt,
        mode: longcatMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
          isNewConversation,
        }
      }
    });
  }

  if (isYuanbaoEnabled.value) {
    statusMap.yuanbao = 'running';
    timingData.yuanbao.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'yuanbao',
        prompt,
        mode: 'web',
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
          isNewConversation,
        }
      }
    });
  }

  inputStr.value = '';
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
};

const autoResize = (e: Event) => {
  const el = e.target as HTMLTextAreaElement;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 128) + 'px';
};

watch(isDeepThinkingEnabled, (enabled) => {
  if (!enabled) {
    clearThinkBuffers();
    schedulePersistCurrentSession();
  }
  saveSettings();
});

watch(isDebugEnabled, (enabled) => {
  setDebugEnabled(enabled);
  saveSettings();
  logger.log('调试模式已', enabled ? '开启' : '关闭');
});

watch(deepseekMode, async (value) => {
  saveApiConfig('deepseek', { mode: value });
  if (value === 'web' && isDeepSeekEnabled.value) {
    const result = await handleGoToProvider('deepseek', false);
    if (!result?.success) {
      isDeepSeekEnabled.value = false;
      window.alert(`${getProviderLabel('deepseek')}切换到网页模式失败：${result?.error || '无法创建页面'}`);
    }
  }
});

watch(doubaoMode, async (value) => {
  saveApiConfig('doubao', { mode: value });
  if (value === 'web' && isDoubaoEnabled.value) {
    const result = await handleGoToProvider('doubao', false);
    if (!result?.success) {
      isDoubaoEnabled.value = false;
      window.alert(`豆包切换到网页模式失败：${result?.error || '无法创建页面'}`);
    }
  }
});

watch(qianwenMode, async (value) => {
  saveApiConfig('qianwen', { mode: value });
  if (value === 'web' && isQianwenEnabled.value) {
    const result = await handleGoToProvider('qianwen', false);
    if (!result?.success) {
      isQianwenEnabled.value = false;
      window.alert(`千问切换到网页模式失败：${result?.error || '无法创建页面'}`);
    }
  }
});

watch(longcatMode, async (value) => {
  saveApiConfig('longcat', { mode: value });
  if (value === 'web' && isLongcatEnabled.value) {
    const result = await handleGoToProvider('longcat', false);
    if (!result?.success) {
      isLongcatEnabled.value = false;
      window.alert(`${getProviderLabel('longcat')}切换到网页模式失败：${result?.error || '无法创建页面'}`);
    }
  }
});

watch(isSummaryEnabled, () => saveSettings());
watch(summaryProviderId, () => saveSummaryConfig());
watch(summaryModel, () => saveSummaryConfig());

watch(deepseekApiKey, (value) => saveApiConfig('deepseek', { apiKey: value }));
watch(doubaoApiKey, (value) => saveApiConfig('doubao', { apiKey: value }));
watch(qianwenApiKey, (value) => saveApiConfig('qianwen', { apiKey: value }));
watch(longcatApiKey, (value) => saveApiConfig('longcat', { apiKey: value }));
watch(deepseekModel, (value) => saveApiConfig('deepseek', { model: value }));
watch(doubaoModel, (value) => saveApiConfig('doubao', { model: value }));
watch(qianwenModel, (value) => saveApiConfig('qianwen', { model: value }));
watch(longcatModel, (value) => saveApiConfig('longcat', { model: value }));
</script>

<style scoped>
.app-shell {
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

/* 给思考框里面的滚动条做下瘦身，不然在侧边栏太臃肿 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
</style>