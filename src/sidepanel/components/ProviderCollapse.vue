<template>
  <div class="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden transition-all duration-300">
    <button @click="isOpen = !isOpen"
      class="w-full flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
      <div class="flex items-center gap-2.5">
        <span v-if="status === 'running'" class="relative flex h-3 w-3 ml-1">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            :class="themeClasses.ping"></span>
          <span class="relative inline-flex rounded-full h-3 w-3" :class="themeClasses.dot"></span>
        </span>
        <span v-else-if="status === 'completed'" class="text-emerald-500 ml-1">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"></path>
          </svg>
        </span>
        <span v-else-if="status === 'error'" class="text-rose-500 ml-1">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 10-1.5 0v4.5a.75.75 0 001.5 0V6.5zm0 7a.75.75 0 10-1.5 0v.5a.75.75 0 001.5 0V13.5z"
              clip-rule="evenodd"></path>
          </svg>
        </span>
        <span v-else class="text-slate-300 ml-1">
          <span class="inline-flex rounded-full h-3 w-3 bg-slate-300"></span>
        </span>
        <span class="text-[13px] font-medium" :class="themeClasses.text">
          {{ providerName }} {{ statusText }}
        </span>
        <span v-if="operationStatus"
          class="text-[10px] font-normal text-amber-500 animate-pulse">{{ operationStatus }}</span>
        <span v-else-if="status === 'running'"
          class="text-[10px] font-normal text-slate-400 animate-pulse">{{ stageLabel }}</span>
      </div>
      <div class="flex items-center gap-2">
        <a
          v-if="rawUrl && rawUrl !== 'api'"
          :href="rawUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[10px] text-slate-400 hover:text-indigo-500 transition-colors"
          @click.stop>
          原始链接
        </a>
        <span
          v-else-if="rawUrl === 'api'"
          class="text-[10px] text-slate-400">
          API模式
        </span>
      </div>
      <svg class="w-4 h-4 text-slate-400 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-show="isOpen"
      class="p-4 border-t border-slate-100 bg-white max-h-[350px] overflow-y-auto text-[13px]">
      <!-- 思考内容折叠块 (启用深度思考时显示) -->
      <template v-if="isDeepThinkingEnabled">
        <div v-if="thinkResponse" class="mb-2">
          <button @click="isThinkBlockOpen = !isThinkBlockOpen"
            class="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors mb-1">
            <svg class="w-3 h-3 transition-transform duration-200" :class="{ 'rotate-90': isThinkBlockOpen }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>思考过程</span>
            <span v-if="stage === 'thinking' && status === 'running'"
              class="inline-block w-1 h-2.5 ml-0.5 bg-slate-400 animate-pulse align-middle"></span>
          </button>
          <div v-show="isThinkBlockOpen"
            class="pl-3 border-l border-slate-200 text-slate-400 leading-relaxed whitespace-pre-wrap font-mono text-[11px] break-words italic">
            {{ thinkResponse }}
          </div>
        </div>
        <div v-else-if="stage === 'thinking' && status === 'running'"
          class="mb-2 text-[11px] text-slate-400 italic flex items-center gap-1">
          正在思考...
          <span class="inline-block w-1 h-2.5 bg-slate-400 animate-pulse align-middle"></span>
        </div>
      </template>

      <!-- 正式回复 -->
      <div class="text-slate-600 leading-relaxed prose prose-sm max-w-none font-mono text-[12px] break-words"
        :class="themeClasses.prose">
        <span v-html="renderedContent"></span>
        <span v-if="status === 'running' && stage === 'responding'"
          class="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse align-middle"
          :class="themeClasses.dot"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const props = defineProps<{
  providerId: string;
  providerName: string;
  themeColor: 'blue' | 'amber' | 'emerald' | 'violet';
  status: 'idle' | 'running' | 'completed' | 'error';
  stage: 'connecting' | 'thinking' | 'responding';
  response: string;
  thinkResponse?: string;
  operationStatus?: string;
  rawUrl?: string;
  isDeepThinkingEnabled?: boolean;
  defaultOpen?: boolean;
}>();

const isOpen = ref(props.defaultOpen ?? true);
const isThinkBlockOpen = ref(true);

const stageLabels: Record<string, string> = {
  connecting: '等待连接网页端...',
  thinking: '已连接 · 正在思考...',
  responding: '正在输出...',
};

const themeClassMap = {
  blue: {
    ping: 'bg-blue-400',
    dot: 'bg-blue-500',
    text: 'text-blue-600',
    prose: 'prose-blue',
  },
  amber: {
    ping: 'bg-amber-400',
    dot: 'bg-amber-500',
    text: 'text-amber-600',
    prose: 'prose-amber',
  },
  emerald: {
    ping: 'bg-emerald-400',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600',
    prose: 'prose-emerald',
  },
  violet: {
    ping: 'bg-violet-400',
    dot: 'bg-violet-500',
    text: 'text-violet-600',
    prose: 'prose-violet',
  },
} as const;

const stageLabel = computed(() => stageLabels[props.stage] || stageLabels.connecting);
const themeClasses = computed(() => themeClassMap[props.themeColor] || themeClassMap.blue);
const statusText = computed(() => {
  if (props.status === 'running') return '正在输出...';
  if (props.status === 'completed') return '(已完成)';
  if (props.status === 'error') return '(出错)';
  return '(待开始)';
});
const renderedContent = computed(() => {
  if (props.response) return renderMarkdown(props.response);
  if (props.status === 'running') return props.stage === 'responding' ? '' : stageLabel.value;
  if (props.status === 'error') return '执行失败，请查看上面的错误信息。';
  if (props.status === 'completed') return '本轮未收到可展示内容。';
  return '等待开始...';
});

watch(() => props.defaultOpen, (value) => {
  isOpen.value = value ?? true;
});

// Markdown 渲染方法
const renderMarkdown = (text: string) => {
  if (!text) return '';
  const html = marked.parse(text);
  return sanitizeHtml(html as string, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'blockquote', 'a', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: {
      'a': ['href', 'target', 'rel']
    },
    transformTags: {
      'a': (tagName: string, attribs: Record<string, string>) => {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        };
      }
    }
  });
};
</script>

<style scoped>
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
