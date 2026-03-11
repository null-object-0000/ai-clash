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
        <!-- 多轮对话模式时显示绿色标签，否则显示 MoE 模式 -->
        <div
          v-if="isMultiTurnSession && hasAsked"
          class="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 transition-colors">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          多轮对话
        </div>
        <div
          v-else
          class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          MoE 模式
        </div>
      </div>

      <div
        v-if="isHistoryPanelOpen"
        class="absolute left-4 right-4 top-[calc(100%+8px)] max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-2 space-y-1">
        <div class="flex items-center justify-between px-2 pt-1 pb-2">
          <div class="text-[12px] font-semibold text-slate-700">历史对话</div>
          <div class="flex items-center gap-2">
            <button
              v-if="historyList.length"
              type="button"
              class="text-[11px] text-red-400 hover:text-red-600 transition-colors"
              @click="clearAllHistory">
              清除全部
            </button>
            <button
              type="button"
              class="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
              @click="isHistoryPanelOpen = false">
              关闭
            </button>
          </div>
        </div>

        <div
          v-if="!historyList.length"
          class="px-3 py-6 text-center text-[12px] text-slate-400">
          暂无历史对话
        </div>

        <div
          v-for="item in historyList"
          :key="item.id"
          class="group relative rounded-xl border transition-colors"
          :class="item.id === activeSessionId
            ? 'border-indigo-200 bg-indigo-50/80'
            : 'border-slate-200 bg-white hover:bg-slate-50'">
          <button
            type="button"
            class="w-full text-left px-3 py-2.5 pr-8"
            @click="restoreHistorySession(item)">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="text-[12px] font-medium text-slate-700 truncate">{{ item.question }}</div>
                <div class="mt-1 text-[10px] text-slate-400">{{ formatHistoryTime(item.createdAt) }}</div>
              </div>
              <div class="text-[10px] text-slate-400 whitespace-nowrap">{{ getHistoryEnabledCount(item) }} 通道</div>
            </div>
          </button>
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
            @click.stop="deleteHistoryItem(item.id)"
            aria-label="删除此记录">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
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
            <!-- 单通道 / 多通道模式动态提示 -->
            <div class="mt-2.5 pt-2.5 border-t border-slate-100">
              <div v-if="getEnabledProviderIds().length === 1" class="flex items-center gap-1.5 text-[11px] text-emerald-600">
                <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
                </svg>
                单通道模式 · 支持多轮对话，可连续追问
              </div>
              <div v-else-if="getEnabledProviderIds().length >= 2" class="flex items-center gap-1.5 text-[11px] text-indigo-500">
                <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                MoE 对比模式 · {{ getEnabledProviderIds().length }} 个通道并行回答
              </div>
              <div v-else class="text-[11px] text-slate-400">请至少选择一个通道</div>
            </div>
          </div>

          <ChannelList
            :provider-meta="PROVIDER_META"
            :is-enabled="(id: string) => isProviderEnabled(id as ProviderId)"
            :get-mode-text="(id: string) => getProviderModeText(id as ProviderId)"
            :get-mode-value="(id: string) => getModeValue(id as ProviderId)"
            @view-history="isHistoryPanelOpen = true"
            @open-settings="(id) => openProviderSettings(id as ProviderId)"
            @toggle="(id) => handleToggleProvider(id as ProviderId)"
            @go="(id) => handleGoToProvider(id as ProviderId)"
          />
        </div>
      </div>

      <template v-else>
        <!-- 多轮对话：历史轮次（仅单通道模式下出现） -->
        <template v-if="conversationTurns.length > 0">
          <template v-for="(turn, idx) in conversationTurns" :key="idx">
            <div class="flex justify-end">
              <div
                class="bg-slate-700 text-white text-[13px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-sm leading-7 break-words tracking-[0.01em] opacity-80">
                {{ turn.question }}
              </div>
            </div>
            <ProviderCollapse
              :provider-id="turn.providerId"
              :provider-name="getProviderLabel(turn.providerId)"
              :theme-color="getProviderThemeColor(turn.providerId)"
              status="completed"
              stage="responding"
              :response="turn.response"
              :think-response="turn.thinkResponse"
              :raw-url="turn.rawUrl"
              :is-from-history="true"
              :is-deep-thinking-enabled="isDeepThinkingEnabled"
              :default-open="false"
            />
          </template>
          <div class="flex items-center gap-2 my-1 opacity-40">
            <div class="flex-1 border-t border-dashed border-slate-300"></div>
            <span class="text-[10px] text-slate-400 whitespace-nowrap">继续对话</span>
            <div class="flex-1 border-t border-dashed border-slate-300"></div>
          </div>
        </template>

        <div class="flex justify-end">
          <div
            class="bg-slate-900 text-white text-[13px] px-4 py-3 rounded-2xl rounded-tr-sm max-w-[88%] shadow-md leading-7 break-words tracking-[0.01em]">
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
          :is-from-history="isCurrentSessionFromHistory"
          :is-deep-thinking-enabled="isDeepThinkingEnabled"
          :default-open="isDeepSeekOpen"
          :stats="statsMap.deepseek"
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
          :is-from-history="isCurrentSessionFromHistory"
          :is-deep-thinking-enabled="isDeepThinkingEnabled"
          :default-open="isDoubaoOpen"
          :stats="statsMap.doubao"
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
          :is-from-history="isCurrentSessionFromHistory"
          :is-deep-thinking-enabled="isDeepThinkingEnabled"
          :default-open="isQianwenOpen"
          :stats="statsMap.qianwen"
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
          :is-from-history="isCurrentSessionFromHistory"
          :is-deep-thinking-enabled="isDeepThinkingEnabled"
          :default-open="isLongcatOpen"
          :stats="statsMap.longcat"
        />

        <!-- 归纳总结面板：开启时或历史有汇总内容时显示 -->
        <SummaryPanel
          v-if="hasAsked && (isSummaryEnabled || summaryStatus !== 'idle')"
          :status="summaryStatus"
          :stage="summaryStage"
          :response="summaryResponse"
          :think-response="summaryThinkResponse"
          :operation-status="summaryOperationStatus"
          :stats="summaryStats"
        />
      </template>

    </main>

    <ChannelSettingsModal
      v-if="activeProviderSettings"
      :active-provider-id="activeProviderSettings"
      :provider-label="getProviderLabel(activeProviderSettings as ProviderId)"
      :mode="getModeValue(activeProviderSettings as ProviderId)"
      :supports-api="supportsApi(activeProviderSettings as ProviderId)"
      :api-key="getApiKeyValue(activeProviderSettings as ProviderId)"
      :model="getModelValue(activeProviderSettings as ProviderId)"
      :model-options="getModelOptions(activeProviderSettings as ProviderId)"
      :show-api-key="showApiKey[activeProviderSettings] ?? false"
      :testing="testingApiKey[activeProviderSettings] ?? false"
      :api-key-test-result="apiKeyTestResult[activeProviderSettings] ?? null"
      :api-key-link="getProviderMeta(activeProviderSettings as ProviderId)?.apiKeyLink"
      :api-note="getProviderMeta(activeProviderSettings as ProviderId)?.apiNote"
      @close="closeProviderSettings"
      @update:mode="(m) => setProviderMode(activeProviderSettings as ProviderId, m)"
      @update:api-key="(v) => setProviderApiKey(activeProviderSettings as ProviderId, v)"
      @update:model="(v) => setProviderModel(activeProviderSettings as ProviderId, v)"
      @toggle-show-api-key="showApiKey[activeProviderSettings] = !showApiKey[activeProviderSettings]"
      @test-api-key="testApiKey(activeProviderSettings as ProviderId, getApiKeyValue(activeProviderSettings as ProviderId))"
    />

    <!-- 未选通道提示（内嵌样式，替代原生 alert） -->
    <div
      v-if="showNoChannelTip"
      class="fixed inset-0 z-30 flex items-center justify-center p-4">
      <button
        type="button"
        class="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]"
        aria-label="关闭提示"
        @click="showNoChannelTip = false">
      </button>
      <div
        class="relative z-10 w-full max-w-[320px] rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.25)]">
        <p class="text-[14px] leading-6 text-slate-700">请在通道列表中至少开启一个通道后再发送。</p>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            @click="showNoChannelTip = false"
            class="inline-flex h-9 items-center justify-center rounded-full bg-indigo-600 px-4 text-[13px] font-medium text-white transition-colors hover:bg-indigo-700">
            确定
          </button>
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

        <!-- 归纳总结开关 + 设置入口 -->
        <div class="relative flex items-center gap-0.5">
          <button
            type="button"
            @click="toggleSummaryEnabled"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
            :class="isSummaryEnabled && !summaryBlockReason()
              ? 'bg-purple-50 border-purple-200 text-purple-600'
              : !summaryBlockReason()
                ? 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
                : 'bg-white border-slate-200 text-slate-300 cursor-default'"
            :title="summaryBlockReason() ?? ''">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>归纳总结</span>
          </button>

          <!-- 设置按钮 -->
          <button
            type="button"
            @click="isSummarySettingsOpen = !isSummarySettingsOpen"
            class="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-600"
            :class="isSummarySettingsOpen ? 'border-purple-200 bg-purple-50 text-purple-500' : ''"
            aria-label="归纳总结设置">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          <!-- 多轮对话提示标签（归纳总结按钮旁，仅单通道激活会话时显示） -->
          <div
            v-if="isMultiTurnSession && hasAsked && !isSummarySettingsOpen"
            class="flex items-center gap-1 ml-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 select-none"
            title="当前为单通道模式，发送下一条消息即可自动续聊">
            <svg class="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z" />
            </svg>
            <span>多轮对话中</span>
          </div>

          <!-- 归纳总结设置浮层 -->
          <div
            v-if="isSummarySettingsOpen"
            class="absolute bottom-full left-0 mb-2 w-[260px] rounded-2xl border border-slate-200 bg-white shadow-xl p-3 space-y-3 z-20">
            <div class="flex items-center justify-between">
              <div class="text-[12px] font-semibold text-slate-800">归纳总结设置</div>
              <button
                type="button"
                @click="isSummarySettingsOpen = false"
                class="text-slate-400 hover:text-slate-600 transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div v-if="getSummaryProviderOptions().length === 0"
              class="text-[11px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2 leading-5">
              请先在通道设置中为 DeepSeek 或 LongCat 配置 API Key，才能使用归纳总结功能。
            </div>

            <template v-else>
              <div class="space-y-1.5">
                <label class="text-[11px] font-medium text-slate-600">汇总通道</label>
                <select
                  v-model="summaryProviderId"
                  class="w-full min-h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/15">
                  <option value="">请选择通道</option>
                  <option v-for="opt in getSummaryProviderOptions()" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <div class="space-y-1.5" v-if="summaryProviderId">
                <label class="text-[11px] font-medium text-slate-600">汇总模型</label>
                <select
                  v-model="summaryModel"
                  class="w-full min-h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-[12px] text-slate-800 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/15">
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
        <span v-if="isMultiTurnSession && hasAsked" class="text-[10px] text-emerald-500">
          单通道多轮对话模式 · 直接输入下一条消息即可继续
        </span>
        <span v-else class="text-[10px] text-slate-400">目前支持：DeepSeek · 豆包 · 千问 · LongCat（网页模式/API模式双接入）</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue';
