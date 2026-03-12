<template>
  <div class="relative bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden ring-1 ring-indigo-50">
    <!-- 头部标题栏 -->
    <div class="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border-b border-indigo-100/80">
      <div class="flex items-center gap-2">
        <!-- 状态指示 -->
        <span v-if="status === 'running'" class="relative flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
        </span>
        <span v-else-if="status === 'completed'" class="text-indigo-500">
          <CheckCircle class="w-3.5 h-3.5" />
        </span>
        <span v-else-if="status === 'error'" class="text-rose-500">
          <AlertCircle class="w-3.5 h-3.5" />
        </span>
        <span v-else class="inline-flex rounded-full h-2.5 w-2.5 bg-slate-200"></span>

        <span class="text-[12px] font-semibold text-indigo-700 tracking-wide">最终研判结论</span>
        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-500 font-medium">AI 智能汇总</span>
      </div>
      <div class="text-[11px] text-indigo-400">
        <span v-if="operationStatus" class="animate-pulse">{{ operationStatus }}</span>
        <span v-else-if="status === 'running' && stage === 'thinking'">正在思考...</span>
        <span v-else-if="status === 'running'">正在输出...</span>
        <span v-else-if="stats && status === 'completed'">
          首字 {{ (stats.ttff / 1000).toFixed(1) }}s · 总耗时 {{ (stats.totalTime / 1000).toFixed(1) }}s · {{ stats.charCount.toLocaleString('zh-CN') }}字 · {{ stats.charsPerSec }}字/s
        </span>
        <span v-else-if="status === 'completed'">已完成</span>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="p-4">
      <!-- 等待中 -->
      <div v-if="status === 'idle'" class="text-[13px] text-slate-400 italic">
        等待各通道回答完毕后自动归纳...
      </div>

      <!-- 思考过程 -->
      <template v-if="thinkResponse && status !== 'idle'">
        <div class="mb-3">
          <button
            @click="isThinkBlockOpen = !isThinkBlockOpen"
            class="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors mb-1">
            <ChevronRight class="w-3 h-3 transition-transform duration-200" :class="{ 'rotate-90': isThinkBlockOpen }" />
            <span>思考过程</span>
            <span v-if="stage === 'thinking' && status === 'running'"
              class="inline-block w-1 h-2.5 ml-0.5 bg-slate-400 animate-pulse align-middle"></span>
          </button>
          <div v-show="isThinkBlockOpen"
            class="pl-3 border-l border-slate-200 text-slate-500 leading-6 whitespace-pre-wrap text-[12px] break-words">
            {{ thinkResponse }}
          </div>
        </div>
      </template>
      <div v-else-if="stage === 'thinking' && status === 'running'"
        class="mb-3 text-[11px] text-slate-400 italic flex items-center gap-1">
        正在思考...
        <span class="inline-block w-1 h-2.5 bg-slate-400 animate-pulse align-middle"></span>
      </div>

      <!-- 正文内容 -->
      <div v-if="status !== 'idle'"
        class="response-content text-slate-700 prose prose-sm max-w-none text-[13.5px] leading-7 break-words prose-indigo">
        <span v-html="renderedContent"></span>
        <span v-if="status === 'running' && stage === 'responding'"
          class="inline-block w-1.5 h-3.5 ml-0.5 bg-indigo-500 animate-pulse align-middle"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { CheckCircle, AlertCircle, ChevronRight } from 'lucide-vue-next';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

type ProviderStats = {
  ttff: number;
  totalTime: number;
  charCount: number;
  charsPerSec: number;
};

const props = defineProps<{
  status: 'idle' | 'running' | 'completed' | 'error';
  stage: 'thinking' | 'responding';
  response: string;
  thinkResponse?: string;
  operationStatus?: string;
  stats?: ProviderStats | null;
}>();

const isThinkBlockOpen = ref(true);

const renderedContent = computed(() => {
  if (!props.response) return '';
  try {
    const html = marked.parse(props.response) as string;
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['del', 'ins']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['class'],
      },
    });
  } catch {
    return props.response;
  }
});
</script>
