import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import { ExportOutlined, SettingOutlined } from '@ant-design/icons';
import { List, Switch, Button, Tag, Avatar, Tooltip } from 'antd';
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
          style={{ backgroundColor: 'transparent' }}
          icon={<Icon.Color size={20} />}
          size={32}
          shape="circle"
        />
      ) : undefined,
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{provider.name}</span>
          <Tag style={{ fontSize: 12 }}>{modeText}模式</Tag>
        </div>
      ),
      description: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {modeValue === 'web' && (
            <Button
              size="small"
              type="link"
              onClick={() => goToProvider(provider.id)}
              style={{ padding: 0, height: 'auto', fontSize: 12 }}
            >
              前往
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => openProviderSettings(provider.id as ProviderId)}
            style={{ fontSize: 12, padding: 0, height: 'auto' }}
          >
            设置
          </Button>
        </div>
      ),
      actions: [
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            key="toggle"
            checked={enabled}
            onChange={(checked) => {
              toggleProvider(provider.id);
            }}
            size="small"
          />
        </div>
      ],
    };
  });

  return (
    <div style={{
      borderRadius: 12,
      border: '1px solid #e5e7eb',
      background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f3f4f6',
        padding: '12px 16px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f1f1f' }}>通道列表</div>
        <Button
          type="text"
          size="small"
          onClick={() => setIsHistoryPanelOpen(true)}
          style={{ fontSize: 12 }}
        >
          查看历史
        </Button>
      </div>

      <List
        itemLayout="horizontal"
        dataSource={listItems}
        renderItem={(item) => (
          <List.Item
            actions={item.actions}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f9fafb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
            }}
          >
            <List.Item.Meta
              avatar={item.avatar}
              title={item.title}
              description={item.description}
            />
          </List.Item>
        )}
      />
    </div>
  );
}