import { MSG_TYPES } from '../shared/messages.js';
import ProviderCollapse from './components/ProviderCollapse.vue';
import ChannelList from './components/ChannelList.vue';
import ChannelSettingsModal from './components/ChannelSettingsModal.vue';
import SummaryPanel from './components/SummaryPanel.vue';

const PROVIDER_IDS = ['deepseek', 'doubao', 'qianwen', 'longcat'] as const;
type ProviderId = typeof PROVIDER_IDS[number];
type ProviderMode = 'web' | 'api';
type ProviderStatus = 'idle' | 'running' | 'completed' | 'error';
type StageType = 'connecting' | 'thinking' | 'responding';
const PROVIDER_META = [
  {
    id: 'deepseek', name: 'DeepSeek', supportsApi: true,
    apiKeyLink: 'https://platform.deepseek.com/api_keys',
    apiNote: undefined,
  },
  {
    id: 'doubao', name: '豆包', supportsApi: true,
    apiKeyLink: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    apiNote: '暂仅支持火山方舟 Coding Plan 模式',
  },
  {
    id: 'qianwen', name: '千问', supportsApi: true,
    apiKeyLink: 'https://bailian.console.aliyun.com/cn-beijing/?tab=coding-plan#/efm/detail',
    apiNote: '暂仅支持阿里云百炼 Coding Plan 模式',
  },
  {
    id: 'longcat', name: 'LongCat', supportsApi: true,
    apiKeyLink: 'https://longcat.chat/platform/api_keys',
    apiNote: undefined,
  },
] as const;

