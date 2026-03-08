<template>
    <div class="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      
      <header class="flex items-center justify-between px-4 py-3 bg-white/70 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <h1 class="text-[15px] font-semibold tracking-tight text-slate-800">AnyBridge AI</h1>
        </div>
        <div class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          MoE 模式
        </div>
      </header>
  
      <main class="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" ref="chatContainer">
        
        <div v-if="!hasAsked" class="h-full flex flex-col items-center justify-center text-center space-y-3 mt-10">
          <div class="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-2">
            <span class="text-3xl">✨</span>
          </div>
          <h2 class="text-lg font-semibold text-slate-700">混合专家引擎已就绪</h2>
          <p class="text-xs text-slate-400 max-w-[200px] leading-relaxed">
            输入您的问题，我将在后台同时调用多个头部模型为您交叉比对。
          </p>
        </div>
  
        <template v-else>
          <div class="flex justify-end">
            <div class="bg-slate-800 text-white text-[14px] px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-md leading-relaxed break-words">
              {{ currentQuestion }}
            </div>
          </div>
  
          <div class="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden transition-all duration-300">
            <button 
              @click="isThoughtOpen = !isThoughtOpen"
              class="w-full flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div class="flex items-center gap-2.5">
                <span v-if="isRunning" class="relative flex h-3 w-3 ml-1">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
                <span v-else class="text-emerald-500 ml-1">
                  <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                </span>
                <span class="text-[13px] font-medium" :class="isRunning ? 'text-indigo-600' : 'text-slate-600'">
                  {{ isRunning ? '各平台专家正在输出...' : '各平台原始输出 (已完成)' }}
                </span>
              </div>
              <svg 
                class="w-4 h-4 text-slate-400 transition-transform duration-200" 
                :class="{ 'rotate-180': isThoughtOpen }"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            
            <div v-show="isThoughtOpen" class="p-4 border-t border-slate-100 bg-white space-y-5 max-h-[350px] overflow-y-auto text-[13px]">
              <div class="relative pl-3 border-l-2 border-blue-500">
                <div class="font-semibold text-blue-600 mb-1.5 flex items-center gap-2">
                  DeepSeek
                  <span v-if="statusMap.deepseek === 'running'" class="text-[10px] font-normal text-slate-400 animate-pulse">抓取中...</span>
                </div>
                <div class="text-slate-600 leading-relaxed whitespace-pre-wrap font-mono text-[12px] break-words">
                  {{ responses.deepseek || '等待连接网页端...' }}
                  <span v-if="statusMap.deepseek === 'running'" class="inline-block w-1.5 h-3.5 ml-0.5 bg-blue-500 animate-pulse align-middle"></span>
                </div>
              </div>
              
              </div>
          </div>
  
          <div v-if="!isRunning && hasAsked" class="relative bg-white p-4 rounded-xl shadow-sm border border-indigo-100 ring-1 ring-indigo-50">
            <div class="absolute -top-2.5 left-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wider">
              最终研判结论
            </div>
            <div class="mt-2 text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap">
              这是基于多个模型给出的综合优化建议。MVP 阶段暂未接大模型总结 API，您可以先在这里查看聚合后的排版效果。
            </div>
          </div>
        </template>
  
      </main>
  
      <div class="p-4 bg-white border-t border-slate-200/60 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] z-10">
        <div class="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
          <textarea 
            v-model="inputStr" 
            @keydown.enter.prevent="submit"
            placeholder="输入问题，按 Enter 发送..."
            class="w-full bg-transparent p-3 pr-2 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-32 min-h-[44px]"
            rows="1"
            @input="autoResize"
            ref="textareaRef"
          ></textarea>
          
          <div class="p-1.5 mb-0.5 pr-2 flex-shrink-0">
            <button 
              @click="submit" 
              :disabled="isRunning || !inputStr.trim()" 
              class="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors flex items-center justify-center shadow-sm disabled:shadow-none"
            >
              <svg class="w-4 h-4 translate-x-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
        <div class="text-center mt-2">
          <span class="text-[10px] text-slate-400">目前支持：DeepSeek 网页端提取</span>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, reactive, onMounted, computed, nextTick } from 'vue';
  import { MSG_TYPES } from '../shared/messages.js';
  
  // UI 状态控制
  const inputStr = ref('');
  const currentQuestion = ref('');
  const hasAsked = ref(false);
  const isThoughtOpen = ref(true); // 控制思考过程是否折叠
  const chatContainer = ref(null);
  const textareaRef = ref(null);
  
  // 业务数据控制
  const statusMap = reactive({ deepseek: 'idle' }); 
  const responses = reactive({ deepseek: '' });
  
  // 计算是否有任何模型还在运行
  const isRunning = computed(() => Object.values(statusMap).includes('running'));
  
  // 自动滚动到底部
  const scrollToBottom = async () => {
    await nextTick();
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  };
  
  // 监听流式数据
  onMounted(() => {
    chrome.runtime?.onMessage.addListener((request) => {
      const { provider } = request.payload || {};
      
      if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
        responses[provider] = request.payload.text;
        scrollToBottom(); // 每次有新字进来就滚动
      } 
      else if (request.type === MSG_TYPES.TASK_COMPLETED) {
        statusMap[provider] = 'completed';
        // 思考完成后，自动把折叠面板关上，让用户的注意力回到总结上
        if (!isRunning.value) {
          setTimeout(() => isThoughtOpen.value = false, 1500);
        }
      }
      else if (request.type === MSG_TYPES.ERROR) {
        statusMap[provider] = 'error';
        responses[provider] = `[系统报错] ${request.payload.message}`;
      }
    });
  });
  
  // 提交问题
  const submit = () => {
    if (!inputStr.value.trim() || isRunning.value) return;
    
    currentQuestion.value = inputStr.value;
    hasAsked.value = true;
    isThoughtOpen.value = true; // 发送新问题时，强行展开面板让用户看到正在拉取
    
    // 重置状态
    statusMap.deepseek = 'running';
    responses.deepseek = '';
  
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: { provider: 'deepseek', prompt: inputStr.value.trim() }
    });
  
    inputStr.value = '';
    // 恢复输入框高度
    if (textareaRef.value) textareaRef.value.style.height = 'auto';
  };
  
  // 输入框自适应高度
  const autoResize = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'; // 最大 128px
  };
  </script>
  
  <style scoped>
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