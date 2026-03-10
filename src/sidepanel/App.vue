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
        <div class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          MoE 模式
        </div>
      </div>

      <div
        v-if="isHistoryPanelOpen"
        class="absolute left-4 right-4 top-[calc(100%+8px)] max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-2 space-y-1">
        <div class="flex items-center justify-between px-2 pt-1 pb-2">
          <div class="text-[12px] font-semibold text-slate-700">历史对话</div>
          <button
            type="button"
            class="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            @click="isHistoryPanelOpen = false">
            关闭
          </button>
        </div>

        <div
          v-if="!historyList.length"
          class="px-3 py-6 text-center text-[12px] text-slate-400">
          暂无历史对话
        </div>

        <button
          v-for="item in historyList"
          :key="item.id"
          type="button"
          class="w-full text-left rounded-xl border px-3 py-2.5 transition-colors"
          :class="item.id === activeSessionId
            ? 'border-indigo-200 bg-indigo-50/80'
            : 'border-slate-200 bg-white hover:bg-slate-50'"
          @click="restoreHistorySession(item)">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-[12px] font-medium text-slate-700 truncate">{{ item.question }}</div>
              <div class="mt-1 text-[10px] text-slate-400">{{ formatHistoryTime(item.createdAt) }}</div>
            </div>
            <div class="text-[10px] text-slate-400 whitespace-nowrap">{{ getHistoryEnabledCount(item) }} 通道</div>
          </div>
        </button>
      </div>
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
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div class="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <div class="text-[12px] font-semibold text-slate-700">通道列表</div>
              <button
                type="button"
                class="text-[11px] text-slate-500 transition-colors hover:text-slate-800"
                @click="isHistoryPanelOpen = true">
                查看历史
              </button>
            </div>

            <div class="divide-y divide-slate-100">
              <div
                v-for="provider in PROVIDER_META"
                :key="provider.id"
                class="px-4 py-2.5">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0 flex items-center gap-2">
                    <span class="text-[13px] font-medium text-slate-800">{{ provider.name }}</span>
                    <span class="text-[11px] text-slate-500">{{ getProviderModeText(provider.id) }}模式</span>
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      :class="isProviderEnabled(provider.id)
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'">
                      {{ isProviderEnabled(provider.id) ? '开' : '关' }}
                    </span>
                  </div>

                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      class="inline-flex h-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
                      @click="openProviderSettings(provider.id)">
                      设置
                    </button>
                    <button
                      v-if="getModeValue(provider.id) === 'web'"
                      type="button"
                      class="inline-flex h-7 items-center justify-center rounded-full bg-indigo-50 px-2.5 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100"
                      @click="handleGoToProvider(provider.id)">
                      前往
                    </button>
                    <button
                      type="button"
                      @click="handleToggleProvider(provider.id)"
                      class="relative inline-flex h-6 w-10 items-center rounded-full transition-colors"
                      :class="isProviderEnabled(provider.id) ? 'bg-indigo-500' : 'bg-slate-300'">
                      <span
                        class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                        :class="isProviderEnabled(provider.id) ? 'translate-x-5' : 'translate-x-1'">
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="flex justify-end">
          <div
            class="bg-slate-900 text-white text-[15px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-md leading-7 break-words tracking-[0.01em]">
            {{ currentQuestion }}
          </div>
        </div>

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
          :is-deep-thinking-enabled="isDeepThinkingEnabled"
          :default-open="isDeepSeekOpen"
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
          :is-deep-thinking-enabled="isDeepThinkingEnabled"
          :default-open="isDoubaoOpen"
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
          :is-deep-thinking-enabled="isDeepThinkingEnabled"
          :default-open="isQianwenOpen"
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
          :is-deep-thinking-enabled="isDeepThinkingEnabled"
          :default-open="isLongcatOpen"
        />

        <div v-if="!isRunning && hasAsked"
          class="relative bg-white p-4 rounded-xl shadow-sm border border-indigo-100 ring-1 ring-indigo-50">
          <div
            class="absolute -top-2.5 left-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wider">
            最终研判结论
          </div>
          <div class="mt-2 text-[14px] text-slate-700 leading-relaxed prose prose-sm max-w-none">
            这是基于多个模型给出的综合优化建议。MVP 阶段暂未接大模型总结 API，您可以先在这里查看聚合后的排版效果。
          </div>
        </div>
      </template>

    </main>

    <div
      v-if="activeProviderSettings"
      class="fixed inset-0 z-40 flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        class="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
        aria-label="关闭通道设置弹窗"
        @click="closeProviderSettings">
      </button>

      <div
        class="relative z-10 w-full max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.5)]">
        <div class="border-b border-slate-200/80 px-5 py-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-[18px] font-semibold tracking-[-0.02em] text-slate-900">{{ getProviderLabel(activeProviderSettings) }} 设置</div>
              <p class="mt-1 text-[13px] leading-6 text-slate-500">这里调整当前通道的接入模式和详细参数。</p>
            </div>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
              @click="closeProviderSettings"
              aria-label="关闭当前通道设置">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          <div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div class="flex items-center gap-2">
              <span class="text-[15px] font-semibold text-slate-900">{{ getProviderLabel(activeProviderSettings) }}</span>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                :class="isProviderEnabled(activeProviderSettings)
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-500'">
                {{ isProviderEnabled(activeProviderSettings) ? '已开启' : '未开启' }}
              </span>
            </div>
            <p class="mt-1 text-[12px] leading-6 text-slate-500">当前模式：{{ getProviderModeText(activeProviderSettings) }}模式</p>
          </div>

          <div class="space-y-2">
            <div class="text-[12px] font-medium text-slate-700">接入模式</div>
            <div class="flex flex-wrap gap-2">
              <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                <input
                  type="radio"
                  :name="`provider-mode-${activeProviderSettings}`"
                  class="h-3.5 w-3.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  :checked="getModeValue(activeProviderSettings) === 'web'"
                  @change="setProviderMode(activeProviderSettings, 'web')" />
                <span>网页模式</span>
              </label>
              <label
                class="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px]"
                :class="supportsApi(activeProviderSettings)
                  ? 'cursor-pointer border-slate-200 bg-slate-50 text-slate-700'
                  : 'border-slate-100 bg-slate-50 text-slate-400'">
                <input
                  type="radio"
                  :name="`provider-mode-${activeProviderSettings}`"
                  class="h-3.5 w-3.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  :disabled="!supportsApi(activeProviderSettings)"
                  :checked="getModeValue(activeProviderSettings) === 'api'"
                  @change="setProviderMode(activeProviderSettings, 'api')" />
                <span>{{ supportsApi(activeProviderSettings) ? 'API模式' : 'API模式暂不支持' }}</span>
              </label>
            </div>
          </div>

          <div
            v-if="supportsApi(activeProviderSettings) && getModeValue(activeProviderSettings) === 'api'"
            class="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div class="space-y-2">
              <label class="text-[12px] font-medium text-slate-700">API Key</label>
              <div class="flex items-center gap-2">
                <input
                  :type="showApiKey[activeProviderSettings] ? 'text' : 'password'"
                  :value="getApiKeyValue(activeProviderSettings)"
                  @input="handleApiKeyInput(activeProviderSettings, $event)"
                  placeholder="输入 API Key"
                  class="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-[13px] text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15" />
                <button
                  type="button"
                  @click="showApiKey[activeProviderSettings] = !showApiKey[activeProviderSettings]"
                  class="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700">
                  {{ showApiKey[activeProviderSettings] ? '隐藏' : '显示' }}
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                @click="testApiKey(activeProviderSettings, getApiKeyValue(activeProviderSettings))"
                :disabled="testingApiKey[activeProviderSettings] || !getApiKeyValue(activeProviderSettings)"
                class="inline-flex min-h-10 items-center justify-center rounded-full bg-indigo-50 px-3 text-[12px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400">
                {{ testingApiKey[activeProviderSettings] ? '测试中...' : '测试 Key' }}
              </button>
              <span
                v-if="apiKeyTestResult[activeProviderSettings]"
                class="text-[11px]"
                :class="apiKeyTestResult[activeProviderSettings].success ? 'text-emerald-600' : 'text-rose-600'">
                {{ apiKeyTestResult[activeProviderSettings].message }}
              </span>
            </div>

            <div class="space-y-2">
              <label class="text-[12px] font-medium text-slate-700">模型</label>
              <select
                :value="getModelValue(activeProviderSettings)"
                @change="handleModelChange(activeProviderSettings, $event)"
                class="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15">
                <option v-for="option in getModelOptions(activeProviderSettings)" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div class="p-4 bg-white border-t border-slate-200/60 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
      <div class="flex items-center gap-1.5 mb-1.5">
        <button
          type="button"
          @click="isDeepThinkingEnabled = !isDeepThinkingEnabled"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
          :class="isDeepThinkingEnabled
            ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'">
          <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.06428 5.93342C7.6876 5.93342 8.19304 6.43904 8.19319 7.06233C8.19319 7.68573 7.68769 8.19123 7.06428 8.19123C6.44096 8.19113 5.93537 7.68567 5.93537 7.06233C5.93552 6.43911 6.44105 5.93353 7.06428 5.93342Z" fill="currentColor"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M8.68147 0.963693C10.1168 0.447019 11.6266 0.374829 12.5633 1.31135C13.5 2.24805 13.4276 3.75776 12.911 5.19319C12.7126 5.74431 12.4385 6.31796 12.0965 6.89729C12.4969 7.54638 12.8141 8.19018 13.036 8.80647C13.5527 10.2419 13.625 11.7516 12.6883 12.6883C11.7516 13.625 10.2419 13.5527 8.80647 13.036C8.19019 12.8141 7.54638 12.4969 6.89729 12.0965C6.31794 12.4386 5.74432 12.7125 5.19319 12.911C3.75774 13.4276 2.24807 13.5 1.31135 12.5633C0.374829 11.6266 0.447019 10.1168 0.963693 8.68147C1.17182 8.10338 1.46318 7.50063 1.82893 6.8924C1.52179 6.35711 1.27232 5.82825 1.08869 5.31819C0.572038 3.88278 0.499683 2.37306 1.43635 1.43635C2.37304 0.499655 3.88277 0.572044 5.31819 1.08869C5.82825 1.27232 6.35712 1.5218 6.8924 1.82893C7.50063 1.46318 8.10338 1.17181 8.68147 0.963693Z" fill="currentColor"/>
          </svg>
          <span>深度思考</span>
        </button>
      </div>
      <div
        class="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
        <textarea v-model="inputStr" @keydown.enter.prevent="submit" placeholder="输入问题，按 Enter 发送..."
          class="w-full bg-transparent p-3 pr-2 text-[15px] leading-7 text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-32 min-h-[48px]"
          rows="1" @input="autoResize" ref="textareaRef"></textarea>

        <div class="p-1.5 mb-0.5 pr-2 flex-shrink-0">
          <button @click="submit" :disabled="isRunning || !inputStr.trim()"
            class="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center justify-center shadow-sm disabled:shadow-none">
            <svg class="w-4 h-4 translate-x-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      <div class="text-center mt-2">
        <span class="text-[10px] text-slate-400">目前支持：DeepSeek · 豆包 · 千问 · LongCat（网页模式/API模式双接入）</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue';
