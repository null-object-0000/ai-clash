<template>
  <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
      <div class="text-[12px] font-semibold text-slate-700">通道列表</div>
      <button
        type="button"
        class="text-[11px] text-slate-500 transition-colors hover:text-slate-800"
        @click="$emit('view-history')">
        查看历史
      </button>
    </div>

    <div class="divide-y divide-slate-100">
      <div
        v-for="provider in providerMeta"
        :key="provider.id"
        class="px-4 py-2.5">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 flex items-center gap-2">
            <span class="text-[13px] font-medium text-slate-800">{{ provider.name }}</span>
            <span class="text-[11px] text-slate-500">{{ getModeText(provider.id) }}模式</span>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              class="inline-flex h-7 items-center justify-center rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
              @click="$emit('open-settings', provider.id)">
              设置
            </button>
            <button
              v-if="getModeValue(provider.id) === 'web'"
              type="button"
              class="inline-flex h-7 items-center justify-center rounded-full bg-indigo-50 px-2.5 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100"
              @click="$emit('go', provider.id)">
              前往
            </button>
            <button
              type="button"
              @click="$emit('toggle', provider.id)"
              class="relative inline-flex h-6 w-10 items-center rounded-full transition-colors"
              :class="isEnabled(provider.id) ? 'bg-indigo-500' : 'bg-slate-300'">
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="isEnabled(provider.id) ? 'translate-x-5' : 'translate-x-1'">
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  providerMeta: ReadonlyArray<{ id: string; name: string }>;
  isEnabled: (providerId: string) => boolean;
  getModeText: (providerId: string) => string;
  getModeValue: (providerId: string) => string;
}>();

defineEmits<{
  (e: 'view-history'): void;
  (e: 'open-settings', providerId: string): void;
  (e: 'toggle', providerId: string): void;
  (e: 'go', providerId: string): void;
}>();
</script>