type SidepanelSettings = {
  isDeepThinkingEnabled?: boolean;
  isSummaryEnabled?: boolean;
};

type SummaryConfig = {
  providerId?: string;
  model?: string;
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
  stats: ProviderStats | null;
};

type ProviderStats = {
  ttff: number;
  totalTime: number;
  charCount: number;
  charsPerSec: number;
};

type SummaryHistoryEntry = {
  status: 'idle' | 'running' | 'completed' | 'error';
  response: string;
  thinkResponse: string;
  stats: ProviderStats | null;
};

type ChatHistoryItem = {
  id: string;
  question: string;
  createdAt: number;
  providers: Record<ProviderId, ProviderHistoryEntry>;
  summary: SummaryHistoryEntry | null;
};

// 多轮对话：已完成的历史轮次（内存中，不持久化）
interface CompletedTurn {
  question: string;
  providerId: ProviderId;
  response: string;
  thinkResponse: string;
  rawUrl: string;
}

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
const showNoChannelTip = ref(false);
/** 当前展示的会话是否来自历史恢复（历史会话点原文打开新标签，新会话点原文激活已有 tab） */
const isCurrentSessionFromHistory = ref(false);
/** 多轮对话：已完成的历史轮次（仅单通道模式下生效） */
const conversationTurns = ref<CompletedTurn[]>([]);
/** 当前会话是否以单通道模式启动（用于判断是否继续多轮对话） */
const isMultiTurnSession = ref(false);

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
const statsMap: Record<ProviderId, ProviderStats | null> = reactive({ deepseek: null, doubao: null, qianwen: null, longcat: null });

