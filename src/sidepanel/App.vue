<template>
  <div
    class="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">

    <header
      class="flex items-center justify-between px-4 py-3 bg-white/70 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-10">
      <div class="flex items-center gap-2">
      </div>
      <div class="relative flex items-center gap-2">
        <button
          type="button"
          class="w-7 h-7 rounded-full border border-slate-200 bg-white/80 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          @click="createNewChat"
          :disabled="!hasAsked || isRunning"
          aria-label="新建对话">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          type="button"
          class="w-7 h-7 rounded-full border border-slate-200 bg-white/80 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors flex items-center justify-center"
          @click="isSettingsOpen = !isSettingsOpen"
          aria-label="设置">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm8.94 2.5a7.96 7.96 0 00-.16-1.6l2.02-1.58-1.9-3.3-2.4.97a8.12 8.12 0 00-2.76-1.6l-.36-2.58h-3.8l-.36 2.58a8.12 8.12 0 00-2.76 1.6l-2.4-.97-1.9 3.3 2.02 1.58a7.96 7.96 0 000 3.2l-2.02 1.58 1.9 3.3 2.4-.97a8.12 8.12 0 002.76 1.6l.36 2.58h3.8l.36-2.58a8.12 8.12 0 002.76-1.6l2.4.97 1.9-3.3-2.02-1.58c.11-.52.16-1.05.16-1.6z" />
          </svg>
        </button>
        <div class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          MoE 模式
        </div>
        <div v-if="isSettingsOpen"
          class="absolute right-0 top-9 w-52 rounded-xl border border-slate-200 bg-white shadow-lg p-3 space-y-3 z-20">
          <div class="text-[11px] font-semibold text-slate-500 tracking-wide">通道开关</div>
          <div class="flex items-center justify-between">
            <span class="text-[13px] text-slate-700">DeepSeek</span>
            <button
              type="button"
              @click="isDeepSeekEnabled = !isDeepSeekEnabled"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              :class="isDeepSeekEnabled ? 'bg-indigo-500/90' : 'bg-slate-200'">
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="isDeepSeekEnabled ? 'translate-x-4' : 'translate-x-1'">
              </span>
            </button>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[13px] text-slate-700">豆包</span>
            <button
              type="button"
              @click="isDoubaoEnabled = !isDoubaoEnabled"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              :class="isDoubaoEnabled ? 'bg-indigo-500/90' : 'bg-slate-200'">
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="isDoubaoEnabled ? 'translate-x-4' : 'translate-x-1'">
              </span>
            </button>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[13px] text-slate-700">千问</span>
            <button
              type="button"
              @click="isQianwenEnabled = !isQianwenEnabled"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              :class="isQianwenEnabled ? 'bg-indigo-500/90' : 'bg-slate-200'">
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="isQianwenEnabled ? 'translate-x-4' : 'translate-x-1'">
              </span>
            </button>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[13px] text-slate-700">LongCat</span>
            <button
              type="button"
              @click="isLongcatEnabled = !isLongcatEnabled"
              class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
              :class="isLongcatEnabled ? 'bg-indigo-500/90' : 'bg-slate-200'">
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="isLongcatEnabled ? 'translate-x-4' : 'translate-x-1'">
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth" ref="chatContainer">

      <div v-if="!hasAsked" class="h-full flex flex-col items-center justify-center text-center space-y-3 mt-6">
        <div
          class="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-2">
          <span class="text-3xl">✨</span>
        </div>
        <h2 class="text-lg font-semibold text-slate-700">混合专家引擎已就绪</h2>
        <p class="text-xs text-slate-400 max-w-[200px] leading-relaxed">
          输入您的问题，我将在后台同时调用多个头部模型为您交叉比对。
        </p>

        <!-- 渠道设置卡片 -->
        <div class="w-full max-w-[260px] mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div class="text-[11px] font-semibold text-slate-500 tracking-wide text-left">通道设置</div>

          <!-- DeepSeek -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="isDeepSeekEnabled = !isDeepSeekEnabled"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  :class="isDeepSeekEnabled ? 'bg-indigo-500/90' : 'bg-slate-200'">
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    :class="isDeepSeekEnabled ? 'translate-x-4' : 'translate-x-1'">
                  </span>
                </button>
                <span class="text-[13px] text-slate-700">DeepSeek</span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="showAdvancedSettings.deepseek = !showAdvancedSettings.deepseek"
                  class="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors">
                  {{ showAdvancedSettings.deepseek ? '收起' : '设置' }}
                </button>
                <a
                  v-if="deepseekMode === 'web'"
                  href="https://chat.deepseek.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[11px] text-indigo-500 hover:text-indigo-600 font-medium px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  前往
                </a>
              </div>
            </div>
            <!-- 高级设置 -->
            <div v-if="showAdvancedSettings.deepseek" class="pl-11 space-y-2 pb-1">
              <div class="flex items-center gap-3">
                <span class="text-[11px] text-slate-500">接入模式:</span>
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    value="web"
                    v-model="deepseekMode"
                    class="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="text-[11px] text-slate-700">网页模式</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    value="api"
                    v-model="deepseekMode"
                    class="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="text-[11px] text-slate-700">API模式</span>
                </label>
              </div>
              <!-- API模式配置 -->
              <div v-if="deepseekMode === 'api'" class="space-y-2">
                <div class="flex items-center gap-2">
                  <input
                    :type="showApiKey.deepseek ? 'text' : 'password'"
                    v-model="deepseekApiKey"
                    placeholder="输入API Key"
                    class="flex-1 px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    @click="showApiKey.deepseek = !showApiKey.deepseek"
                    class="text-[11px] text-slate-500 hover:text-slate-700 px-1.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
                    :title="showApiKey.deepseek ? '隐藏' : '显示'">
                    {{ showApiKey.deepseek ? '🙈' : '👁️' }}
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="testApiKey('deepseek', deepseekApiKey)"
                    :disabled="testingApiKey.deepseek || !deepseekApiKey"
                    class="text-[11px] px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 transition-colors">
                    {{ testingApiKey.deepseek ? '测试中...' : '测试Key' }}
                  </button>
                  <span
                    v-if="apiKeyTestResult.deepseek"
                    class="text-[10px]"
                    :class="apiKeyTestResult.deepseek.success ? 'text-green-600' : 'text-red-600'">
                    {{ apiKeyTestResult.deepseek.message }}
                  </span>
                </div>
                <div>
                  <select
                    v-model="deepseekModel"
                    class="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">默认模型 (deepseek-chat)</option>
                    <option value="deepseek-chat">deepseek-chat</option>
                    <option value="deepseek-reasoner">deepseek-reasoner</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- 豆包 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="isDoubaoEnabled = !isDoubaoEnabled"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  :class="isDoubaoEnabled ? 'bg-indigo-500/90' : 'bg-slate-200'">
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    :class="isDoubaoEnabled ? 'translate-x-4' : 'translate-x-1'">
                  </span>
                </button>
                <span class="text-[13px] text-slate-700">豆包</span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="showAdvancedSettings.doubao = !showAdvancedSettings.doubao"
                  class="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors">
                  {{ showAdvancedSettings.doubao ? '收起' : '设置' }}
                </button>
                <a
                  v-if="doubaoMode === 'web'"
                  href="https://www.doubao.com/chat/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[11px] text-indigo-500 hover:text-indigo-600 font-medium px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  前往
                </a>
              </div>
            </div>
            <!-- 高级设置 -->
            <div v-if="showAdvancedSettings.doubao" class="pl-11 space-y-2 pb-1">
              <div class="flex items-center gap-3">
                <span class="text-[11px] text-slate-500">接入模式:</span>
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    value="web"
                    v-model="doubaoMode"
                    class="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="text-[11px] text-slate-700">网页模式</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer opacity-50">
                  <input
                    type="radio"
                    value="api"
                    disabled
                    class="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="text-[11px] text-slate-500">API模式 (暂不支持)</span>
                </label>
              </div>
            </div>
          </div>

          <!-- 千问 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="isQianwenEnabled = !isQianwenEnabled"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  :class="isQianwenEnabled ? 'bg-indigo-500/90' : 'bg-slate-200'">
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    :class="isQianwenEnabled ? 'translate-x-4' : 'translate-x-1'">
                  </span>
                </button>
                <span class="text-[13px] text-slate-700">千问</span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="showAdvancedSettings.qianwen = !showAdvancedSettings.qianwen"
                  class="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors">
                  {{ showAdvancedSettings.qianwen ? '收起' : '设置' }}
                </button>
                <a
                  v-if="qianwenMode === 'web'"
                  href="https://www.qianwen.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[11px] text-indigo-500 hover:text-indigo-600 font-medium px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  前往
                </a>
              </div>
            </div>
            <!-- 高级设置 -->
            <div v-if="showAdvancedSettings.qianwen" class="pl-11 space-y-2 pb-1">
              <div class="flex items-center gap-3">
                <span class="text-[11px] text-slate-500">接入模式:</span>
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    value="web"
                    v-model="qianwenMode"
                    class="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="text-[11px] text-slate-700">网页模式</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer opacity-50">
                  <input
                    type="radio"
                    value="api"
                    disabled
                    class="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="text-[11px] text-slate-500">API模式 (暂不支持)</span>
                </label>
              </div>
            </div>
          </div>

          <!-- LongCat -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="isLongcatEnabled = !isLongcatEnabled"
                  class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  :class="isLongcatEnabled ? 'bg-indigo-500/90' : 'bg-slate-200'">
                  <span
                    class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                    :class="isLongcatEnabled ? 'translate-x-4' : 'translate-x-1'">
                  </span>
                </button>
                <span class="text-[13px] text-slate-700">LongCat</span>
              </div>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  @click="showAdvancedSettings.longcat = !showAdvancedSettings.longcat"
                  class="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors">
                  {{ showAdvancedSettings.longcat ? '收起' : '设置' }}
                </button>
                <a
                  href="https://longcat.chat/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[11px] text-indigo-500 hover:text-indigo-600 font-medium px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 transition-colors">
                  前往
                </a>
              </div>
            </div>
            <!-- 高级设置 -->
            <div v-if="showAdvancedSettings.longcat" class="pl-11 space-y-2 pb-1">
              <div class="flex items-center gap-3">
                <span class="text-[11px] text-slate-500">接入模式:</span>
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    value="web"
                    v-model="longcatMode"
                    class="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="text-[11px] text-slate-700">网页模式</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    value="api"
                    v-model="longcatMode"
                    class="w-3 h-3 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span class="text-[11px] text-slate-700">API模式</span>
                </label>
              </div>
              <!-- API模式配置 -->
              <div v-if="longcatMode === 'api'" class="space-y-2">
                <div class="flex items-center gap-2">
                  <input
                    :type="showApiKey.longcat ? 'text' : 'password'"
                    v-model="longcatApiKey"
                    placeholder="输入API Key"
                    class="flex-1 px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    @click="showApiKey.longcat = !showApiKey.longcat"
                    class="text-[11px] text-slate-500 hover:text-slate-700 px-1.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
                    :title="showApiKey.longcat ? '隐藏' : '显示'">
                    {{ showApiKey.longcat ? '🙈' : '👁️' }}
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="testApiKey('longcat', longcatApiKey)"
                    :disabled="testingApiKey.longcat || !longcatApiKey"
                    class="text-[11px] px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 transition-colors">
                    {{ testingApiKey.longcat ? '测试中...' : '测试Key' }}
                  </button>
                  <span
                    v-if="apiKeyTestResult.longcat"
                    class="text-[10px]"
                    :class="apiKeyTestResult.longcat.success ? 'text-green-600' : 'text-red-600'">
                    {{ apiKeyTestResult.longcat.message }}
                  </span>
                </div>
                <div>
                  <select
                    v-model="longcatModel"
                    class="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="">默认模型 (longcat-chat)</option>
                    <option value="longcat-chat">longcat-chat</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="flex justify-end">
          <div
            class="bg-slate-800 text-white text-[14px] px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-md leading-relaxed break-words">
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
          :operation-status="operationStatus.doubao"
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
          :operation-status="operationStatus.qianwen"
          :default-open="isQianwenOpen"
        />

        <!-- LongCat 折叠面板 -->
        <ProviderCollapse
          v-if="isLongcatEnabled"
          provider-id="longcat"
          provider-name="LongCat"
          theme-color="purple"
          :status="statusMap.longcat"
          :stage="stageMap.longcat"
          :response="responses.longcat"
          :operation-status="operationStatus.longcat"
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
          class="w-full bg-transparent p-3 pr-2 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-32 min-h-[44px]"
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

