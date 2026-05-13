import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  DownloadOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Flex, Modal, Select, Switch, Tag } from 'antd';
import pkg from '../../../package.json';
import { useStore } from '../store';
import { getDefaultModel } from '../../shared/config.js';

interface Props {
  open: boolean;
  onClose: () => void;
  sidebarWidth?: number;
}

type ChannelStatus = 'published' | 'reviewing' | 'preview' | 'deprecated';
type InstallChannel = 'chrome' | 'edge' | 'manual';

interface ReleaseChannel {
  label: string;
  version: string;
  pendingVersion?: string;
  status: ChannelStatus;
  url: string;
  note?: string;
}

interface ReleaseFeed {
  schemaVersion: number;
  updatedAt: string;
  recommended: 'store' | 'github';
  changelogUrl: string;
  channels: {
    chrome?: ReleaseChannel;
    edge?: ReleaseChannel;
    github?: ReleaseChannel;
  };
}

const RELEASE_FEED_URLS = [
  'https://ai-clash.snewbie.site/releases.json',
  'https://null-object-0000.github.io/ai-clash/releases.json',
  'https://raw.githubusercontent.com/null-object-0000/ai-clash/main/docs/public/releases.json',
];

const DEFAULT_CHANGELOG_URL = 'https://ai-clash.snewbie.site/changelog.html';

