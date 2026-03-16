import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import { Info, ExternalLink, X } from 'lucide-react';
import type { ProviderMode } from '../types';

const iconMap: Record<string, { Color: React.ComponentType<{ size?: number }> }> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  longcat: LongCat,
  yuanbao: Yuanbao,
};

export interface ChannelSettingsModalProps {
  activeProviderId: string | null;
  providerLabel: string;
  mode: ProviderMode;
  supportsApi: boolean;
  apiKey: string;
  model: string;
  modelOptions: Array<{ value: string; label: string }>;
  showApiKey: boolean;
  testing: boolean;
  apiKeyTestResult: { success: boolean; message: string } | null;
  apiKeyLink?: string;
  apiNote?: string;
  onClose: () => void;
  onUpdateMode: (mode: ProviderMode) => void;
  onUpdateApiKey: (value: string) => void;
  onUpdateModel: (value: string) => void;
  onToggleShowApiKey: () => void;
  onTestApiKey: () => void;
}

export default function ChannelSettingsModal({
  activeProviderId,
  providerLabel,
  mode,
  supportsApi,
  apiKey,
  model,
  modelOptions,
  showApiKey,
  testing,
  apiKeyTestResult,
  apiKeyLink,
  apiNote,
  onClose,
  onUpdateMode,
  onUpdateApiKey,
  onUpdateModel,
  onToggleShowApiKey,
  onTestApiKey,
}: ChannelSettingsModalProps) {
  if (!activeProviderId) return null;

  const IconSet = iconMap[activeProviderId];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
        aria-label="关闭通道设置弹窗"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.5)]">
        <div className="border-b border-slate-200/80 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              {IconSet && <IconSet.Color size={24} />}
              <div>
                <div className="text-[18px] font-semibold tracking-[-0.02em] text-slate-900">
                  {providerLabel} 设置
                </div>
                <p className="mt-1 text-[13px] leading-6 text-slate-500">
                  这里调整当前通道的接入模式和详细参数。
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:text-slate-700"
              onClick={onClose}
              aria-label="关闭当前通道设置"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            <div className="text-[12px] font-medium text-slate-700">接入模式</div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                <input
                  type="radio"
                  name={`provider-mode-${activeProviderId}`}
                  className="h-3.5 w-3.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  checked={mode === 'web'}
                  onChange={() => onUpdateMode('web')}
                />
                <span>网页模式</span>
              </label>
              <label
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] ${
                  !supportsApi || !apiKey.trim()
                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                    : 'cursor-pointer border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name={`provider-mode-${activeProviderId}`}
                  className="h-3.5 w-3.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  disabled={!supportsApi || !apiKey.trim()}
                  checked={mode === 'api'}
                  onChange={() => onUpdateMode('api')}
                />
                <span>
                  {!supportsApi
                    ? 'API模式暂不支持'
                    : !apiKey.trim()
                      ? 'API模式（需先填写 Key）'
                      : 'API模式'}
                </span>
              </label>
            </div>
          </div>

          {supportsApi && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-slate-700">API 配置</div>
                <div className="text-[11px] text-slate-400">可用于接入模式及总结功能</div>
              </div>
              {apiNote && (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  <Info className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>{apiNote}</span>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-medium text-slate-700">API Key</label>
                  {apiKeyLink && (
                    <a
                      href={apiKeyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      前往获取 API Key
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => onUpdateApiKey(e.target.value)}
                    placeholder="输入 API Key"
                    className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-[13px] text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                  <button
                    type="button"
                    onClick={onToggleShowApiKey}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
                  >
                    {showApiKey ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onTestApiKey}
                  disabled={testing || !apiKey}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-indigo-50 px-3 text-[12px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {testing ? '测试中...' : '测试 Key'}
                </button>
                {apiKeyTestResult && (
                  <span
                    className={`text-[11px] ${
                      apiKeyTestResult.success ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {apiKeyTestResult.message}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-medium text-slate-700">模型</label>
                <select
                  value={model}
                  onChange={(e) => onUpdateModel(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                >
                  {modelOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