// 内部计时数据（非响应式，仅用于计算）
const timingData: Record<ProviderId, { startTime: number; firstContentTime: number }> = {
  deepseek: { startTime: 0, firstContentTime: 0 },
  doubao: { startTime: 0, firstContentTime: 0 },
  qianwen: { startTime: 0, firstContentTime: 0 },
  longcat: { startTime: 0, firstContentTime: 0 },
};

// 归纳总结状态
const isSummaryEnabled = ref(false);
const summaryProviderId = ref('');
const summaryModel = ref('');
const isSummarySettingsOpen = ref(false);
const summaryStatus = ref<'idle' | 'running' | 'completed' | 'error'>('idle');
const summaryStage = ref<'thinking' | 'responding'>('responding');
const summaryResponse = ref('');
const summaryThinkResponse = ref('');
const summaryFullBuffer = ref('');
const summaryThinkBuffer = ref('');
const summaryDisplayedLength = ref(0);
const summaryThinkDisplayedLength = ref(0);
const summaryOperationStatus = ref('');
const summaryStats = ref<ProviderStats | null>(null);
let summaryTriggered = false;
let summaryTimingData = { startTime: 0, firstContentTime: 0 };

const chatContainer = ref<HTMLElement | null>(null);
const userHasScrolled = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const SETTINGS_KEY = 'aiclash.sidepanel.settings';
const API_CONFIG_KEY = 'aiclash.api.config';
const SUMMARY_CONFIG_KEY = 'aiclash.summary.config';
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

function getProviderMeta(providerId: ProviderId) {
  return PROVIDER_META.find(p => p.id === providerId);
}

function supportsApi(providerId: ProviderId) {
  return getProviderMeta(providerId)?.supportsApi ?? false;
}

function isSummaryConfigValid() {
  const pid = summaryProviderId.value as ProviderId;
  if (!pid || !PROVIDER_IDS.includes(pid)) return false;
  return supportsApi(pid) && !!getApiKeyValue(pid).trim();
}

function getSummaryProviderOptions() {
  return PROVIDER_META
    .filter(p => p.supportsApi && getApiKeyValue(p.id as ProviderId).trim())
    .map(p => ({ value: p.id, label: p.name }));
}

function getSummaryModelOptions() {
  if (!summaryProviderId.value) return [];
  return getModelOptions(summaryProviderId.value as ProviderId);
}

function summaryBlockReason(): string | null {
  if (!isSummaryConfigValid()) return '请先配置归纳总结通道';
  if (getEnabledProviderIds().length < 2) return '请选择 2 个或以上通道';
  return null;
}

function toggleSummaryEnabled() {
  if (!isSummaryConfigValid()) {
    isSummarySettingsOpen.value = true;
    return;
  }
  if (getEnabledProviderIds().length < 2) return;
  isSummaryEnabled.value = !isSummaryEnabled.value;
}

