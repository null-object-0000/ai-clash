import { SettingOutlined } from '@ant-design/icons';
import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao, XiaomiMiMo } from '@lobehub/icons';
import { Button, Switch, Tag } from 'antd';
import { createStyles } from 'antd-style';
import { PROVIDER_META } from '../../shared/config.js';
import { useStore } from '../store';
import type { ProviderId } from '../types';
import React from 'react';

type IconWithColor = { Color: React.ComponentType<{ size?: number; className?: string }> };
const iconMap: Record<string, IconWithColor> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  yuanbao: Yuanbao,
  longcat: LongCat,
  xiaomi: { Color: XiaomiMiMo },
};

const useStyles = createStyles(({ token, css }) => ({
  wrapper: css`
    border-radius: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    margin-inline: ${token.margin}px;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    padding: 10px 16px;
  `,
  headerTitle: css`
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    transition: background 0.2s;
    &:not(:last-child) {
      border-bottom: 1px solid ${token.colorBorderSecondary};
    }
    &:hover {
      background: ${token.colorBgTextHover};
    }
  `,
  iconWrap: css`
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  nameArea: css`
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  providerName: css`
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
  `,
  modeTag: css`
    font-size: 11px;
  `,
  actions: css`
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  `,
  actionBtn: css`
    font-size: 12px;
    padding: 0 4px;
    height: auto;
  `,
}));

export default function ChannelList() {
  const { styles } = useStyles();
  const enabledMap = useStore(s => s.enabledMap);
  const modeMap = useStore(s => s.modeMap);
  const apiKeyMap = useStore(s => s.apiKeyMap);
  const testingApiKey = useStore(s => s.testingApiKey);
  const { toggleProvider, goToProvider, openProviderSettings, testApiKey } = useStore.getState();

  const enabledCount = Object.values(enabledMap).filter(v => v).length;

  // summarizer 是内置总结服务，不在常规通道列表中显示
  const visibleProviders = PROVIDER_META.filter((p: any) => p.id !== 'summarizer');

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>通道列表</span>
        <Tag>{enabledCount} 个已启用</Tag>
      </div>
      {visibleProviders.map((provider: any) => {
        const pid = provider.id as ProviderId;
        const Icon = iconMap[provider.id];
        const enabled = enabledMap[pid];
        const modeValue = modeMap[pid];
        const isApi = modeValue === 'api';
        const apiKey = apiKeyMap[pid] || '';
        const testing = testingApiKey[provider.id] ?? false;

        return (
          <div key={provider.id} className={styles.row}>
            <div className={styles.iconWrap}>
              {Icon && <Icon.Color size={20} />}
            </div>
            <div className={styles.nameArea}>
              <span className={styles.providerName}>{provider.name}</span>
            </div>
            <div className={styles.actions}>
              <Tag className={styles.modeTag}>{isApi ? 'API' : '网页'}</Tag>
              {isApi ? (
                <Button
                  size="small"
                  type="link"
                  onClick={() => testApiKey(provider.id, apiKey)}
                  loading={testing}
                  disabled={!apiKey}
                  className={styles.actionBtn}
                >
                  测试
                </Button>
              ) : (
                <Button
                  size="small"
                  type="link"
                  onClick={() => goToProvider(provider.id)}
                  className={styles.actionBtn}
                >
                  前往
                </Button>
              )}
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => openProviderSettings(pid)}
                className={styles.actionBtn}
              />
              <Switch
                checked={enabled}
                onChange={() => toggleProvider(provider.id)}
                size="small"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
