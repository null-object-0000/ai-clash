<template>
  <div
    v-if="activeProviderId"
    class="fixed inset-0 z-40 flex items-end justify-center p-3 sm:items-center">
    <button
      type="button"
      class="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
      aria-label="关闭通道设置弹窗"
      @click="$emit('close')">
    </button>

    <div
      class="relative z-10 w-full max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.5)]">
      <div class="border-b border-slate-200/80 px-5 py-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-[18px] font-semibold tracking-[-0.02em] text-slate-900">{{ providerLabel }} 设置</div>
            <p class="mt-1 text-[13px] leading-6 text-slate-500">这里调整当前通道的接入模式和详细参数。</p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
            @click="$emit('close')"
            aria-label="关闭当前通道设置">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div class="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
        <div class="space-y-2">
          <div class="text-[12px] font-medium text-slate-700">接入模式</div>
          <div class="flex flex-wrap gap-2">
            <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
              <input
                type="radio"
                :name="`provider-mode-${activeProviderId}`"
                class="h-3.5 w-3.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                :checked="mode === 'web'"
                @change="$emit('update:mode', 'web')" />
              <span>网页模式</span>
            </label>
            <label
              class="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px]"
              :class="supportsApi
                ? 'cursor-pointer border-slate-200 bg-slate-50 text-slate-700'
                : 'border-slate-100 bg-slate-50 text-slate-400'">
              <input
                type="radio"
                :name="`provider-mode-${activeProviderId}`"
                class="h-3.5 w-3.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                :disabled="!supportsApi"
                :checked="mode === 'api'"
                @change="$emit('update:mode', 'api')" />
              <span>{{ supportsApi ? 'API模式' : 'API模式暂不支持' }}</span>
            </label>
          </div>
        </div>

        <div
          v-if="supportsApi && mode === 'api'"
          class="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div class="space-y-2">
            <label class="text-[12px] font-medium text-slate-700">API Key</label>
            <div class="flex items-center gap-2">
              <input
                :type="showApiKey ? 'text' : 'password'"
                :value="apiKey"
                @input="$emit('update:apiKey', ($event.target as HTMLInputElement).value)"
                placeholder="输入 API Key"
                class="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-[13px] text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15" />
              <button
                type="button"
                @click="$emit('toggleShowApiKey')"
                class="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700">
                {{ showApiKey ? '隐藏' : '显示' }}
              </button>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              @click="$emit('testApiKey')"
              :disabled="testing || !apiKey"
              class="inline-flex min-h-10 items-center justify-center rounded-full bg-indigo-50 px-3 text-[12px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400">
              {{ testing ? '测试中...' : '测试 Key' }}
            </button>
            <span
              v-if="apiKeyTestResult"
              class="text-[11px]"
              :class="apiKeyTestResult.success ? 'text-emerald-600' : 'text-rose-600'">
              {{ apiKeyTestResult.message }}
            </span>
          </div>

          <div class="space-y-2">
            <label class="text-[12px] font-medium text-slate-700">模型</label>
            <select
              :value="model"
              @change="$emit('update:model', ($event.target as HTMLSelectElement).value)"
              class="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15">
              <option v-for="option in modelOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  activeProviderId: string | null;
  providerLabel: string;
  mode: 'web' | 'api';
  supportsApi: boolean;
  apiKey: string;
  model: string;
  modelOptions: Array<{ value: string; label: string }>;
  showApiKey: boolean;
  testing: boolean;
  apiKeyTestResult: { success: boolean; message: string } | null;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'update:mode', mode: 'web' | 'api'): void;
  (e: 'update:apiKey', value: string): void;
  (e: 'update:model', value: string): void;
  (e: 'toggleShowApiKey'): void;
  (e: 'testApiKey'): void;
}>();
</script>