// UI 状态控制
const inputStr = ref('');
const currentQuestion = ref('');
const hasAsked = ref(false);
const isDeepThinkingEnabled = ref(true);
const isDeepSeekEnabled = ref(true);
const isDoubaoEnabled = ref(false);
const isQianwenEnabled = ref(false);
const isLongcatEnabled = ref(false);
const isSettingsOpen = ref(false);
// 每个通道独立的折叠状态
const isDeepSeekOpen = ref(true);
const isDoubaoOpen = ref(true);
const isQianwenOpen = ref(true);
const isLongcatOpen = ref(true);
// API配置相关状态
const deepseekMode = ref<'web' | 'api'>('web');
const doubaoMode = ref<'web' | 'api'>('web');
const qianwenMode = ref<'web' | 'api'>('web');
const longcatMode = ref<'web' | 'api'>('web');
const deepseekApiKey = ref('');
const doubaoApiKey = ref('');
const qianwenApiKey = ref('');
const longcatApiKey = ref('');
const deepseekModel = ref('');
const doubaoModel = ref('');
const qianwenModel = ref('');
const longcatModel = ref('');
// API Key测试状态
const testingApiKey = ref<Record<string, boolean>>({});
const apiKeyTestResult = ref<Record<string, { success: boolean; message: string }>>({});
// 是否显示API Key
const showApiKey = ref<Record<string, boolean>>({});
// 是否展开高级设置
const showAdvancedSettings = ref<Record<string, boolean>>({});