import { MSG_TYPES } from '../shared/messages.js';
import ProviderCollapse from './components/ProviderCollapse.vue';

const PROVIDER_IDS = ['deepseek', 'doubao', 'qianwen', 'longcat'] as const;
type ProviderId = typeof PROVIDER_IDS[number];
type ProviderMode = 'web' | 'api';
type ProviderStatus = 'idle' | 'running' | 'completed' | 'error';
type StageType = 'connecting' | 'thinking' | 'responding';
const PROVIDER_META = [
  { id: 'deepseek', name: 'DeepSeek', supportsApi: true },
  { id: 'doubao', name: '豆包', supportsApi: false },
  { id: 'qianwen', name: '千问', supportsApi: false },
  { id: 'longcat', name: 'LongCat', supportsApi: true },
] as const;

type SidepanelSettings = {
  isDeepThinkingEnabled?: boolean;
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
};

type ChatHistoryItem = {
  id: string;
  question: string;
  createdAt: number;
  providers: Record<ProviderId, ProviderHistoryEntry>;
};

// UI 状态控制
const inputStr = ref('');
const currentQuestion = ref('');
const hasAsked = ref(false);
const isDeepThinkingEnabled = ref(true);
const isDeepSeekEnabled = ref(false);
const isDoubaoEnabled = ref(false);
const isQianwenEnabled = ref(false);
const isLongcatEnabled = ref(false);
const isDeepSeekOpen = ref(true);
const isDoubaoOpen = ref(true);
const isQianwenOpen = ref(true);
const isLongcatOpen = ref(true);
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
const testingApiKey = ref<Record<string, boolean>>({});
const apiKeyTestResult = ref<Record<string, { success: boolean; message: string }>>({});
const showApiKey = ref<Record<string, boolean>>({});
const historyList = ref<ChatHistoryItem[]>([]);
const isHistoryPanelOpen = ref(false);
const activeSessionId = ref('');
const activeProviderSettings = ref<ProviderId | ''>('');

