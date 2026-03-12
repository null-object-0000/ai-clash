
<template>
  <div class="absolute left-4 right-4 top-[calc(100%+8px)] max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-2 space-y-1">
    <div class="flex items-center justify-between px-2 pt-1 pb-2">
      <div class="text-[12px] font-semibold text-slate-700">历史对话</div>
      <div class="flex items-center gap-2">
        <button
          v-if="historyList.length"
          type="button"
          class="text-[11px] text-red-400 hover:text-red-600 transition-colors"
          @click="$emit('clear-all')"
        >
          清除全部
        </button>
        <button
          type="button"
          class="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
          @click="$emit('close')"
        >
          关闭
        </button>
      </div>
    </div>

    <div
      v-if="!historyList.length"
      class="px-3 py-6 text-center text-[12px] text-slate-400"
    >
      暂无历史对话
    </div>

    <div
      v-for="item in historyList"
      :key="item.id"
      class="group relative rounded-xl border transition-colors"
      :class="item.id === activeSessionId
        ? 'border-indigo-200 bg-indigo-50/80'
        : 'border-slate-200 bg-white hover:bg-slate-50'"
    >
      <button
        type="button"
        class="w-full text-left px-3 py-2.5 pr-8"
        @click="$emit('restore-session', item)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-[12px] font-medium text-slate-700 truncate">
              {{ item.type === 'single' ? `[${item.providerName}] ${item.turns[0]?.question || '新对话'}` : item.question }}
            </div>
            <div class="mt-1 text-[10px] text-slate-400">
              {{ formatHistoryTime(item.type === 'single' ? item.updatedAt : item.createdAt) }}
              {{ item.type === 'single' ? ` · ${item.turns.length} 轮` : '' }}
            </div>
          </div>
          <div class="text-[10px] text-slate-400 whitespace-nowrap">
            {{ item.type === 'single' ? '单通道' : `${getHistoryEnabledCount(item)} 通道` }}
          </div>
        </div>
      </button>
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
        @click.stop="$emit('delete-item', item.id)"
        aria-label="删除此记录"
      >
        <X class="w-3 h-3" :stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';
import type { ChatHistoryItem } from '../App.vue';

interface Props {
  historyList: ChatHistoryItem[];
  activeSessionId: string;
  hasAsked: boolean;
  isRunning: boolean;
}

defineProps<Props>();

interface Emits {
  (e: 'create-new-chat'): void;
  (e: 'restore-session', item: ChatHistoryItem): void;
  (e: 'delete-item', id: string): void;
  (e: 'clear-all'): void;
  (e: 'close'): void;
}

defineEmits<Emits>();

function formatHistoryTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getHistoryEnabledCount(item: ChatHistoryItem) {
  if (item.type === 'single') {
    return 1;
  }
  return Object.values(item.providers).filter(p => p?.enabled).length;
}
</script>
