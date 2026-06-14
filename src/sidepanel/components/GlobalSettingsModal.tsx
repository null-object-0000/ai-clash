import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import CloudSyncOutlined from '@ant-design/icons/CloudSyncOutlined';
import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
import ExportOutlined from '@ant-design/icons/ExportOutlined';
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Flex, Modal, Select, Switch, Tag } from 'antd';
import pkg from '../../../package.json';
import { useStore } from '../store';
import type { AppLocale } from '../store/types';
import { getDefaultModel } from '../../shared/config.js';
import { getSidepanelText, interpolate, resolveLocale, type SidepanelText } from '../i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  sidebarWidth?: number;
}

type ChannelStatus = 'published' | 'reviewing' | 'preview' | 'deprecated';
type InstallChannel = 'chrome' | 'edge' | 'manual';
type ReleaseLocale = 'zh-CN' | 'en';
type LocalizedText = Partial<Record<ReleaseLocale, string>>;

interface ReleaseChannel {
  label: string;
  labels?: LocalizedText;
  version: string;
  pendingVersion?: string;
  status: ChannelStatus;
  url: string;
  note?: string;
  notes?: LocalizedText;
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

function getStatusTag(status: ChannelStatus, text: SidepanelText) {
  if (status === 'published') return <Tag color="green">{text.settings.published}</Tag>;
  if (status === 'reviewing') return <Tag color="gold">{text.settings.reviewing}</Tag>;
  if (status === 'preview') return <Tag color="blue">{text.settings.preview}</Tag>;
  return <Tag>{text.settings.deprecated}</Tag>;
}

function getLocalizedText(values: LocalizedText | undefined, fallback: string | undefined, locale: AppLocale) {
  const effectiveLocale = resolveLocale(locale);
  return values?.[effectiveLocale] || values?.['zh-CN'] || fallback || '';
}

function isOfflinePackageChannel(channel: ReleaseChannel) {
  const lowerLabel = channel.label.toLowerCase();
  if (lowerLabel.includes('github') || channel.url.includes('/downloads/') || channel.url.endsWith('.zip')) {
    return true;
  }
  return false;
}

function getChannelLabel(channel: ReleaseChannel, text: SidepanelText, locale: AppLocale) {
  const effectiveLocale = resolveLocale(locale);
  const localizedLabel = channel.labels?.[effectiveLocale] || channel.labels?.['zh-CN'];
  if (localizedLabel) return localizedLabel;
  if (isOfflinePackageChannel(channel)) {
    return text.settings.offlinePackage;
  }
  return channel.label;
}

function getChannelNote(channel: ReleaseChannel, text: SidepanelText, locale: AppLocale) {
  const localizedNote = getLocalizedText(channel.notes, channel.note, locale);
  if (localizedNote) return localizedNote;

  const label = getChannelLabel(channel, text, locale);
  if (channel.status === 'published') {
    return interpolate(text.settings.publishedStoreNote, { channel: label, version: channel.version });
  }
  if (channel.status === 'reviewing') {
    const version = channel.pendingVersion || channel.version;
    return interpolate(text.settings.reviewingStoreNote, { channel: label, version });
  }
  if (channel.status === 'preview') {
    return interpolate(text.settings.previewPackageNote, { version: channel.version });
  }
  return text.settings.deprecatedChannelNote;
}

const GlobalSettingsModal: React.FC<Props> = ({ open, onClose, sidebarWidth = 0 }) => {
  const isDebugEnabled = useStore(s => s.isDebugEnabled);
  const isAnalyticsEnabled = useStore(s => s.isAnalyticsEnabled);
  const locale = useStore(s => s.locale);
  const text = getSidepanelText(locale);
  const summaryProviderId = useStore(s => s.summaryProviderId);
  const summaryModel = useStore(s => s.summaryModel);
  const summaryCustomPrompt = useStore(s => s.summaryCustomPrompt);
  const [releaseFeed, setReleaseFeed] = useState<ReleaseFeed | null>(null);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  const {
    toggleDebug, toggleAnalytics, setLocale, setSummaryProviderId, setSummaryModel,
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
    setReleaseError(text.settings.releaseFetchFailed);
  }, [text]);

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
        text: releaseError || text.settings.releaseFetching,
        tone: '#666',
      };
    }

    if (installChannel === 'manual') {
      if (github && compareVersions(installedVersion, github.version) < 0) {
        return {
          icon: <DownloadOutlined />,
          text: interpolate(text.settings.manualUpdate, { version: github.version }),
          tone: '#1677ff',
        };
      }
      return {
        icon: <CheckCircleOutlined />,
        text: text.settings.latestPreview,
        tone: '#389e0d',
      };
    }

    if (storeChannel && compareVersions(installedVersion, storeChannel.version) < 0) {
      return {
        icon: <CloudSyncOutlined />,
        text: interpolate(text.settings.storeUpdate, { channel: getChannelLabel(storeChannel, text, locale), version: storeChannel.version }),
        tone: '#1677ff',
      };
    }

    if (github && compareVersions(installedVersion, github.version) < 0) {
      return {
        icon: <InfoCircleOutlined />,
        text: interpolate(text.settings.storeLatestPreviewAvailable, { version: github.version }),
        tone: '#d48806',
      };
    }

    return {
      icon: <CheckCircleOutlined />,
      text: text.settings.latest,
      tone: '#389e0d',
    };
  }, [installChannel, installedVersion, locale, releaseError, releaseFeed, text]);

  // 计算弹框宽度：侧边栏宽度超过 500px 时随动，最小 400px，最大 800px
  const modalWidth = sidebarWidth > 500
    ? Math.max(400, Math.min(sidebarWidth - 100, 800))
    : 400;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={text.settings.title}
      footer={null}
      width={modalWidth}
      centered
      mask={{ closable: false }}  // 禁用点击遮罩关闭
      keyboard={false}  // 禁用 ESC 键关闭
    >
      <Flex vertical gap={20} style={{ paddingTop: 8 }}>
        <Flex vertical gap={10}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{text.settings.summaryConfig}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {text.settings.summaryConfigDesc}
          </div>
          <Flex vertical gap={8}>
            <Select
              value={summaryProviderId || undefined}
              options={summaryProviderOptions}
              onChange={handleProviderChange}
              placeholder={text.settings.summaryProviderPlaceholder}
              style={{ width: '100%' }}
              notFoundContent={text.settings.summaryProviderNotFound}
            />
            <Select
              value={summaryModel || undefined}
              options={summaryModelOptions}
              onChange={setSummaryModel}
              placeholder={text.settings.summaryModelPlaceholder}
              style={{ width: '100%' }}
              disabled={!summaryProviderId}
            />
          </Flex>
        </Flex>

        <Flex vertical gap={10}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{text.settings.customPrompt}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {text.settings.customPromptDesc}
          </div>
          <Flex vertical gap={8}>
            <textarea
              value={summaryCustomPrompt}
              onChange={(e) => setSummaryCustomPrompt(e.target.value)}
              placeholder={text.settings.customPromptPlaceholder}
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
                {text.settings.resetPrompt}
              </Button>
            </Flex>
          </Flex>
        </Flex>

        <Flex justify="space-between" align="center">
          <Flex vertical gap={2}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{text.settings.debug}</span>
            <span style={{ fontSize: 12, color: '#999' }}>{text.settings.debugDesc}</span>
          </Flex>
          <Switch checked={isDebugEnabled} onChange={toggleDebug} size="small" />
        </Flex>

        <Flex justify="space-between" align="center">
          <Flex vertical gap={2}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{text.settings.analytics}</span>
            <span style={{ fontSize: 12, color: '#999' }}>{text.settings.analyticsDesc}</span>
          </Flex>
          <Switch checked={isAnalyticsEnabled} onChange={toggleAnalytics} size="small" />
        </Flex>

        <Flex vertical gap={8}>
          <Flex vertical gap={2}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{text.settings.language}</span>
            <span style={{ fontSize: 12, color: '#999' }}>{text.settings.languageDesc}</span>
          </Flex>
          <Select
            value={locale}
            onChange={(value) => setLocale(value as AppLocale)}
            options={[
              { value: 'system', label: text.settings.system },
              { value: 'zh-CN', label: text.settings.zhCN },
              { value: 'en', label: text.settings.en },
            ]}
            style={{ width: '100%' }}
          />
        </Flex>

        <Flex vertical gap={12} style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Flex justify="space-between" align="center">
            <Flex vertical gap={4}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{text.settings.about}</span>
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
              {text.settings.checkUpdate}
            </Button>
          </Flex>

          <Flex vertical gap={8}>
            <Flex justify="space-between" align="center" style={{ fontSize: 12 }}>
              <span style={{ color: '#666' }}>{text.settings.installedVersion}</span>
              <Tag variant="filled">v{installedVersion}</Tag>
            </Flex>

            {releaseFeed?.channels.chrome && (
              <ReleaseChannelRow channel={releaseFeed.channels.chrome} installedVersion={installedVersion} text={text} locale={locale} />
            )}
            {releaseFeed?.channels.edge && (
              <ReleaseChannelRow channel={releaseFeed.channels.edge} installedVersion={installedVersion} text={text} locale={locale} />
            )}
            {releaseFeed?.channels.github && (
              <ReleaseChannelRow channel={releaseFeed.channels.github} installedVersion={installedVersion} text={text} locale={locale} />
            )}
          </Flex>

          {releaseError && (
            <div style={{ fontSize: 12, color: '#d48806' }}>
              {releaseError}, {text.settings.openChangelogFallback}
            </div>
          )}

          <Flex gap={8} wrap="wrap">
            <Button
              size="small"
              icon={<ExportOutlined />}
              onClick={() => openExternalUrl(releaseFeed?.changelogUrl || DEFAULT_CHANGELOG_URL)}
            >
              {text.settings.changelog}
            </Button>
            {releaseFeed?.channels.github && (
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => openExternalUrl(releaseFeed.channels.github!.url)}
              >
                {text.settings.downloadPreview}
              </Button>
            )}
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
};

function ReleaseChannelRow({ channel, installedVersion, text, locale }: { channel: ReleaseChannel; installedVersion: string; text: SidepanelText; locale: AppLocale }) {
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
          <span style={{ fontSize: 12, fontWeight: 500 }}>{getChannelLabel(channel, text, locale)}</span>
          {getStatusTag(channel.status, text)}
          {isNewer && <Tag color="blue">{text.settings.updatable}</Tag>}
        </Flex>
        <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getChannelNote(channel, text, locale)}
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