const chatContainer = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const SETTINGS_KEY = 'aiclash.sidepanel.settings';
const API_CONFIG_KEY = 'aiclash.api.config';
type SidepanelSettings = {
  isDeepThinkingEnabled?: boolean;
  isDeepSeekEnabled?: boolean;
  isDoubaoEnabled?: boolean;
  isQianwenEnabled?: boolean;
  isLongcatEnabled?: boolean;
};
type ApiConfig = {
  mode?: 'web' | 'api';
  apiKey?: string;
  model?: string;
  enabled?: boolean;
};

function loadSettings() {
  // 加载基础设置
  chrome.storage?.local.get([SETTINGS_KEY, API_CONFIG_KEY], (result) => {
    const saved = (result?.[SETTINGS_KEY] || {}) as SidepanelSettings;
    isDeepThinkingEnabled.value = saved.isDeepThinkingEnabled ?? true;
    isDeepSeekEnabled.value = saved.isDeepSeekEnabled ?? true;
    isDoubaoEnabled.value = saved.isDoubaoEnabled ?? false;
    isQianwenEnabled.value = saved.isQianwenEnabled ?? false;
    isLongcatEnabled.value = saved.isLongcatEnabled ?? false;

    // 加载API配置
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

function saveSettings() {
  // 保存基础设置
  chrome.storage?.local.set({
    [SETTINGS_KEY]: {
      isDeepThinkingEnabled: isDeepThinkingEnabled.value,
      isDeepSeekEnabled: isDeepSeekEnabled.value,
      isDoubaoEnabled: isDoubaoEnabled.value,
      isQianwenEnabled: isQianwenEnabled.value,
      isLongcatEnabled: isLongcatEnabled.value,
    }
  });
}

// 保存API配置
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

// 测试API Key
async function testApiKey(providerId: string, apiKey: string) {
  testingApiKey.value[providerId] = true;
  try {
    const result = await chrome.runtime?.sendMessage({
      type: MSG_TYPES.TEST_API_KEY,
      payload: { providerId, apiKey }
    });
    apiKeyTestResult.value[providerId] = result;
  } catch (err) {
    apiKeyTestResult.value[providerId] = { success: false, message: '请求失败' };
  } finally {
    testingApiKey.value[providerId] = false;
  }
}

// 业务数据控制
type ProviderStatus = 'idle' | 'running' | 'completed' | 'error';
type StageType = 'connecting' | 'thinking' | 'responding';

const statusMap: Record<string, ProviderStatus> = reactive({ deepseek: 'idle', doubao: 'idle', qianwen: 'idle', longcat: 'idle' });
const responses: Record<string, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
// 操作阶段（在正式内容出现前展示，降低等待焦躁感）
const stageMap: Record<string, StageType> = reactive({ deepseek: 'connecting', doubao: 'connecting', qianwen: 'connecting', longcat: 'connecting' });
const fullTextBuffer: Record<string, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
const thinkTextBuffer: Record<string, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
const displayedLength: Record<string, number> = reactive({ deepseek: 0, doubao: 0, qianwen: 0, longcat: 0 });
const thinkDisplayedLength: Record<string, number> = reactive({ deepseek: 0, doubao: 0, qianwen: 0, longcat: 0 });
const thinkResponses: Record<string, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
// 当前操作状态（显示在标题旁，如"正在定位输入框..."）
const operationStatus: Record<string, string> = reactive({ deepseek: '', doubao: '', qianwen: '', longcat: '' });
let streamAnimationId: number | null = null;
const CHARS_PER_FRAME = 8;


function tickStreamDisplay() {
  let anyPending = false;
  for (const provider of Object.keys(fullTextBuffer)) {
    // think buffer
    const thinkFull = thinkTextBuffer[provider] || '';
    let tLen = thinkDisplayedLength[provider] || 0;
    if (tLen < thinkFull.length) {
      tLen = Math.min(tLen + CHARS_PER_FRAME, thinkFull.length);
      thinkDisplayedLength[provider] = tLen;
      thinkResponses[provider] = thinkFull.slice(0, tLen);
      anyPending = true;
    }
    // response buffer
    const full = fullTextBuffer[provider] || '';
    let len = displayedLength[provider] || 0;
    if (len < full.length) {
      len = Math.min(len + CHARS_PER_FRAME, full.length);
      displayedLength[provider] = len;
      responses[provider] = full.slice(0, len);
      anyPending = true;
    }
  }
  scrollToBottom();
  if (anyPending) {
    streamAnimationId = requestAnimationFrame(tickStreamDisplay);
  } else {
    streamAnimationId = null;
  }
}

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
  loadSettings();

  chrome.runtime?.onMessage.addListener((request) => {
    const { provider } = request.payload || {};

    if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
      const payload = request.payload;
      const prov = provider;
      
      // 如果这是操作状态信息，覆盖更新操作状态（不累积）
      if (payload.isStatus) {
        operationStatus[prov] = payload.text;
        return;
      }
      
      // 阶段立即更新，便于马上看到「已连接·正在思考」等
      if (payload.stage && (payload.stage !== 'thinking' || isDeepThinkingEnabled.value)) {
        stageMap[prov] = payload.stage;
      }
      else if (payload.text && payload.text.length > 0) stageMap[prov] = 'responding';
      // 缓冲与动画放到下一宏任务，避免大量 chunk 同帧只渲染最后一帧
      setTimeout(() => {
        // 根据 isThink 标志分别追加到思考缓冲或回复缓冲
        if (payload.isThink) {
          if (!isDeepThinkingEnabled.value) return;
          thinkTextBuffer[prov] = (thinkTextBuffer[prov] || '') + payload.text;
        } else {
          fullTextBuffer[prov] = (fullTextBuffer[prov] || '') + payload.text;
        }
        if (streamAnimationId == null) streamAnimationId = requestAnimationFrame(tickStreamDisplay);
      }, 0);
    }
    else if (request.type === MSG_TYPES.TASK_COMPLETED) {
      statusMap[provider] = 'completed';
      operationStatus[provider] = ''; // 任务完成后清空操作状态
      if (provider === 'deepseek' && !(responses.deepseek || '').trim()) {
        responses.deepseek = '（网页端已结束，但未抓取到流式内容，可能接口格式已变更）';
      }
      // 不在这里强制补全全文，让打字机动画自然播完，保持流式观感
      if (streamAnimationId != null) {
        // 动画会在 displayedLength 追上 full 时自行停止，不取消
      }
      if (!isRunning.value) {
        // 所有任务完成后，1.5秒后折叠所有通道面板（和原行为保持一致）
        setTimeout(() => {
          isDeepSeekOpen.value = false;
          isDoubaoOpen.value = false;
          isQianwenOpen.value = false;
          isLongcatOpen.value = false;
        }, 1500);
      }
    }
    else if (request.type === MSG_TYPES.ERROR) {
      statusMap[provider] = 'error';
      operationStatus[provider] = ''; // 错误时清空操作状态
      responses[provider] = `[系统报错] ${request.payload.message}`;
    }
  });
});

