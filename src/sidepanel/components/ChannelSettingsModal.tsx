import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import { ExportOutlined } from '@ant-design/icons';
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
      <div style={{ gap: 20, paddingTop: 8 }}>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: -4 }}>
          调整当前通道的接入模式和详细参数。
        </p>

        <div style={{ gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>接入模式</div>
          <Segmented
            block
            options={modeOptions}
            value={mode}
            onChange={(value) => setProviderMode(pid, value as ProviderMode)}
          />
        </div>

        {supportsApi && (
          <div style={{
            gap: 16, borderRadius: 16, border: '1px solid #e2e8f0',
            background: 'rgba(248, 250, 252, 0.7)', padding: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>API 配置</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>可用于接入模式及总结功能</div>
            </div>

            {apiNote && (
              <Alert type="warning" message={apiNote} variant="outlined" />
            )}

            <div style={{ gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>API Key</label>
                {apiKeyLink && (
                  <a
                    href={apiKeyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, color: '#6366f1', transition: 'color 0.2s'
                    }}
                  >
                    前往获取 API Key
                    <ExportOutlined style={{ fontSize: 12 }} />
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

            <div style={{ gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>模型</label>
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