function loadSummaryConfig() {
  chrome.storage?.local.get([SUMMARY_CONFIG_KEY], (result) => {
    const saved = (result?.[SUMMARY_CONFIG_KEY] || {}) as SummaryConfig;
    summaryProviderId.value = saved.providerId || '';
    summaryModel.value = saved.model || '';
  });
}

function saveSummaryConfig() {
  chrome.storage?.local.set({
    [SUMMARY_CONFIG_KEY]: {
      providerId: summaryProviderId.value,
      model: summaryModel.value,
    }
  });
}

function resetSummaryState() {
  summaryStatus.value = 'idle';
  summaryStage.value = 'responding';
  summaryResponse.value = '';
  summaryThinkResponse.value = '';
  summaryFullBuffer.value = '';
  summaryThinkBuffer.value = '';
  summaryDisplayedLength.value = 0;
  summaryThinkDisplayedLength.value = 0;
  summaryOperationStatus.value = '';
  summaryStats.value = null;
  summaryTriggered = false;
  summaryTimingData = { startTime: 0, firstContentTime: 0 };
}

async function triggerSummary() {
  if (summaryTriggered) return;
  if (!isSummaryEnabled.value || !isSummaryConfigValid()) return;

  const providerNames: Record<ProviderId, string> = {
    deepseek: 'DeepSeek', doubao: '豆包', qianwen: '千问', longcat: 'LongCat'
  };

  const responses = getEnabledProviderIds()
    .filter(id => (statusMap[id] === 'completed' || statusMap[id] === 'error') && fullTextBuffer[id]?.trim())
    .map(id => ({ providerId: id, name: providerNames[id], text: fullTextBuffer[id] }));

  if (responses.length < 2) return;

  summaryTriggered = true;
  summaryStatus.value = 'running';
  summaryOperationStatus.value = '';
  summaryTimingData.startTime = Date.now();

  chrome.runtime?.sendMessage({
    type: MSG_TYPES.DISPATCH_SUMMARY,
    payload: {
      question: currentQuestion.value,
      responses,
      summaryConfig: {
        providerId: summaryProviderId.value,
        model: summaryModel.value,
      },
    }
  });
}

function getProviderLabel(providerId: string) {
  return providerId === 'deepseek' ? 'DeepSeek'
    : providerId === 'doubao' ? '豆包'
    : providerId === 'qianwen' ? '千问'
    : providerId === 'longcat' ? 'LongCat'
    : providerId;
}

function getProviderThemeColor(providerId: ProviderId): 'blue' | 'amber' | 'emerald' | 'violet' {
  return providerId === 'deepseek' ? 'blue'
    : providerId === 'doubao' ? 'amber'
    : providerId === 'qianwen' ? 'emerald'
    : 'violet';
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
  if (mode === 'api' && !getApiKeyValue(providerId).trim()) return;
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
      { value: 'deepseek-chat', label: 'deepseek-chat（DeepSeek-V3.2，输出最大 8K）' },
      { value: 'deepseek-reasoner', label: 'deepseek-reasoner（DeepSeek-V3.2 思考，输出最大 64K）' }
    ];
  }

  if (providerId === 'longcat') {
    return [
      { value: '', label: '默认模型 (LongCat-Flash-Lite)' },
      { value: 'LongCat-Flash-Lite', label: 'LongCat-Flash-Lite（高效轻量 MoE）' },
      { value: 'LongCat-Flash-Chat', label: 'LongCat-Flash-Chat（通用对话）' },
      { value: 'LongCat-Flash-Thinking', label: 'LongCat-Flash-Thinking（深度思考）' },
      { value: 'LongCat-Flash-Thinking-2601', label: 'LongCat-Flash-Thinking-2601（升级版深度思考）' },
    ];
  }

  if (providerId === 'doubao') {
    return [
      { value: '', label: '默认模型 (ark-code-latest)' },
      { value: 'ark-code-latest', label: 'ark-code-latest（Coding Plan）' },
    ];
  }

  if (providerId === 'qianwen') {
    return [
      { value: '', label: '默认模型 (qwen3.5-plus)' },
      { value: 'qwen3.5-plus',         label: 'qwen3.5-plus（推荐 · 深度思考 · 图片理解）' },
      { value: 'kimi-k2.5',            label: 'kimi-k2.5（推荐 · 深度思考 · 图片理解）' },
      { value: 'glm-5',                label: 'glm-5（推荐 · 深度思考）' },
      { value: 'MiniMax-M2.5',         label: 'MiniMax-M2.5（推荐 · 深度思考）' },
      { value: 'deepseek-v3.2',        label: 'deepseek-v3.2（推荐）' },
      { value: 'qwen3-max-2026-01-23', label: 'qwen3-max-2026-01-23（旗舰 · 深度思考）' },
      { value: 'qwen3-coder-next',     label: 'qwen3-coder-next（编程专用）' },
      { value: 'qwen3-coder-plus',     label: 'qwen3-coder-plus（编程专用·轻量）' },
      { value: 'glm-4.7',              label: 'glm-4.7（深度思考）' },
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
    rawUrl: '',
    stats: null,
  };
}