// 新建对话
const createNewChat = () => {
  if (isRunning.value) return;

  currentQuestion.value = '';
  hasAsked.value = false;
  // 新建对话时展开所有启用的通道面板
  isDeepSeekOpen.value = isDeepSeekEnabled.value;
  isDoubaoOpen.value = isDoubaoEnabled.value;
  isQianwenOpen.value = isQianwenEnabled.value;
  isLongcatOpen.value = isLongcatEnabled.value;

  // 重置所有状态
  statusMap.deepseek = 'idle';
  statusMap.doubao = 'idle';
  statusMap.qianwen = 'idle';
  statusMap.longcat = 'idle';
  stageMap.deepseek = 'connecting';
  stageMap.doubao = 'connecting';
  stageMap.qianwen = 'connecting';
  stageMap.longcat = 'connecting';
  responses.deepseek = '';
  responses.doubao = '';
  responses.qianwen = '';
  responses.longcat = '';
  thinkResponses.deepseek = '';
  thinkResponses.doubao = '';
  thinkResponses.qianwen = '';
  thinkResponses.longcat = '';
  fullTextBuffer.deepseek = '';
  fullTextBuffer.doubao = '';
  fullTextBuffer.qianwen = '';
  fullTextBuffer.longcat = '';
  thinkTextBuffer.deepseek = '';
  thinkTextBuffer.doubao = '';
  thinkTextBuffer.qianwen = '';
  thinkTextBuffer.longcat = '';
  displayedLength.deepseek = 0;
  displayedLength.doubao = 0;
  displayedLength.qianwen = 0;
  displayedLength.longcat = 0;
  thinkDisplayedLength.deepseek = 0;
  thinkDisplayedLength.doubao = 0;
  thinkDisplayedLength.qianwen = 0;
  thinkDisplayedLength.longcat = 0;
  operationStatus.deepseek = '';
  operationStatus.doubao = '';
  operationStatus.qianwen = '';
  operationStatus.longcat = '';
  if (streamAnimationId != null) {
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
  }

  inputStr.value = '';
  // 恢复输入框高度
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
};

