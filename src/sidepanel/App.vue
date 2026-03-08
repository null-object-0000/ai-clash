<template>
    <div class="flex flex-col h-screen bg-gray-50 text-sm p-4">
        <h1 class="text-xl font-bold mb-4 flex items-center gap-2">
            🌉 Any AI Bridge
        </h1>

        <div class="flex-1 overflow-y-auto space-y-4">
            <div v-if="hasAsked">
                <details class="bg-white border rounded-lg shadow-sm" open>
                    <summary class="p-3 cursor-pointer text-gray-600 font-medium">
                        <span v-if="isRunning" class="animate-pulse">🧠 多平台正在思考中...</span>
                        <span v-else>✅ 思考完成</span>
                    </summary>

                    <div
                        class="p-3 border-t bg-gray-50 text-xs text-gray-600 max-h-64 overflow-y-auto whitespace-pre-wrap">
                        <div class="font-bold text-blue-600 mb-1">DeepSeek:</div>
                        <div>{{ responses.deepseek || '等待响应中...' }}</div>
                    </div>
                </details>
            </div>
        </div>

        <div class="mt-4 relative">
            <textarea v-model="inputStr" @keydown.enter.prevent="submit" placeholder="输入问题，让 AI 开始比对..."
                class="w-full border rounded-xl p-3 resize-none focus:ring-2 focus:ring-blue-500"></textarea>
            <button @click="submit" :disabled="isRunning || !inputStr"
                class="absolute right-2 bottom-2 bg-black text-white px-3 py-1 rounded">
                发送
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { MSG_TYPES } from '../shared/messages.js';

const inputStr = ref('');
const hasAsked = ref(false);
const statusMap = reactive({ deepseek: 'idle' }); // idle, running, completed, error
const responses = reactive({ deepseek: '' });

const isRunning = computed(() => Object.values(statusMap).includes('running'));

// 监听来自网页端的广播数据流
onMounted(() => {
    chrome.runtime.onMessage.addListener((request) => {
        const { provider } = request.payload || {};

        if (request.type === MSG_TYPES.CHUNK_RECEIVED) {
            responses[provider] = request.payload.text;
        }
        else if (request.type === MSG_TYPES.TASK_COMPLETED) {
            statusMap[provider] = 'completed';
            // TODO: 这里可以加逻辑判断，如果所有 provider 都 completed，就触发 API 总结
        }
        else if (request.type === MSG_TYPES.ERROR) {
            statusMap[provider] = 'error';
            responses[provider] = request.payload.message;
        }
    });
});

const submit = () => {
    if (!inputStr.value.trim() || isRunning.value) return;

    hasAsked.value = true;
    statusMap.deepseek = 'running';
    responses.deepseek = '';

    // 通知 Background 去找标签页并派发任务
    chrome.runtime.sendMessage({
        type: MSG_TYPES.DISPATCH_TASK,
        payload: { provider: 'deepseek', prompt: inputStr.value }
    });

    inputStr.value = '';
};
</script>