function compareVersions(a: string, b: string) {
  const left = a.split('.').map(n => Number.parseInt(n, 10) || 0);
  const right = b.split('.').map(n => Number.parseInt(n, 10) || 0);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function getInstalledVersion() {
  return chrome.runtime?.getManifest?.().version || pkg.version;
}

function getInstallChannel(): InstallChannel {
  const runtimeId = chrome.runtime?.id || '';
  if (runtimeId === 'ggngmgpjdklmkpoldbfahmeefpnfhhai') return 'chrome';
  if (runtimeId === 'khjmihaeihajagobgbdhlbjeobdpmfkm') return 'edge';
  const updateUrl = chrome.runtime?.getManifest?.().update_url || '';
  try {
    const hostname = new URL(updateUrl).hostname.toLowerCase();
    const isAllowedHost = (allowedHost: string) =>
      hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
    if (isAllowedHost('clients2.google.com')) return 'chrome';
    if (isAllowedHost('edge.microsoft.com')) return 'edge';
  } catch {
    // Ignore invalid update_url and fall back to manual channel.
  }
  return 'manual';
}

function openExternalUrl(url: string) {
  if (chrome.tabs?.create) {
    chrome.tabs.create({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function getStatusTag(status: ChannelStatus) {
  if (status === 'published') return <Tag color="green">已发布</Tag>;
  if (status === 'reviewing') return <Tag color="gold">审核中</Tag>;
  if (status === 'preview') return <Tag color="blue">先行版</Tag>;
  return <Tag>已停用</Tag>;
}

const GlobalSettingsModal: React.FC<Props> = ({ open, onClose, sidebarWidth = 0 }) => {
  const isDebugEnabled = useStore(s => s.isDebugEnabled);
  const summaryProviderId = useStore(s => s.summaryProviderId);
  const summaryModel = useStore(s => s.summaryModel);
  const summaryCustomPrompt = useStore(s => s.summaryCustomPrompt);
  const [releaseFeed, setReleaseFeed] = useState<ReleaseFeed | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  const {
    toggleDebug, setSummaryProviderId, setSummaryModel,
    setSummaryCustomPrompt, resetSummaryPrompt,
  } = useStore.getState();

  const summaryProviderOptions = useStore.getState().getSummaryProviderOptions();
  const summaryModelOptions = useStore.getState().getSummaryModelOptions();

  const handleProviderChange = (value: string) => {
    // 切换通道时自动设置默认模型
    const defaultModel = getDefaultModel(value as any);
    setSummaryProviderId(value);
    setSummaryModel(defaultModel);
  };

  const installedVersion = getInstalledVersion();
  const installChannel = getInstallChannel();

  const loadReleaseFeed = useCallback(async () => {
    setReleaseLoading(true);
    setReleaseError('');

    for (const url of RELEASE_FEED_URLS) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as ReleaseFeed;
        if (!data?.channels) throw new Error('Invalid release feed');
        setReleaseFeed(data);
        setReleaseLoading(false);
        return;
      } catch {
        // 继续尝试下一个镜像地址
      }
    }

    setReleaseLoading(false);
    setReleaseError('暂时无法获取版本信息');
  }, []);

  useEffect(() => {
    if (open && !releaseFeed && !releaseLoading) {
      loadReleaseFeed();
    }
  }, [loadReleaseFeed, open, releaseFeed, releaseLoading]);

  const versionSummary = useMemo(() => {
    const github = releaseFeed?.channels.github;
    const storeChannel = installChannel === 'edge'
      ? releaseFeed?.channels.edge
      : releaseFeed?.channels.chrome;

    if (!releaseFeed) {
      return {
        icon: <InfoCircleOutlined />,
        text: releaseError || '正在获取渠道版本信息...',
        tone: '#666',
      };
    }

    if (installChannel === 'manual') {
      if (github && compareVersions(installedVersion, github.version) < 0) {
        return {
          icon: <DownloadOutlined />,
          text: `官网先行版 v${github.version} 可手动下载安装`,
          tone: '#1677ff',
        };
      }
      return {
        icon: <CheckCircleOutlined />,
        text: '当前已是最新先行版',
        tone: '#389e0d',
      };
    }

    if (storeChannel && compareVersions(installedVersion, storeChannel.version) < 0) {
      return {
        icon: <CloudSyncOutlined />,
        text: `${storeChannel.label} 有新版 v${storeChannel.version}`,
        tone: '#1677ff',
      };
    }

    if (github && compareVersions(installedVersion, github.version) < 0) {
      return {
        icon: <InfoCircleOutlined />,
        text: `商店版已是最新，官网先行版 v${github.version} 已发布`,
        tone: '#d48806',
      };
    }

    return {
      icon: <CheckCircleOutlined />,
      text: '当前已是最新版本',
      tone: '#389e0d',
    };
  }, [installChannel, installedVersion, releaseError, releaseFeed]);

  // 计算弹框宽度：侧边栏宽度超过 500px 时随动，最小 400px，最大 800px
  const modalWidth = sidebarWidth > 500
    ? Math.max(400, Math.min(sidebarWidth - 100, 800))
    : 400;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="全局设置"
      footer={null}
      width={modalWidth}
      centered
      maskClosable={false}  // 禁用点击遮罩关闭
      keyboard={false}  // 禁用 ESC 键关闭
    >
      <Flex vertical gap={20} style={{ paddingTop: 8 }}>
        <Flex vertical gap={10}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>归纳总结配置</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            选择用于归纳总结的 AI 通道和模型，需先在对应通道中配置 API Key。
          </div>
          <Flex vertical gap={8}>
            <Select
              value={summaryProviderId || undefined}
              options={summaryProviderOptions}
              onChange={handleProviderChange}
              placeholder="选择总结通道"
              style={{ width: '100%' }}
              notFoundContent="请先在通道设置中配置 API Key"
            />
            <Select
              value={summaryModel || undefined}
              options={summaryModelOptions}
              onChange={setSummaryModel}
              placeholder="选择模型"
              style={{ width: '100%' }}
              disabled={!summaryProviderId}
            />
          </Flex>
        </Flex>

        <Flex vertical gap={10}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>自定义总结提示词</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            定制归纳总结的风格和输出格式，AI 们的回答会自动附加在提示词之后。
          </div>
          <Flex vertical gap={8}>
            <textarea
              value={summaryCustomPrompt}
              onChange={(e) => setSummaryCustomPrompt(e.target.value)}
              placeholder="输入自定义总结提示词..."
              rows={12}
              style={{
                width: 'calc(100% - 16px)',
                padding: '8px 12px',
                fontSize: 13,
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <Flex justify="flex-end">
              <Button
                size="small"
                onClick={resetSummaryPrompt}
              >
                恢复默认提示词
              </Button>
            </Flex>
          </Flex>
        </Flex>

        <Flex justify="space-between" align="center">
          <Flex vertical gap={2}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>调试模式</span>
            <span style={{ fontSize: 12, color: '#999' }}>开启后在控制台输出详细日志</span>
          </Flex>
          <Switch checked={isDebugEnabled} onChange={toggleDebug} size="small" />
        </Flex>

        <Flex vertical gap={12} style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Flex justify="space-between" align="center">
            <Flex vertical gap={4}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>关于 / 版本更新</span>
              <span style={{ fontSize: 12, color: versionSummary.tone, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {versionSummary.icon}
                {versionSummary.text}
              </span>
            </Flex>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={releaseLoading}
              onClick={loadReleaseFeed}
            >
              检查更新
            </Button>
          </Flex>

          <Flex vertical gap={8}>
            <Flex justify="space-between" align="center" style={{ fontSize: 12 }}>
              <span style={{ color: '#666' }}>当前安装版本</span>
              <Tag bordered={false}>v{installedVersion}</Tag>
            </Flex>

            {releaseFeed?.channels.chrome && (
              <ReleaseChannelRow channel={releaseFeed.channels.chrome} installedVersion={installedVersion} />
            )}
            {releaseFeed?.channels.edge && (
              <ReleaseChannelRow channel={releaseFeed.channels.edge} installedVersion={installedVersion} />
            )}
            {releaseFeed?.channels.github && (
              <ReleaseChannelRow channel={releaseFeed.channels.github} installedVersion={installedVersion} />
            )}
          </Flex>

          {releaseError && (
            <div style={{ fontSize: 12, color: '#d48806' }}>
              {releaseError}，可直接打开更新日志查看。
            </div>
          )}

          <Flex gap={8} wrap="wrap">
            <Button
              size="small"
              icon={<ExportOutlined />}
              onClick={() => openExternalUrl(releaseFeed?.changelogUrl || DEFAULT_CHANGELOG_URL)}
            >
              查看更新日志
            </Button>
            {releaseFeed?.channels.github && (
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => openExternalUrl(releaseFeed.channels.github!.url)}
              >
                下载先行版
              </Button>
            )}
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
};

function ReleaseChannelRow({ channel, installedVersion }: { channel: ReleaseChannel; installedVersion: string }) {
  const isNewer = compareVersions(installedVersion, channel.version) < 0;

  return (
    <Flex
      justify="space-between"
      align="center"
      gap={10}
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: '8px 10px',
        minWidth: 0,
      }}
    >
      <Flex vertical gap={3} style={{ minWidth: 0, flex: 1 }}>
        <Flex align="center" gap={6} wrap="wrap">
          <span style={{ fontSize: 12, fontWeight: 500 }}>{channel.label}</span>
          {getStatusTag(channel.status)}
          {isNewer && <Tag color="blue">可更新</Tag>}
        </Flex>
        <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {channel.note || (channel.pendingVersion ? `v${channel.pendingVersion} 等待发布` : '渠道版本信息')}
        </span>
      </Flex>
      <Button
        size="small"
        type="text"
        onClick={() => openExternalUrl(channel.url)}
        style={{ flexShrink: 0, paddingInline: 6 }}
      >
        v{channel.version}
      </Button>
    </Flex>
  );
}

export default GlobalSettingsModal;
