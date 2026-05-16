import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, Drawer, Empty, Grid, Input, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { BookOutlined, CloseOutlined, SendOutlined, SyncOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ProductWikiSource, productWikiApi } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

interface WikiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ProductWikiSource[];
}

interface WikiStreamState {
  content: string;
  sources: ProductWikiSource[];
}

const defaultQuestions = [
  '这个产品有哪些核心模块？',
  '知识库问答是怎么接入智能体的？',
  '有哪些后端接口可以调用？',
];

const ProductWikiFloat: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const authToken = useAuthStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<WikiChatMessage[]>([]);
  const [streaming, setStreaming] = useState<WikiStreamState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [indexCount, setIndexCount] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    productWikiApi.overview()
      .then((overview) => setIndexCount(overview.documentCount))
      .catch(() => setIndexCount(null));
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const canSend = useMemo(() => inputValue.trim().length > 0 && !isLoading, [inputValue, isLoading]);

  const sendQuestion = async (question?: string) => {
    const content = (question ?? inputValue).trim();
    if (!content || isLoading) return;

    const userMessage: WikiChatMessage = {
      id: `wiki-user-${Date.now()}`,
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setStreaming({ content: '', sources: [] });

    let answer = '';
    let sources: ProductWikiSource[] = [];
    let buffer = '';

    try {
      const response = await fetch(productWikiApi.streamUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          question: content,
          topK: 6,
          maxDocuments: 8,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('产品 Wiki 暂时不可用');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.split('\n').find((item) => item.startsWith('data: '));
          if (!line) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;
          const event = JSON.parse(payload);
          if (event.type === 'sources' && Array.isArray(event.sources)) {
            sources = event.sources;
            setStreaming((current) => ({ content: current?.content || '', sources }));
          }
          if (event.type === 'content' && event.content) {
            answer += event.content;
            setStreaming({ content: answer, sources });
          }
          if (event.type === 'error') {
            throw new Error(event.content || '产品 Wiki 回答失败');
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `wiki-assistant-${Date.now()}`,
          role: 'assistant',
          content: answer || '产品 Wiki 暂未返回有效回答。',
          sources,
        },
      ]);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '产品 Wiki 回答失败');
      setMessages((prev) => [
        ...prev,
        {
          id: `wiki-assistant-error-${Date.now()}`,
          role: 'assistant',
          content: '我这次没有拿到产品 Wiki 的回答，请稍后再试。',
          sources,
        },
      ]);
    } finally {
      setStreaming(null);
      setIsLoading(false);
    }
  };

  const refreshWiki = async () => {
    try {
      const overview = await productWikiApi.refresh();
      setIndexCount(overview.documentCount);
      message.success('产品 Wiki 已刷新');
    } catch {
      message.error('产品 Wiki 刷新失败');
    }
  };

  const renderSources = (sources?: ProductWikiSource[]) => {
    if (!sources?.length) return null;
    return (
      <div className="product-wiki-sources">
        {sources.slice(0, 4).map((source) => (
          <Tooltip key={source.id} title={source.preview}>
            <Tag className="product-wiki-source-tag">
              {source.path}
            </Tag>
          </Tooltip>
        ))}
      </div>
    );
  };

  const renderMessage = (item: WikiChatMessage) => (
    <div key={item.id} className={`product-wiki-message product-wiki-message-${item.role}`}>
      {item.role === 'assistant' && (
        <Avatar size={28} icon={<BookOutlined />} className="product-wiki-avatar" />
      )}
      <div className="product-wiki-bubble">
        {item.role === 'assistant' ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {item.content}
          </ReactMarkdown>
        ) : (
          <Text>{item.content}</Text>
        )}
        {renderSources(item.sources)}
      </div>
    </div>
  );

  return (
    <>
      <Tooltip title="产品 Wiki">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<BookOutlined />}
          className="product-wiki-float-button"
          onClick={() => setOpen(true)}
          aria-label="产品 Wiki"
        />
      </Tooltip>

      <Drawer
        open={open}
        placement="right"
        width={isMobile ? '100%' : 440}
        onClose={() => setOpen(false)}
        closable={false}
        className="product-wiki-drawer"
        title={(
          <div className="product-wiki-drawer-title">
            <Space size={10}>
              <Avatar size={32} icon={<BookOutlined />} className="product-wiki-avatar" />
              <div>
                <Text strong>产品 Wiki</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {indexCount === null ? '正在读取索引' : `${indexCount} 份材料`}
                  </Text>
                </div>
              </div>
            </Space>
            <Space size={4}>
              <Tooltip title="刷新">
                <Button type="text" icon={<SyncOutlined />} onClick={refreshWiki} />
              </Tooltip>
              <Tooltip title="关闭">
                <Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} />
              </Tooltip>
            </Space>
          </div>
        )}
        footer={(
          <div className="product-wiki-inputbar">
            <TextArea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="问产品功能、接口、实现细节"
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={isLoading}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  sendQuestion();
                }
              }}
            />
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              disabled={!canSend}
              loading={isLoading}
              onClick={() => sendQuestion()}
              aria-label="发送"
            />
          </div>
        )}
      >
        <div className="product-wiki-chat">
          {messages.length === 0 && !streaming && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="产品百科">
              <Space wrap size={[6, 6]} className="product-wiki-prompts">
                {defaultQuestions.map((question) => (
                  <Button
                    key={question}
                    size="small"
                    onClick={() => sendQuestion(question)}
                  >
                    {question}
                  </Button>
                ))}
              </Space>
            </Empty>
          )}

          {messages.map(renderMessage)}

          {streaming && (
            <div className="product-wiki-message product-wiki-message-assistant">
              <Avatar size={28} icon={<BookOutlined />} className="product-wiki-avatar" />
              <div className="product-wiki-bubble">
                {streaming.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {streaming.content}
                  </ReactMarkdown>
                ) : (
                  <Space size={8}>
                    <Spin size="small" />
                    <Paragraph type="secondary" style={{ margin: 0 }}>检索产品 Wiki</Paragraph>
                  </Space>
                )}
                {renderSources(streaming.sources)}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </Drawer>
    </>
  );
};

export default ProductWikiFloat;
