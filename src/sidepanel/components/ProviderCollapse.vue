<template>
  <div class="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden transition-all duration-300">
    <button @click="isOpen = !isOpen"
      class="w-full flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
      <div class="flex items-center gap-2.5 min-w-0">
        <span v-if="status === 'running'" class="relative flex h-3 w-3 ml-1 flex-shrink-0">
          <span
            class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            :class="themeClasses.ping"></span>
          <span class="relative inline-flex rounded-full h-3 w-3" :class="themeClasses.dot"></span>
        </span>
        <span v-else-if="status === 'completed'" class="text-emerald-500 ml-1 flex-shrink-0">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"></path>
          </svg>
        </span>
        <span v-else-if="status === 'error'" class="text-rose-500 ml-1 flex-shrink-0">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 10-1.5 0v4.5a.75.75 0 001.5 0V6.5zm0 7a.75.75 0 10-1.5 0v.5a.75.75 0 001.5 0V13.5z"
              clip-rule="evenodd"></path>
          </svg>
        </span>
        <span v-else class="text-slate-300 ml-1 flex-shrink-0">
          <span class="inline-flex rounded-full h-3 w-3 bg-slate-300"></span>
        </span>
        <span class="text-[12px] font-medium flex-shrink-0" :class="themeClasses.text">
          {{ providerName }} {{ statusText }}
        </span>
        <span v-if="operationStatus"
          class="text-[10px] font-normal text-amber-500 animate-pulse truncate">{{ operationStatus }}</span>
        <span v-else-if="status === 'running'"
          class="text-[10px] font-normal text-slate-400 animate-pulse truncate">{{ stageLabel }}</span>
        <span v-else-if="stats && status === 'completed'"
          class="text-[10px] font-normal text-slate-400 truncate">
          首字 {{ (stats.ttff / 1000).toFixed(1) }}s · 总耗时 {{ (stats.totalTime / 1000).toFixed(1) }}s · {{ stats.charCount.toLocaleString('zh-CN') }}字 · {{ stats.charsPerSec }}字/s
        </span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <a
          v-if="rawUrl && rawUrl !== 'api'"
          :href="rawUrl"
          :target="isFromHistory ? '_blank' : undefined"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-500 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-600"
          @click.stop="onOriginalClick"
          :title="isFromHistory ? '在新标签页打开对话页' : '激活已有标签或打开对话页'">
          <svg class="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          <span>原文</span>
        </a>
        <span
          v-else-if="rawUrl === 'api'"
          class="rounded-full border border-slate-100 bg-slate-50/80 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          API
        </span>
        <svg class="w-4 h-4 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>

    <div v-show="isOpen"
      class="p-4 border-t border-slate-100 bg-white max-h-[380px] overflow-y-auto text-[13px]">
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
            class="pl-3 border-l border-slate-200 text-slate-500 leading-6 whitespace-pre-wrap text-[12px] break-words">
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
      <div class="response-content text-slate-700 prose prose-sm max-w-none text-[13.5px] leading-7 break-words"
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

type ProviderStats = {
  ttff: number;
  totalTime: number;
  charCount: number;
  charsPerSec: number;
};

const props = defineProps<{
  providerId: string;
  providerName: string;
  themeColor: 'blue' | 'amber' | 'emerald' | 'violet' | 'teal';
  status: 'idle' | 'running' | 'completed' | 'error';
  stage: 'connecting' | 'thinking' | 'responding';
  response: string;
  thinkResponse?: string;
  operationStatus?: string;
  rawUrl?: string;
  /** 是否来自历史会话：历史会话点原文打开新标签，新会话则激活已有 tab */
  isFromHistory?: boolean;
  isDeepThinkingEnabled?: boolean;
  defaultOpen?: boolean;
  stats?: ProviderStats | null;
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
  teal: {
    ping: 'bg-teal-400',
    dot: 'bg-teal-500',
    text: 'text-teal-600',
    prose: 'prose-teal',
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

function onOriginalClick(e: MouseEvent) {
  if (props.isFromHistory) return; // 历史会话：不拦截，用 href + target="_blank" 打开新标签
  e.preventDefault();
  if (props.rawUrl && typeof chrome !== 'undefined' && chrome.tabs) {
    activateOrOpenTab(props.rawUrl);
  }
}

function activateOrOpenTab(url: string) {
  try {
    const u = new URL(url);
    const pattern = u.origin + '/*';
    chrome.tabs.query({ url: pattern }, (tabs) => {
      const tab = tabs.find((t) => t.url === url);
      if (tab?.id != null) {
        chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId != null) {
          chrome.windows.update(tab.windowId, { focused: true });
        }
      } else {
        chrome.tabs.create({ url });
      }
    });
  } catch {
    chrome.tabs.create({ url });
  }
}

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

.response-content {
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.response-content :deep(p),
.response-content :deep(ul),
.response-content :deep(ol),
.response-content :deep(blockquote) {
  margin-top: 0.7rem;
  margin-bottom: 0.7rem;
}

.response-content :deep(h1),
.response-content :deep(h2),
.response-content :deep(h3) {
  margin-top: 1rem;
  margin-bottom: 0.6rem;
  line-height: 1.45;
}

.response-content :deep(li) {
  margin: 0.3rem 0;
}

.response-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace;
  font-size: 0.9em;
}
</style>