const statusMap: Record<ProviderId, ProviderStatus> = reactive({ deepseek: 'idle', doubao: 'idle', qianwen: 'idle', longcat: 'idle' });
const responses: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
const stageMap: Record<ProviderId, StageType> = reactive({ deepseek: 'connecting', doubao: 'connecting', qianwen: 'connecting', longcat: 'connecting' });
const fullTextBuffer: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
const thinkTextBuffer: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
const displayedLength: Record<ProviderId, number> = reactive({ deepseek: 0, doubao: 0, qianwen: 0, longcat: 0 });
const thinkDisplayedLength: Record<ProviderId, number> = reactive({ deepseek: 0, doubao: 0, qianwen: 0, longcat: 0 });
const thinkResponses: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
const operationStatus: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
const rawUrlMap: Record<ProviderId, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });

const chatContainer = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const SETTINGS_KEY = 'aiclash.sidepanel.settings';
const API_CONFIG_KEY = 'aiclash.api.config';
const HISTORY_STORAGE_KEY = 'aiclash.chat.history';
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

function supportsApi(providerId: ProviderId) {
  return providerId === 'deepseek' || providerId === 'longcat';
}

function getProviderLabel(providerId: string) {
  return providerId === 'deepseek' ? 'DeepSeek'
    : providerId === 'doubao' ? '豆包'
    : providerId === 'qianwen' ? '千问'
    : providerId === 'longcat' ? 'LongCat'
    : providerId;
}

