import {
  CloudUploadOutlined,
  CommentOutlined,
  CopyOutlined,
  DislikeOutlined,
  LikeOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { AttachmentsProps, BubbleListProps } from '@ant-design/x';
import {
  Attachments,
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Think,
  Welcome,
} from '@ant-design/x';
import { BubbleListRef } from '@ant-design/x/es/bubble';
import XMarkdown, { type ComponentProps } from '@ant-design/x-markdown';
import type { SSEFields, XModelMessage } from '@ant-design/x-sdk';
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

const WELCOME_QUESTIONS = [
  '今天天气怎么样？',
  '如何学习 React？',
  '解释一下量子计算',
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
      overflow: hidden;
      .ant-conversations-list {
        padding-inline-start: 0;
      }
      .ant-conversations-item {
        font-size: 12px;
        overflow: hidden;
        .ant-conversations-item-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
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
    defaultConversations: [{ key: 'default', label: '新会话', group: '今天' }],
    defaultActiveConversationKey: 'default',
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
    requestPlaceholder: () => ({
      content: '思考中...',
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
        placement="right"
        width="clamp(200px, 75%, 320px)"
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        closable={false}
        styles={{ body: { padding: 0, overflow: 'hidden auto' } }}
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
            title="👋 你好，我是 AI 对撞机"
            description="一个问题问多个 AI，获取最全面的答案"
            className={styles.chatWelcome}
          />

          <Prompts
            vertical
            title="试试问我："
            items={WELCOME_QUESTIONS.map((i) => ({ key: i, description: i }))}
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
    <Flex vertical className={styles.chatSend}>
      <Sender
        loading={isRequesting}
        value={inputValue}
        onChange={setInputValue}
        onSubmit={() => {
          handleUserSubmit(inputValue);
          setInputValue('');
        }}
        onCancel={() => {
          abort();
        }}
        allowSpeech
        placeholder="输入你的问题..."
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
