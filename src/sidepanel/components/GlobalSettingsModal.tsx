import React from 'react';
import { Button, Flex, Modal, Select, Switch } from 'antd';
import { useStore } from '../store';
import { getDefaultModel } from '../../shared/config.js';

interface Props {
  open: boolean;
  onClose: () => void;
  sidebarWidth?: number;
}

const GlobalSettingsModal: React.FC<Props> = ({ open, onClose, sidebarWidth = 0 }) => {
  const isDebugEnabled = useStore(s => s.isDebugEnabled);
  const summaryProviderId = useStore(s => s.summaryProviderId);
  const summaryModel = useStore(s => s.summaryModel);
  const summaryCustomPrompt = useStore(s => s.summaryCustomPrompt);

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
      </Flex>
    </Modal>
  );
};

export default GlobalSettingsModal;
