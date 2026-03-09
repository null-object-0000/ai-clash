export const MSG_TYPES = {
    // Content Script -> Background（请求在页面 MAIN world 注入 hook，payload 含 provider）
    INJECT_HOOK: 'INJECT_HOOK',

    // UI -> Background
    DISPATCH_TASK: 'DISPATCH_TASK',

    // Background -> Content Script
    EXECUTE_PROMPT: 'EXECUTE_PROMPT',

    // Content Script -> UI (双向通信)
    CHUNK_RECEIVED: 'CHUNK_RECEIVED',
    TASK_COMPLETED: 'TASK_COMPLETED',
    ERROR: 'ERROR'
};