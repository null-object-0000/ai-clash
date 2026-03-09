/**
 * 通道注册表 — 新增通道只需在此添加一条配置
 */

export interface ProviderConfig {
  /** 通道标识（与 sidepanel 中的 key 一致） */
  id: string;
  /** Chrome 标签页匹配模式 */
  matchPattern: string;
  /** 新建标签页时打开的 URL */
  startUrl: string;
  /** MAIN world hook 脚本路径（相对扩展根目录） */
  hookFile: string;
  /** registerContentScripts 的唯一 ID */
  hookScriptId: string;
  /** 检测 hook 是否已注入的全局变量名 */
  hookGlobalVar: string;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'deepseek',
    matchPattern: 'https://chat.deepseek.com/*',
    startUrl: 'https://chat.deepseek.com/',
    hookFile: 'src/content/deepseek/hook.js',
    hookScriptId: 'anybridge-deepseek-hook',
    hookGlobalVar: '__abHookV',
  },
  {
    id: 'doubao',
    matchPattern: 'https://www.doubao.com/*',
    startUrl: 'https://www.doubao.com/chat/',
    hookFile: 'src/content/doubao/hook.js',
    hookScriptId: 'anybridge-doubao-hook',
    hookGlobalVar: '__abDoubaoHookV',
  },
];

/** 通过 provider id 查找配置 */
export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id);
}
