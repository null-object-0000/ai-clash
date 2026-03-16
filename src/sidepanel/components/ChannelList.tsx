import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import { Avatar, Button, List, Tag } from '@lobehub/ui';
import { Switch } from 'antd';
import { Settings } from 'lucide-react';
import { PROVIDER_META } from '../../shared/config.js';
import { useStore } from '../store';
import type { ProviderId } from '../types';

type IconWithColor = { Color: React.ComponentType<{ size?: number; className?: string }> };
const iconMap: Record<string, IconWithColor> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  longcat: LongCat,
  yuanbao: Yuanbao,
};

export default function ChannelList() {
  const enabledMap = useStore(s => s.enabledMap);
  const modeMap = useStore(s => s.modeMap);

  const {
    setIsHistoryPanelOpen, openProviderSettings, toggleProvider, goToProvider,
  } = useStore.getState();

  const listItems = PROVIDER_META.map((provider: any) => {
    const Icon = iconMap[provider.id];
    const enabled = enabledMap[provider.id as ProviderId];
    const modeValue = modeMap[provider.id as ProviderId];
    const modeText = modeValue === 'api' ? 'API' : '网页';

    return {
      key: provider.id,
      avatar: Icon ? (
        <Avatar
          avatar={<Icon.Color size={16} />}
          size={28}
          shape="circle"
          style={{ flexShrink: 0 }}
        />
      ) : undefined,
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{provider.name}</span>
          <Tag size="small">{modeText}模式</Tag>
        </div>
      ),
      active: enabled,
      actions: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          {modeValue === 'web' && (
            <Button size="small" onClick={() => goToProvider(provider.id)} style={{ fontSize: 11 }} data-testid={`provider-goto-${provider.id}`}>
              前往
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={Settings}
            onClick={() => openProviderSettings(provider.id as ProviderId)}
            style={{ fontSize: 11 }}
            data-testid={`provider-settings-${provider.id}`}
          >
            设置
          </Button>
          <Switch
            checked={enabled}
            onChange={() => toggleProvider(provider.id)}
            size="small"
            data-testid={`provider-toggle-${provider.id}`}
          />
        </div>
      ),
      showAction: true,
    };
  });

  return (
    <div style={{
      borderRadius: 16, border: '1px solid var(--lobe-colorBorderSecondary, #e8e8e8)',
      background: 'var(--lobe-colorBgContainer, #fff)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--lobe-colorBorderSecondary, #f0f0f0)',
        padding: '10px 16px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lobe-colorText, #1f1f1f)' }}>通道列表</div>
        <Button type="text" size="small" onClick={() => setIsHistoryPanelOpen(true)} style={{ fontSize: 11, padding: '0 4px' }}>
          查看历史
        </Button>
      </div>

      <List items={listItems} />
    </div>
  );
}