function getProviderModeText(providerId: ProviderId) {
  const mode = getProviderMode(providerId);
  return mode === 'api' ? 'API' : '网页';
}

function getProviderMode(providerId: ProviderId): ProviderMode {
  return providerId === 'deepseek' ? deepseekMode.value
    : providerId === 'doubao' ? doubaoMode.value
    : providerId === 'qianwen' ? qianwenMode.value
    : longcatMode.value;
}

function getModeValue(providerId: ProviderId) {
  return getProviderMode(providerId);
}

function setProviderMode(providerId: ProviderId, mode: ProviderMode) {
  if (providerId === 'deepseek') deepseekMode.value = mode;
  else if (providerId === 'doubao') doubaoMode.value = mode;
  else if (providerId === 'qianwen') qianwenMode.value = mode;
  else longcatMode.value = mode;
}

function getApiKeyValue(providerId: ProviderId) {
  return providerId === 'deepseek' ? deepseekApiKey.value
    : providerId === 'doubao' ? doubaoApiKey.value
    : providerId === 'qianwen' ? qianwenApiKey.value
    : longcatApiKey.value;
}

function setProviderApiKey(providerId: ProviderId, value: string) {
  if (providerId === 'deepseek') deepseekApiKey.value = value;
  else if (providerId === 'doubao') doubaoApiKey.value = value;
  else if (providerId === 'qianwen') qianwenApiKey.value = value;
  else longcatApiKey.value = value;
}

