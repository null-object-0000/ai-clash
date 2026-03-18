import {
  AppstoreAddOutlined,
  CloudUploadOutlined,
  CommentOutlined,
  CopyOutlined,
  DislikeOutlined,
  LikeOutlined,
  OpenAIFilled,
  PaperClipOutlined,
  PlusOutlined,
  ProductOutlined,
  ReloadOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import type { AttachmentsProps, BubbleListProps, ConversationItemType } from '@ant-design/x';
import {
  Attachments,
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Suggestion,
  Think,
  Welcome,
} from '@ant-design/x';
import { BubbleListRef } from '@ant-design/x/es/bubble';
import XMarkdown, { type ComponentProps } from '@ant-design/x-markdown';
import type { DefaultMessageInfo, SSEFields, XModelMessage } from '@ant-design/x-sdk';
import {
  DeepSeekChatProvider,
  useXChat,
  useXConversations,
  XModelParams,
  XModelResponse,
  XRequest,
} from '@ant-design/x-sdk';
import { Button, Drawer, Flex, GetProp, GetRef, message } from 'antd';
import { createStyles } from 'antd-style';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';

const DEFAULT_CONVERSATIONS_ITEMS: ConversationItemType[] = [
  { key: '5', label: '新会话', group: '今天' },
  { key: '4', label: 'Ant Design X 有哪些升级？', group: '今天' },
  { key: '3', label: '新的 AGI 混合界面', group: '今天' },
  { key: '2', label: '如何快速安装和导入组件？', group: '昨天' },
  { key: '1', label: '什么是 Ant Design X？', group: '昨天' },
];

const HISTORY_MESSAGES: Record<string, DefaultMessageInfo<XModelMessage>[]> = {
  '5': [
    { message: { role: 'user', content: '新会话' }, status: 'success' },
    {
      message: {
        role: 'assistant',
        content: '你好，我是 Ant Design X！基于 Ant Design，AGI 产品界面解决方案，创造更智能的视觉体验~',
      },
      status: 'success',
    },
  ],
  '4': [
    { message: { role: 'user', content: 'Ant Design X 有哪些升级？' }, status: 'success' },
    {
      message: { role: 'assistant', content: 'RICH 设计范式 \n [查看详情](/docs/spec/introduce-cn})' },
      status: 'success',
    },
  ],
  '3': [
    { message: { role: 'user', content: '新的 AGI 混合界面' }, status: 'success' },
    {
      message: {
        role: 'assistant',
        content: `# 快速安装和导入组件 \n\n \`npm install @ant-design/x --save \` \n\n [查看详情](/components/introduce-cn/)\n\n \n\n## 导入方式 \n\n \`\`\`tsx \n\n import { Bubble } from '@ant-design/x';\n\n \`\`\`\n\n ## 组件使用 \n\n \`\`\`tsx\n\n import React from 'react';\n\nimport { Bubble } from '@ant-design/x';\n\nconst App: React.FC = () => ( \n\n \n\n \n\n \n\n );\n\n export default App;`,
      },
      status: 'success',
    },
  ],
  '2': [
    { message: { role: 'user', content: '如何快速安装和导入组件？' }, status: 'success' },
    {
      message: {
        role: 'assistant',
        content:
          "Ant Design X 提供了丰富的组件库。安装很简单：`npm install @ant-design/x --save`。然后你可以导入需要的组件，比如：`import { Bubble, Sender, Conversations } from '@ant-design/x'`。每个组件都有详细的文档和示例。",
      },
      status: 'success',
    },
  ],
  '1': [
    { message: { role: 'user', content: '什么是 Ant Design X？' }, status: 'success' },
    {
      message: {
        role: 'assistant',
        content:
          '什么是 Ant Design X？ 它是基于 Ant Design 的 AGI 产品界面解决方案，专为 AI 时代设计的 React 组件库。包含了对话、气泡、发送器等核心组件，帮助开发者快速构建智能对话界面。',
      },
      status: 'success',
    },
  ],
};

const MOCK_SUGGESTIONS = [
  { label: '写报告', value: 'report' },
  { label: '画图', value: 'draw' },
  {
    label: '查看知识',
    value: 'knowledge',
    icon: <OpenAIFilled />,
    children: [
      { label: '关于 React', value: 'react' },
      { label: '关于 Ant Design', value: 'antd' },
    ],
  },
];

const MOCK_QUESTIONS = [
  'Ant Design X 有哪些升级？',
  'Ant Design X 中有哪些组件？',
  '如何快速安装和导入组件？',
];

const useStyles = createStyles(({ token, css }) => {
  return {
    copilotChat: css`
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      background: ${token.colorBgContainer};
      color: ${token.colorText};
    `,
    floatingToolbar: css`
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 6px;
    `,
    floatingBtn: css`
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: ${token.colorTextSecondary};
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      font-size: 15px;

      &:hover {
        color: ${token.colorPrimary};
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }
    `,
    floatingBtnWithText: css`
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 0 12px;
      height: 32px;
      width: auto;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: ${token.colorTextSecondary};
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;

      &:hover {
        color: ${token.colorPrimary};
        background: rgba(255, 255, 255, 0.95);
        border-color: ${token.colorPrimaryBorder};
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }

      .anticon {
        font-size: 14px;
      }
    `,
    conversations: css`
      width: 100%;
      .ant-conversations-list {
        padding-inline-start: 0;
      }
    `,
    chatList: css`
      padding-block-start: 48px;
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      flex-direction: column;
    `,
    chatWelcome: css`
      margin-inline: ${token.margin}px;
      padding: 12px 16px;
      border-radius: 2px 12px 12px 12px;
      background: ${token.colorBgTextHover};
      margin-bottom: ${token.margin}px;
    `,
    loadingMessage: css`
      background-image: linear-gradient(90deg, #ff6b23 0%, #af3cb8 31%, #53b6ff 89%);
      background-size: 100% 2px;
      background-repeat: no-repeat;
      background-position: bottom;
    `,
    chatSend: css`
      flex-shrink: 0;
      padding: ${token.padding}px;
    `,
    speechButton: css`
      font-size: 18px;
      color: ${token.colorText} !important;
    `,
  };
});

const ThinkComponent = React.memo((props: ComponentProps) => {
  const [title, setTitle] = React.useState('深度思考中...');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (props.streamStatus === 'done') {
      setTitle('深度思考完成');
      setLoading(false);
    }
  }, [props.streamStatus]);

  return (
    <Think title={title} loading={loading}>
      {props.children}
    </Think>
  );
});

