export const MSG_TYPES = {
    // Content Script -> Background（请求在页面 MAIN world 注入 hook，payload 含 provider）
    INJECT_HOOK: 'INJECT_HOOK',

    // UI -> Background
    DISPATCH_TASK: 'DISPATCH_TASK',
    SAVE_API_CONFIG: 'SAVE_API_CONFIG',
    GET_API_CONFIG: 'GET_API_CONFIG',
    TEST_API_KEY: 'TEST_API_KEY',
    OPEN_PROVIDER_TAB: 'OPEN_PROVIDER_TAB', // 请求打开或激活provider对应的tab
    CHECK_PROVIDER_TAB_VALID: 'CHECK_PROVIDER_TAB_VALID', // 查询provider是否有有效绑定的tab
    GET_PROVIDER_RAW_URLS: 'GET_PROVIDER_RAW_URLS', // 获取各通道当前原始链接

    // Background -> UI
    OPEN_PROVIDER_TAB_RESPONSE: 'OPEN_PROVIDER_TAB_RESPONSE', // 打开/激活tab操作响应
    CHECK_PROVIDER_TAB_VALID_RESPONSE: 'CHECK_PROVIDER_TAB_VALID_RESPONSE', // 查询tab有效性响应
    GET_PROVIDER_RAW_URLS_RESPONSE: 'GET_PROVIDER_RAW_URLS_RESPONSE', // 获取原始链接响应

    // Background -> Content Script
    EXECUTE_PROMPT: 'EXECUTE_PROMPT',

    // Background/Content Script -> UI (双向通信)
    CHUNK_RECEIVED: 'CHUNK_RECEIVED',
    TASK_COMPLETED: 'TASK_COMPLETED',
    ERROR: 'ERROR',
    TASK_STATUS_UPDATE: 'TASK_STATUS_UPDATE'
};