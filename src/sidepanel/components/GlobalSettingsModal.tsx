import React from 'react';
import { Flex, Modal, Select, Switch } from 'antd';
import { useStore } from '../store';

interface Props {
  open: boolean;
  onClose: () => void;
}

const GlobalSettingsModal: React.FC<Props> = ({ open, onClose }) => {
  const isDebugEnabled = useStore(s => s.isDebugEnabled);
  const summaryProviderId = useStore(s => s.summaryProviderId);
  const summaryModel = useStore(s => s.summaryModel);

  const {
    toggleDebug, setSummaryProviderId, setSummaryModel,
  } = useStore.getState();

  const summaryProviderOptions = useStore.getState().getSummaryProviderOptions();
  const summaryModelOptions = useStore.getState().getSummaryModelOptions();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="全局设置"
      footer={null}
      width={400}
      centered
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
              onChange={setSummaryProviderId}
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
