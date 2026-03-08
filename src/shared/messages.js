export const MSG_TYPES = {
    // UI -> Background
    DISPATCH_TASK: 'DISPATCH_TASK',

    // Background -> Content Script
    EXECUTE_PROMPT: 'EXECUTE_PROMPT',

    // Content Script -> UI (双向通信)
    CHUNK_RECEIVED: 'CHUNK_RECEIVED',
    TASK_COMPLETED: 'TASK_COMPLETED',
    ERROR: 'ERROR'
};