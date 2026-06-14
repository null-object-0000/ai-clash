import ExportOutlined from '@ant-design/icons/ExportOutlined';
import { Alert, Button, Drawer, Input, Modal, Segmented, Select } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useState } from 'react';
import { PROVIDER_META, getModelOptions, getDefaultModel } from '../../shared/config.js';
import { useStore } from '../store';
import { getProviderDisplayName, type ProviderId, type ProviderMode } from '../types';
import { getProviderColorIcon } from '../config/providerIcons.js';
import { getSidepanelText, resolveLocale } from '../i18n';

const NARROW_THRESHOLD = 500;

const { Password } = Input;

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
  apiKeyLinkIcon: css`
    font-size: 11px;
  `,
  apiFields: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  testRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  testResult: css`
    font-size: 12px;
  `,
  testResultSuccess: css`
    color: ${token.colorSuccess};
  `,
  testResultError: css`
    color: ${token.colorError};
  `,
  modelField: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  fullWidth: css`
    width: 100%;
  `,
  bottomDrawer: css`
    .ant-drawer-content-wrapper,
    .ant-drawer-content {
      border-radius: 16px 16px 0 0;
      overflow: hidden;
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
  const locale = useStore(s => s.locale);
  const text = getSidepanelText(locale);

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
  const providerLabel = getProviderDisplayName(pid, locale);
  const meta = PROVIDER_META.find((p: any) => p.id === activeProviderId);
  const supportsApi = meta?.supportsApi ?? false;
  const mode = modeMap[pid];
  const apiKey = apiKeyMap[pid] || '';
  const model = modelMap[pid] || '';
  const modelOptions = getModelOptions(activeProviderId, resolveLocale(locale));
  const testing = testingApiKey[activeProviderId] ?? false;
  const testResult = apiKeyTestResult[activeProviderId];
  const apiKeyLink = meta?.apiKeyLink;
  const apiNote = meta?.apiNote;
  const Icon = getProviderColorIcon(activeProviderId);

  const modeOptions = [
    { label: text.channelSettings.webMode, value: 'web' },
    {
      label: !supportsApi ? text.channelSettings.apiUnsupported : !apiKey.trim() ? text.channelSettings.apiNeedKey : text.channelSettings.apiMode,
      value: 'api',
      disabled: !supportsApi || !apiKey.trim(),
    },
  ];

  const titleNode = (
    <div className={styles.titleRow}>
      {Icon && <Icon size={22} />}
      <span>{providerLabel} {text.channelSettings.settings}</span>
    </div>
  );

  const contentNode = (
    <>
      <div className={styles.subtitle}>
        {text.channelSettings.subtitle}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>{text.channelSettings.accessMode}</div>
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
            <span className={styles.apiCardTitle}>{text.channelSettings.apiConfig}</span>
            <span className={styles.apiCardHint}>{text.channelSettings.apiHint}</span>
          </div>

          {apiNote && (
            <Alert type="warning" message={apiNote} showIcon />
          )}

          <div className={styles.apiFields}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>API Key</label>
              {apiKeyLink && (
                <a
                  href={apiKeyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.apiKeyLink}
                >
                  {text.channelSettings.getKey} <ExportOutlined className={styles.apiKeyLinkIcon} />
                </a>
              )}
            </div>
            <Password
              value={apiKey}
              onChange={(e) => setProviderApiKey(pid, e.target.value)}
              placeholder={text.channelSettings.apiKeyPlaceholder}
              allowClear
            />

            <div className={styles.testRow}>
              <Button
                onClick={() => testApiKey(activeProviderId, apiKey)}
                loading={testing}
                disabled={!apiKey}
                size="small"
              >
                {text.channelSettings.testKey}
              </Button>
              {testResult && (
                <span className={`${styles.testResult} ${testResult.success ? styles.testResultSuccess : styles.testResultError}`}>
                  {testResult.message}
                </span>
              )}
            </div>

            <div className={styles.modelField}>
              <label className={styles.fieldLabel}>{text.channelSettings.model}</label>
              <Select
                value={model || getDefaultModel(activeProviderId)}
                options={modelOptions}
                onChange={(value) => setProviderModel(pid, value)}
                className={styles.fullWidth}
                placeholder={text.channelSettings.modelPlaceholder}
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
        rootClassName={styles.bottomDrawer}
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