/**
 * 🔔 Please replace the BASE_URL, MODEL with your own values.
 */
const providerCaches = new Map<string, DeepSeekChatProvider>();
const providerFactory = (conversationKey: string) => {
  if (!providerCaches.get(conversationKey)) {
    providerCaches.set(
      conversationKey,
      new DeepSeekChatProvider({
        request: XRequest<XModelParams, Partial<Record<SSEFields, XModelResponse>>>(
          'https://api.x.ant.design/api/big_model_glm-4.5-flash',
          {
            manual: true,
            params: {
              stream: true,
              thinking: {
                type: 'disabled',
              },
              model: 'glm-4.5-flash',
            },
          },
        ),
      }),
    );
  }
  return providerCaches.get(conversationKey);
};

const role: BubbleListProps['role'] = {
  assistant: {
    placement: 'start',
    footer: (
      <div style={{ display: 'flex' }}>
        <Button type="text" size="small" icon={<ReloadOutlined />} />
        <Button type="text" size="small" icon={<CopyOutlined />} />
        <Button type="text" size="small" icon={<LikeOutlined />} />
        <Button type="text" size="small" icon={<DislikeOutlined />} />
      </div>
    ),
    contentRender(content: string) {
      const newContent = content.replace(/\n\n/g, '<br/><br/>');
      return (
        <XMarkdown
          content={newContent}
          components={{
            think: ThinkComponent,
          }}
        />
      );
    },
  },
  user: { placement: 'end' },
};