function saveSettings() {
  chrome.storage?.local.set({
    [SETTINGS_KEY]: {
      isDeepThinkingEnabled: isDeepThinkingEnabled.value,
      isSummaryEnabled: isSummaryEnabled.value,
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

function deleteHistoryItem(id: string) {
  historyList.value = historyList.value.filter((item) => item.id !== id);
  saveHistory();
}

function clearAllHistory() {
  historyList.value = [];
  saveHistory();
  isHistoryPanelOpen.value = false;
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
      rawUrl: rawUrlOverrides[providerId] ?? rawUrlMap[providerId] ?? '',
      stats: statsMap[providerId] ?? null,
    };
    return acc;
  }, {} as Record<ProviderId, ProviderHistoryEntry>);
}

function buildSummaryHistoryEntry(): SummaryHistoryEntry | null {
  if (summaryStatus.value === 'idle') return null;
  return {
    status: summaryStatus.value,
    response: summaryFullBuffer.value || '',
    thinkResponse: summaryThinkBuffer.value || '',
    stats: summaryStats.value,
  };
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
    providers: buildHistoryProviders(mergedRawUrlOverrides),
    summary: buildSummaryHistoryEntry(),
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
    statsMap[providerId] = null;
    timingData[providerId] = { startTime: 0, firstContentTime: 0 };
  }

  resetSummaryState();

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
  isCurrentSessionFromHistory.value = true;
  conversationTurns.value = [];
  isMultiTurnSession.value = false;

  if (streamAnimationId != null) {
    cancelAnimationFrame(streamAnimationId);
    streamAnimationId = null;
  }

  for (const providerId of PROVIDER_IDS) {
    const providerState = item.providers[providerId] || createDefaultHistoryEntry(providerId);
    setProviderEnabled(providerId, providerState.enabled);
    setProviderOpen(providerId, false); // 历史会话默认折叠所有面板
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
    statsMap[providerId] = providerState.stats ?? null;
  }

  // 恢复归纳总结状态
  const summaryEntry = item.summary;
  if (summaryEntry) {
    summaryStatus.value = summaryEntry.status;
    summaryStage.value = 'responding';
    summaryResponse.value = summaryEntry.response;
    summaryThinkResponse.value = summaryEntry.thinkResponse;
    summaryFullBuffer.value = summaryEntry.response;
    summaryThinkBuffer.value = summaryEntry.thinkResponse;
    summaryDisplayedLength.value = summaryEntry.response.length;
    summaryThinkDisplayedLength.value = summaryEntry.thinkResponse.length;
    summaryOperationStatus.value = '';
    summaryStats.value = summaryEntry.stats ?? null;
    summaryTriggered = true; // 防止重复触发
  } else {
    resetSummaryState();
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
          providers,
          summary: (item.summary as SummaryHistoryEntry) ?? null,
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
    isSummaryEnabled.value = saved.isSummaryEnabled ?? false;
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

  // 归纳总结动画
  const sThinkFull = summaryThinkBuffer.value;
  let sThinkLen = summaryThinkDisplayedLength.value;
  if (sThinkLen < sThinkFull.length) {
    sThinkLen = Math.min(sThinkLen + CHARS_PER_FRAME, sThinkFull.length);
    summaryThinkDisplayedLength.value = sThinkLen;
    summaryThinkResponse.value = sThinkFull.slice(0, sThinkLen);
    anyPending = true;
  }
  const sFull = summaryFullBuffer.value;
  let sLen = summaryDisplayedLength.value;
  if (sLen < sFull.length) {
    sLen = Math.min(sLen + CHARS_PER_FRAME, sFull.length);
    summaryDisplayedLength.value = sLen;
    summaryResponse.value = sFull.slice(0, sLen);
    anyPending = true;
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
  if (userHasScrolled.value) return;
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

onMounted(() => {
  loadSettings();
  loadHistory();
  loadSummaryConfig();

  // 检测用户主动向上滚动，暂停自动滚动
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.addEventListener('scroll', () => {
        if (!isRunning.value) return;
        const el = chatContainer.value!;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom > 80) {
          userHasScrolled.value = true;
        }
      }, { passive: true });
    }
  });

  chrome.runtime?.onMessage.addListener((request) => {
    const { provider } = request.payload || {};

    if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
      const payload = request.payload;

      // 归纳总结通道
      if (provider === '_summary') {
        if (payload.isStatus) {
          summaryOperationStatus.value = payload.text;
          return;
        }
        if (payload.stage) summaryStage.value = payload.stage;
        if (!payload.isThink && payload.text && !summaryTimingData.firstContentTime) {
          summaryTimingData.firstContentTime = Date.now();
        }
        setTimeout(() => {
          if (payload.isThink) {
            summaryThinkBuffer.value += payload.text;
          } else {
            summaryFullBuffer.value += payload.text;
          }
          if (streamAnimationId == null) streamAnimationId = requestAnimationFrame(tickStreamDisplay);
        }, 0);
        return;
      }

      const prov = provider as ProviderId;
      if (!prov) return;

      if (payload.isStatus) {
        operationStatus[prov] = payload.text;
        schedulePersistCurrentSession();
        return;
      }

      // 记录首次正文 chunk 到达时间（用于 TTFF 计算）
      if (!payload.isThink && payload.text && !timingData[prov].firstContentTime) {
        timingData[prov].firstContentTime = Date.now();
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

      // 归纳总结通道
      if (provider === '_summary') {
        summaryStatus.value = 'running';
        summaryOperationStatus.value = payload.text || '';
        return;
      }

      const prov = provider as ProviderId;
      if (!prov) return;
      statusMap[prov] = 'running';
      operationStatus[prov] = payload.text || '';
      schedulePersistCurrentSession();

    } else if (request.type === MSG_TYPES.TASK_COMPLETED) {
      // 归纳总结通道
      if (provider === '_summary') {
        summaryStatus.value = 'completed';
        summaryOperationStatus.value = '';
        if (summaryTimingData.startTime > 0 && summaryTimingData.firstContentTime > 0) {
          const completedAt = Date.now();
          const charCount = summaryFullBuffer.value?.length || 0;
          const ttff = summaryTimingData.firstContentTime - summaryTimingData.startTime;
          const totalTime = completedAt - summaryTimingData.startTime;
          const outputSecs = (completedAt - summaryTimingData.firstContentTime) / 1000;
          const charsPerSec = outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0;
          summaryStats.value = { ttff, totalTime, charCount, charsPerSec };
        }
        schedulePersistCurrentSession();
        return;
      }

      const prov = provider as ProviderId;
      if (!prov) return;
      statusMap[prov] = 'completed';
      operationStatus[prov] = '';

      // 计算本次性能统计
      const timing = timingData[prov];
      if (timing.startTime > 0 && timing.firstContentTime > 0) {
        const completedAt = Date.now();
        const charCount = fullTextBuffer[prov]?.length || 0;
        const ttff = timing.firstContentTime - timing.startTime;
        const totalTime = completedAt - timing.startTime;
        const outputSecs = (completedAt - timing.firstContentTime) / 1000;
        const charsPerSec = outputSecs > 0.1 ? Math.round(charCount / outputSecs) : 0;
        statsMap[prov] = { ttff, totalTime, charCount, charsPerSec };
      }

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
        // 所有通道完成后触发归纳总结
        if (isSummaryEnabled.value && hasAsked.value && !isCurrentSessionFromHistory.value) {
          void triggerSummary();
        }
      }

    } else if (request.type === MSG_TYPES.ERROR) {
      // 归纳总结通道
      if (provider === '_summary') {
        summaryStatus.value = 'error';
        summaryOperationStatus.value = '';
        const errMsg = request.payload.message || request.payload.error || '未知错误';
        summaryFullBuffer.value = `[归纳总结出错] ${errMsg}`;
        summaryDisplayedLength.value = summaryFullBuffer.value.length;
        summaryResponse.value = summaryFullBuffer.value;
        return;
      }

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
      // 出错的通道也可能是最后一个完成的，检查是否触发总结
      if (!isRunning.value && isSummaryEnabled.value && hasAsked.value && !isCurrentSessionFromHistory.value) {
        void triggerSummary();
      }
    }
  });
});

