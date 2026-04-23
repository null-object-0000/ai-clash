import { BorderOutlined, CheckSquareOutlined, DownOutlined, SettingOutlined, SwapOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Switch, Tag } from 'antd';
import { createStyles } from 'antd-style';
import React, { useEffect, useRef, useState } from 'react';
import { getProvidersByRegion } from '../../shared/config.js';
import { getProviderIcon } from '../config/providerIcons.js';
import { useStore } from '../store';
import type { ProviderId } from '../types';

const COLLAPSED_CONTENT_HEIGHT = 180;
const CHANNEL_LIST_MIN_HEIGHT = 272;

const useStyles = createStyles(({ token, css }) => ({
  wrapper: css`
    margin-inline: ${token.margin}px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  card: css`
    border-radius: 12px;
    border: 1px solid ${token.colorBorderSecondary};
    background: ${token.colorBgContainer};
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: ${CHANNEL_LIST_MIN_HEIGHT}px;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    padding: 12px 16px;
    background: ${token.colorFillAlter};
  `,
  headerTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: ${token.colorText};
  `,
  contentWrapper: css`
    overflow-y: auto;
    padding-bottom: 8px;
    scrollbar-width: thin;
    scrollbar-color: ${token.colorSplit} transparent;
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: ${token.colorSplit};
      border-radius: 3px;
      transition: background 0.2s;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: ${token.colorTextDisabled};
    }
  `,
  sectionHeader: css`
    font-size: 12px;
    font-weight: 500;
    color: ${token.colorTextTertiary};
    padding: 12px 16px 4px;
    position: sticky;
    top: 0;
    background: ${token.colorBgContainer};
    z-index: 1;
  `,
  row: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    transition: background 0.2s;
    &:hover {
      background: ${token.colorBgTextHover};
    }
  `,
  iconWrap: css`
    flex-shrink: 0;
    width: 24px;
    height: 24px;
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
    border: none;
    background: ${token.colorFillQuaternary};
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
  expandBar: css`
    display: flex;
    justify-content: center;
    padding-top: 2px;
  `,
  expandBtn: css`
    border-radius: 999px;
    padding-inline: 14px;
    font-size: 12px;
    height: 30px;
  `,
}));

export default function ChannelList() {
  const { styles } = useStyles();
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const enabledMap = useStore(s => s.enabledMap);
  const modeMap = useStore(s => s.modeMap);
  const apiKeyMap = useStore(s => s.apiKeyMap);
  const testingApiKey = useStore(s => s.testingApiKey);
  const expanded = useStore(s => s.isChannelListExpanded);
  const { toggleProvider, goToProvider, openProviderSettings, testApiKey, selectAllProviders, invertProviderSelection, setChannelListExpanded } = useStore.getState();

  const cnProviders = getProvidersByRegion('cn').filter((p: any) => p.id !== 'summarizer');
  const globalProviders = getProvidersByRegion('global').filter((p: any) => p.id !== 'summarizer');
  const allProviders = [...cnProviders, ...globalProviders];
  const enabledCount = allProviders.filter((p: any) => enabledMap[p.id as ProviderId]).length;
  const allEnabled = allProviders.length > 0 && enabledCount === allProviders.length;

  useEffect(() => {
    const checkOverflow = () => {
      const el = contentRef.current;
      if (!el) return;
      setHasOverflow(el.scrollHeight > COLLAPSED_CONTENT_HEIGHT + 4);
    };

    checkOverflow();
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    window.addEventListener('resize', checkOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
  }, [enabledMap, modeMap, apiKeyMap, testingApiKey, cnProviders.length, globalProviders.length]);

  const renderListItems = (providers: any[]) => {
    return providers.map((provider: any) => {
      const pid = provider.id as ProviderId;
      const enabled = enabledMap[pid];
      const modeValue = modeMap[pid];
      const isApi = modeValue === 'api';
      const apiKey = apiKeyMap[pid] || '';
      const testing = testingApiKey[provider.id] ?? false;
      const Icon = getProviderIcon(provider.id)!;

      return (
        <div key={provider.id} className={styles.row}>
          <div className={styles.iconWrap}>
            {Icon && React.createElement(Icon, { size: 20 })}
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
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={styles.headerTitle}>通道列表</span>
            <Tag bordered={false} color="blue">{enabledCount} 已启用</Tag>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <Button
              size="small"
              type="text"
              onClick={selectAllProviders}
              style={{ fontSize: '12px', color: '#666' }}
            >
              {allEnabled ? <><BorderOutlined /> 全不选</> : <><CheckSquareOutlined /> 全选</>}
            </Button>
            <Button
              size="small"
              type="text"
              onClick={invertProviderSelection}
              style={{ fontSize: '12px', color: '#666' }}
            >
              <><SwapOutlined /> 反选</>
            </Button>
          </div>
        </div>

        <div
          ref={contentRef}
          className={styles.contentWrapper}
          style={expanded ? undefined : { minHeight: COLLAPSED_CONTENT_HEIGHT, maxHeight: COLLAPSED_CONTENT_HEIGHT }}
        >
          {cnProviders.length > 0 && (
            <>
              <div className={styles.sectionHeader}>🇨🇳 国内原生大模型</div>
              {renderListItems(cnProviders)}
            </>
          )}

          <div className={styles.sectionHeader}>🌍 海外原生大模型</div>
          {globalProviders.length > 0 ? (
            renderListItems(globalProviders)
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.25)', fontSize: '13px' }}>
              暂无海外 AI 通道，敬请期待
              <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.75 }}>
                ChatGPT、Gemini 等即将上线
              </div>
            </div>
          )}
        </div>
      </div>

      {hasOverflow && (
        <div className={styles.expandBar}>
          <Button
            size="small"
            type="default"
            className={styles.expandBtn}
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setChannelListExpanded(!expanded)}
          >
            {expanded ? '收起通道列表' : '展开全部通道'}
          </Button>
        </div>
      )}
    </div>
  );
}
