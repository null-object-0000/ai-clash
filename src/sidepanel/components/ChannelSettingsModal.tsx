import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import { ExternalLink } from 'lucide-react';
import { Modal, Segmented, InputPassword, Select, Button, Alert } from '@lobehub/ui';
import { PROVIDER_META, getModelOptions } from '../../shared/config.js';
import { useStore } from '../store';
import { PROVIDER_NAME_MAP, type ProviderId, type ProviderMode } from '../types';

const iconMap: Record<string, { Color: React.ComponentType<{ size?: number }> }> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  longcat: LongCat,
  yuanbao: Yuanbao,
};

export default function ChannelSettingsModal() {
  const activeProviderId = useStore(s => s.activeProviderSettings);
  const modeMap = useStore(s => s.modeMap);
  const apiKeyMap = useStore(s => s.apiKeyMap);
  const modelMap = useStore(s => s.modelMap);
  const testingApiKey = useStore(s => s.testingApiKey);

  const {
    closeProviderSettings, setProviderMode, setProviderApiKey,
    setProviderModel, testApiKey,
  } = useStore.getState();

  if (!activeProviderId) return null;

  const pid = activeProviderId as ProviderId;
  const providerLabel = PROVIDER_NAME_MAP[pid] || activeProviderId;
  const meta = PROVIDER_META.find((p: any) => p.id === activeProviderId);
  const supportsApi = meta?.supportsApi ?? false;
  const mode = modeMap[pid];
  const apiKey = apiKeyMap[pid] || '';
  const model = modelMap[pid] || '';
  const modelOptions = getModelOptions(activeProviderId);
  const testing = testingApiKey[activeProviderId] ?? false;
  const apiKeyLink = meta?.apiKeyLink;
  const apiNote = meta?.apiNote;
  const IconSet = iconMap[activeProviderId];

  const modeOptions = [
    { label: '网页模式', value: 'web' },
    {
      label: !supportsApi ? 'API（暂不支持）' : !apiKey.trim() ? 'API（需先填 Key）' : 'API模式',
      value: 'api',
      disabled: !supportsApi || !apiKey.trim(),
    },
  ];

  return (
    <Modal
      open
      onCancel={closeProviderSettings}
      footer={null}
      width={520}
      title={
        <div className="flex items-center gap-2.5">
          {IconSet && <IconSet.Color size={24} />}
          <span>{providerLabel} 设置</span>
        </div>
      }
    >
      <div className="space-y-5 pt-2">
        <p className="text-[13px] text-slate-500 -mt-1">
          调整当前通道的接入模式和详细参数。
        </p>

        <div className="space-y-2">
          <div className="text-[12px] font-medium text-slate-700">接入模式</div>
          <Segmented
            block
            options={modeOptions}
            value={mode}
            onChange={(value) => setProviderMode(pid, value as ProviderMode)}
          />
        </div>

        {supportsApi && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold text-slate-700">API 配置</div>
              <div className="text-[11px] text-slate-400">可用于接入模式及总结功能</div>
            </div>

            {apiNote && (
              <Alert type="warning" message={apiNote} variant="outlined" />
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
                <InputPassword
                  value={apiKey}
                  onChange={(e) => setProviderApiKey(pid, e.target.value)}
                  placeholder="输入 API Key"
                  style={{ flex: 1 }}
                  visibilityToggle
                />
              </div>
            </div>

            <Button
              onClick={() => testApiKey(activeProviderId, apiKey)}
              loading={testing}
              disabled={!apiKey}
              size="small"
            >
              测试 Key
            </Button>

            <div className="space-y-2">
              <label className="text-[12px] font-medium text-slate-700">模型</label>
              <Select
                value={model || undefined}
                options={modelOptions}
                onChange={(value) => setProviderModel(pid, value)}
                style={{ width: '100%' }}
                placeholder="选择模型"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