function getModelValue(providerId: ProviderId) {
  return providerId === 'deepseek' ? deepseekModel.value
    : providerId === 'doubao' ? doubaoModel.value
    : providerId === 'qianwen' ? qianwenModel.value
    : longcatModel.value;
}

function setProviderModel(providerId: ProviderId, value: string) {
  if (providerId === 'deepseek') deepseekModel.value = value;
  else if (providerId === 'doubao') doubaoModel.value = value;
  else if (providerId === 'qianwen') qianwenModel.value = value;
  else longcatModel.value = value;
}

function getModelOptions(providerId: ProviderId) {
  if (providerId === 'deepseek') {
    return [
      { value: '', label: '默认模型 (deepseek-chat)' },
      { value: 'deepseek-chat', label: 'deepseek-chat' },
      { value: 'deepseek-reasoner', label: 'deepseek-reasoner' }
    ];
  }

  if (providerId === 'longcat') {
    return [
      { value: '', label: '默认模型 (longcat-chat)' },
      { value: 'longcat-chat', label: 'longcat-chat' }
    ];
  }

  return [{ value: '', label: '默认模型' }];
}

function isProviderEnabled(providerId: ProviderId) {
  return providerId === 'deepseek' ? isDeepSeekEnabled.value
    : providerId === 'doubao' ? isDoubaoEnabled.value
    : providerId === 'qianwen' ? isQianwenEnabled.value
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
  else isLongcatEnabled.value = enabled;
}

function setProviderOpen(providerId: ProviderId, open: boolean) {
  if (providerId === 'deepseek') isDeepSeekOpen.value = open;
  else if (providerId === 'doubao') isDoubaoOpen.value = open;
  else if (providerId === 'qianwen') isQianwenOpen.value = open;
  else isLongcatOpen.value = open;
}

function getEnabledProviderIds() {
  return PROVIDER_IDS.filter((providerId) => isProviderEnabled(providerId));
}

function getHistoryEnabledCount(item: ChatHistoryItem) {
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
    rawUrl: ''
  };
}

function saveSettings() {
  chrome.storage?.local.set({
    [SETTINGS_KEY]: {
      isDeepThinkingEnabled: isDeepThinkingEnabled.value,
    }
  });
}

function saveHistory() {
  chrome.storage?.local.set({
    [HISTORY_STORAGE_KEY]: historyList.value.slice(0, MAX_HISTORY_COUNT)
  });
}

function upsertHistoryItem(item: ChatHistoryItem) {
  const nextList = historyList.value.filter((historyItem) => historyItem.id !== item.id);
  nextList.unshift(item);
  historyList.value = nextList.slice(0, MAX_HISTORY_COUNT);
  saveHistory();
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
      rawUrl: rawUrlOverrides[providerId] ?? rawUrlMap[providerId] ?? ''
    };
    return acc;
  }, {} as Record<ProviderId, ProviderHistoryEntry>);
}

async function persistCurrentSession(rawUrlOverrides: Partial<Record<ProviderId, string>> = {}) {
  if (!activeSessionId.value || !hasAsked.value || !currentQuestion.value.trim()) return;

  const existing = historyList.value.find((item) => item.id === activeSessionId.value);
  const mergedRawUrlOverrides = { ...pendingRawUrlOverrides, ...rawUrlOverrides };
  pendingRawUrlOverrides = {};

  upsertHistoryItem({
    id: activeSessionId.value,
    question: currentQuestion.value,
    createdAt: existing?.createdAt ?? Date.now(),
    providers: buildHistoryProviders(mergedRawUrlOverrides)
  });
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
  }

  if (streamAnimationId != null) {
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
  }
}

