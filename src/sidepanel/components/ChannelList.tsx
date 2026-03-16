import { DeepSeek, Doubao, Qwen, LongCat, Yuanbao } from '@lobehub/icons';
import { Avatar, Button, Tag } from '@lobehub/ui';
import { Settings } from 'lucide-react';

type IconWithColor = { Color: React.ComponentType<{ size?: number; className?: string }> };
const iconMap: Record<string, IconWithColor> = {
  deepseek: DeepSeek,
  doubao: Doubao,
  qianwen: Qwen,
  longcat: LongCat,
  yuanbao: Yuanbao,
};

export interface ChannelListProps {
  providerMeta: ReadonlyArray<{ id: string; name: string }>;
  isEnabled: (id: string) => boolean;
  getModeText: (id: string) => string;
  getModeValue: (id: string) => string;
  onViewHistory: () => void;
  onOpenSettings: (id: string) => void;
  onToggle: (id: string) => void;
  onGo: (id: string) => void;
}

export default function ChannelList({
  providerMeta,
  isEnabled,
  getModeText,
  getModeValue,
  onViewHistory,
  onOpenSettings,
  onToggle,
  onGo,
}: ChannelListProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div className="text-[12px] font-semibold text-slate-700">通道列表</div>
        <Button type="text" size="small" onClick={onViewHistory} style={{ fontSize: 11, padding: '0 4px' }}>
          查看历史
        </Button>
      </div>

      <div className="divide-y divide-slate-100">
        {providerMeta.map((provider) => {
          const Icon = iconMap[provider.id];
          const enabled = isEnabled(provider.id);
          const modeValue = getModeValue(provider.id);

          return (
            <div key={provider.id} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2">
                  {Icon && (
                    <Avatar
                      avatar={<Icon.Color size={16} />}
                      size={24}
                      shape="circle"
                      style={{ flexShrink: 0 }}
                    />
                  )}
                  <span className="text-[13px] font-medium text-slate-800">{provider.name}</span>
                  <Tag size="small">{getModeText(provider.id)}模式</Tag>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {modeValue === 'web' && (
                    <Button type="primary" size="small" onClick={() => onGo(provider.id)} style={{ fontSize: 11 }}>
                      前往
                    </Button>
                  )}
                  <Button
                    type="text"
                    size="small"
                    icon={Settings}
                    onClick={() => onOpenSettings(provider.id)}
                    style={{ fontSize: 11 }}
                  >
                    设置
                  </Button>
                  <button
                    type="button"
                    onClick={() => onToggle(provider.id)}
                    className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                      enabled ? 'bg-indigo-500' : 'bg-slate-300'
                    }`}
                    role="switch"
                    aria-checked={enabled}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