const createNewChat = () => {
  if (isRunning.value) return;

  currentQuestion.value = '';
  hasAsked.value = false;
  activeSessionId.value = '';
  isCurrentSessionFromHistory.value = false;
  isHistoryPanelOpen.value = false;
  activeProviderSettings.value = '';
  conversationTurns.value = [];
  isMultiTurnSession.value = false;
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

  userHasScrolled.value = false;

  const enabledIds = getEnabledProviderIds();
  if (!enabledIds.length) {
    showNoChannelTip.value = true;
    return;
  }

  const isSingleChannel = enabledIds.length === 1;
  // 多轮对话续接条件：当前会话以单通道启动、已有回答、非历史恢复
  const isMultiTurnContinuation = isMultiTurnSession.value && isSingleChannel && hasAsked.value && !isCurrentSessionFromHistory.value;

  if (isMultiTurnContinuation) {
    // 保存当前已完成的轮次
    const singleProviderId = enabledIds[0];
    conversationTurns.value.push({
      question: currentQuestion.value,
      providerId: singleProviderId,
      response: fullTextBuffer[singleProviderId] || responses[singleProviderId] || '',
      thinkResponse: thinkTextBuffer[singleProviderId] || '',
      rawUrl: rawUrlMap[singleProviderId] || '',
    });
  } else {
    // 全新会话：清空历史轮次，生成新会话 ID
    conversationTurns.value = [];
    activeSessionId.value = createSessionId();
    isMultiTurnSession.value = isSingleChannel;
  }

  currentQuestion.value = prompt;
  hasAsked.value = true;
  if (isMultiTurnContinuation) {
    // 多轮模式下更新历史记录（仍用同一 session ID）
    schedulePersistCurrentSession(0);
  } else {
    schedulePersistCurrentSession(0);
  }

  isCurrentSessionFromHistory.value = false;
  isHistoryPanelOpen.value = false;
  activeProviderSettings.value = '';
  isDeepSeekOpen.value = isDeepSeekEnabled.value;
  isDoubaoOpen.value = isDoubaoEnabled.value;
  isQianwenOpen.value = isQianwenEnabled.value;
  isLongcatOpen.value = isLongcatEnabled.value;
  resetTaskState();

  for (const providerId of enabledIds) {
    rawUrlMap[providerId] = getProviderMode(providerId) === 'api' ? 'api' : '';
  }

  void syncProviderRawUrls(enabledIds);

  // API 模式下的多轮对话历史（仅单通道时有效）
  const conversationHistory = (isSingleChannel && conversationTurns.value.length > 0)
    ? conversationTurns.value.map(t => ({ question: t.question, response: t.response }))
    : [];

  if (isDeepSeekEnabled.value) {
    statusMap.deepseek = 'running';
    timingData.deepseek.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'deepseek',
        prompt,
        mode: deepseekMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
        }
      }
    });
  }

  if (isDoubaoEnabled.value) {
    statusMap.doubao = 'running';
    timingData.doubao.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'doubao',
        prompt,
        mode: doubaoMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
        }
      }
    });
  }

  if (isQianwenEnabled.value) {
    statusMap.qianwen = 'running';
    timingData.qianwen.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'qianwen',
        prompt,
        mode: qianwenMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
        }
      }
    });
  }

  if (isLongcatEnabled.value) {
    statusMap.longcat = 'running';
    timingData.longcat.startTime = Date.now();
    chrome.runtime?.sendMessage({
      type: MSG_TYPES.DISPATCH_TASK,
      payload: {
        provider: 'longcat',
        prompt,
        mode: longcatMode.value,
        settings: {
          isDeepThinkingEnabled: isDeepThinkingEnabled.value,
          conversationHistory,
        }
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

watch(isSummaryEnabled, () => saveSettings());
watch(summaryProviderId, () => saveSummaryConfig());
watch(summaryModel, () => saveSummaryConfig());

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