function applyHistorySession(item: ChatHistoryItem) {
  activeSessionId.value = item.id;
  currentQuestion.value = item.question;
  hasAsked.value = true;
  isHistoryPanelOpen.value = false;

  if (streamAnimationId != null) {
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
  }

  for (const providerId of PROVIDER_IDS) {
    const providerState = item.providers[providerId] || createDefaultHistoryEntry(providerId);
    setProviderEnabled(providerId, providerState.enabled);
    setProviderOpen(providerId, providerState.enabled);
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
  }

  void scrollToBottom();
}

function restoreHistorySession(item: ChatHistoryItem) {
  applyHistorySession(item);
}

function loadHistory() {
  chrome.storage?.local.get([HISTORY_STORAGE_KEY], (result) => {
    const savedHistory = Array.isArray(result?.[HISTORY_STORAGE_KEY]) ? result[HISTORY_STORAGE_KEY] : [];
    historyList.value = savedHistory
      .map((item: Partial<ChatHistoryItem>) => {
        const providers = PROVIDER_IDS.reduce((acc, providerId) => {
          acc[providerId] = {
            ...createDefaultHistoryEntry(providerId),
            ...(item.providers?.[providerId] || {})
          };
          return acc;
        }, {} as Record<ProviderId, ProviderHistoryEntry>);

        return {
          id: item.id || createSessionId(),
          question: item.question || '',
          createdAt: item.createdAt || Date.now(),
          providers
        };
      })
      .filter((item: ChatHistoryItem) => item.question.trim())
      .sort((a: ChatHistoryItem, b: ChatHistoryItem) => b.createdAt - a.createdAt)
      .slice(0, MAX_HISTORY_COUNT);
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
    isDeepSeekEnabled.value = false;
    isDoubaoEnabled.value = false;
    isQianwenEnabled.value = false;
    isLongcatEnabled.value = false;

    const [deepseekValid, doubaoValid, qianwenValid, longcatValid] = await Promise.all([
      checkProviderTabValid('deepseek'),
      checkProviderTabValid('doubao'),
      checkProviderTabValid('qianwen'),
      checkProviderTabValid('longcat')
    ]);

    isDeepSeekEnabled.value = deepseekValid;
    isDoubaoEnabled.value = doubaoValid;
    isQianwenEnabled.value = qianwenValid;
    isLongcatEnabled.value = longcatValid;

    const apiConfig = (result?.[API_CONFIG_KEY] || {}) as Record<string, ApiConfig>;
    deepseekMode.value = apiConfig.deepseek?.mode || 'web';
    doubaoMode.value = apiConfig.doubao?.mode || 'web';
    qianwenMode.value = apiConfig.qianwen?.mode || 'web';
    longcatMode.value = apiConfig.longcat?.mode || 'web';
    deepseekApiKey.value = apiConfig.deepseek?.apiKey || '';
    doubaoApiKey.value = apiConfig.doubao?.apiKey || '';
    qianwenApiKey.value = apiConfig.qianwen?.apiKey || '';
    longcatApiKey.value = apiConfig.longcat?.apiKey || '';
    deepseekModel.value = apiConfig.deepseek?.model || '';
    doubaoModel.value = apiConfig.doubao?.model || '';
    qianwenModel.value = apiConfig.qianwen?.model || '';
    longcatModel.value = apiConfig.longcat?.model || '';
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
    console.error('打开provider tab失败:', err);
    return { success: false, error: String(err) };
  }
}

async function handleToggleProvider(providerId: string) {
  const currentState = providerId === 'deepseek' ? isDeepSeekEnabled.value
    : providerId === 'doubao' ? isDoubaoEnabled.value
    : providerId === 'qianwen' ? isQianwenEnabled.value
    : providerId === 'longcat' ? isLongcatEnabled.value
    : false;

  if (currentState) {
    if (providerId === 'deepseek') isDeepSeekEnabled.value = false;
    else if (providerId === 'doubao') isDoubaoEnabled.value = false;
    else if (providerId === 'qianwen') isQianwenEnabled.value = false;
    else if (providerId === 'longcat') isLongcatEnabled.value = false;
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

  void scrollToBottom();
  if (anyPending) {
    streamAnimationId = requestAnimationFrame(tickStreamDisplay);
  } else {
    streamAnimationId = null;
  }
}

const isRunning = computed(() => Object.values(statusMap).includes('running'));

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

onMounted(() => {
  loadSettings();
  loadHistory();

  chrome.runtime?.onMessage.addListener((request) => {
    const { provider } = request.payload || {};

    if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
      const payload = request.payload;
      const prov = provider as ProviderId;
      if (!prov) return;

      if (payload.isStatus) {
        operationStatus[prov] = payload.text;
        schedulePersistCurrentSession();
        return;
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
      const prov = provider as ProviderId;
      if (!prov) return;
      statusMap[prov] = 'running';
      operationStatus[prov] = payload.text || '';
      schedulePersistCurrentSession();
    } else if (request.type === MSG_TYPES.TASK_COMPLETED) {
      const prov = provider as ProviderId;
      if (!prov) return;
      statusMap[prov] = 'completed';
      operationStatus[prov] = '';
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
        }, 1500);
      }
    } else if (request.type === MSG_TYPES.ERROR) {
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
    }
  });
});