// 提交问题
const submit = () => {
  if (!inputStr.value.trim() || isRunning.value) return;
  if (!isDeepSeekEnabled.value && !isDoubaoEnabled.value && !isQianwenEnabled.value && !isLongcatEnabled.value) {
    window.alert('请在设置中至少开启一个通道。');
    return;
  }

  currentQuestion.value = inputStr.value;
  hasAsked.value = true;
  // 发送新问题时，强行展开所有启用的通道面板让用户看到正在拉取
  isDeepSeekOpen.value = isDeepSeekEnabled.value;
  isDoubaoOpen.value = isDoubaoEnabled.value;
  isQianwenOpen.value = isQianwenEnabled.value;
  isLongcatOpen.value = isLongcatEnabled.value;

  // 重置状态
  statusMap.deepseek = 'idle';
  statusMap.doubao = 'idle';
  statusMap.qianwen = 'idle';
  statusMap.longcat = 'idle';
  stageMap.deepseek = 'connecting';
  stageMap.doubao = 'connecting';
  stageMap.qianwen = 'connecting';
  stageMap.longcat = 'connecting';
  responses.deepseek = '';
  responses.doubao = '';
  responses.qianwen = '';
  responses.longcat = '';
  thinkResponses.deepseek = '';
  thinkResponses.doubao = '';
  thinkResponses.qianwen = '';
  thinkResponses.longcat = '';
  fullTextBuffer.deepseek = '';
  fullTextBuffer.doubao = '';
  fullTextBuffer.qianwen = '';
  fullTextBuffer.longcat = '';
  thinkTextBuffer.deepseek = '';
  thinkTextBuffer.doubao = '';
  thinkTextBuffer.qianwen = '';
  thinkTextBuffer.longcat = '';
  displayedLength.deepseek = 0;
  displayedLength.doubao = 0;
  displayedLength.qianwen = 0;
  displayedLength.longcat = 0;
  thinkDisplayedLength.deepseek = 0;
  thinkDisplayedLength.doubao = 0;
  thinkDisplayedLength.qianwen = 0;
  thinkDisplayedLength.longcat = 0;
  operationStatus.deepseek = '';
  operationStatus.doubao = '';
  operationStatus.qianwen = '';
  operationStatus.longcat = '';
  if (streamAnimationId != null) {
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
  }

  if (isDeepSeekEnabled.value) {
    statusMap.deepseek = 'running';
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'deepseek',
        prompt: inputStr.value.trim(),
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
        prompt: inputStr.value.trim(),
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
        prompt: inputStr.value.trim(),
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
        prompt: inputStr.value.trim(),
        mode: longcatMode.value,
        settings: {}
      }
    });
  }

  inputStr.value = '';
  // 恢复输入框高度
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
};

