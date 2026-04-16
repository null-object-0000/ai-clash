import { ExportOutlined } from '@ant-design/icons';
import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao, XiaomiMiMo, Wenxin } from '@lobehub/icons';
import { Alert, Button, Drawer, Input, Modal, Segmented, Select } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import { PROVIDER_META, getModelOptions, getDefaultModel } from '../../shared/config.js';
import { useStore } from '../store';
import { PROVIDER_NAME_MAP, type ProviderId, type ProviderMode } from '../types';

const NARROW_THRESHOLD = 500;

const { Password } = Input;

const iconMap: Record<string, { Color: React.ComponentType<{ size?: number }> }> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  yuanbao: Yuanbao,
  wenxin: Wenxin,
  longcat: LongCat,
  xiaomi: { Color: XiaomiMiMo },
};

const useStyles = createStyles(({ token, css }) => ({
  titleRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  subtitle: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
    margin-bottom: 20px;
  `,
  section: css`
    margin-bottom: 20px;
  `,
  sectionLabel: css`
    font-size: 13px;
    font-weight: 500;
    color: ${token.colorText};
    margin-bottom: 8px;
  `,
  apiCard: css`
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-radius: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorFillQuaternary};
    padding: 16px;
  `,
  apiCardHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  apiCardTitle: css`
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  apiCardHint: css`
    font-size: 11px;
    color: ${token.colorTextQuaternary};
  `,
  fieldRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  fieldLabel: css`
    font-size: 12px;
    font-weight: 500;
    color: ${token.colorText};
  `,
  apiKeyLink: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: ${token.colorPrimary};
    transition: color 0.2s;
    &:hover {
      color: ${token.colorPrimaryHover};
    }
  `,
}));

export default function ChannelSettingsDrawer() {
  const { styles } = useStyles();
  const activeProviderId = useStore(s => s.activeProviderSettings);
  const modeMap = useStore(s => s.modeMap);
  const apiKeyMap = useStore(s => s.apiKeyMap);
  const modelMap = useStore(s => s.modelMap);
  const testingApiKey = useStore(s => s.testingApiKey);
  const apiKeyTestResult = useStore(s => s.apiKeyTestResult);

  const {
    closeProviderSettings, setProviderMode, setProviderApiKey,
    setProviderModel, testApiKey,
  } = useStore.getState();

  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < NARROW_THRESHOLD);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < NARROW_THRESHOLD);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
  const testResult = apiKeyTestResult[activeProviderId];
  const apiKeyLink = meta?.apiKeyLink;
  const apiNote = meta?.apiNote;
  const IconSet = iconMap[activeProviderId];

  const modeOptions = [
    { label: '网页模式', value: 'web' },
    {
      label: !supportsApi ? 'API（暂不支持）' : !apiKey.trim() ? 'API（需填 Key）' : 'API 模式',
      value: 'api',
      disabled: !supportsApi || !apiKey.trim(),
    },
  ];

  const titleNode = (
    <div className={styles.titleRow}>
      {IconSet && <IconSet.Color size={22} />}
      <span>{providerLabel} 设置</span>
    </div>
  );

  const contentNode = (
    <>
      <div className={styles.subtitle}>
        调整当前通道的接入模式和详细参数。
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>接入模式</div>
        <Segmented
          block
          options={modeOptions}
          value={mode}
          onChange={(value) => setProviderMode(pid, value as ProviderMode)}
        />
      </div>

      {supportsApi && (
        <div className={styles.apiCard}>
          <div className={styles.apiCardHeader}>
            <span className={styles.apiCardTitle}>API 配置</span>
            <span className={styles.apiCardHint}>可用于接入及总结</span>
          </div>

          {apiNote && (
            <Alert type="warning" message={apiNote} showIcon />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>API Key</label>
              {apiKeyLink && (
                <a
                  href={apiKeyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.apiKeyLink}
                >
                  获取 Key <ExportOutlined style={{ fontSize: 11 }} />
                </a>
              )}
            </div>
            <Password
              value={apiKey}
              onChange={(e) => setProviderApiKey(pid, e.target.value)}
              placeholder="输入 API Key"
              allowClear
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                onClick={() => testApiKey(activeProviderId, apiKey)}
                loading={testing}
                disabled={!apiKey}
                size="small"
              >
                测试 Key
              </Button>
              {testResult && (
                <span style={{
                  fontSize: 12,
                  color: testResult.success ? '#52c41a' : '#ff4d4f',
                }}>
                  {testResult.message}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className={styles.fieldLabel}>模型</label>
              <Select
                value={model || getDefaultModel(activeProviderId)}
                options={modelOptions}
                onChange={(value) => setProviderModel(pid, value)}
                style={{ width: '100%' }}
                placeholder="选择模型"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isNarrow) {
    return (
      <Drawer
        open
        onClose={closeProviderSettings}
        placement="bottom"
        size="65vh"
        title={titleNode}
        styles={{ wrapper: { borderRadius: '16px 16px 0 0' } }}
      >
        {contentNode}
      </Drawer>
    );
  }

  return (
    <Modal
      open
      onCancel={closeProviderSettings}
      title={titleNode}
      footer={null}
      width={480}
      centered
    >
      {contentNode}
    </Modal>
  );
}