const App = () => {
  const { styles } = useStyles();
  const attachmentsRef = useRef<GetRef<typeof Attachments>>(null);

  // ==================== State ====================
  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    getConversation,
    setConversation,
  } = useXConversations({
    defaultConversations: DEFAULT_CONVERSATIONS_ITEMS,
    defaultActiveConversationKey: DEFAULT_CONVERSATIONS_ITEMS[0].key,
  });
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [files, setFiles] = useState<GetProp<AttachmentsProps, 'items'>>([]);

  const [inputValue, setInputValue] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const listRef = useRef<BubbleListRef>(null);

  // ==================== Runtime ====================

  const { onRequest, messages, isRequesting, abort } = useXChat({
    provider: providerFactory(activeConversationKey),
    conversationKey: activeConversationKey,
    defaultMessages: HISTORY_MESSAGES[activeConversationKey] || [],
    requestPlaceholder: () => ({
      content: '暂无数据',
      role: 'assistant',
    }),
    requestFallback: (_, { error, errorInfo, messageInfo }) => {
      if (error.name === 'AbortError') {
        return {
          content: messageInfo?.message?.content || '请求已中止',
          role: 'assistant',
        };
      }
      return {
        content: errorInfo?.error?.message || '请求失败，请重试！',
        role: 'assistant',
      };
    },
  });

  // ==================== Event ====================
  const handleUserSubmit = (val: string) => {
    onRequest({
      messages: [{ role: 'user', content: val }],
    });
    listRef.current?.scrollTo({ top: 'bottom' });

    const conversation = getConversation(activeConversationKey);
    if (conversation?.label === '新会话') {
      setConversation(activeConversationKey, { ...conversation, label: val?.slice(0, 20) });
    }
  };

  const onPasteFile = (files: FileList) => {
    for (const file of files) {
      attachmentsRef.current?.upload(file);
    }
    setAttachmentsOpen(true);
  };

  // ==================== Nodes ====================
  const chatHeader = (
    <>
      <div className={styles.floatingToolbar}>
        <button
          className={styles.floatingBtnWithText}
          title="新对话"
          onClick={() => {
            if (messages?.length) {
              const timeNow = dayjs().valueOf().toString();
              addConversation({ key: timeNow, label: '新会话', group: '今天' });
              setActiveConversationKey(timeNow);
            } else {
              message.error('当前已经是新会话');
            }
          }}
        >
          <PlusOutlined />
        </button>
        <button
          className={styles.floatingBtn}
          title="历史记录"
          onClick={() => setHistoryOpen(true)}
        >
          <CommentOutlined />
        </button>
      </div>
      <Drawer
        title="历史记录"
        placement="right"
        width="85%"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <Conversations
          items={conversations?.map((i) =>
            i.key === activeConversationKey ? { ...i, label: `[当前] ${i.label}` } : i,
          )}
          activeKey={activeConversationKey}
          groupable
          onActiveChange={(key) => {
            setActiveConversationKey(key);
            setHistoryOpen(false);
          }}
          styles={{ item: { padding: '0 8px' } }}
          className={styles.conversations}
        />
      </Drawer>
    </>
  );
  const chatList = (
    <div className={styles.chatList}>
      {messages?.length ? (
        <Bubble.List
          ref={listRef}
          style={{ paddingInline: 16 }}
          items={messages?.map((i) => ({
            ...i.message,
            key: i.id,
            status: i.status,
            loading: i.status === 'loading',
          }))}
          role={role}
        />
      ) : (
        <>
          <Welcome
            variant="borderless"
            title="👋 你好，我是 Ant Design X"
            description="基于 Ant Design，AGI 产品界面解决方案，创造更智能的视觉体验~"
            className={styles.chatWelcome}
          />

          <Prompts
            vertical
            title="我可以帮助："
            items={MOCK_QUESTIONS.map((i) => ({ key: i, description: i }))}
            onItemClick={(info) => handleUserSubmit(info?.data?.description as string)}
            style={{ marginInline: 16 }}
            styles={{ title: { fontSize: 14 } }}
          />
        </>
      )}
    </div>
  );
  const sendHeader = (
    <Sender.Header
      title="上传文件"
      styles={{ content: { padding: 0 } }}
      open={attachmentsOpen}
      onOpenChange={setAttachmentsOpen}
      forceRender
    >
      <Attachments
        ref={attachmentsRef}
        beforeUpload={() => false}
        items={files}
        onChange={({ fileList }) => setFiles(fileList)}
        placeholder={(type) =>
          type === 'drop'
            ? { title: '将文件拖到此处' }
            : {
                icon: <CloudUploadOutlined />,
                title: '上传文件',
                description: '点击或将文件拖到此处上传',
              }
        }
      />
    </Sender.Header>
  );
  const chatSender = (
    <Flex vertical gap={12} className={styles.chatSend}>
      <Flex gap={12} align="center">
        <Button
          icon={<ScheduleOutlined />}
          onClick={() => handleUserSubmit('Ant Design X 有哪些升级？')}
        >
          升级
        </Button>
        <Button
          icon={<ProductOutlined />}
          onClick={() => handleUserSubmit('Ant Design X 中有哪些组件？')}
        >
          组件
        </Button>
        <Button icon={<AppstoreAddOutlined />}>更多</Button>
      </Flex>
      <Suggestion items={MOCK_SUGGESTIONS} onSelect={(itemVal) => setInputValue(`[${itemVal}]:`)}>
        {({ onTrigger, onKeyDown }) => (
          <Sender
            loading={isRequesting}
            value={inputValue}
            onChange={(v) => {
              onTrigger(v === '/');
              setInputValue(v);
            }}
            onSubmit={() => {
              handleUserSubmit(inputValue);
              setInputValue('');
            }}
            onCancel={() => {
              abort();
            }}
            allowSpeech
            placeholder="提问或输入 / 使用技能"
            onKeyDown={onKeyDown}
            header={sendHeader}
            prefix={
              <Button
                type="text"
                icon={<PaperClipOutlined style={{ fontSize: 18 }} />}
                onClick={() => setAttachmentsOpen(!attachmentsOpen)}
              />
            }
            onPasteFile={onPasteFile}
          />
        )}
      </Suggestion>
    </Flex>
  );

  return (
    <div className={styles.copilotChat}>
      {chatHeader}
      {chatList}
      {chatSender}
    </div>
  );
};

export default App;