// 输入框自适应高度
const autoResize = (e: Event) => {
  const el = e.target as HTMLTextAreaElement;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'; // 最大 128px
};

watch(isDeepThinkingEnabled, (enabled) => {
  if (!enabled) {
    thinkResponses.deepseek = '';
    thinkTextBuffer.deepseek = '';
    thinkDisplayedLength.deepseek = 0;
  }
  saveSettings();
});

watch(isDeepSeekEnabled, () => {
  saveSettings();
});

watch(isDoubaoEnabled, () => {
  saveSettings();
});

watch(isQianwenEnabled, () => {
  saveSettings();
});

watch(isLongcatEnabled, () => {
  saveSettings();
});

// API配置变化监听
watch(deepseekMode, (value) => {
  saveApiConfig('deepseek', { mode: value });
});
watch(doubaoMode, (value) => {
  saveApiConfig('doubao', { mode: value });
});
watch(qianwenMode, (value) => {
  saveApiConfig('qianwen', { mode: value });
});
watch(longcatMode, (value) => {
  saveApiConfig('longcat', { mode: value });
});

watch(deepseekApiKey, (value) => {
  saveApiConfig('deepseek', { apiKey: value });
});
watch(doubaoApiKey, (value) => {
  saveApiConfig('doubao', { apiKey: value });
});
watch(qianwenApiKey, (value) => {
  saveApiConfig('qianwen', { apiKey: value });
});
watch(longcatApiKey, (value) => {
  saveApiConfig('longcat', { apiKey: value });
});

watch(deepseekModel, (value) => {
  saveApiConfig('deepseek', { model: value });
});
watch(doubaoModel, (value) => {
  saveApiConfig('doubao', { model: value });
});
watch(qianwenModel, (value) => {
  saveApiConfig('qianwen', { model: value });
});
watch(longcatModel, (value) => {
  saveApiConfig('longcat', { model: value });
});
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