const createNewChat = () => {
  if (isRunning.value) return;

  currentQuestion.value = '';
  hasAsked.value = false;
  activeSessionId.value = '';
  isHistoryPanelOpen.value = false;
  activeProviderSettings.value = '';
  isDeepSeekOpen.value = isDeepSeekEnabled.value;
  isDoubaoOpen.value = isDoubaoEnabled.value;
  isQianwenOpen.value = isQianwenEnabled.value;
  isLongcatOpen.value = isLongcatEnabled.value;
  resetTaskState();
  inputStr.value = '';
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
};

const submit = () => {
  const prompt = inputStr.value.trim();
  if (!prompt || isRunning.value) return;
  if (!isDeepSeekEnabled.value && !isDoubaoEnabled.value && !isQianwenEnabled.value && !isLongcatEnabled.value) {
    window.alert('请在设置中至少开启一个通道。');
    return;
  }

  currentQuestion.value = prompt;
  hasAsked.value = true;
  activeSessionId.value = createSessionId();
  isHistoryPanelOpen.value = false;
  activeProviderSettings.value = '';
  isDeepSeekOpen.value = isDeepSeekEnabled.value;
  isDoubaoOpen.value = isDoubaoEnabled.value;
  isQianwenOpen.value = isQianwenEnabled.value;
  isLongcatOpen.value = isLongcatEnabled.value;
  resetTaskState();

  for (const providerId of getEnabledProviderIds()) {
    rawUrlMap[providerId] = getProviderMode(providerId) === 'api' ? 'api' : '';
  }

  schedulePersistCurrentSession(0);
  void syncProviderRawUrls(getEnabledProviderIds());

  if (isDeepSeekEnabled.value) {
    statusMap.deepseek = 'running';
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'deepseek',
        prompt,
        mode: deepseekMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
        }
      }
    });
  }

  if (isDoubaoEnabled.value) {
    statusMap.doubao = 'running';
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'doubao',
        prompt,
        mode: doubaoMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
        }
      }
    });
  }

  if (isQianwenEnabled.value) {
    statusMap.qianwen = 'running';
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'qianwen',
        prompt,
        mode: qianwenMode.value,
        settings: {}
      }
    });
  }

  if (isLongcatEnabled.value) {
    statusMap.longcat = 'running';
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'longcat',
        prompt,
        mode: longcatMode.value,
        settings: {}
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