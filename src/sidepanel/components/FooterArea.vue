
<template>
  <div class="p-4 bg-white border-t border-slate-200/60 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
    <div class="flex items-center gap-1.5 mb-1.5">
      <button
        type="button"
        @click="$emit('toggle-deep-thinking')"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
        :class="isDeepThinkingEnabled
          ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.06428 5.93342C7.6876 5.93342 8.19304 6.43904 8.19319 7.06233C8.19319 7.68573 7.68769 8.19123 7.06428 8.19123C6.44096 8.19113 5.93537 7.68567 5.93537 7.06233C5.93552 6.43911 6.44105 5.93353 7.06428 5.93342Z" fill="currentColor"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M8.68147 0.963693C10.1168 0.447019 11.6266 0.374829 12.5633 1.31135C13.5 2.24805 13.4276 3.75776 12.911 5.19319C12.7126 5.74431 12.4385 6.31796 12.0965 6.89729C12.4969 7.54638 12.8141 8.19018 13.036 8.80647C13.5527 10.2419 13.625 11.7516 12.6883 12.6883C11.7516 13.625 10.2419 13.5527 8.80647 13.036C8.19019 12.8141 7.54638 12.4969 6.89729 12.0965C6.31794 12.4386 5.74432 12.7125 5.19319 12.911C3.75774 13.4276 2.24807 13.5 1.31135 12.5633C0.374829 11.6266 0.447019 10.1168 0.963693 8.68147C1.17182 8.10338 1.46318 7.50063 1.82893 6.8924C1.52179 6.35711 1.27232 5.82825 1.08869 5.31819C0.572038 3.88278 0.499683 2.37306 1.43635 1.43635C2.37304 0.499655 3.88277 0.572044 5.31819 1.08869C5.82825 1.27232 6.35712 1.5218 6.8924 1.82893C7.50063 1.46318 8.10338 1.17181 8.68147 0.963693Z" fill="currentColor"/>
        </svg>
        <span>深度思考</span>
      </button>

      <!-- 归纳总结开关 + 设置入口 -->
      <div class="relative flex items-center gap-0.5">
        <button
          type="button"
          @click="$emit('toggle-summary-enabled')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
          :class="isSummaryEnabled && !summaryBlockReason
            ? 'bg-purple-50 border-purple-200 text-purple-600'
            : !summaryBlockReason
              ? 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
              : 'bg-white border-slate-200 text-slate-300 cursor-default'"
          :title="summaryBlockReason ?? ''"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span>归纳总结</span>
        </button>

        <!-- 设置按钮 -->
        <button
          type="button"
          @click="$emit('toggle-summary-settings')"
          class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
          :class="isSummarySettingsOpen ? 'border-purple-200 bg-purple-50 text-purple-500' : ''"
          aria-label="设置"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <!-- 多轮对话提示标签（归纳总结按钮旁，仅单通道激活会话时显示） -->
        <div
          v-if="isMultiTurnSession && hasAsked && !isSummarySettingsOpen"
          class="flex items-center gap-1 ml-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 select-none"
          title="当前为单通道模式，发送下一条消息即可自动续聊"
        >
          <svg class="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
          </svg>
          <span>多轮对话中</span>
        </div>

        <!-- 设置浮层 -->
        <div
          v-if="isSummarySettingsOpen"
          class="absolute bottom-full left-0 mb-2 w-[260px] rounded-2xl border border-slate-200 bg-white shadow-xl p-3 space-y-3 z-20"
        >
          <div class="flex items-center justify-between">
            <div class="text-[12px] font-semibold text-slate-800">设置</div>
            <button
              type="button"
              @click="$emit('toggle-summary-settings')"
              class="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 调试模式 -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
              </svg>
              <span class="text-[12px] text-slate-700">调试模式</span>
            </div>
            <button
              type="button"
              @click="$emit('toggle-debug-enabled')"
              class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="isDebugEnabled ? 'bg-slate-600' : 'bg-slate-200'"
              role="switch"
              :aria-checked="isDebugEnabled"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
                :class="isDebugEnabled ? 'translate-x-4' : 'translate-x-0'"
              >
              </span>
            </button>
          </div>

          <div class="border-t border-slate-100"></div>

          <!-- 归纳总结 -->
          <div class="text-[11px] font-medium text-slate-500 -mb-1">归纳总结</div>

          <div v-if="getSummaryProviderOptions().length === 0"
            class="text-[11px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2 leading-5">
            请先在通道设置中为 DeepSeek 或 LongCat 配置 API Key，才能使用归纳总结功能。
          </div>

          <template v-else>
            <div class="space-y-1.5">
              <label class="text-[11px] font-medium text-slate-600">汇总通道</label>
              <select
                :value="summaryProviderId"
                @change="(e) => $emit('update:summary-provider-id', (e.target as HTMLSelectElement).value)"
                class="w-full min-h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/15"
              >
                <option value="">请选择通道</option>
                <option v-for="opt in getSummaryProviderOptions()" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="space-y-1.5" v-if="summaryProviderId">
              <label class="text-[11px] font-medium text-slate-600">汇总模型</label>
              <select
                :value="summaryModel"
                @change="(e) => $emit('update:summary-model', (e.target as HTMLSelectElement).value)"
                class="w-full min-h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/15"
              >
                <option v-for="opt in getSummaryModelOptions()" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <p class="text-[10px] text-slate-400 leading-4">
              将复用已配置的 API Key，等所有通道回答完毕后自动发起汇总请求。
            </p>
          </template>
        </div>
      </div>
    </div>
    <div
      class="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all"
    >
      <textarea
        :value="inputValue"
        @input="(e) => $emit('update:inputValue', (e.target as HTMLTextAreaElement).value)"
        @keydown.enter.prevent="$emit('submit')"
        placeholder="输入问题，按 Enter 发送..."
        class="w-full bg-transparent p-3 pr-2 text-[15px] leading-7 text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-32 min-h-[48px]"
        rows="1"
        ref="textareaRef"
      ></textarea>

      <div class="p-1.5 mb-0.5 pr-2 flex-shrink-0">
        <button @click="$emit('submit')" :disabled="isRunning || !inputValue.trim()"
          class="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center justify-center shadow-sm disabled:shadow-none"
        >
          <svg class="w-4 h-4 translate-x-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
    <div class="text-center mt-2">
      <span v-if="isMultiTurnSession && hasAsked" class="text-[10px] text-emerald-500">
        单通道多轮对话模式 · 直接输入下一条消息即可继续
      </span>
      <span v-else class="text-[10px] text-slate-400">目前支持：DeepSeek · 豆包 · 千问 · LongCat（网页模式/API模式双接入）</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  inputValue: string;
  isRunning: boolean;
  isDeepThinkingEnabled: boolean;
  isSummaryEnabled: boolean;
  isSummarySettingsOpen: boolean;
  isDebugEnabled: boolean;
  summaryProviderId: string;
  summaryModel: string;
  summaryBlockReason: string | null;
  getSummaryProviderOptions: () => Array<{ value: string; label: string }>;
  getSummaryModelOptions: () => Array<{ value: string; label: string }>;
  isMultiTurnSession: boolean;
  hasAsked: boolean;
}

defineProps<Props>();

interface Emits {
  (e: 'update:inputValue', value: string): void;
  (e: 'submit'): void;
  (e: 'toggle-deep-thinking'): void;
  (e: 'toggle-summary-enabled'): void;
  (e: 'toggle-summary-settings'): void;
  (e: 'update:summary-provider-id', value: string): void;
  (e: 'update:summary-model', value: string): void;
  (e: 'toggle-debug-enabled'): void;
}

defineEmits<Emits>();
</script>
